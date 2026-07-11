import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type AnalyticsEventName =
  | "signup_completed"
  | "login"
  | "email_verified"
  | "contact_submitted"
  | "newsletter_subscribed"
  | "subscription_created";

export async function trackEvent(
  name: AnalyticsEventName,
  options?: {
    userId?: string;
    organizationId?: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  await db.analyticsEvent.create({
    data: {
      name,
      userId: options?.userId,
      organizationId: options?.organizationId,
      metadata: options?.metadata,
    },
  });
}
