"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";

type Membership = { organizationId: string; name: string; role: string };

export function SelectOrganizationForm({
  memberships,
}: {
  memberships: Membership[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectOrganization(organizationId: string) {
    setPendingId(organizationId);
    setError(null);
    const response = await fetch("/api/auth/select-organization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Try again.");
      setPendingId(null);
      return;
    }

    router.push("/portal/dashboard");
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {memberships.map((membership) => (
        <button
          key={membership.organizationId}
          type="button"
          onClick={() => selectOrganization(membership.organizationId)}
          disabled={pendingId !== null}
          className="border-border bg-card hover:bg-muted flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="flex items-center gap-3">
            <span className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-9 w-9 items-center justify-center rounded-lg">
              <Building2 className="size-4" />
            </span>
            <span>
              <span className="text-foreground block font-medium">
                {membership.name}
              </span>
              <span className="text-muted-foreground block text-xs">
                {membership.role}
              </span>
            </span>
          </span>
          <ArrowRight className="text-muted-foreground size-4" />
        </button>
      ))}
    </div>
  );
}
