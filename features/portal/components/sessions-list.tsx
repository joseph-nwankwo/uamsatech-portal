"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type SessionInfo = {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

export function SessionsList({ sessions }: { sessions: SessionInfo[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingOthers, setPendingOthers] = useState(false);

  async function revoke(id: string) {
    setPendingId(id);
    await fetch(`/api/portal/sessions/${id}/revoke`, { method: "POST" });
    router.refresh();
    setPendingId(null);
  }

  async function revokeOthers() {
    setPendingOthers(true);
    await fetch("/api/portal/sessions/revoke-others", { method: "POST" });
    router.refresh();
    setPendingOthers(false);
  }

  const hasOtherSessions = sessions.some((s) => !s.isCurrent);

  return (
    <div className="space-y-3">
      {hasOtherSessions && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            loading={pendingOthers}
            onClick={revokeOthers}
          >
            Sign out other sessions
          </Button>
        </div>
      )}
      {sessions.map((s) => (
        <div
          key={s.id}
          className="border-border flex items-center justify-between rounded-xl border p-4"
        >
          <div className="flex items-center gap-3">
            <span className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-9 w-9 items-center justify-center rounded-lg">
              <Monitor className="size-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-foreground text-sm font-medium">
                  Session started {new Date(s.createdAt).toLocaleDateString()}
                </p>
                {s.isCurrent && <Badge variant="outline">This device</Badge>}
              </div>
              <p className="text-muted-foreground text-xs">
                Expires {new Date(s.expiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          {!s.isCurrent && (
            <Button
              variant="outline"
              size="sm"
              loading={pendingId === s.id}
              onClick={() => revoke(s.id)}
            >
              Revoke
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
