# Phase 13 — Analytics

Google Analytics, Microsoft Clarity, Product Analytics, Conversion Tracking, Revenue Dashboard, Customer Analytics, Marketing Dashboard. Two scope questions were resolved with the user before writing any code, because this phase's dashboards are inherently company-wide data with nowhere safe to put them in the existing architecture.

## The core problem: company-wide dashboards, no staff role

Every dashboard this phase asks for — Revenue, Customer Analytics, Marketing — is necessarily company-wide (total revenue across every customer, signups across every organization). But every existing portal page in this codebase is deliberately scoped to a single customer's organization via `Membership`, and there has never been a platform-staff concept (the same fact that shaped the Phase 10 blog-editor and Phase 11 live-chat decisions). Putting a revenue dashboard inside `/portal` would leak every other customer's revenue to any org OWNER — a real data leak, not a hypothetical one.

The user chose to add a genuinely new, deliberately minimal access-control concept rather than skip these dashboards: an `ADMIN_EMAILS` env allowlist (comma-separated, `lib/env.ts`) checked against the session's email in `lib/admin/auth.ts`, guarding an entirely new `/admin` route segment that's structurally separate from `/portal`. `getAdminContext()` mirrors `getPortalContext()`'s shape but **404s** (via `notFound()`) rather than showing a "not authorized" page for a non-admin — the same reasoning already used for cross-user resource lookups elsewhere (a ticket you don't own, a comment you can't delete): an ordinary customer shouldn't be able to tell `/admin` exists at all. `middleware.ts`'s matcher was extended to cover `/admin/:path*` so an unauthenticated request never even reaches the email check.

## Google Analytics & Microsoft Clarity

The user confirmed they don't have real tracking IDs yet, so both are built as real, working integrations gated on presence, not stubs: `components/analytics/google-analytics.tsx` and `components/analytics/microsoft-clarity.tsx` each read a `NEXT_PUBLIC_*` env var directly (`NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_PROJECT_ID`) and render nothing at all if it's unset — same graceful-degradation pattern already established for Stripe/Paystack/Flutterwave keys. Both are mounted in the root `app/layout.tsx`, so setting either env var in `.env` is the only step needed to go live; no code change required. Neither script currently loads in this environment, which is expected and stated plainly rather than faked with placeholder IDs.

## First-party event tracking (Product Analytics' foundation)

New `AnalyticsEvent` model (`name`, optional `userId`/`organizationId`, `metadata` Json, `createdAt`, indexed on `[name, createdAt]`) and `lib/analytics/track.ts`'s `trackEvent()` helper, instrumented at 8 real call sites — not a blanket "track everything" approach:

- `signup_completed` (signup route), `login` (login route), `email_verified` (verify-email page)
- `contact_submitted` (Phase 11's contact route), `newsletter_subscribed` (Phase 10's subscribe route)
- `subscription_created` (all 3 billing webhook handlers — Stripe, Paystack, Flutterwave — at their respective checkout-completed equivalents)

This is deliberately narrower than trying to fabricate page-view/session tracking — this repo has no visitor-level instrumentation and GA/Clarity aren't configured, so building fake traffic charts from nothing wasn't an option. Every event tracked here corresponds to a real, already-existing action with a real audit trail.

## Conversion Tracking (`/admin/conversion`)

Computed directly from ground-truth tables (`User.emailVerified`, `Membership`, `Subscription`), not from the event log — more reliable than an approximation, since these facts already exist as real column state rather than requiring an event to have fired correctly. The funnel: **Signed up → Verified email → Joined an organization → Subscribed to a product**, each step's count and conversion percentage relative to the previous step.

## Revenue Dashboard (`/admin/revenue`)

Real numbers from Phase 7's `Invoice`/`Subscription`/`ProductPlan` models: total revenue (sum of `PAID` invoices, all-time), an MRR estimate (active subscriptions' plan price normalized to monthly — `YEARLY` divided by 12), revenue broken down by product and by billing provider, and a recent-invoices table. **Verified precisely, not just glanced at**: seeded a real invoice via script (ScholarCraft Enterprise, $399/yr, Stripe) and confirmed Total revenue showed exactly `$399`, MRR showed exactly `$33` (39900¢ ÷ 12 = 3325¢ → rounds to $33 with `Intl.NumberFormat`'s `maximumFractionDigits: 0`), and both the by-product and by-provider breakdowns attributed it correctly.

## Customer Analytics (`/admin/customers`)

Total organizations, total users, subscription status breakdown (Active/Trialing/PastDue/Canceled), top organizations by usage volume, and a **real signups-over-time bar chart** — parameterized from actual `User.createdAt` grouped by day, using the same `ChartContainer`/`ChartConfig` primitive from Phase 2's design system. This is the primitive's **first real, non-demo use**: the existing `components/charts/signups-bar-chart.tsx` and `chart-data.ts` from Phase 2 are hardcoded to fabricated numbers (`186, 205, 237...`) for the `/design-system` reference page only, and were deliberately left untouched rather than reused here — reusing fake-data-bound components for a real dashboard would have been silently fabricating numbers. A new, separate component was built that accepts real query results as props instead.

## Marketing Dashboard (`/admin/marketing`)

Scoped to what this app actually has ground truth for — newsletter subscriber growth and active/unsubscribed counts, contact form submission volume and recent messages, blog publishing cadence, feature-request engagement (submissions + total votes) — rather than attempting to fabricate traffic, channel, or campaign data that fundamentally lives in Google Analytics and Microsoft Clarity's own systems, not this Postgres database. The page states this plainly and links out to `analytics.google.com` and `clarity.microsoft.com` directly, rather than faking an embedded traffic chart this repo has no way to populate honestly.

## Product Analytics (`/admin/product`)

Two real views: `AnalyticsEvent` counts by name over the last 30 days (signup/login/verification/contact/newsletter/subscription activity), and sitewide `UsageRecord` totals grouped by product and metric — the same usage data Phase 12's portal dashboard shows per-organization, aggregated here across every organization for a platform-wide view.

## Verification

`tsc --noEmit`, `eslint`, `prettier --write` all clean.

Full E2E test against the live DB:

- Confirmed `/admin` and every sub-route redirect an anonymous request to `/login`, and 404 a signed-in non-admin account (not a 403 — verified the distinction matters, since a 403 would confirm the route's existence to a probing customer).
- Added a real email to `ADMIN_EMAILS`, confirmed that exact account reaches all 6 admin pages while a second, non-listed account still 404s.
- Seeded a real invoice via script (see Revenue Dashboard above) and hand-verified every derived figure (total revenue, MRR, per-product, per-provider) against the raw numbers rather than eyeballing the page.
- Triggered real signup, login, email verification, contact form, and newsletter subscribe events through the actual routes (not inserted directly) and confirmed each appears correctly in `/admin/product`'s event counts.
- Regression-checked the rest of the site — no impact from the new `/admin` segment or the `trackEvent()` calls added to 5 existing routes.

Production build: clean, zero errors. All 6 `/admin/*` routes confirmed compiled (`.next/server/app/admin/**`) after the build log's early lines were lost to a `tail` truncation on the first check — verified directly against the build output directory instead of re-trusting a possibly-incomplete log. **136 total concrete routes**, up from Phase 12's 130 — 6 new (`/admin` index + 5 dashboards), no new API routes since all tracking happens inside existing routes.
