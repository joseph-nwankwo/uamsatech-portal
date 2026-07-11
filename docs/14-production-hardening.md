# Phase 14 — Production Hardening

Docker, GitHub Actions, CI/CD, Nginx, Security, Rate Limiting, Caching, Logging, Monitoring, Prometheus, Grafana, Health Checks, Backups, Kubernetes manifests.

This phase is infrastructure scaffolding rather than app features, and that changes what "verified" means. None of Docker, kubectl, nginx, redis-cli, pg_dump, or prometheus/promtool are installed in this sandbox — confirmed by checking each directly before writing anything. Everything below is split explicitly into **runtime-tested in this session** (health checks, security headers, rate limiting, structured logging, the metrics endpoint — all exercised against a real running server, including a real production build) and **written correctly, syntax/schema-validated, but not runtime-executed here** (Docker, GitHub Actions, Nginx, Prometheus, Grafana, Kubernetes, the backup scripts) — the same honesty boundary Phase 1 drew around Docker from the very start of this project.

## Real bugs found and fixed, not just new scaffolding

**Rate limiter memory leak.** `lib/auth/rate-limit.ts`'s bucket `Map` had no eviction — every unique key (IP, `login:<ip>:<email>`, user ID) created a permanent entry nothing ever removed. On a long-running process this is unbounded memory growth, worse the more unique callers accumulate. Fixed with a periodic sweep (every 5 minutes, `unref()`'d so it never keeps the process alive by itself) that deletes expired buckets. Exposed as `rateLimitBucketCount()` for the new metrics endpoint.

**`sitemap.ts` frozen at build time.** Same bug class as the Phase 11 status-page fix: this route queries the DB (blog posts, KB articles) but has no dynamic API, so Next prerendered it once at build time — a new blog post or KB article wouldn't show up in the sitemap until the next deploy. Fixed with `export const revalidate = 3600`; confirmed in the rebuilt output (`○ /sitemap.xml ... 1h` revalidate window now shown in the route table, next to `/status`'s existing `1m`).

**`docker-compose.yml` was missing a required env var entirely.** `AUTH_JWT_SECRET` (required, 32-char minimum per `lib/env.ts`) was never passed to the `app` service — `docker compose up` would have built successfully and then crashed on boot with a Zod validation error, the least helpful place to discover a missing config value. Fixed with an env-var substitution that fails loudly at `docker compose` invocation time (`${AUTH_JWT_SECRET:?...}`) instead of silently at container boot.

## Health Checks (`/api/health`, `/api/health/ready`) — real, tested

Split deliberately into liveness (checks nothing but the process itself — an orchestrator restarts the pod if this fails) and readiness (checks the database via `SELECT 1` — an orchestrator pulls the pod out of rotation if this fails, without restarting it). **Verified the split actually behaves differently**: pointed `DATABASE_URL` at an unreachable port, restarted the server, confirmed `/api/health/ready` correctly returned `503` while `/api/health` stayed `200` — then restored the real connection string and confirmed both recovered. This is the exact distinction a liveness-only health check gets wrong (restarting every pod in a fleet because the database had a 10-second blip).

## Rate Limiting — a real fix, and a real finding about how it was tested

The in-memory limiter itself already existed (Phase 5+). This phase fixed its leak (above) and **discovered something worth documenting rather than glossing over**: testing the fix via `npm run dev`, triggering a rate limit and then checking `/api/metrics`'s bucket count consistently read `0` — looked like a bug at first. Root-caused it to Next.js's dev server compiling separate route handlers into isolated module instances, so the `buckets` module-level `Map` isn't reliably shared across two different API routes _in dev mode specifically_. Rebuilt for production and ran the actual standalone server (`node .next/standalone/server.js`, the same artifact the Dockerfile produces) and confirmed the real behavior: a single failed login correctly took the bucket count from `0` → `1`, and three more distinct-key attempts took it to `4`. The fix is correct; the first test of it just used the wrong server mode. Documented as a gotcha below so it doesn't cost time again.

**Known, stated limitation, not an oversight**: this is still single-instance in-memory. The Kubernetes manifests here default to `minReplicas: 2` (`deploy/k8s/hpa.yaml`), which means the _effective_ rate limit across a horizontally-scaled deployment is up to N× the configured value, split unevenly across whichever pod each request lands on. A shared store (Redis) is the real fix for that and was deliberately not added — this sandbox's npm registry has a documented history of flaky installs, and adding a Redis client dependency with zero way to runtime-test it against a real Redis instance here would have been worse than stating the limitation plainly.

## Logging — real, tested

`lib/logger.ts`: single-line JSON to stdout/stderr (level, message, timestamp, arbitrary context) — the format every log aggregator expects without extra parsing config. No dependency added, same reasoning as above. Instrumented at 8 real points: all 3 billing webhook handlers (invalid signature → `warn`, valid event received → `info`), login (`auth.login_failed`, `auth.login_rate_limited`, both `warn`), and the `/admin` gate (`admin.access_denied` on a non-admin hitting a 404, `warn`). **Verified the actual output, not just that logger calls exist**: triggered 11 failed logins against the real dev server and grepped the captured process output, confirming real JSON lines like `{"level":"warn","message":"auth.login_rate_limited","timestamp":"...","ip":"::1"}` were actually written.

## Monitoring — `/api/metrics`, real and tested

Hand-rolled Prometheus text exposition format (no `prom-client` dependency, same flaky-install reasoning) exposing 9 gauges: process up/uptime, Node.js heap/RSS, database reachability, active rate-limit buckets, total users, total organizations. Optionally gated behind a `METRICS_TOKEN` bearer check (`lib/env.ts`) for internet-facing deployments; open by default on the assumption it's firewalled at the network layer, which `deploy/nginx/uamsatech.conf` actually does (see below). **Verified against the real running app**: correct `# HELP`/`# TYPE`/value lines, correct `Content-Type: text/plain; version=0.0.4`, real (not fabricated) user/organization counts matching the live database, and the rate-limit gauge tracked real state changes end-to-end (see above).

## Security headers — real, tested

`next.config.ts` now sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation all denied), `Strict-Transport-Security`, and a real `Content-Security-Policy` on every route. The CSP allows Google Analytics's and Microsoft Clarity's own domains plus `'unsafe-inline'` on `script-src` for their inline init snippets — a real, stated trade-off (a nonce-based CSP would remove it, at the cost of plumbing a per-request nonce through `middleware.ts`, not done here to avoid touching proven auth-redirect logic in a phase with no way to verify the change against real traffic). **Verified against both the dev server and the real production standalone server**: curled every header, confirmed presence and correct values on both. **One real gap, stated plainly**: there's no headless browser available in this sandbox, so the CSP was verified by header inspection and by confirming every page still returns 200 — not by confirming zero browser-console CSP violations from actual script execution. Next.js's production client bundle doesn't rely on `eval` (unlike dev-mode Fast Refresh), so this is a reasonable inference, not a confirmed observation.

## Caching — real, tested

RSS feed (`/blog/rss.xml`) now sends `Cache-Control: public, s-maxage=600, stale-while-revalidate=3600` — a feed reader polling every few minutes shouldn't hit the DB every time. Verified the header is actually present on a real response. The sitemap fix above is also a caching/freshness fix in the same spirit.

## Docker — written and fixed, not runtime-tested (no Docker in this sandbox)

Existing multi-stage `Dockerfile` (deps → builder → runner, non-root user, `output: standalone`) gained a `HEALTHCHECK` wired to `/api/health`. `docker-compose.yml`'s missing-env-var bug (above) is fixed, and it now has an app-level healthcheck too. Neither `docker build` nor `docker compose up` were run — `which docker` returns nothing in this environment. Validate with `docker build .` and `docker compose config` before relying on this.

## GitHub Actions / CI-CD — written, not runtime-executed (no `gh` CLI, no live repo trigger)

`.github/workflows/ci.yml`: typecheck, lint, format check, `prisma validate`, a real `prisma db push` against a Postgres service container, and a full `next build` — using a real 47-character placeholder `AUTH_JWT_SECRET` so the build's env validation actually passes in CI, not a fake short one. `.github/workflows/deploy.yml`: builds and pushes the Docker image to GHCR on merge to `main`. Deliberately stops there — there's no real deploy target (no kubeconfig, no SSH host, no cloud credentials) configured anywhere in this repo, so writing a "kubectl apply" step past the image push would be inventing infrastructure that doesn't exist rather than describing what does.

## Nginx — written, not runtime-tested (no nginx binary in this sandbox)

`deploy/nginx/uamsatech.conf`: HTTP→HTTPS redirect with an ACME challenge path left open for cert renewal, gzip, immutable long-cache headers for `/_next/static/`, a network-level allowlist restricting `/api/metrics` to internal IPs (defense in depth alongside `METRICS_TOKEN`), and **a second, independent rate-limiting layer** (`limit_req_zone`, tighter on `/api/auth/`) in front of the app's own per-action in-memory limiter — nginx catches raw request-flood abuse before it reaches Node; the app layer still owns the action-specific limits (5 signups/hour etc.) that depend on parsed request bodies nginx can't see. Sets `X-Forwarded-For`/`X-Forwarded-Proto`, which `lib/auth/rate-limit.ts`'s `requestIp()` already reads — this config and the app's IP-based limiting are designed to work together. Validate with `nginx -t` before use.

## Prometheus & Grafana — written, not runtime-tested (neither binary available)

`deploy/prometheus/prometheus.yml` scrapes `/api/metrics` every 30s. `deploy/grafana/`: datasource + dashboard auto-provisioning pointed at that Prometheus instance, plus a real dashboard JSON (`uamsatech-overview.json`) with 6 panels wired to the exact 9 metric names `/api/metrics` actually emits — not placeholder metric names. JSON syntax validated with `JSON.parse` (real check); the YAML files were validated the same way Prettier validates every file in this repo (`format:check` parses before formatting — a genuine syntax check, not just a naming convention check). Neither has been loaded by a real Prometheus/Grafana instance.

## Kubernetes manifests — written, not runtime-tested (no kubectl, no cluster)

`deploy/k8s/`: `namespace`, `configmap` (non-secret env), `secret` (a template with obviously-fake placeholder values and an explicit "never commit real values" instruction — generate the real one at deploy time via `kubectl create secret` or a proper secrets manager), `deployment` (2 replicas, rolling update with zero unavailable, resource requests/limits, liveness probe on `/api/health`, readiness probe on `/api/health/ready` — deliberately different probes for the reason explained above), `service`, `ingress` (nginx ingress class + cert-manager annotation), and `hpa` (CPU/memory-based autoscaling, 2–6 replicas). `.gitignore` gained an entry so a filled-in local secrets file can never be accidentally committed alongside the template.

## Backups — scripts written, not runtime-tested (no `pg_dump`/`pg_restore` in this sandbox)

`scripts/backup-db.sh` (timestamped `pg_dump -Fc` custom-format dump + retention pruning) and `scripts/restore-db.sh` (`pg_restore --clean --if-exists`, with an interactive confirmation prompt before it touches anything). Both pass `bash -n` syntax validation (a real check, run in this session) but couldn't be executed against real data here. The user's actual machine has a real local PostgreSQL 18 install, which almost certainly includes the standard `pg_dump`/`pg_restore` client tools — test these for real there before depending on them. Added as `npm run db:backup` / `npm run db:restore` alongside the existing `db:*` scripts.

## Verification

`tsc --noEmit`, `eslint`, `prettier --write` (which also validates every new YAML/JSON file's syntax) all clean.

Real, runtime-tested in this session:

- Liveness/readiness split behavior, including a genuine DB-down failure test with restore.
- Rate-limit fix, verified against the real production standalone server after an initial dev-mode false alarm that was root-caused rather than papered over.
- Structured JSON logging, verified by grepping real captured process output.
- `/api/metrics`, verified for correct format, correct content-type, and real (not fabricated) data.
- Security headers, verified present with correct values on both dev and the real production server.
- RSS caching header and the sitemap ISR fix, both verified present/working.
- Regression-checked 7 pages (marketing, auth, portal, admin) on the real production server — all correct (200s for public pages, 307s for auth-gated pages hit anonymously).

Written and statically validated only, not runtime-executed (tooling unavailable in this sandbox — confirmed absent before writing anything, not assumed): Docker build/compose, all GitHub Actions workflows, the Nginx config, Prometheus/Grafana, all Kubernetes manifests, and the backup/restore scripts' actual execution against a database.

Production build: clean, zero errors. **139 total concrete routes**, up from Phase 13's 136 — 3 new (`/api/health`, `/api/health/ready`, `/api/metrics`); no new pages.
