"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserX } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

export type TeamMember = {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
};

export function TeamMembersTable({
  members,
  currentUserId,
  canChangeRoles,
  canRemove,
  currentUserRole,
}: {
  members: TeamMember[];
  currentUserId: string;
  canChangeRoles: boolean;
  canRemove: boolean;
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER";
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<TeamMember | null>(null);

  async function changeRole(membershipId: string, role: string) {
    setError(null);
    setBusyId(membershipId);
    const response = await fetch(`/api/portal/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(data.error ?? "Couldn't change role.");
      return;
    }
    router.refresh();
  }

  async function confirmRemove() {
    if (!pendingRemoval) return;
    setError(null);
    setBusyId(pendingRemoval.membershipId);
    const response = await fetch(
      `/api/portal/members/${pendingRemoval.membershipId}`,
      { method: "DELETE" }
    );
    const data = await response.json().catch(() => ({}));
    setBusyId(null);
    setPendingRemoval(null);
    if (!response.ok) {
      setError(data.error ?? "Couldn't remove member.");
      return;
    }
    router.refresh();
  }

  const canRemoveTarget = (member: TeamMember) => {
    if (member.userId === currentUserId) return false;
    if (!canRemove) return false;
    if (currentUserRole === "ADMIN" && member.role !== "MEMBER") return false;
    return true;
  };

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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.membershipId}>
                <TableCell className="text-foreground font-medium">
                  {member.name ?? "—"}
                  {member.userId === currentUserId && (
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      (you)
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.email}
                </TableCell>
                <TableCell>
                  {canChangeRoles ? (
                    <Select
                      value={member.role}
                      onValueChange={(role) =>
                        role && changeRole(member.membershipId, role)
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        disabled={busyId === member.membershipId}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Member</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="OWNER">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{member.role}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {canRemoveTarget(member) && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busyId === member.membershipId}
                      onClick={() => setPendingRemoval(member)}
                      aria-label={`Remove ${member.email}`}
                    >
                      <UserX className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
            <DialogDescription>
              {pendingRemoval &&
                `${pendingRemoval.name ?? pendingRemoval.email} will lose access to this organization immediately.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              loading={busyId === pendingRemoval?.membershipId}
              onClick={confirmRemove}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
