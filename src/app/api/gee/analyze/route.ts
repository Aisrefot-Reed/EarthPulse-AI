import '@/lib/silence-warnings';
import { NextResponse } from 'next/server';
import { initGEE } from '@/lib/gee/client';
import ee from '@google/earthengine';

/**
 * Robust GEE Analysis Route 
 * FIX: Explicit type casting for connectedPixelCount support.
 * FALLBACK: Raster mapId for heatmap if vectors fail.
 */
export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const { bbox, dateStart, dateEnd, analysisType = 'deforestation' } = body;

    console.log(`[GEE] Analyzing Type: ${analysisType.toUpperCase()}`);

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

    const counts: any = await new Promise((resolve) => {
      ee.Dictionary({
        current: currentColl.size(),
        baseline: baselineColl.size()
      }).evaluate((res: any) => resolve(res || {current: 0, baseline: 0}));
    });

    console.log(`[GEE] Images Found: ${counts.current}`);

    if (counts.current === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'В выбранной области мало снимков без облаков. Попробуйте другой период.' 
      }, { status: 200 });
    }

    const currentImg = currentColl.median();
    const baselineImg = baselineColl.median();

    // 2. Analysis Metrics
    let diff: any;
    let threshold = -0.2;
    let isPositiveChange = false;
    let visPalette = ['#ef4444']; // Red

    switch (analysisType) {
      case 'wildfires':
        diff = currentImg.normalizedDifference(['B8', 'B12']).subtract(baselineImg.normalizedDifference(['B8', 'B12']));
        threshold = -0.15;
        visPalette = ['#f97316']; // Orange
        break;
      case 'flooding':
        diff = currentImg.normalizedDifference(['B3', 'B11']).subtract(baselineImg.normalizedDifference(['B3', 'B11']));
        threshold = 0.15;
        isPositiveChange = true;
        visPalette = ['#0ea5e9']; // Blue
        break;
      default:
        const dNDVI = currentImg.normalizedDifference(['B8', 'B4']).subtract(baselineImg.normalizedDifference(['B8', 'B4']));
        const waterMask = currentImg.normalizedDifference(['B3', 'B8']).lt(0.05);
        diff = dNDVI.updateMask(waterMask);
        threshold = -0.25;
    }

    // 3. CREATE ROBUST INTEGER MASK (CRITICAL FIX)
    const baseMask = isPositiveChange ? diff.gt(threshold) : diff.lt(threshold);
    // Convert to uint8 (0 or 1) to support connectedPixelCount
    const intMask = baseMask.toUint8().selfMask();
    
    console.log('[GEE] Applying spatial filters to Integer Band...');
    const filteredMask = intMask.focal_median(20, 'circle', 'meters');
    const finalMask = filteredMask.updateMask(filteredMask.connectedPixelCount(100).gte(15));

    // 4. Parallel Processing: Base Map, Raster Mask, and Vectors
    console.log('[GEE] Requesting Map IDs and optional Vectorization...');
    const [mapInfo, maskMapInfo, rawPolygons]: [any, any, any] = await Promise.all([
      // A. Base Satellite Imagery
      new Promise((resolve, reject) => {
        currentImg.getMap({ bands: ['B4', 'B3', 'B2'], min: 0, max: 3000, gamma: 1.3 }, 
        (res: any, err: any) => err ? reject(new Error(err)) : resolve(res));
      }),
      // B. Raster Mask (Always returned as fallback heatmap)
      new Promise((resolve) => {
        finalMask.getMap({ palette: visPalette, opacity: 0.7 }, (res: any) => resolve(res));
      }),
      // C. Optional Vectors
      new Promise((resolve) => {
        finalMask.reduceToVectors({
          geometry: area,
          scale: 30,
          geometryType: 'polygon',
          maxPixels: 1e7
        }).evaluate((res: any, err: any) => {
          if (err) {
            console.warn('[GEE] Vectorization error skipped:', err);
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

    console.log(`[GEE] Analysis finished. Polygons: ${polygons.features.length}. Mask URL: ${!!maskMapInfo?.mapid}`);

    return NextResponse.json({
      success: true,
      mode: 'gee',
      data: {
        url: mapInfo.urlFormat || `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapInfo.mapid}/tiles/{z}/{x}/{y}`,
        changeUrl: maskMapInfo?.urlFormat || (maskMapInfo?.mapid ? `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${maskMapInfo.mapid}/tiles/{z}/{x}/{y}` : null),
        polygons: polygons,
        analysisInfo: {
          type: analysisType,
          stats: { areaHectares: polygons.features.length * 0.45 }
        }
      },
      meta: { processingTime: Date.now() - startTime }
    });

  } catch (error: any) {
    console.error('[GEE CRITICAL]:', error.message || error);
    return NextResponse.json({ success: false, error: 'Ошибка сервера GEE.' }, { status: 200 });
  }
}
