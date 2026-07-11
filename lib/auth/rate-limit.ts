import { getRedisClient } from "@/lib/redis";
import { logger } from "@/lib/logger";

/**
 * In-memory, single-instance fixed-window rate limiter — the fallback used
 * whenever REDIS_URL isn't configured, and the only backend available in
 * this sandbox (no local Redis to test against). Fine for one server
 * process; the Redis-backed path below is the real fix for multiple
 * instances, documented in docs/14-production-hardening.md as a known gap
 * this closes.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

// Every unique key (IP, "login:<ip>:<email>", user ID, ...) used to create a
// permanent entry that nothing ever removed — a real unbounded-memory-growth
// bug on a long-running process, only visible after enough distinct callers
// accumulate. A periodic sweep evicts expired buckets; unref() so it never
// keeps the Node process alive by itself (matters for serverless/edge
// environments where the module can be torn down between invocations).
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupScheduled() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}

function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  ensureCleanupScheduled();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

// Atomic increment-and-maybe-expire as a single Lua script — INCR followed
// by a separate PEXPIRE call would leave a key that never expires if the
// process died in between. EVAL runs both as one atomic operation on the
// Redis server.
const INCR_WITH_TTL_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return current
`;

async function checkRateLimitRedis(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const redis = getRedisClient();
  if (!redis) return checkRateLimitMemory(key, limit, windowMs);

  try {
    const redisKey = `ratelimit:${key}`;
    const count = (await redis.eval(
      INCR_WITH_TTL_SCRIPT,
      1,
      redisKey,
      windowMs
    )) as number;

    if (count > limit) {
      const ttl = await redis.pttl(redisKey);
      return { allowed: false, retryAfterMs: Math.max(ttl, 0) };
    }
    return { allowed: true, retryAfterMs: 0 };
  } catch (err) {
    // Redis unreachable/erroring — fail open to the in-memory limiter rather
    // than letting every request through unlimited or blocking on a dead
    // dependency. Logged so a real outage is visible in ops, not silent.
    logger.warn("rate_limit.redis_error_fallback", {
      error: (err as Error).message,
    });
    return checkRateLimitMemory(key, limit, windowMs);
  }
}

// Always async, even on the in-memory path — a function that's sometimes a
// Promise and sometimes a plain object is a real footgun: forgetting await
// on the Redis path would make `allowed` a truthy Promise object, silently
// disabling rate limiting instead of failing loudly. TypeScript's
// `Promise<T>` return type forces every call site to await it.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const redis = getRedisClient();
  if (redis) return checkRateLimitRedis(key, limit, windowMs);
  return checkRateLimitMemory(key, limit, windowMs);
}

// Exposed for the /api/metrics endpoint — reflects only the in-memory
// backend's state, since Redis doesn't expose a cheap equivalent without an
// expensive SCAN. Meaningful when Redis isn't configured (the only backend
// active in this sandbox); when Redis is active this will read 0 even
// though rate limiting is working, which /api/metrics labels accordingly.
export function rateLimitBucketCount(): number {
  return buckets.size;
}

export function rateLimitBackend(): "redis" | "memory" {
  return getRedisClient() ? "redis" : "memory";
}

export function requestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}
