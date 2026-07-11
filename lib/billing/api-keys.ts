import { generateOpaqueToken, hashToken } from "@/lib/auth/tokens";

const KEY_PREFIX = "uamsa_live_";

/**
 * Generates a new API key. The full key is only ever returned once, at
 * creation time — only its hash and a short display prefix are persisted.
 */
export function generateApiKey(): {
  fullKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const secret = generateOpaqueToken();
  const fullKey = `${KEY_PREFIX}${secret}`;
  const keyPrefix = `${fullKey.slice(0, KEY_PREFIX.length + 6)}…`;
  const keyHash = hashToken(fullKey);
  return { fullKey, keyPrefix, keyHash };
}
