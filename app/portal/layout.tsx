import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { PortalSidebar } from "@/features/portal/components/portal-sidebar";
import { getPortalContext } from "@/lib/portal/context";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, activeMembership } = await getPortalContext();

  return (
    <SidebarProvider>
      <PortalSidebar
        userName={user.name ?? user.email}
        userEmail={user.email}
        organizationName={activeMembership?.organization.name ?? null}
      />
      <SidebarInset>
        <header className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-muted-foreground text-sm font-medium">
            Portal
          </span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
