"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    const response = await fetch("/api/portal/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }

    router.push("/portal/dashboard");
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {error && (
        <p className="bg-destructive/10 text-destructive w-full rounded-lg px-3 py-2 text-center text-sm">
          {error}
        </p>
      )}
      <Button
        onClick={handleAccept}
        className="bg-navy hover:bg-navy/90 w-full text-white"
      >
        Accept invitation
      </Button>
    </div>
  );
}
