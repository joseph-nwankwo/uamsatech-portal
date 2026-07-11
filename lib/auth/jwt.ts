import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { JWTPayload } from "jose";
import { env } from "@/lib/env";

const secret = new TextEncoder().encode(env.AUTH_JWT_SECRET);

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

export type AccessTokenPayload = JWTPayload & {
  sub: string;
  orgId?: string;
  role?: string;
};

export async function signAccessToken(
  payload: Omit<AccessTokenPayload, "iat" | "exp">
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sub !== "string") return null;
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}
