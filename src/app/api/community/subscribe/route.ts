import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(req: Request) {
  try {
    const { email, regionName, bbox } = await req.json();

    if (!email || !bbox) {
      return NextResponse.json({ success: false, error: 'Email and region boundaries are required.' }, { status: 400 });
    }

    // Check user quota (max 3 regions)
    const userKey = `user:${email}:subscriptions`;
    const count = await redis.scard(userKey);

    if (count >= 3) {
      return NextResponse.json({ 
        success: false, 
        error: 'Subscription limit reached (max 3 regions per user).' 
      }, { status: 403 });
    }

    const subscription = {
      id: crypto.randomUUID(),
      email,
      regionName: regionName || 'Selected Area',
      bbox,
      createdAt: new Date().toISOString()
    };

    // Store in a global list for the cron job and in the user's list
    await redis.sadd('all_subscriptions', JSON.stringify(subscription));
    await redis.sadd(userKey, subscription.id);

    return NextResponse.json({ success: true, message: 'Region adopted! You will receive alerts for significant changes.' });

  } catch (error: any) {
    console.error('Subscription error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
