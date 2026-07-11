# Phase 6 — Customer Portal

All 9 requested sections built at `/portal/*`, with real functionality wired to data models already in the schema (`Membership`, `RefreshToken`, `AuditLog`, `Subscription`) rather than mocked content — and, like Phase 5, fully exercised end-to-end against the real database.

## The layout restructuring this phase required

Every page up to now rendered inside one root layout that unconditionally wrapped `{children}` in `<SiteHeader/>`/`<SiteFooter/>`. That was fine when the only non-marketing pages were auth forms (Phase 5 deliberately left them in the same layout to keep that phase's scope controlled). A full sidebar-driven portal can't share that shell — a fixed marketing nav sitting above an app sidebar would look broken, not premium. So this phase did the restructuring Phase 5 explicitly deferred:

- `app/layout.tsx` (root) now only provides `<html>/<body>`, fonts, and the Organization JSON-LD — no header/footer.
- `app/(marketing)/layout.tsx` (new route group, invisible in the URL) adds `<SiteHeader/>`/`<SiteFooter/>` back for the public site. All 15 marketing routes moved into `app/(marketing)/` — a pure filesystem move, zero import changes needed since the codebase has used `@/`-absolute imports throughout.
- Auth pages (`/login`, `/signup`, etc.) stay exactly where they were — outside any group, so they now naturally render with no header/footer (they already had their own `AuthShell` chrome).
- `app/portal/` is a **real path segment** (not a route group) with its own `layout.tsx` — every page under it automatically gets the sidebar shell via normal Next.js layout nesting.

**Why `/portal/*` and not `/dashboard/*`:** the portal needs a "Products" section, and `/products` was already taken by the public product marketing pages. Prefixing the whole portal under `/portal` avoids that collision and reads naturally as the local stand-in for `portal.uamsatech.com` (same pattern Phase 5 used for `auth.uamsatech.com` → `/login` etc.). `/dashboard` was moved to `/portal/dashboard`; every redirect target (login, signup, select-organization, verify-email) and the middleware matcher were updated accordingly.

## The 9 sections

- **Dashboard** — welcome, email-verified status, org/role, live counts (team members, active subscriptions) that link to their full pages, and a 3-entry recent-activity preview.
- **Organization** — org name, member count, created date; name is editable by OWNER/ADMIN via a real `PATCH /api/portal/organization`. Individual (no-org) accounts get an honest `EmptyState` pointing at `/contact` — self-serve org creation isn't part of the Phase 0 sales-led institutional journey, so this isn't a fake "create org" button.
- **Users** — real `Membership` list (name, email, role, joined date) for the active org. Read-only this phase — no invite-by-email flow, since that needs its own token-based invitation model and building it half-working would be worse than not having it yet. Individual accounts get the same honest empty state as Organization.
- **Profile** — name (editable, `PATCH /api/portal/profile`), email (read-only — changing it would need re-verification, out of scope).
- **Notifications** — honest `EmptyState`. No `Notification` model exists and nothing in the app currently generates notifications (no billing, no team invites yet) — showing fake notification rows would be exactly the kind of fabrication earlier phases explicitly avoided.
- **Products** — the 5 marketing products cross-referenced against real `Subscription` rows for the active org (`ACTIVE`/etc. shown as "Subscribed" vs "Not subscribed" with a "Get access" → `/contact` CTA). No checkout/billing exists yet, so nothing is subscribed for a fresh org — that's accurate, not a bug.
- **Recent Activity** — full `AuditLog` history. This only has real data because this phase also **retrofitted audit logging** into Phase 5's `login`/`logout`/`reset-password` routes plus every new portal mutation (`profile_updated`, `settings_updated`, `organization.updated`, `session.revoked`) — so this page reflects genuine account history, not a stub.
- **Security** — change-password form (`POST /api/portal/change-password`, requires current password) and a real active-sessions list read from `RefreshToken` rows, with per-session revoke and "sign out other sessions." Changing your password intentionally **keeps the current session alive** and only revokes the others — you shouldn't get logged out of the device you're using to change your own password.
- **Settings** — one real, persisted preference (`User.emailNotificationsEnabled`, new schema field) via a `Switch`. Deliberately not padded with fake toggles that don't do anything.

## Build issues hit and fixed

1. **`PageNotFoundError` / `ENOENT` for `/_not-found` during "Collecting page data"** — appeared twice in a row after the route-group restructuring, ruling out a one-off race. Root cause: no explicit `app/not-found.tsx` existed, and Next couldn't unambiguously resolve where its auto-generated not-found page should attach once a route group was introduced. Fixed by adding a real `app/not-found.tsx` (a proper branded 404 page, not just a placeholder).
2. **`jose` edge-runtime warning** (`CompressionStream`/`DecompressionStream` not supported) — `middleware.ts` imports `verifyAccessToken` from `lib/auth/jwt.ts`, which imported the full `jose` package index, pulling in JWE (encryption) code we never use just for its JWS (signing) functions. Fixed by importing from `jose/jwt/sign` and `jose/jwt/verify` directly, with `JWTPayload` as a type-only import (erased at compile time). Cosmetic (the build succeeded even with the warning present), but worth fixing cleanly.

## Verification

`tsc --noEmit`, `eslint`, `prettier --write` all clean on the first pass.

**Full real end-to-end test against the live database** (12 scenarios, all passed):

1. All 17 marketing routes → 200, header/footer confirmed present in the HTML.
2. Auth pages (`/login` etc.) → 200, confirmed the marketing footer text is **absent** (route restructuring worked as intended).
3. Login as the existing Phase 5 test user against the new schema → 200.
4. All 9 `/portal/*` pages while authenticated → 200.
5. Organization/Users empty states correctly shown for this individual (no-org) account.
6. `PATCH /api/portal/profile` → persisted, confirmed via `/api/auth/me`.
7. `PATCH /api/portal/settings` → persisted.
8. `/portal/activity` shows real entries for both mutations plus the earlier login — audit logging confirmed working, not just installed.
9. `POST /api/portal/change-password` → success; old password subsequently rejected (401), new password accepted (200).
10. The session used to change the password **remained valid afterward** — confirmed via `/api/auth/me` with the same cookies, proving the "keep current session, revoke others" logic works.
11. `/portal/security` shows the "This device" badge on the surviving session.
12. Unauthenticated `GET /portal/dashboard` → still 307 to `/login?redirect_uri=...` (middleware matcher update for the new `/portal` prefix confirmed working).

Production build: 57 pages — all marketing/auth pages static, all `/portal/*` and `/api/*` routes correctly dynamic (they read cookies/session per-request).

## What's still not built

Team invitations (needs a token-based invite flow, deliberately deferred), billing/checkout (so Products subscriptions stay empty by default — accurate for a pre-launch product), and notifications (no event source exists yet to generate them).
