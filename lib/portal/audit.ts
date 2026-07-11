import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "user.password_reset"
  | "user.password_changed"
  | "user.profile_updated"
  | "user.settings_updated"
  | "organization.updated"
  | "organization.left"
  | "session.revoked"
  | "api_key.created"
  | "api_key.revoked"
  | "billing.checkout_started"
  | "billing.subscription_activated"
  | "billing.subscription_canceled"
  | "billing.invoice_paid"
  | "feature_flag.updated"
  | "member.invited"
  | "member.invitation_revoked"
  | "member.invitation_accepted"
  | "member.role_changed"
  | "member.removed"
  | "support_ticket.created"
  | "support_ticket.message_sent"
  | "bug_report.created"
  | "feature_request.created"
  | "feature_request.voted";

export async function logActivity(
  userId: string,
  action: AuditAction,
  metadata?: Prisma.InputJsonValue,
  organizationId?: string
) {
  await db.auditLog.create({
    data: { userId, action, metadata, organizationId },
  });
}
