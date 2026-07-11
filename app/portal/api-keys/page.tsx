import type { Metadata } from "next";
import { H1, Muted } from "@/components/ui/typography";
import { ApiKeysManager } from "@/features/portal/components/api-keys-manager";
import { getPortalContext } from "@/lib/portal/context";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "API Keys",
  robots: { index: false, follow: false },
};

export default async function ApiKeysPage() {
  const { user } = await getPortalContext();

  const apiKeys = await db.apiKey.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <H1 className="text-2xl sm:text-2xl">API Keys</H1>
      <Muted className="mt-1">
        Use API keys to authenticate requests to UAMSATech products
        programmatically.
      </Muted>

      <div className="mt-8">
        <ApiKeysManager
          apiKeys={apiKeys.map((key) => ({
            id: key.id,
            name: key.name,
            keyPrefix: key.keyPrefix,
            lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
            createdAt: key.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
