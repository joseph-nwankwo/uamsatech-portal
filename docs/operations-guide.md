# Operations Guide

Day-to-day operation of a running instance: how to check on it, how to read what it's telling you, and what to do when something's wrong. Written for whoever is on call for this — currently, that's the same person who built it.

## Checking system health

Three real signals, in order of how much they tell you:

1. **`GET /api/health`** — liveness only. `200` means the Node process is up and responding. Doesn't touch the database.
2. **`GET /api/health/ready`** — readiness. `200` means the database is reachable (`SELECT 1`); `503` with `{"checks":{"database":"unreachable"}}` means it isn't. This is the one that actually tells you if the app can serve real requests.
3. **`GET /api/metrics`** — the full picture: process uptime, Node.js heap/RSS, `uamsatech_db_up`, `uamsatech_users_total`/`uamsatech_organizations_total` (sanity-check these aren't unexpectedly `0`), `uamsatech_rate_limit_backend_redis` (confirms whether Redis or the in-memory fallback is actually active), `uamsatech_redis_configured`, `uamsatech_storage_configured`.

If `METRICS_TOKEN` is set, include `Authorization: Bearer <token>` when curling `/api/metrics` manually.

## Reading logs

Every log line is single-line JSON (`lib/logger.ts`): `{"level":"...","message":"...","timestamp":"...", ...context}`. Where these land depends on how you're running the app — `docker logs`, `kubectl logs`, or your platform's log stream; this app always writes to stdout/stderr and never manages its own log files.

**Messages worth searching for:**

- `webhook.invalid_signature` — someone (or something) sent a billing webhook that didn't verify. Expected occasionally from scanners; a sustained burst against one provider is worth investigating.
- `auth.login_failed` / `auth.login_rate_limited` — failed/throttled login attempts. A spike from one IP across many distinct emails is credential stuffing, not a bug.
- `admin.access_denied` — a signed-in account (not a random visitor) tried to reach `/admin` and isn't on the allowlist. Worth knowing who, especially if it's not you.
- `rate_limit.redis_error_fallback` — Redis is configured but unreachable; the app is correctly failing open to the in-memory limiter rather than failing closed. Fix Redis, but the app degraded safely in the meantime.
- `redis.connection_error` — same underlying issue, logged from the client itself.

## Common incidents

**Readiness probe failing, liveness still healthy.** The database is down or unreachable — check Postgres directly first, not the app. The app is behaving correctly here (see the Architecture doc for why liveness and readiness are deliberately different checks); don't restart the app pods, fix the database.

**Rate limiting seems too aggressive across a scaled deployment.** Check `uamsatech_rate_limit_backend_redis` on each instance. If it reads `0` (in-memory fallback) on more than one running instance, the _effective_ limit is N× the configured value split unevenly across instances — this is the known, documented gap closed by setting `REDIS_URL`, not a new bug.

**A billing webhook isn't updating a subscription.** Check for `webhook.invalid_signature` around the expected time first — if present, the provider's webhook secret in your env doesn't match what's configured on their dashboard. If absent, check `webhook.received` logged the right event type, then trace the specific provider's webhook handler (`app/api/billing/<provider>/webhook/route.ts`) for that event.

**A real incident affecting the public site.** `Incident` records back the `/status` page (Phase 11) — there is no admin UI for this by design (see `docs/11-support-center.md` for why). Create/update one directly:

```js
await db.incident.create({
  data: {
    title: "...",
    body: "...",
    status: "INVESTIGATING",
    severity: "MAJOR",
    service: "...",
  },
});
// later:
await db.incident.update({
  where: { id },
  data: { status: "RESOLVED", resolvedAt: new Date() },
});
```

The status page revalidates every 60 seconds (`app/(marketing)/status/page.tsx`), so an update appears within a minute without a redeploy.

## Re-verifying security posture on demand

Beyond the automated weekly `security-scan.yml` audit and Dependabot's patch PRs (both covered in the Maintenance Guide), you can manually re-run the actual security-behavior test suite against any running instance at any time — useful right after a suspicious log entry (`admin.access_denied`, a burst of `auth.login_rate_limited`) when you want to confirm the enforced behavior still matches what's documented, not just re-read the code and hope:

```bash
TEST_BASE_URL=https://your-instance npm run test:security
```

This asserts, against the real running app, the things that actually matter during an incident: every protected route still rejects an anonymous caller, `/admin` still 404s a non-admin, rate limits still cut off at their configured threshold, and security headers are still present. A failure here is a live regression, not a hypothetical — treat it as an incident, not a test-suite flake, unless you can immediately explain why (e.g., you intentionally changed a limit).

## Scaling

Kubernetes: `deploy/k8s/hpa.yaml` autoscales 2–6 replicas on 70% CPU / 80% memory. Manual override: `kubectl scale deployment/uamsatech --replicas=N -n uamsatech`. Remember the rate-limiting caveat above before scaling past 1 replica without Redis configured.

## The admin dashboards

`/admin` (gated by `ADMIN_EMAILS`) has 6 pages, built in Phase 13: Revenue, Customer Analytics, Marketing, Product Analytics, Conversion Tracking, and the index (redirects to Revenue). All read real data — no synthetic/demo numbers. Check these periodically rather than only during an incident; `/admin/revenue`'s MRR figure and `/admin/customers`' signups chart are the fastest way to notice something's actually wrong (e.g., signups flatlining) versus just technically up.

## Rotating a secret

Changing `AUTH_JWT_SECRET` invalidates every existing session immediately (every access token was signed with the old secret and will fail verification) — every logged-in user gets signed out at once. Do this during a low-traffic window and expect a wave of re-logins, not an error spike; it's not a bug if it happens right after a rotation.

Billing provider webhook secrets can be rotated independently per-provider without affecting anything else — update the env var and the provider's dashboard together, since a mismatch produces exactly the `webhook.invalid_signature` symptom described above.
