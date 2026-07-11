import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { products as marketingProducts } from "@/lib/site-config";
import { validateCoupon } from "@/lib/billing/coupons";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import type { Coupon, Product, ProductPlan, User } from "@prisma/client";

type CheckoutContext = {
  session: AccessTokenPayload;
  // Exactly one of these is set — an organization checkout (OWNER/ADMIN
  // buying for their org) or an individual checkout (a user with no active
  // org, buying a plan for themselves). Only products whose `pricingPlans`
  // includes "individual" (lib/site-config.ts) allow the latter.
  billTo:
    { type: "organization"; organizationId: string } | { type: "individual" };
  productPlan: ProductPlan;
  product: Product;
  user: User;
  coupon: Coupon | null;
};

export async function resolveCheckoutContext(
  productPlanId: string,
  couponCode?: string
): Promise<CheckoutContext | { error: string }> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to start checkout." };
  }

  const productPlan = await db.productPlan.findUnique({
    where: { id: productPlanId },
    include: { product: true },
  });
  if (!productPlan || !productPlan.isActive) {
    return { error: "Plan not found." };
  }

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    return { error: "User not found." };
  }

  let billTo: CheckoutContext["billTo"];
  if (session.orgId) {
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return { error: "Only owners and admins can manage billing." };
    }
    billTo = { type: "organization", organizationId: session.orgId };
  } else {
    const catalogProduct = marketingProducts.find(
      (p) => p.slug === productPlan.product.slug
    );
    if (!catalogProduct?.pricingPlans.includes("individual")) {
      return {
        error:
          "This plan is only available to organizations. Join or create an organization first.",
      };
    }
    billTo = { type: "individual" };
  }

  let coupon: Coupon | null = null;
  if (couponCode) {
    coupon = await validateCoupon(couponCode.trim().toUpperCase());
    if (!coupon) {
      return { error: "This coupon code isn't valid." };
    }
  }

  return {
    session,
    billTo,
    productPlan,
    product: productPlan.product,
    user,
    coupon,
  };
}
