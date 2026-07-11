import { db } from "@/lib/db";
import { signAccessToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import {
  generateOpaqueToken,
  hashToken,
  REFRESH_TOKEN_TTL_MS,
} from "@/lib/auth/tokens";

/**
 * Issues a fresh access token + refresh token pair for a user (optionally
 * scoped to an organization) and sets them as httpOnly cookies.
 */
export async function issueSession({
  userId,
  organizationId,
  role,
}: {
  userId: string;
  organizationId?: string;
  role?: string;
}) {
  const accessToken = await signAccessToken({
    sub: userId,
    orgId: organizationId,
    role,
  });

  const rawRefreshToken = generateOpaqueToken();
  await db.refreshToken.create({
    data: {
      userId,
      organizationId,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  await setAuthCookies(accessToken, rawRefreshToken);
}
