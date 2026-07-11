import type { Metadata } from "next";
import { H1 } from "@/components/ui/typography";
import { ProfileForm } from "@/features/portal/components/profile-form";
import { getPortalContext } from "@/lib/portal/context";
import { isStorageConfigured } from "@/lib/storage";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const { user } = await getPortalContext();

  return (
    <div className="mx-auto max-w-2xl">
      <H1 className="text-2xl sm:text-2xl">Profile</H1>
      <div className="border-border mt-8 rounded-2xl border p-6">
        <ProfileForm
          initialName={user.name ?? ""}
          email={user.email}
          avatarUrl={user.avatarUrl}
          storageConfigured={isStorageConfigured()}
        />
      </div>
    </div>
  );
}
