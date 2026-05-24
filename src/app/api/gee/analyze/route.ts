import { NextResponse } from 'next/server';
import { initGEE } from '@/lib/gee/client';
import ee from '@google/earthengine';

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    await initGEE();
    const { bbox, dateStart, dateEnd } = await req.json();

    const area = ee.Geometry.Rectangle(bbox);
    const getS2Composite = (start: string, end: string) => {
      return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
        .filterBounds(area)
        .filterDate(start, end)
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        .median();
    };

    const before = getS2Composite(dateStart, dateEnd);
    const ndvi = before.normalizedDifference(['B8', 'B4']).rename('NDVI');

    // Robust Map ID generation
    const mapId = await new Promise((resolve, reject) => {
      ndvi.getMap({ min: 0, max: 1, palette: ['#ffffff', '#CE7E45', '#DF923D', '#F1B555', '#FCD163', '#99B718', '#74A901', '#66A000', '#529400', '#3E8601', '#207401', '#056201', '#004C00', '#023B01', '#012E01', '#011D01', '#011301'] }, (res: any, err: any) => {
        if (err) return reject(new Error(`GEE Map Error: ${err}`));
        if (!res || !res.mapid) return reject(new Error('GEE returned empty mapid'));
        resolve(res.mapid);
      });
    });

    return NextResponse.json({
      success: true,
      mode: 'gee',
      data: {
        mapId,
        url: `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapId}/tiles/{z}/{x}/{y}`
      },
      meta: { processingTime: Date.now() - startTime }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      meta: { processingTime: Date.now() - startTime }
    }, { status: 500 });
  }
}
