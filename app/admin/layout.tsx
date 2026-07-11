import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { getAdminContext } from "@/lib/admin/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getAdminContext();

  return (
    <SidebarProvider>
      <AdminSidebar userEmail={user.email} />
      <SidebarInset>
        <header className="border-border bg-destructive/5 flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-destructive text-sm font-medium">
            Internal — admin only, not visible to customers
          </span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
