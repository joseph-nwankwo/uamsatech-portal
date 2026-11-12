import { SignJWT } from "jose/jwt/sign";
import { randomUUID } from "crypto";
import { env } from "@/lib/env";

export const LAUNCH_TOKEN_TTL_SECONDS = 5 * 60; // 5 minutes

/** Canonical product identifiers that may receive a launch token. */
export type LaunchTargetProduct =
  "lecturesuite" | "scholarsuite" | "researchsuite";

/**
 * Signs a short-lived SSO launch token for a Craft Suite product.
 *
 * @param sub    - Portal user ID (from session)
 * @param email  - User email passed to the product for provisioning
 * @param target - Product self-identifier ('lecturesuite' | 'scholarsuite')
 */
export async function signLaunchToken(
  sub: string,
  email: string,
  target: LaunchTargetProduct
): Promise<string> {
  const secret = new TextEncoder().encode(env.CRAFT_LAUNCH_SECRET);
  // One clock read so exp - iat is exactly the TTL (product backends enforce
  // maxAge = 5 min from iat).
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub, email, type: "product_launch", target })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("uamsatech")
    .setAudience(target)
    .setIssuedAt(now)
    .setExpirationTime(now + LAUNCH_TOKEN_TTL_SECONDS)
    .setJti(randomUUID())
    .sign(secret);
}
