"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { H3, Muted } from "@/components/ui/typography";

export function LeaveOrganizationCard({
  organizationName,
}: {
  organizationName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLeave() {
    setError(null);
    setIsSubmitting(true);
    const response = await fetch("/api/portal/organization/leave", {
      method: "POST",
    });
    const data = await response.json();
    setIsSubmitting(false);

    if (!response.ok) {
      setError(data.error ?? "Couldn't leave the organization.");
      return;
    }

    setOpen(false);
    router.push("/portal/dashboard");
    router.refresh();
  }

  return (
    <div className="border-destructive/30 mt-10 rounded-xl border p-5">
      <H3 className="text-sm">Danger zone</H3>
      <Muted className="mt-1">
        Leaving removes your access to {organizationName} immediately.
      </Muted>
      {error && (
        <p className="bg-destructive/10 text-destructive mt-3 rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="destructive" className="mt-3">
              Leave organization
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave {organizationName}?</DialogTitle>
            <DialogDescription>
              You&apos;ll lose access to this organization&apos;s products,
              billing, and team immediately. This can&apos;t be undone by you —
              someone already in the organization would need to invite you back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              loading={isSubmitting}
              onClick={handleLeave}
            >
              Leave organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
