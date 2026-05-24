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

    const mapId = await new Promise((resolve, reject) => {
      ndvi.getMap({ min: 0, max: 1, palette: ['red', 'yellow', 'green'] }, (res: any, err: any) => {
        if (err) reject(err);
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
