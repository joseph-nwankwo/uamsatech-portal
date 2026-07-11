"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function NotificationSettingsForm({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function toggle(checked: boolean) {
    setEnabled(checked);
    setPending(true);
    await fetch("/api/portal/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailNotificationsEnabled: checked }),
    });
    setPending(false);
  }

  return (
    <div className="border-border flex items-center justify-between rounded-2xl border p-6">
      <div>
        <Label htmlFor="email-notifications">Email notifications</Label>
        <p className="text-muted-foreground mt-1 text-sm">
          Receive account and security emails from UAMSATech.
        </p>
      </div>
      <Switch
        id="email-notifications"
        checked={enabled}
        disabled={pending}
        onCheckedChange={toggle}
      />
    </div>
  );
}
