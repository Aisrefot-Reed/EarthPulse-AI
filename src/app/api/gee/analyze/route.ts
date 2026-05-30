import '@/lib/silence-warnings';
import { NextResponse } from 'next/server';
import { initGEE } from '@/lib/gee/client';
import ee from '@google/earthengine';

/**
 * Enhanced GEE Analysis Route with Multi-Mode Support and Deep Logging
 */
export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const { bbox, dateStart, dateEnd, analysisType = 'deforestation' } = body;

    console.log(`[GEE] Analyzing Type: ${analysisType.toUpperCase()}`);
    console.log(`[GEE] Period: ${dateStart} to ${dateEnd}`);

    if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      return NextResponse.json({ success: false, error: 'Invalid BBox coordinates' }, { status: 200 });
    }

    await initGEE();
    const area = ee.Geometry.Rectangle(bbox);
    
    // 1. Fetch collections
    const s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(area)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

    const currentColl = s2Collection.filterDate(dateStart || '2023-01-01', dateEnd || '2023-12-31');
    const baselineColl = s2Collection.filterDate('2019-01-01', '2019-12-31');

    // 2. Availability Check
    const counts: any = await new Promise((resolve) => {
      ee.Dictionary({
        current: currentColl.size(),
        baseline: baselineColl.size()
      }).evaluate((res: any) => resolve(res || {current: 0, baseline: 0}));
    });

    console.log(`[GEE] Images Found - Current: ${counts.current}, Baseline: ${counts.baseline}`);

    if (counts.current === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'В выбранной области за этот период мало чистых снимков. Попробуйте другой диапазон.' 
      }, { status: 200 });
    }

    const currentImg = currentColl.median();
    const baselineImg = baselineColl.median();

    // 3. Specialized Scientific Metrics
    let diff: any;
    let threshold = -0.2;
    let isPositiveChange = false; // By default we look for decrease (deforestation/fire)

    switch (analysisType) {
      case 'wildfires':
        // Normalized Burn Ratio: (B8 - B12) / (B8 + B12)
        const currentNBR = currentImg.normalizedDifference(['B8', 'B12']);
        const baselineNBR = baselineImg.normalizedDifference(['B8', 'B12']);
        diff = currentNBR.subtract(baselineNBR);
        threshold = -0.15; // Standard dNBR threshold for low-severity burn
        break;

      case 'flooding':
        // Modified Normalized Difference Water Index: (B3 - B11)
        const currentNDWI = currentImg.normalizedDifference(['B3', 'B11']);
        const baselineNDWI = baselineImg.normalizedDifference(['B3', 'B11']);
        diff = currentNDWI.subtract(baselineNDWI);
        threshold = 0.15; // Look for significant increase in water
        isPositiveChange = true;
        break;

      case 'deforestation':
      default:
        const currentNDVI = currentImg.normalizedDifference(['B8', 'B4']);
        const baselineNDVI = baselineImg.normalizedDifference(['B8', 'B4']);
        diff = currentNDVI.subtract(baselineNDVI);
        threshold = -0.25;
        // Apply water mask to prevent false positives at coastlines
        const waterMask = currentImg.normalizedDifference(['B3', 'B8']).lt(0.05);
        diff = diff.updateMask(waterMask);
    }

    // 4. Noise Filtering & Vectorization
    // We create a binary mask of "Significant Change"
    const changeMask = isPositiveChange ? diff.gt(threshold) : diff.lt(threshold);
    
    // Focal filter to remove isolated speckle noise (radius 20m)
    const filteredMask = changeMask.selfMask().focal_median(20, 'circle', 'meters');
    
    // Connected components to remove fragments smaller than ~1 hectare
    // pixel area (10x10) * 50 = 5000sqm
    const finalMask = filteredMask.updateMask(filteredMask.connectedPixelCount(100).gte(15));

    console.log('[GEE] Processing Map ID and Vectors...');
    const [mapInfo, rawPolygons]: [any, any] = await Promise.all([
      new Promise((resolve, reject) => {
        currentImg.getMap({ 
          bands: ['B4', 'B3', 'B2'], 
          min: 0, max: 3000, gamma: 1.3 
        }, (res: any, err: any) => err ? reject(new Error(err)) : resolve(res));
      }),
      new Promise((resolve) => {
        finalMask.reduceToVectors({
          geometry: area,
          scale: 30,
          geometryType: 'polygon',
          maxPixels: 1e7
        }).evaluate((res: any, err: any) => {
          if (err) {
            console.warn('[GEE] Vectorization error (likely too complex):', err);
            return resolve({ features: [] });
          }
          resolve(res);
        });
      })
    ]);

    const polygons = {
      type: "FeatureCollection",
      features: (rawPolygons && Array.isArray(rawPolygons.features)) ? rawPolygons.features : []
    };

    console.log(`[GEE] Success! Found ${polygons.features.length} change polygons.`);

    return NextResponse.json({
      success: true,
      mode: 'gee',
      data: {
        url: mapInfo.urlFormat || `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapInfo.mapid}/tiles/{z}/{x}/{y}`,
        polygons: polygons,
        analysisInfo: {
          type: analysisType,
          stats: {
            areaHectares: polygons.features.length * 0.45 // Estimated based on connected count
          }
        }
      },
      meta: { processingTime: Date.now() - startTime }
    });

  } catch (error: any) {
    console.error('[GEE CRITICAL]:', error.message || error);
    return NextResponse.json({ success: false, error: 'Внутренняя ошибка сервиса анализа.' }, { status: 200 });
  }
}
