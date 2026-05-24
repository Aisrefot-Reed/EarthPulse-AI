import { Redis } from '@upstash/redis';
import { initGEE } from '@/lib/gee/client';
import ee from '@google/earthengine';
import { Resend } from 'resend';

export async function GET(req: Request) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

  // Verify Vercel Cron Secret to ensure only Vercel can trigger this
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await initGEE();
    const subscriptions = await redis.smembers('all_subscriptions');
    const BATCH_SIZE = 50;
    const processingList = subscriptions.slice(0, BATCH_SIZE);
    
    let processedCount = 0;
    let errorCount = 0;

    for (const subStr of processingList) {
      const sub = JSON.parse(subStr as string);
      
      // Cooldown: Only notify once every 3 days
      const cooldownKey = `alert_cooldown:${sub.id}`;
      if (await redis.get(cooldownKey)) continue;

      try {
        const area = ee.Geometry.Rectangle(sub.bbox);
        
        const getRecentNDVI = (daysAgo: number) => {
          const end = ee.Date(new Date());
          const start = end.advance(-daysAgo, 'day');
          return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(area)
            .filterDate(start, end)
            .median()
            .normalizedDifference(['B8', 'B4']);
        };

        const current = getRecentNDVI(30);
        const baseline = getRecentNDVI(365);
        
        const diff = current.subtract(baseline).abs();
        const stats = diff.reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: area,
          scale: 10,
          maxPixels: 1e8
        });

        const changeScore: number = await new Promise((resolve, reject) => {
          stats.evaluate((result: any, err: any) => {
            if (err) reject(err);
            resolve(result?.nd || 0);
          });
        });
        
        if (changeScore > 0.05) {
          await resend.emails.send({
            from: 'EarthPulse Alerts <alerts@alerts.earthpulse.ai>',
            to: sub.email,
            subject: `🚨 Change Alert for ${sub.regionName}`,
            html: `<p>Hello, Guardian!</p>
                   <p>Our AI detected a significant landscape change (<b>${(changeScore * 100).toFixed(1)}%</b>) in your adopted region: <b>${sub.regionName}</b>.</p>
                   <p><a href="https://earthpulse-ai.vercel.app/map?lat=${sub.bbox[1]}&lon=${sub.bbox[0]}">View Live Map</a></p>
                   <p><a href="https://earthpulse-ai.vercel.app/api/community/unsubscribe?id=${sub.id}&email=${sub.email}">Unsubscribe</a></p>`,
            text: `Change Alert for ${sub.regionName}: Our AI detected a ${(changeScore * 100).toFixed(1)}% change.`
          });
          await redis.set(cooldownKey, '1', { ex: 259200 }); // 3 day cooldown
        }
        processedCount++;
      } catch (err) {
        errorCount++;
        console.error(`[Cron] Failed to process sub ${sub.id}:`, err);
        // Fallback email for system failure
        await resend.emails.send({
          from: 'EarthPulse System <system@alerts.earthpulse.ai>',
          to: sub.email,
          subject: `System Update for ${sub.regionName}`,
          html: `<p>We encountered a technical issue monitoring your region. We'll try again tomorrow.</p>`,
          text: `We encountered a technical issue monitoring your region: ${sub.regionName}. We'll try again tomorrow.`
        });
      }
    }
    
    await redis.set('stats:last_cron_processed', processedCount);
    return Response.json({ success: true, processed: processedCount, errors: errorCount });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
