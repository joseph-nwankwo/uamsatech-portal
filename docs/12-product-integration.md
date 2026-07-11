# Phase 12 — Product Integration

Connects the 5-product ecosystem (UAMSA, LecturerCraft, ScholarCraft, StudyFlow, Records) into the portal's central dashboard, which now shows Owned Products, Subscriptions, Usage, and Quick Launch. Two scope questions were resolved with the user before writing code, because "Connect" is ambiguous and this session genuinely cannot verify what's live outside this repo.

## What "Connect" means here

The user chose the SSO-launch-link interpretation over building a real connect/disconnect integration model. There's no OAuth-style "connect an external account" flow anywhere in this codebase, and none was needed: SSO already works via the shared `*.uamsatech.com` cookie (`COOKIE_DOMAIN`) and the cross-subdomain `/api/auth/me` endpoint built in Phase 5. "Connect" and "Quick launch" are the same action — a link to `https://{product.subdomain}` — since a signed-in user landing there is already authenticated by the existing SSO mechanism. No new data model was needed.

## Only UAMSA gets a live link — stated plainly, not glossed over

Only UAMSA has a real, separately-built codebase. LecturerCraft, ScholarCraft, StudyFlow, and Records are marketing-only in this session's scope — the same honesty boundary drawn in Phase 4 when building illustrative product mockups instead of fabricating screenshots. This repo has no way to verify whether `lecturercraft.uamsatech.com` etc. actually resolve to anything today, so linking to them as if they were live would risk presenting a broken experience as a working one.

The user chose to label the 4 unbuilt products clearly rather than link out to them speculatively. A new `isLive: boolean` field was added to the `Product` type (`types/product.ts`) and set in `lib/site-config.ts` — `true` only for `uamsa`, `false` for the other 4. Every place that renders a product now branches on it:

- **Subscribed + live** → a real `<a href="https://{subdomain}" target="_blank">Launch</a>` link.
- **Subscribed + not live** → a "Coming soon" badge, not a link.
- **Not subscribed** → the existing "Get access" flow (unchanged from Phase 6/7).

## Central dashboard (`/portal/dashboard`)

Rebuilt to surface all 4 requested sections as distinct, glanceable blocks rather than folding them into one generic "products" list:

- **Quick launch** — a 5-tile row for every product in the ecosystem (not just owned ones), so it doubles as a map of the whole product line. Live+subscribed tiles link out; everything else routes back to `/portal/products` instead of a dead link.
- **Owned products** — which of the 5 the organization is actually subscribed to, with an honest `EmptyState` ("No products yet") when there are none.
- **Subscriptions** — the billing-relevant view: plan name, price/interval, status, and renewal date, pulled from `Subscription` → `ProductPlan` → `Plan`, reusing the same `formatPrice` pattern as the Phase 7 billing page.
- **Usage this month** — the top 5 usage rows for the org's current billing period, with a link through to the full `/portal/usage` page (unchanged from Phase 7) rather than duplicating its entire table.

All four query the same `Subscription`/`UsageRecord` data already established in Phase 7 — nothing new was added to the schema for this beyond `isLive`, which lives in `site-config.ts`, not the database, since it's a presentation fact about the marketing/ecosystem layer, not billing data.

## Verification

`tsc --noEmit`, `eslint`, `prettier --write` all clean (one unused-import warning caught and fixed: a leftover `Button` import in the rebuilt dashboard).

Full E2E test against the live DB:

- Seeded a real test organization via script with two subscriptions — UAMSA (live, no plan — quotation-only per Phase 7) and LecturerCraft (not live, Free plan) — plus real `UsageRecord` rows for both.
- Confirmed the dashboard's Quick Launch row shows a real `https://uamsa.uamsatech.com` link for UAMSA and a "Coming soon" label (no href) for LecturerCraft and the other 3 non-live products, regardless of subscription status.
- Confirmed Owned Products, Subscriptions (plan name, price, status, renewal date), and Usage (both seeded metrics) all render the real seeded data correctly.
- Tested the zero-data path with a second, org-less test account: confirmed all three sections correctly render their `EmptyState` variants instead of erroring, and Quick Launch correctly shows "Not subscribed" for UAMSA (the only branch where that label is actually reachable, since every other product is non-live and shows "Coming soon" first regardless of subscription — verified this is intentional, not a dead-code bug).
- Confirmed `/portal/products` shows the same Launch/Coming-soon logic independently of the dashboard.
- Regression-checked `/`, `/products`, `/portal/billing`, `/portal/usage`, `/pricing`, `/blog`, `/support` — no impact on the rest of the site.

Production build: clean, zero errors. Route count unchanged at 130 (this phase modified two existing pages rather than adding new routes).
