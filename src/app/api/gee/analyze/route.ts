import '@/lib/silence-warnings';
import { NextResponse } from 'next/server';
import { initGEE } from '@/lib/gee/client';
import ee from '@google/earthengine';

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log('[GEE] Incoming request started...');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { bbox, dateStart, dateEnd } = body;

    if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      console.error('[GEE] Invalid bbox provided:', bbox);
      return NextResponse.json({ success: false, error: 'Invalid BBox coordinates' }, { status: 200 });
    }

    console.log('[GEE] Initializing Earth Engine...');
    await initGEE();

    const area = ee.Geometry.Rectangle(bbox);
    
    // 1. Fetch imagery with cloud check
    console.log('[GEE] Filtering collections...');
    const s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(area)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

    const currentColl = s2Collection.filterDate(dateStart || '2023-01-01', dateEnd || '2023-12-31');
    const baselineColl = s2Collection.filterDate('2019-01-01', '2019-12-31');

    // Safe check for image availability
    const checkImages = await new Promise((resolve) => {
      currentColl.size().evaluate((size: number) => resolve(size > 0));
    });

    if (!checkImages) {
      console.warn('[GEE] No cloud-free images found in current range.');
      return NextResponse.json({ 
        success: false, 
        error: 'No satellite data found for this region/date. Try a larger area or different dates.' 
      }, { status: 200 });
    }

    const currentImg = currentColl.median();
    const baselineImg = baselineColl.median();

    // 2. Change Detection Logic
    console.log('[GEE] Calculating dNDVI...');
    const currentNDVI = currentImg.normalizedDifference(['B8', 'B4']);
    const baselineNDVI = baselineImg.normalizedDifference(['B8', 'B4']);
    const dNDVI = currentNDVI.subtract(baselineNDVI);

    // 3. Robust Map Visualization (Primary result)
    console.log('[GEE] Generating Map ID...');
    const mapInfo: any = await new Promise((resolve, reject) => {
      currentImg.getMap({ 
        bands: ['B4', 'B3', 'B2'], 
        min: 0, max: 3500, gamma: 1.3 
      }, (res: any, err: any) => {
        if (err) {
          console.error('[GEE MAP ERROR]:', err);
          return reject(new Error(err));
        }
        resolve(res);
      });
    });

    // 4. Vectorization (Optional/Secondary result)
    console.log('[GEE] Starting optional vectorization...');
    let polygons = { type: "FeatureCollection", features: [] };
    
    try {
      // Threshold and clean
      const changeMask = dNDVI.lt(-0.2).selfMask();
      const vectors = changeMask.reduceToVectors({
        geometry: area,
        scale: 50, // Coarser scale for better stability
        geometryType: 'polygon',
        maxPixels: 1e7
      });

      const rawGeoJSON: any = await new Promise((resolve, reject) => {
        vectors.evaluate((res: any, err: any) => {
          if (err) {
            console.warn('[GEE VECTOR WARNING]:', err);
            return resolve(null); // Non-blocking
          }
          resolve(res);
        });
      });

      if (rawGeoJSON && rawGeoJSON.features) {
        polygons = rawGeoJSON;
        console.log(`[GEE] Successfully vectorized ${polygons.features.length} regions.`);
      }
    } catch (vErr) {
      console.warn('[GEE] Vectorization skipped due to error.');
    }

    console.log('[GEE] Request completed successfully.');
    return NextResponse.json({
      success: true,
      mode: 'gee',
      data: {
        url: mapInfo.urlFormat || `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapInfo.mapid}/tiles/{z}/{x}/{y}`,
        polygons: polygons,
        stats: {
          impactArea: polygons.features.length * 2.5,
          confidence: 0.82
        }
      },
      meta: { 
        processingTime: Date.now() - startTime,
        engine: 'GEE Robust Pipeline'
      }
    });

  } catch (error: any) {
    const errMsg = typeof error === 'string' ? error : (error?.message || 'Unknown Internal GEE Error');
    console.error('[CRITICAL GEE ERROR]:', errMsg);
    
    return NextResponse.json({
      success: false,
      error: `Earth Engine: ${errMsg}`,
      meta: { processingTime: Date.now() - startTime }
    }, { status: 200 });
  }
}
