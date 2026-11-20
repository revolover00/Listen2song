import type { Request, RequestHandler } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  limit?: number;
  windowMs?: number;
  maxKeys?: number;
  now?: () => number;
}

const DEFAULT_LIMIT = 15;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_KEYS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000;
const TOO_MANY_REQUESTS =
  "Too many requests. Try again later. / لقد تجاوزت حد الطلبات المسموح به، حاول مرة أخرى لاحقاً.";

function clientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Best-effort, per-process rate limiting for a single Node instance.
 * The store is bounded and expired entries are removed opportunistically;
 * use a shared store (e.g. Redis) for a multi-instance production deployment.
 */
export function createInMemoryRateLimiter(options: RateLimiterOptions = {}): RequestHandler {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();
  let nextCleanupAt = 0;

  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("limit must be a positive integer");
  if (!Number.isFinite(windowMs) || windowMs < 1) throw new RangeError("windowMs must be positive");
  if (!Number.isInteger(maxKeys) || maxKeys < 1) throw new RangeError("maxKeys must be a positive integer");

  const pruneExpired = (currentTime: number) => {
    for (const [key, bucket] of buckets) {
      if (currentTime >= bucket.resetAt) buckets.delete(key);
    }
    nextCleanupAt = currentTime + CLEANUP_INTERVAL_MS;
  };

  return (req, res, next) => {
    const currentTime = now();
    if (currentTime >= nextCleanupAt) pruneExpired(currentTime);

    const key = clientKey(req);
    const bucket = buckets.get(key);
    if (!bucket || currentTime >= bucket.resetAt) {
      if (!bucket && buckets.size >= maxKeys) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey !== undefined) buckets.delete(oldestKey);
      }
      buckets.set(key, { count: 1, resetAt: currentTime + windowMs });
      return next();
    }

    if (bucket.count >= limit) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000))));
      return res.status(429).json({ success: false, error: TOO_MANY_REQUESTS });
    }

    bucket.count += 1;
    // Refresh insertion order so capacity eviction removes the least recently used key.
    buckets.delete(key);
    buckets.set(key, bucket);
    return next();
  };
}
