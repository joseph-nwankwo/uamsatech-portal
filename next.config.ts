import path from "path";
import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/security-headers";

// Allows Google Analytics / Microsoft Clarity's own inline init snippets and
// their outbound beacons (see components/analytics/*) without opening the
// policy up generally. 'unsafe-inline' on script-src is a real, documented
// trade-off: GA's/Clarity's snippets are inline by design and neither script
// (still unconfigured — no NEXT_PUBLIC_GA_MEASUREMENT_ID /
// NEXT_PUBLIC_CLARITY_PROJECT_ID set) actually loads in this environment
// today. A nonce-based CSP would remove this, at the cost of plumbing a
// per-request nonce through middleware — a reasonable next hardening step,
// not done here to avoid touching the auth middleware's proven matcher logic
// in a phase with no way to runtime-verify the change against real traffic.
// Next.js's dev server (Fast Refresh / webpack HMR) runs its client bundle
// through eval() — a CSP without 'unsafe-eval' silently blocks React
// hydration in `next dev` specifically (the page still server-renders fine,
// curl still returns 200, so this doesn't show up as an error; every client
// component just stays un-hydrated — e.g. Framer Motion elements stuck at
// their `initial` state forever, looking like a blank section). The
// production build doesn't use eval, so 'unsafe-eval' is dev-only and never
// ships. This was flagged as an unverified risk in docs/14-production-hardening.md
// (no headless browser was available to catch it at the time), confirmed and
// fixed, and the isDev branch is now locked in by
// tests/unit/security-headers.test.ts so it can't silently regress.
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  // Next sends `X-Powered-By: Next.js` by default — free reconnaissance
  // information for an attacker with no upside for us.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: buildSecurityHeaders(isDev) }];
  },
};

export default nextConfig;
