import Redis from 'ioredis';

import { logger } from '../utils/logger';

import env from './env.config';

// Create Redis client instance
let redisClient: Redis | null = null;

// Function to initialize Redis client with loaded environment
export const initRedisClient = (): Redis => {
  if (redisClient) {
    return redisClient;
  }

  const redisConfig = {
    host: env.REDIS_HOST || 'localhost',
    port: parseInt(env.REDIS_PORT || '6379', 10),
    password: env.REDIS_PASSWORD,
    db: parseInt(env.REDIS_DB || '0', 10),
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };

  redisClient = new Redis(redisConfig);

  redisClient.on('error', error => {
    logger.error('Redis connection error:', error);
  });

  redisClient.on('connect', () => {
    logger.info('✅ Successfully connected to Redis');
  });

  return redisClient;
};

// Get the Redis client (initialize if not already initialized)
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    return initRedisClient();
  }
  return redisClient;
};

// Close the Redis client
export const closeRedisClient = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('✅ Successfully closed Redis connection');
  }
};
