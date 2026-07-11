# Phase 0 — Brand & Product Strategy

Status key used throughout: **[Built]** already implemented in this codebase · **[Planned]** defined here, not yet built.

## 1. Brand Strategy

**Vision:** To become Africa's leading provider of intelligent education technology solutions by building a unified ecosystem of AI-powered academic software.

**Mission:** Empower universities, lecturers, researchers, registrars, and students with intelligent software that simplifies teaching, learning, research, administration, and academic records management.

**Core values:** Simplicity, Reliability, Innovation, Security, Scalability, User-Centered Design, Academic Excellence. **[Built]** — rendered on `/about` and Home.

**Positioning:** UAMSATech is the parent platform — one account, one billing relationship, five products. It is explicitly _not_ one of the SaaS products; it's the marketing site, auth gateway, and customer portal that sits above them.

**Identity**

| Token            | Value     | Usage                                     |
| ---------------- | --------- | ----------------------------------------- |
| Primary — Navy   | `#0A2540` | Headers, primary CTAs, wordmark badge     |
| Secondary — Gold | `#C9A227` | Highlighted plan, premium accents, badges |
| Accent — Blue    | `#2F6FEB` | Links, focus rings, dark-mode primary     |
| Typography       | Inter     | All UI text                               |

**[Built]** as CSS custom properties in `app/globals.css` (`--brand-navy`, `--brand-gold`, `--brand-blue`) and wired through shadcn's semantic tokens (`--primary`, `--secondary`, `--accent`, `--ring`) for both light and dark mode.

**Design language:** premium, minimal, conversion-focused, inspired by Stripe/Vercel/Linear/Notion/Clerk/Framer. Subtle motion only (Framer Motion fades/slides on entry, no gimmicks).

**Voice & tone:** confident and clear, speaks to academic administrators and educators as domain experts — not "tech-bro" SaaS voice, not overly formal/bureaucratic either. Avoid hype words ("revolutionary", "game-changing"); let the product list and specificity of features carry credibility.

**Logo style:** wordmark ("UAMSATech") paired with a navy rounded-square monogram badge ("U" in white) — **[Built]** in `SiteHeader`/`SiteFooter`. Same mark should become the favicon and portal app icon in later phases.

---

## 2. Product Strategy & Hierarchy

UAMSATech is the umbrella; five independent SaaS products sit under it, each usable standalone but stronger together via SSO.

| Product           | Purpose                                                                                    | Audience                                | Deployment                                       | Subdomain                     | Database           | Role in funnel                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------ | ----------------------------- | ------------------ | ------------------------------------------------------------------------------ |
| **UAMSA**         | University ERP / SIS (admissions, students, staff, courses, results, transcripts, fees)    | Universities                            | Institution only                                 | `uamsa.uamsatech.com`         | `uamsa_db`         | Anchor institutional deal — highest ACV, longest sales cycle                   |
| **LecturerCraft** | AI teaching platform (notes, lesson plans, question/exam/assignment generators, AI TA)     | Individual lecturers, universities      | Individual, institution, integrated w/ UAMSA     | `lecturercraft.uamsatech.com` | `lecturercraft_db` | Bottom-up acquisition — free tier → individual champion → institutional upsell |
| **ScholarCraft**  | AI academic writing (thesis, dissertation, lit review, citations, research assistant)      | Students, researchers, universities     | Individual, institution, integrated w/ UAMSA     | `scholarcraft.uamsatech.com`  | `scholarcraft_db`  | Bottom-up acquisition, high-frequency use during thesis season                 |
| **Records**       | Academic records management (transcripts, composite results, mark sheets, QR verification) | Registrars, exam officers, universities | Standalone, integrated w/ UAMSA, third-party SIS | `records.uamsatech.com`       | `records_db`       | Wedge product — sells into registrars even where UAMSA isn't adopted yet       |
| **StudyFlow**     | AI study planning (planner, AI tutor, goal tracking, revision, assignment tracker)         | Students, universities                  | Individual, institution, integrated w/ UAMSA     | `studyflow.uamsatech.com`     | `studyflow_db`     | Bottom-up acquisition, high volume / low ACV                                   |

**[Built]** as the canonical data source in `lib/site-config.ts` (`products` array) — every product page, card, and pricing row reads from this single source. Any future phase that touches product data should extend this file, not hardcode elsewhere.

**Cross-sell logic:** LecturerCraft, ScholarCraft, StudyFlow, and Records are designed to land individually (low-friction, sometimes free) and then convert the institution into a UAMSA deal once enough of its staff/students/registrars are already using a satellite product on shared SSO. UAMSA in turn makes every satellite product "integrated" (shared roster, single billing).

**Central authentication:** one UAMSATech account via `auth.uamsatech.com` issues JWT + refresh token, valid across all five products — no duplicate accounts, single sign-on. **[Planned]** — not yet built; marketing site currently links "Sign in" / "Get started" CTAs to this subdomain as placeholders.

---

## 3. Information Architecture

### Public site (uamsatech.com) — **[Built]**

```
/                     Home
/about                About (vision, mission, values)
/solutions            By audience: Universities, Lecturers, Students & Researchers, Registrars
/products             All 5 products, integrations
/products/[slug]      uamsa | lecturercraft | scholarcraft | records | studyflow
/pricing              Plans (Individual, Institution, Standalone) + per-product pricing table
/customers            [stub — coming soon]
/blog                 [stub — coming soon]
/docs                 [stub — coming soon, will federate to docs.uamsatech.com]
/careers              [stub — no open roles]
/contact              Contact form (React Hook Form + Zod)
/support              [stub — coming soon]
/privacy              Privacy Policy (placeholder legal copy, pending review)
/terms                Terms of Service (placeholder legal copy, pending review)
/status               Static "all systems operational" per-service status
/sitemap.xml          Generated from products + static routes
/robots.txt           Generated
```

### Authenticated portal (portal.uamsatech.com) — **[Planned, not yet built]**

```
/dashboard            Overview across subscribed products
/organizations         Manage institution(s) / team membership
/billing               Invoices, plan, payment method (Stripe/Paystack/Flutterwave)
/team                  Team member management, roles
/api-keys              API key issuance/rotation
/products              Product access matrix, launch links to each subdomain
/notifications         Account & billing notifications
/profile               User profile
/settings              Account settings, security
```

### Subdomain map — **[Planned]**

`uamsatech.com` (marketing/portal), `auth.uamsatech.com`, `docs.uamsatech.com`, `api.uamsatech.com`, `uamsa.`, `lecturercraft.`, `scholarcraft.`, `records.`, `studyflow.` `.uamsatech.com` each. Only the marketing site exists today; the rest are placeholder link targets.

---

## 4. Navigation — **[Built]**, source of truth `lib/site-config.ts`

**Primary nav** (`mainNav`): Products · Solutions · Pricing · Customers · Docs · Blog, plus persistent "Sign in" / "Get started" CTAs (desktop inline, mobile via `Sheet` drawer).

**Footer nav** (`footerNav`), four columns:

- **Product** — All Products, Pricing, Solutions, Integrations
- **Company** — About, Careers, Customers, Contact
- **Resources** — Documentation, Blog, Support, Status
- **Legal** — Privacy Policy, Terms of Service

**Portal nav** — **[Planned]**: left sidebar (Dashboard, Organizations, Billing, Team, API Keys, Products, Notifications) + top-right profile/settings menu, once the portal is built.

---

## 5. Pricing Model — **[Built]** on `/pricing`

Three plan tiers (not per-product SKUs at the top level, to keep the decision simple):

| Plan                          | Price               | For                              | Includes                                                                                                    |
| ----------------------------- | ------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Individual**                | From ₦0 (free tier) | Lecturers, students, researchers | One product, SSO account, core AI tools, email support                                                      |
| **Institution** (highlighted) | Custom              | Universities                     | All 5 products, institution-wide deployment, SSO across products, dedicated onboarding, custom integrations |
| **Standalone / Third-party**  | Custom              | Registrars / exam offices        | Standalone Records, third-party SIS integration, QR verification, priority support                          |

Below the plan cards, a per-product table maps each product to its deployment options and whether it has a free tier or requires an institutional quote — read live from `products` in `lib/site-config.ts`.

**Payment rails:** Stripe (global), Paystack + Flutterwave (Africa-first local currency) — **[Planned]**: referenced in FAQ copy and terms/privacy placeholders; no billing integration wired yet.

**Billing relationship:** one UAMSATech account can hold multiple product subscriptions under unified billing, whether the account belongs to an individual or an institution's admin.

---

## 6. Customer Journeys — **[Planned]**, new in this phase

### A. University decision-maker (Registrar / IT Director / VC's office) — anchors UAMSA

1. Awareness via search, conference, or peer referral.
2. Lands on Home → `/solutions` (Universities card) → `/products/uamsa`.
3. Reviews `/pricing` → Institution tier → clicks "Talk to sales".
4. Submits `/contact` form → sales conversation → custom demo & quote.
5. Contract signed → onboarded via `portal.uamsatech.com` (institution admin creates org, invites team).
6. Institution-wide SSO rollout of UAMSA.
7. **Expansion:** sales cross-sells LecturerCraft, ScholarCraft, StudyFlow, Records to the same institution using the same account.

### B. Individual lecturer — bottom-up acquisition for LecturerCraft

1. Awareness via social/search/colleague recommendation.
2. Lands directly on `/products/lecturercraft` (paid channel or direct link, not necessarily Home first).
3. Reviews features → `/pricing` Individual tier (free) → signs up via `auth.uamsatech.com`.
4. Uses core AI tools (lecture notes, question generator) inside the product subdomain.
5. Hits usage limits → in-product upgrade prompt → converts to paid Individual plan.
6. **Expansion path:** becomes an internal champion who requests institutional UAMSA/LecturerCraft adoption — feeds back into Journey A.

### C. Student / researcher — bottom-up acquisition for ScholarCraft / StudyFlow

1. Awareness via peer referral or university recommendation (often seasonal — thesis deadlines, exam periods).
2. Lands on `/products/scholarcraft` or `/products/studyflow`.
3. Free-tier signup via `auth.uamsatech.com`, immediate use (no sales conversation).
4. Upgrades for advanced features (e.g. more AI research assistant queries) at point of need.
5. Renews each semester/academic year; low support burden, high volume.

### D. Registrar / examination officer — wedge product for Records

1. Pain point: manual transcript/result generation, no verification mechanism.
2. Searches for a solution → lands on `/products/records`.
3. Reviews features (QR verification, Excel import, mark sheet generator) → `/pricing` Standalone/Third-party tier.
4. Submits `/contact` → pilots with one department/faculty.
5. Full rollout, optionally integrated with the institution's existing SIS (not necessarily UAMSA).
6. **Expansion path:** once the institution sees value, Records success case is used to open a broader UAMSA conversation — feeds back into Journey A.

### E. Cross-product SSO journey — any existing authenticated user

1. User already holds a UAMSATech account (via any of Journeys A–D) authenticated at `auth.uamsatech.com`.
2. Discovers a second product via the marketing site or the portal's product directory.
3. One click grants access without re-registering — auth session already covers it.
4. New subscription is added to the existing account under unified billing (no duplicate accounts, no duplicate checkout for identity).

**Implication for later phases:** the portal (`/dashboard`, `/organizations`, `/billing`) must be built so Journey E's "add a product to an existing account" step is a real, low-friction flow — this is the connective tissue that makes the five-product ecosystem behave like one platform rather than five separate purchases.

---

## What's already built vs. what Phase 0 unlocks next

Everything under §1–§5 already exists in code (branding tokens, product data, navigation, pricing page). The net-new output of this phase is §6, the customer journey maps, plus this document as a single reference so future phases (auth, portal, CMS, billing) build toward the funnel described above instead of reinventing it. Recommended next phase: auth (`auth.uamsatech.com`) and the portal shell, since Journeys A and E both depend on it.
