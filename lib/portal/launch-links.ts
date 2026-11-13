/**
 * Where an authenticated portal "Launch" control points (AS-P0-SECURITY-006A).
 *
 * Academic Suite products MUST launch through /api/portal/launch/[product],
 * which checks product-specific entitlement before signing a launch token. A
 * direct https://<product> link would skip that check, so none is ever
 * produced for these slugs. The list mirrors the launch route's PRODUCT_MAP
 * keys (catalog slugs plus canonical aliases); a unit test keeps them in step.
 *
 * Products outside central entitlement (e.g. the UAMSA ERP, which has its own
 * access control and is out of scope here) keep their existing direct link.
 */
export const ENTITLEMENT_LAUNCH_SLUGS = [
  "lecturercraft",
  "lecturesuite",
  "scholarcraft",
  "scholarsuite",
  "researchsuite",
] as const;

export function requiresEntitlementLaunch(slug: string): boolean {
  return (ENTITLEMENT_LAUNCH_SLUGS as readonly string[]).includes(slug);
}

export function productLaunchHref(product: {
  slug: string;
  subdomain: string;
}): string {
  return requiresEntitlementLaunch(product.slug)
    ? `/api/portal/launch/${encodeURIComponent(product.slug)}`
    : `https://${product.subdomain}`;
}
