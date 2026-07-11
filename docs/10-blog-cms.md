# Phase 10 — Blog CMS

All 8 pieces built (Categories, Authors, Tags, SEO, Related Posts, Newsletter, Comments, RSS) — the blog moved from a 3-post static array (`features/blog/data.ts`, built in Phase 3) to a fully DB-backed content system.

## Schema

Four new models: `Author` (slug, name, title, bio, initials), `Category` (slug, name, description), `Tag` (slug, name), `Comment` (postId, userId, content, cascades on post deletion). `BlogPost.content` changed from `String` to `Json` (an array of paragraph strings) to support richer future content without another migration; `BlogPost` gained `authorId`, `categoryId`, and a `tags` many-to-many relation. `NewsletterSubscriber` gained `unsubscribeTokenHash` (unique) and `unsubscribedAt`. Pushed to the live DB with `prisma db push --accept-data-loss` — the flag was required only because of the new unique constraint on `unsubscribeTokenHash`; the table was verified empty (0 rows) before accepting, so no real data was at risk.

## Who manages blog content — a deliberate scope decision

This phase does **not** add a blog editor to the customer portal, and that was a security decision, not an oversight. Portal roles (OWNER/ADMIN/MEMBER) are scoped to a customer's own `Organization` via `Membership` — there is no "platform staff" concept anywhere in this codebase. If blog editing lived in the portal, any customer who becomes OWNER of their own org would be able to edit the public company blog. Content is instead DB-backed but managed via `prisma/seed.js`, the same pattern already used for Phase 7's pricing plans and Phase 9's docs content.

## Authors — real, not fabricated

Two institutional/role-based authors seeded: "UAMSATech Team" and "Product Team." No named individual personas ("Jane Doe, VP of Product") were invented — that would be the same kind of fabricated social proof already deliberately avoided on the Customers page (Phase 3) and product Testimonials sections (Phase 4). The reasoning is documented directly in `prisma/seed.js` next to the `AUTHORS` array.

## Categories, Tags, Related Posts

Three categories (Product, Teaching, Company) and nine tags seeded, each of the 3 existing posts assigned one category and 2-3 tags. `getRelatedPosts()` (`features/blog/queries.ts`) finds other published posts sharing the same category or any tag, excluding the current post, capped at 3. New archive pages: `/blog/category/[slug]` and `/blog/tag/[slug]`, both statically generated, both added to `sitemap.ts`.

**Known limitation, stated plainly:** with only 3 seed posts, each in a different category with non-overlapping tags, the "Related posts" section never actually has anything to show on the live site today. The query logic itself was verified correct with a direct DB script that constructed an overlapping-tag query and confirmed matches are found when they exist — this is a content-volume limitation, not a broken feature. It'll start showing results as soon as more posts share a category or tag.

## Newsletter

`POST /api/newsletter/subscribe` — rate-limited (5/hour/IP), reactivates a previously-unsubscribed email silently, otherwise creates a subscriber with a hashed unsubscribe token and emails the raw token via the Phase 5 `sendEmail()` fallback pattern. `/newsletter/unsubscribe/[token]` looks up by token hash and sets `unsubscribedAt`.

**Bug caught and fixed before shipping:** the first draft hashed a freshly generated token and stored only the hash, but never captured the raw value anywhere — no valid unsubscribe link could ever have been constructed, silently defeating the entire feature. Fixed by capturing the raw token before hashing it and building the unsubscribe URL from that.

## Comments

Auth-gated (`getSession()`), rate-limited (10/min per user), 2-2000 character content. `POST /api/blog/[slug]/comments` creates a comment; `DELETE /api/blog/comments/[id]` enforces `comment.userId === session.sub` (403 otherwise) — no admin override, no moderation queue, matching the scope of what was actually asked for. Anonymous visitors see a "sign in to comment" prompt using the Phase 8 `redirect_uri` pattern, landing them back on the same post after login.

## SEO

Per-post canonical URLs, `BlogPosting` JSON-LD (author, category, publish date), and a genuinely dynamic per-post Open Graph image at `app/(marketing)/blog/[slug]/opengraph-image.tsx` — post title and category rendered into the navy/gold branded template from the Phase 7 root OG image. `sitemap.ts` is now `async` and DB-backed: blog posts, category pages, and tag pages are all queried live rather than imported from a static array.

**Bug caught and fixed:** the OG image route initially declared `export const runtime = "edge"`, copied from the root static OG image. That route queries the DB for post data, and Prisma's default engine doesn't run on the Edge runtime — every request 404'd. Fixed by removing the edge runtime declaration so it runs on Node.js. Separately confirmed (by reading the actual generated `<meta property="og:image">` tag rather than guessing the URL) that Next.js appends a content hash to dynamic per-param image routes — e.g. `/blog/building-for-africa-first/opengraph-image-yqks0s?<hash>` — to prevent stale caching across different posts; a plain `/opengraph-image` URL correctly 404s by design and isn't a bug.

## RSS

`GET /blog/rss.xml` — hand-built RSS 2.0 XML (no dependency added), manually escaped for the 5 XML special characters, `application/rss+xml` content type, one `<item>` per published post ordered newest-first. Verified well-formed by fetching and reading the raw output.

## Verification

`tsc --noEmit`, `eslint`, `prettier --write` all clean.

Full E2E test against the live DB:

- Blog index, category archives, tag archives all return 200 with real data.
- RSS feed fetched and confirmed well-formed, correct content-type, correct item count and ordering.
- Sitemap fetched and confirmed all 3 posts + 3 categories + 9 tags present, no static-data leftovers.
- Signed up two real test accounts; posted a comment with real UTF-8 content (em dash, emoji) via each; confirmed cross-user delete is rejected (403), own-comment delete succeeds (200), anonymous delete is rejected (401).
- Subscribed a real email to the newsletter; confirmed the console-logged `[DEV EMAIL FALLBACK]` unsubscribe link; followed it and confirmed `unsubscribedAt` was set in the DB; resubscribed and confirmed it correctly cleared back to `null`.
- Related-posts query mechanics verified directly against the DB (see limitation above).
- Per-post OG image fetched via its real hashed URL and confirmed a genuine 168KB PNG.
- Regression-checked `/`, `/docs`, `/products`, `/pricing`, `/login`, `/customers` — no impact on the rest of the site.

One tooling issue hit and resolved along the way: after adding the new `opengraph-image.tsx` file, the dev server's route manifest didn't pick it up even after a restart on a fresh port — traced to stale `.next` build cache, not a code bug. `rm -rf .next` before restarting resolved it. Also hit the by-now-familiar zombie-process pattern from Phases 3/7 (orphaned `next dev`/`next start` processes squatting on ports 3000-3005 across several restarts) — resolved by killing PIDs directly via `netstat`/`taskkill` rather than trusting the task-stop tool alone, since it only terminates the wrapping shell, not detached child processes.

Production build: clean, zero errors. **112 total concrete routes** (80 route patterns from the build manifest, expanded for static params — 3 blog posts, 3 categories, 9 tags, 17 doc pages, 5 products), up from Phase 9's 89. `features/blog/data.ts` deleted — nothing imports from it anymore.
