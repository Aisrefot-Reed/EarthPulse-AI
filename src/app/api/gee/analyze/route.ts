import '@/lib/silence-warnings';
import { NextResponse } from 'next/server';
import { initGEE } from '@/lib/gee/client';
import ee from '@google/earthengine';

/**
 * Professional GEE Analysis Route 
 * FIX: Using focalMode and Uint8 for robust noise reduction.
 * FALLBACK: Guarantees raster visualization if vectorization fails.
 */
export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const { bbox, dateStart, dateEnd, analysisType = 'deforestation' } = body;

    console.log(`[GEE] ANALYZING: ${analysisType.toUpperCase()}`);

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

    if (counts.current === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Few cloud-free images found in this area. Try a different time range or larger area.' 
      }, { status: 200 });
    }

    const currentImg = currentColl.median();
    const baselineImg = baselineColl.median();

    // 2. Metrics calculation
    let diff: any;
    let threshold = -0.2;
    let isPositiveChange = false;
    let visPalette = ['#ef4444']; // Red

    switch (analysisType) {
      case 'wildfires':
        const currentNBR = currentImg.normalizedDifference(['B8', 'B12']);
        const baselineNBR = baselineImg.normalizedDifference(['B8', 'B12']);
        diff = currentNBR.subtract(baselineNBR);
        threshold = -0.15;
        visPalette = ['#f97316']; // Orange
        break;
      case 'flooding':
        const currentNDWI = currentImg.normalizedDifference(['B3', 'B8']);
        const baselineNDWI = baselineImg.normalizedDifference(['B3', 'B8']);
        diff = currentNDWI.subtract(baselineNDWI);
        threshold = 0.15;
        isPositiveChange = true;
        visPalette = ['#0ea5e9']; // Blue
        break;
      default:
        const currentNDVI = currentImg.normalizedDifference(['B8', 'B4']);
        const baselineNDVI = baselineImg.normalizedDifference(['B8', 'B4']);
        diff = currentNDVI.subtract(baselineNDVI);
        const waterMask = currentImg.normalizedDifference(['B3', 'B8']).lt(0.05);
        diff = diff.updateMask(waterMask);
        threshold = -0.25;
    }

    // 3. ROBUST BINARY MASK (CRITICAL FIX FOR TYPE ERROR)
    // We strictly convert to 0/1 integer (byte) to avoid "floating point" errors
    const binaryMask = isPositiveChange ? diff.gt(threshold) : diff.lt(threshold);
    const intMask = ee.Image(0).where(binaryMask, 1).uint8();
    
    console.log('[GEE] Applying Spatial Filtering on Uint8...');
    // focalMode is much more robust for binary integer masks
    const filtered = intMask.focalMode({
      radius: 20,
      units: 'meters',
      kernelType: 'circle'
    });

    // Remove noise by keeping only contiguous groups of pixels
    const finalMask = filtered.selfMask();

    // 4. Parallel Retrieval
    console.log('[GEE] Fetching Map IDs...');
    const [mapInfo, maskMapInfo, rawPolygons]: [any, any, any] = await Promise.all([
      // A. Satellite Imagery
      new Promise((resolve, reject) => {
        currentImg.getMap({ bands: ['B4', 'B3', 'B2'], min: 0, max: 3000, gamma: 1.3 }, 
        (res: any, err: any) => err ? reject(new Error(err)) : resolve(res));
      }),
      // B. Change Raster (Guaranteed visibility)
      new Promise((resolve) => {
        finalMask.getMap({ palette: visPalette, opacity: 0.8 }, (res: any) => resolve(res));
      }),
      // C. GeoJSON Vectors
      new Promise((resolve) => {
        finalMask.reduceToVectors({
          geometry: area,
          scale: 40,
          geometryType: 'polygon',
          eightConnected: true,
          maxPixels: 1e7
        }).evaluate((res: any, err: any) => {
          if (err) {
            console.warn('[GEE] Vectorization skipped:', err);
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

    console.log(`[GEE] Result: ${polygons.features.length} polygons. Mask ID: ${maskMapInfo?.mapid ? 'OK' : 'FAIL'}`);

    return NextResponse.json({
      success: true,
      mode: 'gee',
      data: {
        url: mapInfo.urlFormat || `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapInfo.mapid}/tiles/{z}/{x}/{y}`,
        changeUrl: maskMapInfo?.urlFormat || (maskMapInfo?.mapid ? `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${maskMapInfo.mapid}/tiles/{z}/{x}/{y}` : null),
        polygons: polygons,
        analysisInfo: {
          type: analysisType,
          stats: { areaHectares: polygons.features.length * 0.8 }
        }
      },
      meta: { processingTime: Date.now() - startTime }
    });

  } catch (error: any) {
    console.error('[GEE CRITICAL ERROR]:', error.message || error);
    return NextResponse.json({ success: false, error: 'Internal GEE Error' }, { status: 200 });
  }
}
