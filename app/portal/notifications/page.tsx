import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { H1 } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <H1 className="text-2xl sm:text-2xl">Notifications</H1>
      <div className="mt-8">
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Billing, team, and product notifications will show up here once they're available."
        />
      </div>
    </div>
  );
}
