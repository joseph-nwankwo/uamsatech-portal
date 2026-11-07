/**
 * Origin allowlist for cross-subdomain SSO checks (e.g. LectureSuite.uamsatech.com
 * calling GET /api/auth/me on uamsatech.com to read the shared session cookie).
 * `Access-Control-Allow-Origin` must echo a specific origin (not `*`) when
 * credentials are involved, so every allowed origin has to be checked explicitly.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const { hostname, protocol } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    return (
      protocol === "https:" &&
      (hostname === "uamsatech.com" || hostname.endsWith(".uamsatech.com"))
    );
  } catch {
    return false;
  }
}

export function corsHeaders(origin: string | null): HeadersInit {
  if (!isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
