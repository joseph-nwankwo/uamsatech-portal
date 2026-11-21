/**
 * Redis-backed store for portal launch tokens.
 *
 * The portal generates a short-lived JWT for LectureSuite during the launch
 * step and stores it here, keyed by the SSO state parameter.  LectureSuite
 * retrieves the token via a server-to-server call rather than receiving it
 * in a browser-visible URL, which keeps the JWT out of Nginx access logs and
 * browser history.
 *
 * All portal worker processes share the same Redis instance, so a token stored
 * by one worker is always retrievable by any other worker that handles the
 * callback request.
 *
 * Fail-closed: if Redis is not configured both operations throw, and the
 * caller returns 503.  There is no silent fall-back to a process-local store —
 * a process-local store cannot be safely shared across multiple workers.
 */

import { getRedisClient } from "@/lib/redis";

const KEY_PREFIX = "sso_token:";
const TOKEN_TTL_SECONDS = 5 * 60; // 5 min — matches JWT maxAge

export async function storeLaunchToken(
  state: string,
  token: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error("SSO token store unavailable: Redis is not configured");
  }
  await redis.set(`${KEY_PREFIX}${state}`, token, "EX", TOKEN_TTL_SECONDS);
}

/** Retrieve and immediately consume the token for a given state (single-use). */
export async function consumeLaunchToken(
  state: string
): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error("SSO token store unavailable: Redis is not configured");
  }
  return redis.getdel(`${KEY_PREFIX}${state}`);
}
