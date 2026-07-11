# Phase 9 — Documentation Platform

All 7 pieces built (Developer Docs, API Docs, User Guides, Product Manuals, Search, Versioning, Code Blocks) — with one deliberate scoping decision made up front, before writing a word of content.

## What gets documented, and why

The 5 SaaS products (LecturerCraft, ScholarCraft, StudyFlow, Records, and UAMSA as a separate existing codebase) aren't built inside this project — there's no real API, no real UI, nothing to accurately document beyond what the marketing pages already say. Writing detailed API references or feature manuals for them would mean inventing endpoints and behavior that don't exist — the same fabrication trap flagged and avoided in Phases 3, 4, 7, and 8.

What **is** real: five phases of actually-built, actually-tested platform — authentication, sessions, SSO, the customer portal, and one genuine API-key-authenticated endpoint (`/api/v1/usage`, built in Phase 7). So that's what got documented, in detail, accurately, cross-checked against the real route source files rather than written from memory:

- **Developer Docs** — how JWT access tokens + rotating refresh tokens work (with the actual TTLs and the real timing-safe-login code), how SSO works across `*.uamsatech.com` via `COOKIE_DOMAIN` and `/api/auth/me`, and how payment webhook signature verification works (including the honest caveat that it's been tested with dummy keys, not a live transaction).
- **API Docs** — explicitly starts by explaining that most `/api/auth/*` and `/api/portal/*` routes are internal, cookie-authenticated, and not a supported public contract — documenting them as if they were would be misleading. The real API surface is `/api/v1/usage`: how to create an API key, the exact request/response shapes (pulled from the actual route file), and every real error code.
- **User Guides** — creating an account, joining an organization via invite, managing a team, understanding roles & permissions, security & sessions. All five map directly to real, working flows from Phases 5, 6, and 8.
- **Product Manuals** — the one category that couldn't be "real" in the same sense, so it's handled differently: `features/docs/content/manuals.ts` is **generated programmatically from the same `products` array the marketing pages already use**, not hand-duplicated content that could drift out of sync, and each page ends with an explicit callout that the product is still in development and links back to the marketing page.

## Search

Fully client-side — `features/docs/index.ts` builds a flat search index (title, description, flattened block text) from the same content data at import time, no backend search service, no API route. `DocsSearch` is a Dialog (Phase 2's Dialog, now used a fourth time this session) with an input that filters the index in-browser and links straight to the matching page.

## Versioning

Handled honestly rather than faked. There's exactly one version of this platform today, so `VersionBadge` shows "v1 (current)" with a tooltip that says plainly: this is where a version switcher will appear once a v2 exists. Every `DocPage` already carries a `version: "v1"` field — the data model is ready for a second version to be added later without restructuring, but nothing pretends multiple versions exist today.

## Code Blocks

No new dependency installed for syntax highlighting — given this session's repeated experience with slow/flaky npm installs (up to 17 minutes for a single package), a hand-rolled regex tokenizer (`features/docs/components/highlight.ts`) covers the three languages actually used in the docs (bash, JSON, TypeScript). It's built as an array of `{ text, className }` tokens rendered as React elements, **never `dangerouslySetInnerHTML`** — safe by construction regardless of what's in the code string. Token colors reuse the categorical chart palette already validated for contrast and colorblind-safety by the dataviz skill in Phase 2 (`chart-2`, `chart-3`, `chart-5`, plus the brand blue for keywords) rather than picking new arbitrary highlight colors.

## Layout

`/docs` moved out of the `(marketing)` route group into its own `app/docs/` segment with a dedicated layout — a lightweight header (logo, search, "back to site") and a sidebar, no marketing footer. Same reasoning as Phase 6's portal restructuring and the same route-group lesson from that phase: a docs platform needs its own shell, not the marketing chrome bolted on top.

## Verification

`tsc --noEmit`, `eslint`, `prettier --write` all clean on the first pass — no bugs surfaced this phase.

Dev-server checks: all 4 category types (`/docs/developer/authentication`, `/docs/api/usage-api`, `/docs/guides/joining-an-organization`, `/docs/manuals/lecturercraft`) return 200; verified the actual code block content renders correctly (real `signAccessToken` code visible in the HTML, not mangled by the tokenizer); verified the sidebar nav, version badge, and search trigger all render; confirmed the docs layout has no marketing-footer text (chrome restructuring worked); regression-checked `/`, `/pricing`, `/products`, `/careers` — no impact on the rest of the site.

Production build: **89 pages** — `/docs/[category]/[slug]` statically generated for all 17 real doc pages (4 developer + 3 API + 5 guides + 5 manuals), `/docs` itself static, everything else unchanged from Phase 8's build shape.
