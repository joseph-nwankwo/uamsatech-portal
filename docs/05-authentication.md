# Phase 5 — Central Authentication

All requested pieces built and, for the first time this project, **verified end-to-end against a real PostgreSQL database** (the user's local Postgres 18, not a stub).

## Architecture decisions

**Hand-rolled JWT + refresh tokens, not NextAuth.** The phase explicitly lists JWT and refresh-token mechanics as deliverables — NextAuth would abstract exactly those away. `jose` (edge-compatible, WebCrypto-based) signs/verifies access tokens; `bcryptjs` (pure JS, no native build step) hashes passwords.

**Access token / refresh token split:**

- Access token: short-lived (15 min) JWT, payload `{ sub: userId, orgId?, role? }`, HS256, signed with `AUTH_JWT_SECRET`. Stateless — verified without a DB round trip (this is what `middleware.ts` checks at the edge).
- Refresh token: opaque random 32-byte value. Only its SHA-256 hash is stored (`RefreshToken.tokenHash`) — a database leak doesn't yield usable tokens. 30-day expiry. **Rotated on every use**: `/api/auth/refresh` and `/api/auth/select-organization` revoke the presented token and issue a new one, so a stolen-and-reused-after-rotation token is a detectable signal (not currently alerted on, but the revocation trail exists).

**Organization Selection required a schema change.** The original `User.organizationId` (single FK) can't represent a user belonging to multiple organizations, so it was replaced with a `Membership` join table (`userId`, `organizationId`, `role`, unique per pair). Nothing in the app referenced the old field yet, so this was safe. Login checks membership count: 0 → individual account, 1 → auto-selected into the access token, 2+ → `requiresOrgSelection: true`, routing to `/select-organization`. The active org travels with the refresh token (`RefreshToken.organizationId`) so it survives across refreshes without the client resending it.

**Email verification & password reset** use the same opaque-token-hashed-in-DB pattern as refresh tokens (`VerificationToken`, typed `EMAIL_VERIFICATION` or `PASSWORD_RESET`, single-use via `consumedAt`, 24h/1h expiry respectively). Resetting a password revokes every existing refresh token for that user — a compromised session can't outlive a password change.

**Login is enumeration-resistant**: a fixed dummy bcrypt hash is compared against even when the email doesn't exist, so response timing doesn't reveal account existence. `/api/auth/forgot-password` always returns the same generic message regardless of whether the account exists.

**Rate limiting** is in-memory, per-process (`lib/auth/rate-limit.ts`) — fine for one server instance, explicitly documented as needing a shared store (Redis) before scaling horizontally.

**No email provider configured** (no Resend API key) — `lib/auth/email.ts` logs the full email (including the verification/reset link) to the console instead of pretending to send it. This is exactly how the real end-to-end test below extracted working links.

**Single Sign-On architecture** — this repo can't literally test cross-subdomain SSO (the other 4 product subdomains aren't built), but it provides the actual mechanism two ways:

1. `COOKIE_DOMAIN` env var (unset in dev, `.uamsatech.com` in production) — when set, the access/refresh cookies are issued for the whole domain, so `lecturercraft.uamsatech.com` etc. automatically receive them.
2. `GET /api/auth/me` — CORS-enabled (`lib/auth/cors.ts`) for any `*.uamsatech.com` origin with credentials, so another product's frontend can call it to check "is this browser authenticated" and get user/org context, without needing its own copy of the JWT-verification logic.
3. `/login` accepts a `redirect_uri` query param (validated against the same origin allowlist) so another subdomain can send an unauthenticated user to central login and land them back where they started.

Deployment note: in this repo the auth pages live at `/login`, `/signup`, etc. on the main app (not a separate service) — making `auth.uamsatech.com` literally resolve to them in production is a domain-aliasing step (e.g. a Vercel domain alias pointing at this same deployment), not a code change.

## What was built

- `prisma/schema.prisma`: `Membership`, `RefreshToken`, `VerificationToken` models; `User.emailVerified`.
- `lib/auth/`: `passwords.ts`, `jwt.ts`, `tokens.ts`, `cookies.ts` + `cookie-names.ts` (kept dependency-free for middleware), `session.ts`, `rate-limit.ts`, `email.ts`, `cors.ts`, `issue-session.ts`.
- `app/api/auth/{signup,login,logout,refresh,forgot-password,reset-password,select-organization,me}/route.ts`.
- Pages: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` (server component, verifies on render), `/select-organization`, `/dashboard` (protected placeholder — explicitly not the full portal, that's a later phase).
- `middleware.ts` — edge-runtime JWT check protecting `/dashboard` and `/select-organization`, redirecting to `/login?redirect_uri=...`.
- Header's "Sign in"/"Get started" now point at `/login`/`/signup` instead of the external placeholder.

## Verification

Static checks: `tsc --noEmit`, `eslint`, `prettier --write` all clean. Production build succeeded — 44 pages, with `/dashboard`, `/reset-password`, `/select-organization`, `/verify-email`, and all `/api/auth/*` routes correctly dynamic (ƒ), everything else static.

**Crypto verified in isolation** (`bcryptjs` hash/verify, `jose` sign/verify + tamper rejection + expiry enforcement, token hashing) via a standalone script — 11/11 checks passed.

**Real end-to-end test against a live database** — a first for this project. The user has PostgreSQL 18 running locally; once they created a `uamsatech` database and gave me working credentials, `npx prisma db push` created the schema and the full flow was exercised via curl:

1. `POST /api/auth/signup` → 201, `access_token`/`refresh_token` cookies set.
2. Verification link extracted from the `[DEV EMAIL FALLBACK]` console log → `GET /verify-email?token=...` → "Your email is verified".
3. `POST /api/auth/login` → 200, `emailVerified: true` correctly reflects step 2, `requiresOrgSelection: false` (no memberships).
4. `POST /api/auth/refresh` → 200, new access + refresh token cookies (rotation confirmed by different token values).
5. `GET /api/auth/me` → 200, correct session data.
6. `POST /api/auth/logout` → 200, both cookies cleared (`Max-Age=0`).
7. Middleware: unauthenticated `GET /dashboard` → 307 to `/login?redirect_uri=%2Fdashboard`; authenticated → 200.
8. `POST /api/auth/forgot-password` → generic success message, real reset link logged.
9. `POST /api/auth/reset-password` with that token → success.
10. Login with the **new** password → 200 success.
11. Login with the **old** password → 401 (confirms the reset actually took effect, not just returned success).

**Sandbox note**: `npx prisma db push` (and `db execute`) hit `spawn EPERM` when run as a normal synchronous command in this environment's Bash tool, but succeeded when run via the tool's background-execution mode — a quirk of this sandbox, not a Prisma or code issue. Worth remembering for any future schema changes.

## What's still not built

The full customer portal (`/dashboard` is a deliberately minimal placeholder — organizations management, billing, team, API keys are later-phase work per the Phase 0 roadmap). CMS and billing remain unbuilt.
