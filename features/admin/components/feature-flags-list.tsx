"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type FeatureFlagInfo = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
};

export function FeatureFlagsList({ flags }: { flags: FeatureFlagInfo[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string, checked: boolean) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feature-flags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: checked }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? `Update failed (${res.status}).`);
      }
    } catch {
      setError("Network error. The flag was not changed.");
    } finally {
      router.refresh();
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {flags.map((flag) => (
        <div
          key={flag.id}
          className="border-border flex items-center justify-between rounded-2xl border p-6"
        >
          <div>
            <Label htmlFor={flag.key}>{flag.name}</Label>
            {flag.description && (
              <p className="text-muted-foreground mt-1 text-sm">
                {flag.description}
              </p>
            )}
            <p className="text-muted-foreground mt-1 font-mono text-xs">
              {flag.key}
            </p>
          </div>
          <Switch
            id={flag.key}
            checked={flag.isEnabled}
            disabled={pendingId === flag.id}
            onCheckedChange={(checked) => toggle(flag.id, checked)}
          />
        </div>
      ))}
    </div>
  );
}
