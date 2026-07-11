import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/lib/auth/jwt";
import { REFRESH_TOKEN_TTL_MS } from "@/lib/auth/tokens";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/cookie-names";

export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE };

const baseCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  domain: env.COOKIE_DOMAIN,
};

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string
) {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  store.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions,
    maxAge: Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
  store.set(REFRESH_TOKEN_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
}
