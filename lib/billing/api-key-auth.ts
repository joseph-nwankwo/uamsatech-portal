import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";

export async function authenticateApiKey(
  request: Request
): Promise<{ userId: string; organizationId: string | null } | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const rawKey = header.slice("Bearer ".length).trim();
  if (!rawKey) return null;

  const keyHash = hashToken(rawKey);
  const apiKey = await db.apiKey.findUnique({ where: { keyHash } });

  if (!apiKey || apiKey.revokedAt) return null;

  await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return { userId: apiKey.userId, organizationId: apiKey.organizationId };
}
