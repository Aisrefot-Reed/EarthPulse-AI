import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function middleware(request: NextRequest) {
  // Only rate limit AI inference routes
  if (request.nextUrl.pathname.startsWith('/api/ai/')) {
    const ip = (request as any).ip ?? '127.0.0.1'
    const key = `ratelimit:ai:${ip}`
    
    const count = await redis.incr(key)
    
    if (count === 1) {
      // Set expiration for 24 hours on first request
      await redis.expire(key, 86400)
    }
    
    if (count > 5) {
      return NextResponse.json(
        { error: 'Premium AI limit reached. Try again in 24 hours.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429 }
      )
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
