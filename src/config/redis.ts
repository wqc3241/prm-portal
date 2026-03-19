import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) {
          console.error('[Redis] Connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected');
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  try {
    await client.connect();
  } catch (err: any) {
    if (err.message && !err.message.includes('already connected')) {
      console.warn('[Redis] Could not connect:', err.message);
    }
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export default { getRedisClient, connectRedis, closeRedis };
