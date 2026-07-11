// Extracted from next.config.ts so the CSP-construction logic is unit
// testable — the dev-only 'unsafe-eval' bug (docs/14-production-hardening.md)
// happened precisely because this logic had never been exercised by a test,
// only inferred from reading the code. See tests/unit/security-headers.test.ts.

export function buildCsp(isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://www.clarity.ms`,
    "connect-src 'self' https://www.google-analytics.com https://www.clarity.ms",
    "img-src 'self' data: https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function buildSecurityHeaders(isDev: boolean) {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "Content-Security-Policy", value: buildCsp(isDev) },
  ];
}
