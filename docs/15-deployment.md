# Phase 15 — Deployment

Production deployment: Frontend, Backend, Database, Redis, Storage, DNS, SSL, Email, Monitoring, Analytics, Backups, Security. Plus 4 generated guides: Deployment, Operations, Maintenance, Architecture. This phase's premise — "deploy to production" — required resolving a real limitation before writing anything: this session has no cloud account, no registered/DNS-controlled domain, no SSL issuance, and no provisioned Redis/S3 anywhere. Two scope questions were resolved with the user up front rather than either faking a live deployment or silently skipping the phase.

## What "Deploy" means here

The user chose deployment readiness over a live deployment. Nothing was actually deployed — there is nothing real to deploy to. Instead: any remaining infrastructure gaps from Phase 14 were closed (Redis, object storage), and the 4 requested guides were written against the real, working system this project actually is. Every deployment step described is accurate and ready to execute the moment real infrastructure exists; none of it has been executed here, and both the Deployment Guide and this document say so plainly rather than implying otherwise.

## Redis and storage — added for real, per the user's choice

The user chose to add both as genuine, working integrations rather than leave them undocumented gaps, on the same env-gated, graceful-degradation pattern as every other optional provider in this project.

**Redis** (`lib/redis.ts`, `ioredis`): backs `lib/auth/rate-limit.ts` when `REDIS_URL` is set, using an atomic `INCR`+`PEXPIRE` Lua script (avoids the real race condition a naive two-command version would have — a crash between the two commands would leave a key that never expires). Falls back to the existing in-memory limiter, and **fails open to it** if Redis errors mid-request rather than either blocking the request or silently disabling rate limiting. This closes the exact gap Phase 14 stated and deliberately didn't fix at the time (no local Redis available to test against, and a real reason not to add an untestable dependency then).

**A real correctness bug caught by TypeScript, not by testing:** making `checkRateLimit` sometimes return a `Promise` (Redis path) and sometimes a plain object (in-memory path) would have meant any caller that forgot `await` got a truthy `Promise` object back from `!allowed` — silently disabling rate limiting on the Redis path instead of erroring. Fixed by making it consistently `async`, which is a real behavior difference (not just a style choice): TypeScript then refused to compile until all 10 existing call sites added `await`, catching every one mechanically rather than by memory.

**Object storage** (`lib/storage.ts`, `@aws-sdk/client-s3`, S3-compatible — works with AWS S3 or R2/MinIO/Cloudinary via `S3_ENDPOINT`): wired into a concrete, real feature rather than added as unused scaffolding — portal profile avatar upload. New `User.avatarUrl` field; `POST /api/portal/profile/avatar` validates type (`png`/`jpeg`/`webp`) and size (2MB), uploads, updates the user record. The upload button is disabled with a clear message when storage isn't configured (verified: real 503 from the API, real `disabled` attribute rendered on the button) rather than presenting a control that would silently fail.

## A real sandbox blocker, worked around without losing correctness

Applying the `avatarUrl` schema change hit a new failure mode: `prisma db push`/`migrate`'s schema-engine binary started returning `Access Denied` when spawned — via both the Bash tool and PowerShell directly, ruling out a shell-specific issue. Checked and ruled out the two most likely causes directly: no Windows Defender threat detection recorded, no Mark-of-the-Web (`Zone.Identifier`) stream on the file. Root cause undetermined, but the **query engine and `prisma generate` were confirmed still working** — so the schema change was applied via `$executeRawUnsafe("ALTER TABLE users ADD COLUMN...")` through the already-working Prisma Client, then `prisma generate` brought the TypeScript types back in sync. Verified the column exists via `information_schema.columns` before proceeding. Documented in the Maintenance Guide as a real, previously-encountered failure mode, not swept under the rug.

## The four guides

Written as separate operator-facing documents (`docs/deployment-guide.md`, `docs/operations-guide.md`, `docs/maintenance-guide.md`, `docs/architecture.md`) rather than folded into the customer-facing `/docs` site — a developer runbook for "how to create an Incident record via script" has no business being visible to a customer, the same operator/customer boundary already drawn throughout this project. Each cross-references the real phase docs (`docs/0N-*.md` through `docs/14-*.md`) rather than re-deriving facts from memory, and the Architecture doc's "known limitations" section is the same 3 gaps already stated honestly elsewhere in the project (no individual billing self-serve, `Coupon` schema-only, in-memory-only rate limiting until Redis is configured) — collected in one place, not newly invented for this phase.

## Verification

`tsc --noEmit`, `eslint`, `prettier --write` all clean.

Full E2E test against the live DB and a real production build:

- `POST /api/portal/profile/avatar` confirmed `401` unauthenticated, `503` authenticated-but-unconfigured (real HTTP behavior, not just code review).
- `/portal/profile` confirmed rendering the disabled upload button (`disabled` attribute present) and the "aren't configured yet" message when storage is unset.
- `/api/metrics` confirmed reporting `uamsatech_redis_configured=0`, `uamsatech_storage_configured=0`, `uamsatech_rate_limit_backend_redis=0` — all correctly reflecting this environment's real unconfigured state, not hardcoded.
- **Rate limiting re-verified end-to-end against the real production standalone server** (`node .next/standalone/server.js`, same artifact the Dockerfile produces) after hitting the same Next dev-mode module-isolation artifact Phase 14 already diagnosed (rate-limit state not reliably shared across requests in `next dev` specifically): 10 login attempts succeeded (`401`), the 11th and 12th correctly returned `429`, and `/api/metrics` on that same server confirmed `uamsatech_rate_limit_active_buckets=1`.
- Regression-checked 8 pages including `/admin` and `/portal/dashboard` (both correctly `307` for anonymous requests) on the production server — no impact on the rest of the site.
- All new YAML/JSON config (docker-compose Redis service, k8s secret template additions) validated by Prettier's parser, which fails loudly on malformed YAML/JSON.

Production build: clean, zero errors, all 6 `/admin/*` routes and the new avatar route confirmed present in the build output. Route count: **140**, up from Phase 14's 139 (one new route: `/api/portal/profile/avatar`).
