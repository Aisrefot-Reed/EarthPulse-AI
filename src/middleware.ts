import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Relaxed Rate Limiting for stability
  if (request.nextUrl.pathname.startsWith('/api/ai/')) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })

      const ip = (request as any).ip ?? '127.0.0.1'
      const key = `ratelimit:ai:${ip}`
      
      const count = await redis.incr(key)
      
      if (count === 1) {
        await redis.expire(key, 86400)
      }
      
      // Increased to 20 requests/24h to avoid annoying 429s during hackathon/testing
      if (count > 20) {
        return NextResponse.json(
          { error: 'Daily analysis limit reached (20/24h).', code: 'RATE_LIMIT_EXCEEDED' },
          { status: 429 }
        )
      }
    } catch (e) {
      // If Redis fails, don't block the request. Stability first.
      return NextResponse.next()
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
