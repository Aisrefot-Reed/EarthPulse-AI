import { NextResponse } from 'next/server';
import { runPrithviInference } from '@/lib/ai/prithvi';
import { Redis } from '@upstash/redis';

export async function POST(req: Request) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  const startTime = Date.now();
  try {
    const { bbox, imageUrl, cacheKey } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: 'Missing image URL' }, { status: 400 });
    }

    // 1. Check Cache
    if (cacheKey) {
      const cached = await redis.get(`inference:${cacheKey}`);
      if (cached) {
        console.log(`[AI] Cache hit for ${cacheKey}`);
        return NextResponse.json({
          success: true,
          mode: 'prithvi',
          data: cached,
          meta: { cached: true, processingTime: Date.now() - startTime }
        });
      }
    }

    // 2. Fetch image
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error('Failed to fetch image for inference');
    const buffer = Buffer.from(await imageRes.arrayBuffer());

    // 3. Inference with 8s Timeout
    const inferencePromise = runPrithviInference(buffer);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Inference Timeout')), 8000)
    );

    const result = await Promise.race([inferencePromise, timeoutPromise]) as Float32Array;

    // 4. Standard Response
    const responseData = Array.from(result);
    if (cacheKey) {
      await redis.set(`inference:${cacheKey}`, responseData, { ex: 86400 });
    }

    console.log(`[AI] Inference successful in ${Date.now() - startTime}ms`);
    return NextResponse.json({
      success: true,
      mode: 'prithvi',
      data: responseData,
      meta: { cached: false, processingTime: Date.now() - startTime }
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`[AI] Error after ${processingTime}ms:`, error.message);
    
    if (error.message === 'Inference Timeout') {
      return NextResponse.json({
        success: false,
        mode: 'gee',
        error: 'AI timed out. Falling back to GEE Baseline.',
        meta: { processingTime }
      }, { status: 504 });
    }

    return NextResponse.json({
      success: false,
      error: error.message,
      meta: { processingTime }
    }, { status: 500 });
  }
}
