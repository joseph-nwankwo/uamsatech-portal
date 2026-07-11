import { db } from "@/lib/db";

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({ where: { key } });
  return flag?.isEnabled ?? false;
}
