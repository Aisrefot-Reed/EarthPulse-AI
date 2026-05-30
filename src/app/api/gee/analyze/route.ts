import '@/lib/silence-warnings';
import { NextResponse } from 'next/server';
import { initGEE } from '@/lib/gee/client';
import ee from '@google/earthengine';

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const { bbox, dateStart, dateEnd, analysisType = 'deforestation' } = body;

    if (!bbox) return NextResponse.json({ success: false, error: 'BBox required' }, { status: 200 });

    await initGEE();
    const area = ee.Geometry.Rectangle(bbox);
    
    // 1. Fetch imagery
    const s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(area)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

    const current = s2.filterDate(dateStart || '2023-01-01', dateEnd || '2023-12-31').median();
    const baseline = s2.filterDate('2019-01-01', '2019-12-31').median();

    // 2. Specialized Analysis Logic
    let diff: any;
    let threshold = -0.2;
    let palette = ['#ef4444', '#b91c1c']; // Default Red

    switch (analysisType) {
      case 'wildfires':
        // NBR = (B8 - B12) / (B8 + B12) - Standard for burn scars
        const currentNBR = current.normalizedDifference(['B8', 'B12']);
        const baselineNBR = baseline.normalizedDifference(['B8', 'B12']);
        diff = currentNBR.subtract(baselineNBR);
        threshold = -0.15;
        palette = ['#f97316', '#7c2d12']; // Orange to Burnt
        break;

      case 'flooding':
        // NDWI = (B3 - B8) / (B3 + B8) - Standard for water
        const currentNDWI = current.normalizedDifference(['B3', 'B8']);
        const baselineNDWI = baseline.normalizedDifference(['B3', 'B8']);
        diff = currentNDWI.subtract(baselineNDWI);
        threshold = 0.2; // Increase in water
        palette = ['#0ea5e9', '#1e3a8a']; // Sky to Deep Blue
        break;

      case 'deforestation':
      default:
        const currentNDVI = current.normalizedDifference(['B8', 'B4']);
        const baselineNDVI = baseline.normalizedDifference(['B8', 'B4']);
        diff = currentNDVI.subtract(baselineNDVI);
        // Mask water out of deforestation to fix the "water noise" problem
        const waterMask = current.normalizedDifference(['B3', 'B8']).lt(0.1);
        diff = diff.updateMask(waterMask);
        threshold = -0.25;
        palette = ['#22c55e', '#15803d']; // Green (for loss visualization) -> usually shown in red/pink in professional tools
        palette = ['#ef4444', '#991b1b']; // Actually red is better for "Loss"
    }

    // 3. Noise Reduction & Vectorization
    const changeMask = analysisType === 'flooding' ? diff.gt(threshold) : diff.lt(threshold);
    const cleanedMask = changeMask.selfMask().focal_median(20, 'circle', 'meters').connectedPixelCount(50).updateMask(ee.Image(1));
    
    const vectors = cleanedMask.selfMask().reduceToVectors({
      geometry: area,
      scale: 30,
      geometryType: 'polygon',
      maxPixels: 1e7
    });

    const [mapInfo, rawGeoJSON]: [any, any] = await Promise.all([
      new Promise((resolve, reject) => {
        current.getMap({ bands: ['B4', 'B3', 'B2'], min: 0, max: 3500, gamma: 1.2 }, 
        (res: any, err: any) => err ? reject(err) : resolve(res));
      }),
      new Promise((resolve, reject) => {
        vectors.evaluate((res: any, err: any) => err ? resolve({features:[]}) : resolve(res));
      })
    ]);

    return NextResponse.json({
      success: true,
      mode: 'gee',
      data: {
        url: mapInfo.urlFormat || `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapInfo.mapid}/tiles/{z}/{x}/{y}`,
        polygons: rawGeoJSON || { type: 'FeatureCollection', features: [] },
        analysisInfo: {
          type: analysisType,
          palette: palette
        }
      },
      meta: { processingTime: Date.now() - startTime }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}
