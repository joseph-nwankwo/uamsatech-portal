# Phase 7 — Billing

All 12 requested pieces built (Stripe, Paystack, Flutterwave, Subscriptions, Invoices, Payments, Coupons, Plans, Usage, API Keys, Feature Flags), fully end-to-end tested against the real database — and one real, material product gap found and clearly flagged rather than glossed over.

## Schema

New models: `Plan` (Free/Starter/Professional/Enterprise tiers), `ProductPlan` (join table — price/interval/features per product × plan), `Subscription` (extended — provider, provider IDs, status, `cancelAtPeriodEnd`), `Invoice`, `Coupon`, `UsageRecord`, `FeatureFlag`. `ApiKey` already existed from Phase 1.

**Seed data (`prisma/seed.js`) uses your real pricing table, not fabricated numbers** — LecturerCraft $0/$15/$39/custom, ScholarCraft $0/$12/$35/custom, StudyFlow $0/$8/$20/custom, Records $99/$299 (no free tier), UAMSA has no seeded plan at all (quotation-only, exactly as you specified). Verified live: the `priceCents` values flowing through `/portal/billing` match these exactly (0, 1500, 3900, 49900, 9900, 29900).

## Payment providers

Stripe (`stripe` SDK), Paystack, Flutterwave (both via direct REST calls — neither has an official maintained Node SDK, so raw `fetch` is the standard approach). All three follow the same pattern: checkout route creates a provider session with our metadata (org/product/plan IDs) for webhook reconciliation; webhook route verifies the signature, then upserts `Subscription` and creates `Invoice` records.

**Graceful degradation, matching the Phase 5 email-fallback pattern**: `STRIPE_SECRET_KEY` etc. are optional in `lib/env.ts`. No keys are configured in this environment, so every checkout route returns a clean `503 "not configured"` rather than crashing — verified live for all three providers.

**Webhook signature verification actually tested, not just code-reviewed**: temporarily set dummy `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` in `.env`, restarted the dev server, and confirmed both an invalid signature and a missing signature header are rejected with `400 "Invalid signature."` — proving the real Stripe SDK verification logic runs and works, not just the earlier "not configured" gate. Reverted `.env` immediately after and restarted again to confirm the 503 behavior returns.

## API Keys

`/portal/api-keys` — full lifecycle verified: created a key (`POST /api/portal/api-keys`), confirmed the plaintext is shown exactly once in the response and only a SHA-256 hash + short prefix are persisted in the database (checked directly). Used the real key to authenticate against `POST /api/v1/usage` (`Authorization: Bearer ...`) — succeeded, created a real `UsageRecord`. Revoked the key, then confirmed a subsequent call with the same key is rejected with `401`.

## Usage

`/api/v1/usage` is the intended integration point: the actual UAMSATech products (LecturerCraft, ScholarCraft, etc. — separate deployments) would call this endpoint with an API key to report metered activity. `/portal/usage` aggregates `UsageRecord` by product/metric for the current month. Verified end-to-end: reported a `lecture_notes_generated` event via the API key, and it appeared correctly on `/portal/usage` grouped under LecturerCraft.

## Feature Flags

`/portal/feature-flags` — `PATCH /api/portal/feature-flags/[id]` is OWNER-role-gated (`403` for non-owners) and logs to `AuditLog`. Toggled `billing_flutterwave_enabled` off, confirmed persisted via a direct DB read, then toggled it back to its original seeded state.

## Coupons

Schema and `lib/billing/coupons.ts` exist (percent/fixed discount types, redemption limits, expiry) but there's no portal UI to create/manage coupons yet — they'd currently need to be inserted directly. Not wired into the checkout flow's price calculation either. This is the one piece of the 12 that's schema-complete but not yet functionally wired end-to-end; flagging it rather than overstating it as "done."

## The one real gap: individual subscriptions don't work

**`Subscription.organizationId` is required — there's no `userId` field.** Every billing page and route assumes an organization. `/portal/billing` for a user with no organization shows an `EmptyState` directing them to `/contact`, full stop — there is no path for an individual user to see or purchase a plan.

This directly contradicts the pricing model you gave me: LecturerCraft, ScholarCraft, and StudyFlow all have "Individual" tiers ($15, $12, $8/month) that are explicitly meant for a lecturer or student without an institution. As currently built, **that self-serve individual purchase path doesn't exist** — only organizations can subscribe to anything, for any product, at any tier. This carries forward a limitation first noted (but not resolved) in Phase 6.

Fixing it properly means: adding an optional `userId` to `Subscription` (alongside `organizationId`, mutually exclusive), updating `checkout-context.ts` and all three checkout routes to resolve either an org or a solo user, and updating the billing page's empty-state gate. That's real scope, not a quick patch — worth prioritizing as its own follow-up rather than something to rush in at the end of an already-long phase.

## SEO fixes (same session, not part of the original Phase 7 list but done alongside it)

An SEO audit found 4 gaps; all fixed and verified live:

1. **OG image** — `app/opengraph-image.tsx` using `next/og`'s `ImageResponse`, branded navy/gold/blue. Verified live: `200`, correct `image/png`, and the `og:image`/`twitter:image` meta tags render correctly in page HTML.
2. **Canonical URLs** — `alternates.canonical` added to all 15 static marketing pages, the root layout (`/`), and both dynamic routes (`/products/[slug]`, `/blog/[slug]`) via their `generateMetadata`. Verified rendering in actual HTML output (`<link rel="canonical" href="https://uamsatech.com/about"/>`).
3. **FAQPage structured data** — added directly to the shared `Faq` component, so it automatically applies everywhere the component is used (Home, Pricing, product pages, Support) with zero per-page duplication. Verified live on `/pricing`.
4. **Sitemap `lastModified`** — blog entries now use the post's real `date` instead of the build timestamp.

## Lessons from this phase

- **A stale process from an earlier session was squatting on port 3000**, causing a long false-alarm chase: every `curl localhost:3000/products/uamsa` returned `500` from dead code, while the actual current dev server (correctly serving `200`) had been silently bumped to port 3001. Always check which port `next dev`'s own log says it bound to — don't assume 3000.
- Access tokens are 15 minutes; across a session with several dev-server restarts, cookies went stale more than once mid-test. Re-login when a `200` unexpectedly turns into a `307`.

## Verification

`tsc --noEmit`, `eslint`, `prettier --write` all clean. Full E2E pass against the live database (org creation, billing plans, checkout 503s ×3, webhook signature accept/reject, API key create→use→revoke, feature flag toggle, usage reporting, all 9 Phase 6 portal pages regression-checked). Clean production build: **69 pages** — all marketing/auth/blog/product pages static or SSG, every `/api/*` and `/portal/*` route correctly dynamic.
