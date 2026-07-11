# Phase 11 — Support Center

All 8 pieces built (Knowledge Base, FAQs, Support Tickets, Live Chat, Contact Forms, Status Page, Bug Reports, Feature Requests). Two scope questions were resolved with the user up front, before writing any code, because they had real architecture implications: how to build "Live Chat" honestly with no support-staff system in this codebase, and whether Feature Requests should be a public voting board or a private submission box.

## Live Chat, without a live agent

There is no platform-staff concept anywhere in this codebase (the same fact that shaped Phase 10's "no portal blog editor" decision) — so a real-time chat widget implying someone is on the other end would be dishonest. The user chose the async option: **Live Chat is a real message thread on a support ticket**, not a chat-styled contact form. `TicketMessage` (`author: USER | STAFF`) threads onto `SupportTicket`; the customer-facing UI at `/portal/support/[id]` renders it like a chat (bubbles, own-message alignment), but nothing about it claims real-time presence. STAFF replies are authored directly via script — demonstrated during E2E testing by inserting one directly into the DB and confirming it renders correctly and distinctly (labeled "UAMSATech Support") — the same content-management pattern as blog posts and docs, not a live agent console.

## Feature Requests, as a real public board

The user chose the public, upvotable option. `FeatureRequest` + `FeatureRequestVote` (unique on `[featureRequestId, userId]`, so voting again toggles the vote off) back a genuinely public `/feature-requests` page — anyone can see it, only signed-in users can submit or vote, and submitting a request casts an implicit first vote for it (standard behavior for this kind of board, verified in E2E testing). No requests were seeded — like Phase 10's comments and newsletter subscribers, the board starts genuinely empty rather than seeded with invented "customer" asks, since inventing feedback attributed to fictional users would be exactly the kind of fabrication avoided everywhere else this session.

## Knowledge Base vs. Docs — different job, not a duplicate

`KnowledgeBaseArticle` **repurposes the unused `Documentation` model** left over from Phase 1 (confirmed via grep: zero references anywhere in the app) rather than adding a second, overlapping content table next to it. Content is deliberately distinct from Phase 9's Docs platform: Docs explains _how the system works_ (developer/process reference), the Knowledge Base answers _why isn't this working_ — troubleshooting and support-ticket-deflection content like "My invitation link isn't working" or "I can't log in." Seven articles across four categories, all documenting real, already-built functionality (verification email fallback, SSO, billing/invoices, invitation expiry, last-owner safeguard, login troubleshooting) — including one article that plainly states a real gap ("there's currently no self-serve way to downgrade, cancel, or switch a plan... this is a known gap, not an oversight"), consistent with how that same billing gap was flagged honestly in Phase 7 and Phase 10's docs.

## Support Tickets & Contact Forms

`SupportTicket` already existed (Phase 1, never wired to anything) and now has a real create flow at `/portal/support` (rate-limited, 5/hour/user) plus the message thread above. The **Contact page's form was a complete stub** before this phase — it `console.log`'d the submission and faked a 700ms delay instead of persisting anything. It's now wired to `POST /api/contact`, which writes to the also-previously-unused `ContactMessage` model.

## Bug Reports

`BugReport` is a dedicated model (severity, steps to reproduce, optional product) rather than reusing `SupportTicket` with a type flag, since bug reports have structurally different fields worth keeping distinct. Submittable by anyone — logged-in users are attached by `userId`, anonymous visitors must provide an email (enforced server-side, verified in E2E testing: an anonymous submission with no email correctly 400s).

## Status Page

Went from a fully static "All systems operational" claim with a "coming soon" placeholder to real DB-backed incidents (`Incident` model: status, severity, affected service, start/resolve times). Verified end-to-end by creating a real incident directly via script, confirming the page banner correctly flips to "Some systems are experiencing issues," the specific affected service flips to "Degraded" while every other service stays "Operational," then resolving it and confirming it correctly moves out of the live banner into incident history.

**Bug caught and fixed during the production build, not before:** the page compiled as fully static (`○`) despite querying the DB — meaning a new incident wouldn't appear on the live site until the next deploy, defeating the entire point of a status page. Fixed by adding `export const revalidate = 60`, confirmed in the rebuilt output (`○ /status ... 1m` revalidate window shown in the route table).

## A real security bug caught during E2E testing, not code review

The ticket-message and feature-request creation routes both did `include: { user: true }` (or `votes: true`) and returned the raw Prisma result directly in the API response — which meant the full `User` row, **including `passwordHash`**, was being sent back to the client on every ticket reply. This wasn't caught by `tsc`/`eslint`/`prettier`, which all passed clean — it surfaced only when actually curling the endpoint and reading the real response body during E2E testing. Fixed by switching both routes to explicit `select` clauses that return only the fields the UI needs (name/email, or nothing at all for the feature-request response, since the client doesn't use it). This is the same class of bug the blog comments route in Phase 10 had already avoided by reshaping its response manually — this phase's first draft didn't follow that pattern consistently, and it's worth remembering going forward: **never return a raw Prisma `include: { user: true }` result from an API route.**

## Verification

`tsc --noEmit`, `eslint`, `prettier --write` all clean.

Full E2E test against the live DB:

- All new public pages (`/support`, `/support/kb`, `/support/kb/[slug]`, `/status`, `/feature-requests`, `/support/bug-report`, `/contact`) return 200.
- Contact form and anonymous bug report (with and without email) submit correctly, including the required-email validation for anonymous bug reports.
- Signed up two real test accounts: created a ticket, sent a follow-up message, confirmed a directly-DB-inserted STAFF reply renders correctly and distinctly; confirmed a second user gets a 404 viewing another user's ticket page and a 403 trying to message it; confirmed anonymous `/portal/support` access redirects to login.
- Submitted a feature request, confirmed the submitter's implicit self-vote; a second user voted, un-voted, and re-voted (toggle confirmed at every step); confirmed anonymous voting is rejected with 401; confirmed the live vote count on the public page updates correctly.
- Created and resolved a real incident directly via script, confirmed the status page's live banner, per-service degraded state, and incident history all update correctly at each stage.
- Confirmed the security fix above by re-curling the ticket-message endpoint post-fix and verifying no `passwordHash` (or any other sensitive field) appears in the response.
- Confirmed the sitemap includes `/support`, `/support/kb`, all 7 KB article slugs, `/support/bug-report`, and `/feature-requests`, while portal routes stay correctly excluded (noindex).
- Regression-checked `/`, `/blog`, `/docs`, `/products`, `/pricing`, `/login` — no impact on the rest of the site.

Production build: clean, zero errors. **130 total concrete routes**, up from Phase 10's 112 — 18 new (6 API routes, `/feature-requests`, `/support/bug-report`, `/support/kb` index, 7 statically generated KB articles, `/portal/support`, and `/portal/support/[id]`).
