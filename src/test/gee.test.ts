import { describe, it, expect, vi } from 'vitest'
import { initGEE } from '@/lib/gee/client'
import ee from '@google/earthengine'

vi.mock('@google/earthengine', () => {
  return {
    default: {
      data: {
        getAuthToken: vi.fn(),
        authenticateViaPrivateKey: vi.fn((key, success) => success()),
      },
      initialize: vi.fn((a, b, success) => success()),
    }
  }
})

describe('GEE Client', () => {
  it('should initialize successfully when credentials are provided', async () => {
    process.env.GEE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      client_email: 'test@example.com',
      private_key: 'test-key'
    })
    
    const result = await initGEE()
    expect(result).toBe(true)
  })
})
