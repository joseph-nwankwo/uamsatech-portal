export type Product = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  audience: string[];
  features: string[];
  benefits: { title: string; description: string }[];
  deployment: string[];
  pricingPlans: ("individual" | "institution" | "standalone")[];
  subdomain: string;
  accent: "navy" | "gold" | "blue";
  // Whether this product has a real, separately-built application behind
  // its subdomain today. Only UAMSA does — the other 4 are marketing-only
  // in this session's scope (see docs/04-product-pages.md). Drives whether
  // "Quick launch" in the portal shows a live link or a "Coming soon" state,
  // so the portal never implies a live app this repo can't verify.
  isLive: boolean;
};
