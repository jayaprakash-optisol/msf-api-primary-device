import { type NextFunction, type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import env from '../config/env.config';
import { getRedisClient } from '../config/redis.config';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max number of requests per window
  keyPrefix?: string; // Prefix for Redis keys
}

// Set defaults based on environment
const getDefaultOptions = (): RateLimitOptions => {
  if (env.NODE_ENV === 'development') {
    return {
      windowMs: parseInt(env.TEST_RATE_LIMIT_WINDOW_MS, 10), // 1 second for testing
      max: parseInt(env.TEST_RATE_LIMIT_MAX, 10), // 3 requests per window for testing
      keyPrefix: 'test-rate-limit',
    };
  }

  return {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10), // 15 minutes default
    max: parseInt(env.RATE_LIMIT_MAX, 10), // 100 requests per window default
    keyPrefix: 'rate-limit',
  };
};

export const rateLimiter = (
  options: RateLimitOptions = getDefaultOptions(),
): ((req: Request, res: Response, next: NextFunction) => void) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if rate limiting is enabled (it's a boolean value from env.config.ts)
    if (env.RATE_LIMIT_ENABLED === false) {
      return next();
    }

    const key = `${options.keyPrefix}:${req.ip}`;
    const redis = getRedisClient();

    redis
      .incr(key)
      .then(current => {
        if (current === 1) {
          redis.pexpire(key, options.windowMs);
        }

        return redis.pttl(key).then(ttl => {
          res.setHeader('X-RateLimit-Limit', options.max);
          res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - current));
          res.setHeader('X-RateLimit-Reset', Math.ceil(ttl / 1000));

          if (current > options.max) {
            return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
              error: 'Too many requests, please try again later.',
              retryAfter: Math.ceil(ttl / 1000),
            });
          }

          next();
        });
      })
      .catch(error => {
        console.error('Rate limiter error:', error);
        // If Redis is down, allow the request to proceed
        next();
      });
  };
};
