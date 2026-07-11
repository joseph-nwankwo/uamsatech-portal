# Phase 3 — Marketing Website

All 14 requested pages, all production-ready and verified with a real `next build`, not just the dev server.

## Pages that already existed (from before Phase 0), reviewed for this phase

Home, About, Products (+ 5 dynamic product pages), Solutions, Pricing, Contact, Privacy, Terms, Status — all already had real content from the initial marketing build. Reviewed for broken links (e.g. confirmed the footer's `/products#integrations` anchor actually exists) and left as-is; no functional issues found.

## Pages built out this phase (previously "coming soon" stubs)

**Customers** — Before writing this, flagged to the user that fabricating fake institution logos/testimonials for a pre-launch product would be dishonest marketing. User chose the audience-framed approach: no fake logos, instead outcomes framed per persona (universities/lecturers/students/registrars, matching the Phase 0 customer journeys) plus an honest "become a founding partner" CTA into `/contact`.

**Blog** — `features/blog/data.ts` holds 3 genuine, company-authored sample posts (introducing the platform, an AI-teaching-assistant piece, an Africa-first company post) — not fabricated third-party claims, just first-party content marketing, which is normal practice even pre-launch. `/blog` is the index, `/blog/[slug]` is a static per-post page with `generateStaticParams`/`generateMetadata` and `BlogPosting` JSON-LD.

**Documentation** — A genuine getting-started hub: explains the central-auth/SSO model (from the Phase 0 IA) and links out to each of the 5 products. Deliberately doesn't fabricate detailed API/feature docs for products that aren't fully built yet — it's an honest entry point, built to grow as `docs.uamsatech.com` content is written.

**Support** — Three real channels (Contact, Documentation, Status) plus a short FAQ on response times, password resets (routed through central auth), and dedicated institutional support contacts.

**Careers** — Company values (from Phase 0) plus a genuine `EmptyState` component (Phase 2) for "no open roles right now" — the first real, non-showcase usage of that component — with a CTA to register interest via `/contact`.

## SEO

`sitemap.ts` extended with the 3 blog post routes (in addition to the 5 product routes already there).

## Verification

This phase went further than dev-server curling — ran an actual `next build`:

1. First build attempt failed: `Cannot find module './611.js'` while prerendering `/404`. Root cause: the dev server was still running against the same `.next` directory while `next build` also wrote to it — running dev and build concurrently against one build cache corrupts it. Not a code bug.
2. Fix: stopped the dev server, `rm -rf .next`, reran `npm run build` clean.
3. Clean build succeeded: **29 pages**, all Static or SSG (`○`/`●`), zero dynamic/server-rendered pages — the entire marketing site is static, meaning it can be hosted on Vercel's CDN edge with no server compute per request.

```
Route (app)                                     Size  First Load JS
┌ ○ /                                        42.2 kB         169 kB
├ ○ /about                                     405 B         111 kB
├ ○ /blog                                      276 B         106 kB
├ ● /blog/[slug]                               885 B         106 kB   (3 posts)
├ ○ /careers                                   405 B         111 kB
├ ○ /contact                                 32.2 kB         148 kB
├ ○ /customers                                 406 B         111 kB
├ ○ /docs                                      814 B         106 kB
├ ○ /pricing                                   779 B         127 kB
├ ○ /privacy / /terms                          133 B         102 kB
├ ○ /products                                  408 B         111 kB
├ ● /products/[slug]                           443 B         118 kB   (5 products)
├ ○ /solutions                                 406 B         111 kB
├ ○ /status                                    801 B         103 kB
└ ○ /support                                   207 B         118 kB
```

After the clean build, the dev server was restarted and every route was re-curled (`/`, `/blog`, `/blog/introducing-uamsatech`, `/design-system`, `/products/uamsa`, `/customers`, `/docs`, `/support`, `/careers`) — all 200, no errors in the server log.

```
npm run typecheck     → zero errors
npm run lint          → zero errors
npm run format:check  → all files match
npm run build          → succeeds, 29/29 pages generated
```

## What's still not built

Portal (`portal.uamsatech.com`), central auth (`auth.uamsatech.com`), CMS/billing — unchanged from Phase 1's assessment. The "Sign in"/"Get started" header buttons still link to the placeholder `auth.uamsatech.com` URL.
