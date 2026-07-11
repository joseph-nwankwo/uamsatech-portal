# Architecture Documentation

A technical overview of what this system actually is, grounded in the real code — not an aspirational design doc. Every phase referenced here has a corresponding `docs/0N-*.md`/`docs/1N-*.md` write-up with full detail; this document is the map, not the territory.

## What this repository is

`uamsatech.com` — the marketing site, central authentication/SSO provider, customer self-service portal, and (as of Phase 13) an internal admin analytics area for the UAMSATech product ecosystem. It is explicitly **not** one of the 5 SaaS products themselves. Of those 5 products (UAMSA, LecturerCraft, ScholarCraft, StudyFlow, Records), only **UAMSA has a real, separately-built codebase** — the other 4 are marketing-only in this project's scope (Phase 4, Phase 12). This distinction is load-bearing throughout the app: see `isLive` on the `Product` type.

## System diagram (textual)

```
                         ┌─────────────────────┐
                         │   Browser / Client    │
                         └──────────┬───────────┘
                                    │ HTTPS
                         ┌──────────▼───────────┐
                         │   Nginx (optional)     │  TLS termination, gzip,
                         │ deploy/nginx/*.conf    │  edge rate limiting,
                         └──────────┬───────────┘  static asset caching
                                    │
                         ┌──────────▼───────────┐
                         │  Next.js App Router    │  middleware.ts guards
                         │  (single Node process, │  /portal, /admin,
                         │   output: standalone)  │  /select-organization
                         └──┬────────┬─────────┬─┘
                            │        │         │
                 ┌──────────▼─┐  ┌───▼────┐ ┌──▼──────────┐
                 │ PostgreSQL │  │ Redis  │ │ S3-compatible│
                 │ (required) │  │(optional│ │ storage      │
                 │ via Prisma │  │rate-lim)│ │ (optional,   │
                 └────────────┘  └────────┘ │ avatars)     │
                                             └──────────────┘
        Optional external services, all gracefully degrading when unconfigured:
        Resend (email) · Stripe/Paystack/Flutterwave (billing) ·
        Google Analytics/Microsoft Clarity (client-side) · GHCR (CI image registry)
```

There is no separate backend service — API routes, server components, and the auth/session layer all run inside the one Next.js process. `output: "standalone"` (`next.config.ts`) produces a self-contained Node server (`node .next/standalone/server.js`) that the Dockerfile packages; horizontal scaling is "run more copies of this same process" (see `deploy/k8s/deployment.yaml`, `hpa.yaml`), not a services split.

## Data model, by area

- **Identity & auth:** `User`, `Membership` (many-to-many User↔Organization with a role), `Organization`, `RefreshToken` (rotated on every use, hashed at rest), `VerificationToken` (shared hashed-single-use-token pattern reused for email verification, password reset, and invitations), `Invitation`.
- **Billing:** `Product` (real DB rows, distinct from the static `products` array in `lib/site-config.ts` which drives marketing pages), `Plan`/`ProductPlan` (tier × per-product pricing), `Subscription`, `Invoice`, `Coupon` (schema-only, not wired into checkout — a stated gap, see `docs/07-billing.md`), `UsageRecord`, `ApiKey`.
- **Content:** `BlogPost`/`Author`/`Category`/`Tag`/`Comment` (Phase 10), `KnowledgeBaseArticle` (Phase 11 — repurposed from an unused Phase 1 `Documentation` model rather than adding a duplicate table), Docs content (`features/docs/content/*.ts` — deliberately static files, not DB rows, since it's developer reference content, not a CMS).
- **Support:** `SupportTicket`/`TicketMessage` (the async "live chat" — Phase 11), `BugReport`, `FeatureRequest`/`FeatureRequestVote`, `ContactMessage`, `NewsletterSubscriber`, `Incident` (backs the public `/status` page).
- **Platform:** `AuditLog` (every portal mutation), `AnalyticsEvent` (Phase 13's first-party event tracking, 8 real trigger points — not blanket instrumentation), `FeatureFlag`.

## Authentication & SSO

Hand-rolled JWT (via `jose`) access tokens (15-minute expiry) + opaque, hashed, rotated-on-use refresh tokens — not NextAuth, a deliberate choice made in Phase 5. SSO across `*.uamsatech.com` subdomains works via a shared cookie (`COOKIE_DOMAIN` env var, unset in local dev) plus a CORS-enabled `GET /api/auth/me` other subdomains/products can call to confirm identity. There is no OAuth "connect an external account" flow anywhere — "Quick launch" to a product (Phase 12) is just a link to that product's subdomain, riding the same shared-cookie session.

## Multi-tenancy and the no-staff-role boundary

Every customer-facing portal page (`/portal/*`) is scoped to a single `Organization` via `Membership` (`OWNER`/`ADMIN`/`MEMBER`). **There has never been a platform-staff role anywhere in this codebase.** This single fact drove three separate, deliberate architecture decisions across the project:

1. **Phase 10 (blog):** content editing lives in `prisma/seed.js`, not a portal editor — any customer OWNER would otherwise be able to edit the public company blog.
2. **Phase 11 (support):** "Live Chat" is an async `TicketMessage` thread, not a staff console — there's no staff identity to build a console for. Staff replies are authored via script.
3. **Phase 13 (analytics):** company-wide dashboards (revenue across every customer) needed a genuinely new, separate access boundary — `ADMIN_EMAILS`, a plain env-var allowlist checked in `lib/admin/auth.ts`, guarding a structurally separate `/admin` segment. `getAdminContext()` 404s a non-admin rather than 403ing, so a customer probing the URL can't even confirm the route exists — the same reasoning used for cross-user resource lookups elsewhere in the app (a ticket you don't own 404s, not 403s).

If this project ever needs real platform-staff accounts (support agents actually replying to tickets, a real content CMS UI), that's a genuine new primitive to design — not an extension of `Membership`, which is fundamentally customer-organization-scoped.

## Request path & middleware

`middleware.ts` matches `/portal/:path*`, `/admin/:path*`, and `/select-organization`, verifying the access-token cookie and redirecting to `/login?redirect_uri=...` on failure — this is the only global gate; route-level checks (org-scoped permissions in `lib/portal/permissions.ts`, the admin-email check) happen inside each route/page after middleware lets the request through.

## Resilience & graceful degradation

Every external integration in this project follows the same pattern, established with the billing providers in Phase 7 and applied consistently since: **check configuration at request time, degrade clearly, never fail the build or crash the process for a missing optional credential.**

| Integration                 | Unconfigured behavior                                                         |
| --------------------------- | ----------------------------------------------------------------------------- |
| Resend (email)              | Logs `[DEV EMAIL FALLBACK]` to console instead of sending                     |
| Stripe/Paystack/Flutterwave | Checkout returns `503 Not configured`                                         |
| Redis                       | Rate limiting falls back to in-memory, single-instance (Phase 15)             |
| S3-compatible storage       | Avatar upload button disabled, clear message shown (Phase 15)                 |
| Google Analytics / Clarity  | Script tags simply don't render                                               |
| `ADMIN_EMAILS` unset        | `/admin` 404s for everyone, including its own developer                       |
| `METRICS_TOKEN` unset       | `/api/metrics` is open (expected to be firewalled at the proxy layer instead) |

## Observability

Structured JSON logs (`lib/logger.ts`, no dependency) to stdout/stderr; a hand-rolled Prometheus exposition endpoint (`/api/metrics`, no `prom-client` dependency) covering process health, DB reachability, rate-limit backend state, and core business counts; `deploy/prometheus/` + `deploy/grafana/` provisioning to scrape and visualize it. Both loggers/metrics avoid new npm dependencies deliberately — this sandbox's package registry has a documented history of flaky installs, and both formats are simple enough to hand-roll correctly (see `docs/14-production-hardening.md`).

## Automated testing & patching

`tests/unit/**` (Vitest, no server needed — password hashing, tokens, the rate limiter, permissions, the CSP dev/prod split) and `tests/security/**` (Vitest, hits a real running standalone server over HTTP — auth-required checks, the `/admin` 404-not-403 boundary, IDOR, XSS-escaping, rate-limit enforcement, security headers, injection/oversized-input handling). Both run in `.github/workflows/ci.yml` on every push/PR — the security suite specifically boots the real `output: standalone` production server (not `next dev`, which has the module-isolation quirk noted above under Resilience) and runs against it, so a merged change that weakens an access-control check or a rate limit fails CI, not just a manual review months later. `npm run test:security` can also be pointed at any running instance via `TEST_BASE_URL` for on-demand re-verification (see the Operations Guide).

Dependency patching is CI-gated the same way: `.github/dependabot.yml` opens weekly PRs (grouped minor/patch bumps, `prisma`/`@prisma/client` majors excluded — see the pin note below), each of which must pass the full suite above before merge; `.github/workflows/security-scan.yml` runs `npm audit` weekly independent of any code change, so a newly-disclosed CVE in an untouched dependency still gets caught. Full detail in `docs/maintenance-guide.md`.

## Known, stated architectural limitations

Not oversights — each was a deliberate scope decision, documented at the time it was made:

- **No self-serve path for an individual (non-org) user to purchase a plan.** `Subscription.organizationId` is required with no `userId` field, contradicting the "Individual" pricing tier that's core to 3 of 5 products' stated business model. First flagged in Phase 6, still open (`docs/07-billing.md`).
- **`Coupon` is schema-only** — not wired into checkout pricing.
- **In-memory rate limiting is the only backend actually exercised in this sandbox.** The Redis-backed path (Phase 15) is written correctly against `ioredis`'s documented API but has never run against a real Redis server here — there isn't one available in this environment, unlike Postgres.
- **No live production deployment exists.** Everything in `deploy/`, `.github/workflows/`, and the Deployment Guide is real, correct configuration — none of it has been executed against real infrastructure, because none exists in this project's environment (no cloud account, no domain, no cluster). See the Deployment Guide's closing section.
