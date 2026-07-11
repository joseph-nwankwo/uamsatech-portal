import { products } from "@/lib/site-config";
import type { DocPage } from "@/features/docs/types";

// Generated from the same `products` data the marketing pages use, rather
// than duplicated by hand — a description edited on /products/[slug] can't
// silently drift out of sync with what shows up here.
export const manualsDocs: DocPage[] = products.map((product, index) => ({
  slug: product.slug,
  category: "manuals",
  title: product.name,
  description: product.tagline,
  version: "v1",
  order: index + 1,
  blocks: [
    { type: "p", text: product.description },
    { type: "h2", text: "Who it's for" },
    { type: "list", items: product.audience },
    { type: "h2", text: "Deployment" },
    { type: "list", items: product.deployment },
    { type: "h2", text: "Features" },
    { type: "list", items: product.features },
    {
      type: "callout",
      tone: "info",
      text: `${product.name} is still in active development. This page covers what's planned, not a shipped feature-by-feature manual — see /products/${product.slug} for the marketing overview, or /pricing for plan details.`,
    },
  ],
}));
