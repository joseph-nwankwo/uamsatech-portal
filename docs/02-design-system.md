# Phase 2 — Design System

All 16 requested categories, plus a living reference page at `/design-system` (internal — excluded from the public nav, `sitemap.ts`, and search indexing via `robots: { index: false }`).

## Colors

Brand tokens (`--brand-navy #0a2540`, `--brand-gold #c9a227`, `--brand-blue #2f6feb`) and the full shadcn semantic set (`--primary`, `--secondary`, `--accent`, `--muted`, `--destructive`, `--border`, light + dark) were already in place from Phase 0. New this phase: a validated chart palette.

**Chart categorical palette** — the dataviz skill's default 8-hue categorical order (blue/aqua/yellow/green/violet/red/magenta/orange) with slot 1 substituted for our brand blue (`#2f6feb` light / `#3987e5` dark) instead of the skill's default blue. Re-validated after the swap with `scripts/validate_palette.js`:

- Light mode: lightness band PASS, chroma floor PASS, CVD separation PASS (worst adjacent ΔE 24.2), contrast WARN on 3 slots (aqua/yellow/magenta) — same as the skill's documented default, mitigated by always pairing those slots with direct labels (see the sample charts).
- Dark mode: lightness band PASS, chroma floor PASS, contrast PASS, CVD separation WARN (floor band, ΔE 10.3) — legal per the skill only with secondary encoding (direct labels), which the sample charts use.

**Status palette** (fixed, never themed, per the skill): good `#0ca30c`, warning `#fab219`, serious `#ec835a`, critical `#d03b3b`.

All of this lives in `app/globals.css` as `--chart-1..8` and `--status-good/warning/serious/critical`, exposed as Tailwind utilities (`chart-1`, `status-good`, etc.) via `@theme inline`.

## Typography

`components/ui/typography.tsx` — `H1`–`H4`, `Lead`, `P`, `Large`, `Small`, `Muted`. One consistent scale on Inter, replacing ad hoc heading classes for any new code (existing pages weren't mass-migrated — see "What wasn't touched" below).

## Buttons

Existing shadcn Button (Base UI) with `default/outline/secondary/ghost/destructive/link` variants and `xs/sm/default/lg/icon` sizes. Added: a `loading` prop (spinner + auto-disable + `aria-busy`) so every submit button gets a consistent busy state — the contact form now uses `loading={isSubmitting}` instead of its own ad hoc spinner.

## Cards

Existing shadcn Card, used as-is (product cards, design-system showcase).

## Inputs

Existing Input/Textarea/Label, plus newly installed **Select, Checkbox, Switch, RadioGroup** — the standard form-input family, demonstrated together on `/design-system`.

## Tables

Newly installed shadcn Table (`Table/TableHeader/TableBody/TableRow/TableHead/TableCell`). The pricing page's hand-rolled `<table>` was refactored to use it — real usage, not just a showcase.

## Dialogs

Newly installed shadcn Dialog. No organic use case exists yet on the marketing site (no destructive/confirm actions), so it's demonstrated on `/design-system` with a representative "Request institutional demo" dialog, ready to reuse once the portal needs one.

## Sidebars

Newly installed shadcn Sidebar (the full collapsible app-shell primitive). Not wired into the live marketing site (it has no sidebar need) — instead, `features/design-system/components/portal-sidebar-demo.tsx` renders a representative instance of the **future** `portal.uamsatech.com` nav (Dashboard, Organizations, Billing, Team, API Keys, Products, Notifications, Settings — straight from the Phase 0 IA), so the component is proven out before the portal phase needs it.

## Navigation

The header's "Products" link was upgraded from a flat link into a `NavigationMenu` mega-menu listing all 5 products with taglines and a "View all products" footer link — real, live usage on every page. Mobile nav (the Sheet drawer) keeps the flat link list, since a mega-menu doesn't fit a narrow viewport. `/design-system` shows the same pattern in isolation for reference.

## Charts

Recharts + shadcn's `ChartContainer`/`ChartTooltip`/`ChartLegend` wrapper (`components/ui/chart.tsx`). Two sample charts, both using the validated brand categorical palette:

- `SignupsBarChart` — single series, no legend needed (per the skill: "a single series needs no legend box"), thin bars with rounded top corners, recessive gridlines, hover tooltip.
- `AdoptionLineChart` — two series (LecturerCraft/ScholarCraft), legend present, 2px lines, 4px dots, hover tooltip.

Both are illustrative/placeholder data for the future analytics dashboard — no live data source exists yet. Per the skill's accessibility requirement, `/design-system` renders a plain HTML `<table>` immediately below each chart as the "table view" alternative, sharing the same data (`components/charts/chart-data.ts`).

**Gotcha hit and fixed:** the chart sample data was originally exported from the chart component files themselves (which have `"use client"`). Importing a plain data array from a client-boundary module into the (server) `/design-system` page caused `signupsData.map is not a function` at runtime — Next's RSC serialization doesn't pass plain values through a client-component module cleanly in that direction. Fixed by extracting the data into its own plain module (`components/charts/chart-data.ts`, no `"use client"`) that both the client chart components and the server page import from independently.

## Badges

Existing shadcn Badge, variants demonstrated on `/design-system`.

## Empty States

New `components/ui/empty-state.tsx` — icon + title + description + optional action, dashed-border container. Not yet used on a real page (no page has an empty async-data state today), demonstrated on `/design-system`.

## Loading States

Formalized via the Button `loading` prop (see Buttons) plus a standalone spinner pattern (`Loader2` + `animate-spin`) shown on `/design-system`.

## Skeletons

Newly installed shadcn Skeleton, demonstrated as a card-shaped placeholder on `/design-system`. Not wired into a real page yet — all current pages render server-side with no client-side data fetching, so there's no loading gap to skeleton over yet.

## Animations

`lib/motion.ts` — shared Framer Motion presets (`fadeInUp`, `fadeIn`, `staggerContainer`, `transitionDefault`). The Home page hero was refactored from four separately-tuned `motion.div` animations (each with its own duration/delay) to a single `staggerContainer` wrapping `fadeInUp` children — same visual result, one source of truth for easing/duration going forward.

## Icons

Lucide React (already the icon library throughout). No new code — `/design-system` documents the convention: stroke-based icons sized via Tailwind `size-*` utilities, `size-4` inline with text, `size-5`/`size-6` standalone.

## What wasn't touched

Existing marketing pages (Home, About, Products, Pricing, Contact, etc.) were **not** mass-migrated to the new `Typography` components or `EmptyState`/`Skeleton` — they already had consistent, working Tailwind classes from Phase 0, and rewriting working pages purely for internal consistency wasn't worth the churn/regression risk this phase. New pages and the next phases (portal, auth) should use the new primitives directly.

## Verification

```
npm run typecheck     → zero errors
npm run lint          → zero errors
npm run format:check  → all files match
```

Dev server re-verified after every change: `/`, `/about`, `/products`, `/products/uamsa`, `/solutions`, `/pricing`, `/contact`, `/design-system` all return 200. One real bug was caught and fixed during verification (the RSC chart-data import issue above) — this is the value of actually curling every route instead of trusting the build alone.
