import { NextResponse } from 'next/server';
import { initGEE } from '@/lib/gee/client';
import ee from '@google/earthengine';

/**
 * Robust GEE Analyze Endpoint
 * 1. Sanitizes inputs
 * 2. Initializes GEE singleton
 * 3. Uses a safe Promise-based map request
 */
export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const { bbox, dateStart, dateEnd } = body;

    if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or missing BBox coordinates' 
      }, { status: 400 });
    }

    // Ensure GEE is initialized
    await initGEE();

    // Date range safety: GEE filterDate is [start, end)
    // If dates are identical or missing, we create a valid range
    let start = dateStart || '2023-01-01';
    let end = dateEnd || '2023-12-31';

    if (start === end) {
      // If single day provided (Story Mode), extend by 2 months to find a cloud-free image
      const startDate = new Date(start);
      const endDate = new Date(start);
      endDate.setMonth(startDate.getMonth() + 2);
      end = endDate.toISOString().split('T')[0];
      
      // Move start back by 1 month to have a window
      startDate.setMonth(startDate.getMonth() - 1);
      start = startDate.toISOString().split('T')[0];
    }

    // Create calculation area
    const area = ee.Geometry.Rectangle(bbox);
    
    // Sentinel-2 True Color + NDVI Analysis
    const s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(area)
      .filterDate(start, end)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .median();

    // Baseline calculation (NDVI)
    const ndvi = s2Collection.normalizedDifference(['B8', 'B4']).rename('NDVI');
    
    // Convert to Map ID with a safe promise wrapper
    const mapInfo: any = await new Promise((resolve, reject) => {
      ndvi.getMap({ 
        min: 0, 
        max: 1, 
        palette: ['#ffffff', '#CE7E45', '#DF923D', '#F1B555', '#FCD163', '#99B718', '#74A901', '#66A000', '#529400', '#3E8601', '#207401', '#056201', '#004C00', '#023B01', '#012E01', '#011D01', '#011301'] 
      }, (res: any, err: any) => {
        if (err) return reject(new Error(err));
        if (!res || !res.mapid) return reject(new Error('GEE returned empty mapid'));
        resolve(res);
      });
    });

    const url = `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapInfo.mapid}/tiles/{z}/{x}/{y}`;

    return NextResponse.json({
      success: true,
      mode: 'gee',
      mapid: mapInfo.mapid,
      url: url,
      bbox: bbox,
      meta: {
        processingTime: Date.now() - startTime,
        engine: 'Google Earth Engine'
      }
    });

  } catch (error: any) {
    console.error('[GEE ERROR]:', error.message);
    
    return NextResponse.json({
      success: false,
      mode: 'fallback',
      error: error.message || 'Unknown GEE error',
      meta: { processingTime: Date.now() - startTime }
    }, { status: 200 }); // Returning 200 to let UI handle the error state gracefully
  }
}
