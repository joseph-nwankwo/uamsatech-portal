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

- Kubernetes: an `A`/`AAAA` record (or `CNAME` on a managed LB) to the ingress controller's external IP.
- Docker Compose behind nginx: an `A` record to the host's public IP.

`deploy/nginx/uamsatech.conf` is written for `uamsatech.com` and `www.uamsatech.com` — update the `server_name` directives if deploying under a different domain, and update `NEXT_PUBLIC_APP_URL` / `COOKIE_DOMAIN` to match.

## 6. SSL

- Kubernetes: `ingress.yaml`'s `cert-manager.io/cluster-issuer: letsencrypt-prod` annotation requests a certificate automatically once cert-manager and a `ClusterIssuer` named `letsencrypt-prod` exist on the cluster.
- Docker/nginx: use certbot against `deploy/nginx/uamsatech.conf` — the config already reserves `/.well-known/acme-challenge/` above the HTTP→HTTPS redirect so renewal doesn't break.

## 7. CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`: typecheck, lint, format check, `prisma validate`, a real `prisma db push` against a Postgres service container, and a full `next build`. `.github/workflows/deploy.yml` builds and pushes the Docker image to `ghcr.io/<your-repo>` on merge to `main`, using the automatically-provided `GITHUB_TOKEN` — no extra secret needed for that step. It deliberately stops at "image pushed" — wire a final `kubectl apply`/platform-CLI step once you have a real cluster/host target; writing one now would describe infrastructure that doesn't exist.

## 8. First-deploy checklist

- [ ] `GET /api/health` returns `200`.
- [ ] `GET /api/health/ready` returns `200` (confirms DB connectivity from inside the deployed environment, not just locally).
- [ ] `GET /api/metrics` returns real, non-zero `uamsatech_users_total` after seeding (or `0` on a genuinely fresh DB — either is correct, just confirm it's not erroring).
- [ ] Sign up a real test account, confirm the `[DEV EMAIL FALLBACK]` log appears if `RESEND_API_KEY` is unset, or a real email arrives if it's set.
- [ ] Add your own email to `ADMIN_EMAILS`, redeploy, confirm `/admin/revenue` is reachable and every other account still 404s on it.
- [ ] Confirm security headers are present: `curl -sD - -o /dev/null https://yourdomain.com/ | grep -i content-security-policy`.
- [ ] Run `scripts/backup-db.sh` once manually to confirm `pg_dump` is available and the target directory is writable, before relying on it as a scheduled job.

## What this guide can't cover

There is no live deployment behind this guide today — this repository has no cloud account, no registered domain, no DNS zone, and no provisioned Redis/S3/Postgres-as-a-service anywhere connected to it. Everything above was written against, and cross-checked with, the real Dockerfile/`docker-compose.yml`/`deploy/k8s/*`/`.github/workflows/*` files in this repo — but the actual `kubectl apply`, `docker compose up`, and DNS record creation have not been executed in this session, because there is nothing real to run them against. Execute this guide for real the first time you deploy, and correct anything here that turns out to be wrong in practice.
