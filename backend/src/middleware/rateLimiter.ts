import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number;          // Time window in milliseconds (e.g. 60000 for 1 minute)
  max: number;               // Max allowed requests per window
  message?: string;          // User-facing error message
  keyGenerator?: (req: Request) => string;
}

interface ClientBucket {
  count: number;
  resetTime: number;
}

/**
 * Lightweight in-memory rate limiter middleware.
 *
 * ARCHITECTURE & LIMITATIONS NOTICE:
 * This rate limiter stores request counts in the local Node.js process heap memory.
 * - Suitable for: Single-instance local deployments, desktop/workstation research use,
 *   and development environments without external infrastructure dependencies.
 * - Limitations: In a horizontally-scaled multi-node production cluster behind a load
 *   balancer, each process maintains its own memory bucket. For multi-node deployments,
 *   a distributed rate-limiter backed by Redis (e.g. rate-limit-redis) is required.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests. Please wait a moment before trying again.',
    keyGenerator = (req: Request) => {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
      return req.ip || req.socket.remoteAddress || '127.0.0.1';
    },
  } = options;

  const clients = new Map<string, ClientBucket>();

  // Prune expired buckets every 5 minutes to prevent memory leaks
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of clients.entries()) {
      if (now > bucket.resetTime) {
        clients.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Unref so the interval does not block process shutdown or tests
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    let bucket = clients.get(key);

    if (!bucket || now > bucket.resetTime) {
      bucket = {
        count: 1,
        resetTime: now + windowMs,
      };
      clients.set(key, bucket);
    } else {
      bucket.count++;
    }

    const remaining = Math.max(0, max - bucket.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetTime - now) / 1000));

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetTime / 1000));

    if (bucket.count > max) {
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        success: false,
        error: 'Rate Limit Exceeded',
        message: `${message} (Retry after ${retryAfterSeconds}s)`,
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

/**
 * Rate limiter for document uploads and arXiv downloads.
 * Allows up to 30 uploads per minute per client IP.
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Upload rate limit reached. Please wait before uploading additional documents.',
});

/**
 * Rate limiter for expensive AI operations (RAG synthesis, streaming, comparison, summarization).
 * Allows up to 60 requests per minute per client IP.
 */
export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'AI synthesis request limit reached. Please wait a moment before sending another query.',
});
