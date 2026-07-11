# Deployment Guide

How to take this repository from source to a running production instance. Every piece referenced here is real and lives in this repo — nothing in this guide describes infrastructure that doesn't exist. What it can't do is walk you through steps that need accounts this project doesn't have (a registered domain, a cloud/hosting account, a Redis/S3/Resend/Stripe account) — you'll need those regardless of who deploys this.

## 1. Prerequisites

**Required:**

- A PostgreSQL 16+ database, reachable from wherever the app runs.
- A hosting target: either a Docker host (single VM, `docker-compose.yml`) or a Kubernetes cluster (`deploy/k8s/`).
- A 32+ character random secret for `AUTH_JWT_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

**Optional, each independently gracefully-degrading if skipped** (see `.env.example` for the full list):

- Redis (`REDIS_URL`) — rate limiting falls back to in-memory single-instance limiting without it.
- S3-compatible storage (`S3_*`) — profile avatar uploads are disabled without it.
- Resend (`RESEND_API_KEY`) — transactional emails log to the console (`[DEV EMAIL FALLBACK]`) instead of sending.
- Stripe / Paystack / Flutterwave keys — checkout for that provider returns a clear 503 instead of the app failing to boot.
- `ADMIN_EMAILS` — leave unset and nobody can reach `/admin` (revenue/customer/marketing dashboards).
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` / `NEXT_PUBLIC_CLARITY_PROJECT_ID` — analytics scripts simply don't load without them.
- `METRICS_TOKEN` — `/api/metrics` is open by default (expected to be firewalled — see `deploy/nginx/uamsatech.conf`).

## 2. Environment variables

Copy `.env.example` to `.env` (or your platform's secret manager) and fill in every value your deployment needs. `lib/env.ts` validates all of this at process startup with Zod — a missing required var (`DATABASE_URL`, `AUTH_JWT_SECRET`) fails loudly at boot, not silently later.

## 3. Database

```bash
npx prisma generate    # regenerate the client for the target environment
npx prisma db push     # sync the schema — see the sandbox note below
node prisma/seed.js    # seed products/plans/blog/docs/knowledge-base content
```

`prisma db push` is what this project has used throughout development (no migration history is currently tracked — see the Maintenance Guide for when to switch to `prisma migrate deploy` instead). Run the seed script once after the first schema push; it's idempotent (upserts), safe to re-run.

## 4. Choose a deployment path

### Path A — Docker Compose (single host)

```bash
docker compose up -d --build
```

Brings up Postgres, Redis, and the app together (`docker-compose.yml`). The app service will refuse to start without `AUTH_JWT_SECRET` set in your shell/`.env` (fails loudly via `${AUTH_JWT_SECRET:?...}`, a deliberate fix — see `docs/14-production-hardening.md`). Point a reverse proxy at it using `deploy/nginx/uamsatech.conf` for TLS termination, gzip, and edge-layer rate limiting.

### Path C — Vercel

The chosen path for this project's first real deployment. A few things are genuinely different on Vercel versus Docker/Kubernetes — read this whole section before running anything, not just the commands.

**`output: "standalone"` in `next.config.ts` is harmless here** — it's for self-hosting outside Vercel (Docker, in this repo's case); Vercel's own build pipeline ignores it and uses its own optimized output regardless. No config change needed to deploy to Vercel.

**`DATABASE_URL` cannot point at `localhost`.** Vercel functions run on Vercel's infrastructure, not this machine — the local Postgres this project has used all along (`localhost:5432`) is unreachable from there. You need a Postgres reachable from the public internet: Vercel Postgres (Neon-backed, adds itself to your project's env vars automatically), Neon, Supabase, or Railway all work. Pick one, get its connection string, and use that for `DATABASE_URL` in Vercel's project settings — not the value in your local `.env`.

**Redis stops being optional in practice.** `lib/auth/rate-limit.ts`'s in-memory fallback relies on a long-running Node process keeping a `Map` in memory between requests — true for the Docker/K8s paths, **not true on Vercel's serverless model**, where each invocation can run in a different, short-lived container. Without `REDIS_URL` set, rate limiting on Vercel will be unreliable (each container effectively resets its own counter) — a real security-relevant gap for this platform specifically, not just a nice-to-have. Get a `REDIS_URL` from Upstash (Vercel's marketplace has a one-click integration) before this handles real traffic.

**Connection pooling.** Serverless functions open many short-lived database connections — a Postgres instance can run out of connections under load without pooling in front of it. Neon and Supabase both include built-in pooling (use their pooled connection string, usually the default one they give you); if you're on plain Postgres, put PgBouncer or Prisma Accelerate in front of it.

Steps, once you have a Postgres connection string and (ideally) a Redis one:

```bash
vercel login                     # browser-based auth — this is the one step only you can do
vercel link                      # connects this local directory to a Vercel project
vercel env add DATABASE_URL production
vercel env add AUTH_JWT_SECRET production   # use a freshly generated one, never the local dev value
vercel env add REDIS_URL production         # optional but see the note above
# repeat vercel env add for any other vars this deployment needs (RESEND_API_KEY, STRIPE_SECRET_KEY, etc.)
vercel --prod
```

Then run the database step (step 3 above) once against the real production `DATABASE_URL` — `npx prisma db push` and `node prisma/seed.js` from your machine with `DATABASE_URL` temporarily set to the production value works fine for a first deploy.

Once this repo has a GitHub remote, connecting the repo in the Vercel dashboard (Project → Git) instead of using `vercel --prod` manually gives you auto-deploy on every push to `main`, and Vercel-native preview deployments per pull request — the more durable path for ongoing work, worth switching to once GitHub is set up.

### Path B — Kubernetes

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/configmap.yaml
# Generate the real secret — never apply the tracked secret.yaml template as-is:
kubectl create secret generic uamsatech-secrets --namespace uamsatech \
  --from-literal=AUTH_JWT_SECRET="$(openssl rand -base64 32)" \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=REDIS_URL="..." \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f deploy/k8s/deployment.yaml
kubectl apply -f deploy/k8s/service.yaml
kubectl apply -f deploy/k8s/ingress.yaml
kubectl apply -f deploy/k8s/hpa.yaml
```

Requires an nginx ingress controller and cert-manager already installed on the cluster (the `ingress.yaml` annotations assume both, it doesn't install either). `deployment.yaml`'s liveness/readiness probes point at `/api/health` and `/api/health/ready` respectively — see the Architecture doc for why they're deliberately different checks.

Run the database steps (step 3) from a one-off pod or your CI pipeline before the first rollout — the Deployment doesn't run migrations itself.

## 5. DNS

Point your domain at whatever the ingress/load balancer/reverse-proxy host resolves to:

- **Vercel** (this project's chosen host, and you already own `uamsatech.com`): in the Vercel dashboard, Project → Settings → Domains → add `uamsatech.com`. Vercel then shows you the exact record to add — usually an `A` record to `76.76.21.21` for the apex domain, or a `CNAME` to `cname.vercel-dns.com` for `www` — add whichever it actually displays (Vercel occasionally changes these) at your domain registrar's DNS settings. Propagation is typically minutes, sometimes up to 24-48 hours depending on your registrar's TTL.
- Kubernetes: an `A`/`AAAA` record (or `CNAME` on a managed LB) to the ingress controller's external IP.
- Docker Compose behind nginx: an `A` record to the host's public IP.

`deploy/nginx/uamsatech.conf` is written for `uamsatech.com` and `www.uamsatech.com` (Docker/K8s paths only — Vercel doesn't use nginx). Whichever path you use, update `NEXT_PUBLIC_APP_URL` and `COOKIE_DOMAIN` (`.uamsatech.com`, so the shared SSO cookie covers every product subdomain) to match.

## 6. SSL

- **Vercel**: automatic. Once the domain is added and DNS verifies, Vercel provisions and renews the certificate itself — nothing to configure.
- Kubernetes: `ingress.yaml`'s `cert-manager.io/cluster-issuer: letsencrypt-prod` annotation requests a certificate automatically once cert-manager and a `ClusterIssuer` named `letsencrypt-prod` exist on the cluster.
- Docker/nginx: use certbot against `deploy/nginx/uamsatech.conf` — the config already reserves `/.well-known/acme-challenge/` above the HTTP→HTTPS redirect so renewal doesn't break.

## 7. CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`: typecheck, lint, format check, unit tests, a real `prisma db push` against a Postgres service container, a full `next build`, and the security integration test suite against a real running instance of that build. This runs regardless of hosting target.

**On Vercel**, this is your actual deploy mechanism once the repo is on GitHub: connecting the repo in the Vercel dashboard deploys automatically on every push to `main` (and creates a preview deployment per pull request) — `.github/workflows/deploy.yml` (which builds and pushes a Docker image to `ghcr.io`) is for the Docker/Kubernetes paths and isn't part of the Vercel flow at all.

## 8. First-deploy checklist

- [ ] `GET /api/health` returns `200`.
- [ ] `GET /api/health/ready` returns `200` (confirms DB connectivity from inside the deployed environment, not just locally).
- [ ] `GET /api/metrics` returns real, non-zero `uamsatech_users_total` after seeding (or `0` on a genuinely fresh DB — either is correct, just confirm it's not erroring).
- [ ] Sign up a real test account, confirm the `[DEV EMAIL FALLBACK]` log appears if `RESEND_API_KEY` is unset, or a real email arrives if it's set.
- [ ] Add your own email to `ADMIN_EMAILS`, redeploy, confirm `/admin/revenue` is reachable and every other account still 404s on it.
- [ ] Confirm security headers are present: `curl -sD - -o /dev/null https://yourdomain.com/ | grep -i content-security-policy`.
- [ ] Run `scripts/backup-db.sh` once manually to confirm `pg_dump` is available and the target directory is writable, before relying on it as a scheduled job.

## What this guide can't cover

As of 2026-07-11: a hosting target (Vercel) and domain (`uamsatech.com`, already owned) are decided, and the repo has its first real git commit — but nothing has actually deployed yet. That still needs, in order: (1) a GitHub remote to push this repo to, (2) `vercel login` run interactively in a real browser (not something automatable from here), (3) a hosted Postgres connection string, (4) ideally a Redis connection string given the serverless rate-limiting note in Path C above. None of these can be created on your behalf — they need your accounts, and in the case of a real domain-DNS change, direct access to your registrar. Everything in this guide was written against, and cross-checked with, the real Dockerfile/`docker-compose.yml`/`deploy/k8s/*`/`.github/workflows/*`/`vercel` CLI in this repo — but the actual `vercel --prod`, `kubectl apply`, `docker compose up`, and DNS record creation have not been executed, because the accounts to run them against don't exist here yet. Execute this guide for real the first time you deploy, and correct anything here that turns out to be wrong in practice.
