import { Redis } from '@upstash/redis';
import { initGEE } from '@/lib/gee/client';
import ee from '@google/earthengine';
import { Resend } from 'resend';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: Request) {
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
        // ... GEE Logic ... (Simplified for brevity in replacement)
        
        if (changeScore > 0.05) {
          await resend.emails.send({
            from: 'EarthPulse Alerts <alerts@earthpulse.ai>',
            to: sub.email,
            subject: `🚨 Change Alert for ${sub.regionName}`,
            html: `... <p><a href="https://earthpulse-ai.vercel.app/api/community/unsubscribe?id=${sub.id}&email=${sub.email}">Unsubscribe</a></p>`
          });
          await redis.set(cooldownKey, '1', { ex: 259200 }); // 3 day cooldown
        }
        processedCount++;
      } catch (err) {
        errorCount++;
        console.error(`[Cron] Failed to process sub ${sub.id}:`, err);
        // Fallback email for system failure
        await resend.emails.send({
          to: sub.email,
          subject: `System Update for ${sub.regionName}`,
          html: `<p>We encountered a technical issue monitoring your region. We'll try again tomorrow.</p>`
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
