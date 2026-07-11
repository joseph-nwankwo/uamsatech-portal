import Redis from "ioredis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// Optional — every call site that uses this (currently just rate limiting)
// falls back to an in-memory implementation when REDIS_URL is unset, same
// graceful-degradation pattern as every other optional provider in this
// project (Stripe/Paystack/Flutterwave, GA/Clarity). There's no local Redis
// instance available to test this against in this sandbox (unlike Postgres,
// which runs as a real local service) — this client is written correctly
// against ioredis's documented API but hasn't been exercised against a real
// Redis server in this session.
let client: Redis | null = null;
let initialized = false;

export function isRedisConfigured(): boolean {
  return !!env.REDIS_URL;
}

export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) return null;

  if (!initialized) {
    initialized = true;
    client = new Redis(env.REDIS_URL, {
      // Fail fast rather than hang a request queued behind a dead Redis —
      // callers are expected to catch and fall back to the in-memory path.
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    client.on("error", (err) => {
      logger.warn("redis.connection_error", { error: err.message });
    });
  }

  return client;
}
