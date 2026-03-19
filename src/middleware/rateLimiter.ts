import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { AppError } from '../utils/AppError';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

function createRateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClient();
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `${options.keyPrefix}:${ip}`;

      const current = await redis.incr(key);
      if (current === 1) {
        await redis.pexpire(key, options.windowMs);
      }

      const ttl = await redis.pttl(key);
      const remaining = Math.max(0, options.maxRequests - current);

      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + (ttl > 0 ? ttl / 1000 : 0)));

      if (current > options.maxRequests) {
        const retryAfter = Math.ceil((ttl > 0 ? ttl : options.windowMs) / 1000);
        res.setHeader('Retry-After', retryAfter);
        throw new AppError(
          `Too many requests. Please try again in ${retryAfter} seconds.`,
          429,
          'RATE_LIMIT_EXCEEDED',
        );
      }

      next();
    } catch (err) {
      if (err instanceof AppError) {
        return next(err);
      }
      // If Redis is down, let requests through
      console.warn('[RateLimiter] Redis unavailable, skipping rate limit');
      next();
    }
  };
}

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

export const generalLimiter = createRateLimiter({
  windowMs,
  maxRequests: parseInt(process.env.RATE_LIMIT_GENERAL || '100', 10),
  keyPrefix: 'rl:general',
});

export const authLimiter = createRateLimiter({
  windowMs,
  maxRequests: parseInt(process.env.RATE_LIMIT_AUTH || '5', 10),
  keyPrefix: 'rl:auth',
});
