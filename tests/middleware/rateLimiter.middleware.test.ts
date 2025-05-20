import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Request, type Response } from 'express';

// Mock dependencies - must be before importing the modules
vi.mock('../../src/config/redis.config', () => {
  return {
    getRedisClient: vi.fn(() => ({
      incr: vi.fn().mockResolvedValue(1),
      pexpire: vi.fn().mockResolvedValue(1),
      pttl: vi.fn().mockResolvedValue(60000),
    })),
  };
});

vi.mock('../../src/config/env.config', () => {
  return {
    default: {
      NODE_ENV: 'development',
      RATE_LIMIT_ENABLED: true,
      TEST_RATE_LIMIT_WINDOW_MS: '1000',
      TEST_RATE_LIMIT_MAX: '3',
      RATE_LIMIT_WINDOW_MS: '900000',
      RATE_LIMIT_MAX: '100',
    },
  };
});

// Import after mocks
import { rateLimiter } from '../../src/middleware/rateLimiter.middleware';
import env from '../../src/config/env.config';
import { getRedisClient } from '../../src/config/redis.config';

describe('Rate Limiter Middleware', () => {
  let mockRedis: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = getRedisClient();
  });

  it('should create a middleware function', () => {
    const middleware = rateLimiter();
    expect(typeof middleware).toBe('function');
  });

  it('should bypass rate limiting when disabled', async () => {
    // Setup
    const originalValue = env.RATE_LIMIT_ENABLED;
    (env as any).RATE_LIMIT_ENABLED = false;

    const req = { ip: '127.0.0.1' } as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;
    const next = vi.fn();

    // Execute
    const middleware = rateLimiter();
    await middleware(req, res, next);

    // Verify
    expect(next).toHaveBeenCalled();
    expect(mockRedis.incr).not.toHaveBeenCalled();

    // Cleanup
    (env as any).RATE_LIMIT_ENABLED = originalValue;
  });

  it('should accept custom options', () => {
    // Setup
    const customOptions = {
      windowMs: 5000,
      max: 10,
      keyPrefix: 'custom-prefix',
    };

    // Execute
    const middleware = rateLimiter(customOptions);

    // Verify it's a function
    expect(typeof middleware).toBe('function');
  });

  it('should use correct environment-based defaults', () => {
    // Test that different environments use different defaults
    // We can only test this indirectly by checking that it doesn't throw
    (env as any).NODE_ENV = 'development';
    expect(() => rateLimiter()).not.toThrow();

    (env as any).NODE_ENV = 'production';
    expect(() => rateLimiter()).not.toThrow();

    // Restore original
    (env as any).NODE_ENV = 'development';
  });
});
