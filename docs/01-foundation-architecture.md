# Phase 1 — Foundation & Architecture

Status key: **[Verified]** confirmed working in this environment · **[Written, untested]** files are correct but couldn't be exercised in this sandbox (no Docker CLI, no live Postgres).

## Stack — installed versions

| Package                 | Version                                       | Notes                                                                         |
| ----------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| Next.js                 | 15.5.20                                       | App Router, pinned to v15 per spec (latest available was 16)                  |
| React / React DOM       | 19.2.7                                        |                                                                               |
| TypeScript              | ^5                                            | strict mode on                                                                |
| Tailwind CSS            | v4                                            | via `@tailwindcss/postcss`                                                    |
| shadcn/ui               | components generated against `@base-ui/react` | `shadcn init` defaulted to the Base UI library, not Radix — see gotcha below  |
| Prisma / @prisma/client | **6.19.3**                                    | pinned down from 7.x — see rationale below                                    |
| ESLint                  | 9.39.4, `eslint-config-next` 15.5.20          | flat config via `FlatCompat`                                                  |
| Prettier                | 3.9.4 + `prettier-plugin-tailwindcss`         |                                                                               |
| Husky                   | 9.1.7                                         | pre-commit → `lint-staged`                                                    |
| lint-staged             | 17.0.8                                        |                                                                               |
| TanStack Query          | 5.101.2                                       | installed, not yet wired to any data fetching (no client-side data needs yet) |
| React Hook Form + Zod   | 7.81.0 / 4.4.3                                | already used in the contact form                                              |

## Why Prisma is pinned to 6.19.3, not latest

`npm install prisma @prisma/client` installs 7.x by default. Prisma 7 removed the classic `datasource { url = env("DATABASE_URL") }` schema syntax in favor of a required driver-adapter (`@prisma/adapter-pg`) passed to the `PrismaClient` constructor plus a new `prisma.config.ts` file. That's a meaningfully bigger surface area (new config file, adapter wiring, different client construction) for what's meant to be a foundational schema with no consumers yet. Pinned both `prisma` and `@prisma/client` to the latest stable 6.x (6.19.3), which supports the conventional `url = env(...)` pattern most tooling and docs still assume. Revisit the 7.x adapter pattern in a later phase if there's a concrete reason to (e.g. edge runtime support).

## Folder structure changes

```
app/                          Next.js routes (unchanged from Phase 0)
components/
  ui/                          shadcn primitives (Base UI–backed)
  layout/                      site-header, site-footer — truly global/shared
features/
  marketing/components/        moved here from components/marketing/ — hero, product-card,
                                product-grid, integrations, values, faq, cta-section,
                                contact-form, coming-soon
types/
  product.ts                   Product type, now the single source; lib/site-config.ts
                                re-exports it for backward compatibility
lib/
  site-config.ts                site config, nav, products data (unchanged)
  utils.ts                      cn() helper (unchanged)
  db.ts                         new — Prisma client singleton (hot-reload safe)
  env.ts                        new — zod-validated process.env accessor
prisma/
  schema.prisma                 new — 11 models (see below)
docs/
  00-brand-product-strategy.md   Phase 0
  01-foundation-architecture.md  this file
```

`hooks/` was deliberately **not** created — git doesn't track empty directories and there's no hook to put there yet. It'll appear naturally once the first client-side hook is needed (likely Phase 2, auth: `useSession`/`useAuth`).

`features/` currently only holds `marketing/`. As auth, billing, and portal phases land, each becomes its own `features/<domain>/` module; `components/` stays reserved for primitives and truly global layout.

## Prisma schema — 11 models

Modeled directly from the tables named in the original project spec: `User` (+`UserRole` enum), `Organization`, `Product`, `Subscription` (+`SubscriptionStatus` enum), `BlogPost`, `Documentation`, `SupportTicket` (+`SupportTicketStatus` enum), `ContactMessage`, `NewsletterSubscriber`, `ApiKey`, `AuditLog`. Fields are intentionally minimal (id, timestamps, core relations) — this is the foundation skeleton; each later phase (auth, billing, CMS, portal) will extend the relevant models rather than guessing every field now.

**[Verified]** `npx prisma validate` passes, `npx prisma generate` succeeds, `@prisma/client` types compile. **Not verified:** no live PostgreSQL in this sandbox, so `prisma migrate dev` has never actually been run against a database — do that first thing once you have Postgres running (`docker compose up -d postgres` locally, then `npm run db:migrate`).

## Docker — **[Written, untested]**

- `Dockerfile`: 3-stage build (deps → builder → runner), runs `prisma generate` before `next build`, uses `output: "standalone"` (set in `next.config.ts`), runs as non-root `nextjs` user.
- `docker-compose.yml`: `postgres` service (16-alpine, named volume, healthcheck) + `app` service (builds from the Dockerfile, waits on postgres healthcheck).
- `.dockerignore` excludes node_modules, .git, docs, .env*.

No Docker CLI is available in this sandbox, so none of this has actually been built or run. Test with `docker compose up --build` before relying on it.

## Tooling configuration

- **ESLint**: flat config (`eslint.config.mjs`) using `FlatCompat` to load `next/core-web-vitals` + `next/typescript`, plus `eslint-config-prettier` to disable stylistic rules that conflict with Prettier. (The newer direct-import style, `eslint-config-next/core-web-vitals.js`, exports a `{ extends: [...] }` object whose `"plugin:@next/next/core-web-vitals"` string didn't resolve correctly with this ESLint/config-helpers version combo — `FlatCompat` is the more robust, long-documented path.)
- **Prettier**: `.prettierrc.json` (80-char width, double quotes off i.e. double quotes, `prettier-plugin-tailwindcss` for class sorting), `.prettierignore`.
- **Husky + lint-staged**: `.husky/pre-commit` runs `npx lint-staged`; staged `*.{js,jsx,ts,tsx}` get `eslint --fix` + `prettier --write`, staged `*.{json,md,css}` get `prettier --write`.
- **VS Code**: `.vscode/settings.json` (format-on-save via Prettier, ESLint fix-on-save, Tailwind IntelliSense class regex for `cva`/`cn`), `.vscode/extensions.json` (Prettier, ESLint, Tailwind CSS IntelliSense, Prisma).
- **npm scripts**: `dev`, `build`, `start`, `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `prepare` (husky), `db:generate`, `db:push`, `db:migrate`, `db:studio`.
- **Environment variables**: `.env.example` (committed template) + local `.env` (gitignored) with `DATABASE_URL`, `NODE_ENV`, `NEXT_PUBLIC_APP_URL` — matches the docker-compose Postgres credentials.

## Verification results

```
npx prisma validate   → schema is valid
npx prisma generate   → Prisma Client generated (v6.19.3)
npm run typecheck     → tsc --noEmit, zero errors
npm run lint           → eslint, zero errors/warnings
npm run format:check   → all files match Prettier style
```

Dev server restarted and re-verified after the `features/` move: `/`, `/products/uamsa`, `/contact` all return 200.

## Known gaps / sandbox limitations

- Docker/docker-compose are written but not build/run-tested (no Docker CLI here).
- No live PostgreSQL was available, so no real migration has been run — schema is only statically validated.
- The npm registry was slow and occasionally dropped connections (`ECONNRESET`) during this session; one install race briefly left `package.json` out of sync with `node_modules`, fixed manually. If you hit similar flakiness locally, install dependencies one at a time rather than in parallel.
