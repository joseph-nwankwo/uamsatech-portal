"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type PendingInvitation = {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  expiresAt: string;
};

export function PendingInvitationsTable({
  invitations,
  canRevoke,
}: {
  invitations: PendingInvitation[];
  canRevoke: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(id: string) {
    setError(null);
    setBusyId(id);
    const response = await fetch(`/api/portal/invitations/${id}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setError(data.error ?? "Couldn't revoke invitation.");
      return;
    }
    router.refresh();
  }

  if (invitations.length === 0) return null;

  return (
    <div className="space-y-3">
      {error && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="border-border overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell className="text-foreground font-medium">
                  {invite.email}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{invite.role}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(invite.expiresAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {canRevoke && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busyId === invite.id}
                      onClick={() => revoke(invite.id)}
                      aria-label={`Revoke invitation to ${invite.email}`}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
