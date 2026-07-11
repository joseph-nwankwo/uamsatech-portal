import type { Metadata } from "next";
import { H1 } from "@/components/ui/typography";
import { NotificationSettingsForm } from "@/features/portal/components/notification-settings-form";
import { getPortalContext } from "@/lib/portal/context";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const { user } = await getPortalContext();

  return (
    <div className="mx-auto max-w-2xl">
      <H1 className="text-2xl sm:text-2xl">Settings</H1>
      <div className="mt-8">
        <NotificationSettingsForm
          initialEnabled={user.emailNotificationsEnabled}
        />
      </div>
    </div>
  );
}
