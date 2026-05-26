import '@/lib/silence-warnings';
import { NextResponse } from 'next/server';
import { initGEE } from '@/lib/gee/client';
import ee from '@google/earthengine';

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

    await initGEE();

    let start = dateStart || '2023-01-01';
    let end = dateEnd || '2023-12-31';

    if (start === end) {
      const startDate = new Date(start);
      const endDate = new Date(start);
      endDate.setMonth(startDate.getMonth() + 2);
      end = endDate.toISOString().split('T')[0];
      startDate.setMonth(startDate.getMonth() - 1);
      start = startDate.toISOString().split('T')[0];
    }

    const area = ee.Geometry.Rectangle(bbox);
    
    // Base Composite
    const s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(area)
      .filterDate(start, end)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .median();

    // Change Detection Mask (Mock AI result via GEE)
    // We calculate dNDVI to show RED areas of significant change
    const currentNDVI = s2Collection.normalizedDifference(['B8', 'B4']);
    const baselineNDVI = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(area)
      .filterDate('2019-01-01', '2019-12-31')
      .median()
      .normalizedDifference(['B8', 'B4']);
    
    const changeMask = currentNDVI.subtract(baselineNDVI).lt(-0.2); // Significant drop in vegetation

    const ndviMapInfo: any = await new Promise((resolve, reject) => {
      s2Collection.getMap({ 
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 3000,
        gamma: 1.4
      }, (res: any, err: any) => {
        if (err) return reject(new Error(err));
        resolve(res);
      });
    });

    const url = `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${ndviMapInfo.mapid}/tiles/{z}/{x}/{y}`;

    // Return unified structure
    return NextResponse.json({
      success: true,
      mode: 'gee',
      data: {
        mapid: ndviMapInfo.mapid,
        url: url,
        bbox: bbox
      },
      meta: {
        processingTime: Date.now() - startTime,
        engine: 'Google Earth Engine'
      }
    });

  } catch (error: any) {
    console.error('[GEE ERROR]:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown GEE error',
      meta: { processingTime: Date.now() - startTime }
    }, { status: 200 });
  }
}
