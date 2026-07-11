"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCircle,
  Bell,
  Grid2x2,
  Activity,
  ShieldCheck,
  Settings,
  CreditCard,
  KeyRound,
  BarChart3,
  Flag,
  LifeBuoy,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

const navGroups = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/portal/dashboard", icon: LayoutDashboard },
      { title: "Recent Activity", href: "/portal/activity", icon: Activity },
    ],
  },
  {
    label: "Organization",
    items: [
      { title: "Organization", href: "/portal/organization", icon: Building2 },
      { title: "Team Members", href: "/portal/users", icon: Users },
      { title: "Products", href: "/portal/products", icon: Grid2x2 },
      { title: "Billing", href: "/portal/billing", icon: CreditCard },
      { title: "Usage", href: "/portal/usage", icon: BarChart3 },
    ],
  },
  {
    label: "Developer",
    items: [
      { title: "API Keys", href: "/portal/api-keys", icon: KeyRound },
      { title: "Feature Flags", href: "/portal/feature-flags", icon: Flag },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile", href: "/portal/profile", icon: UserCircle },
      { title: "Notifications", href: "/portal/notifications", icon: Bell },
      { title: "Security", href: "/portal/security", icon: ShieldCheck },
      { title: "Support", href: "/portal/support", icon: LifeBuoy },
      { title: "Settings", href: "/portal/settings", icon: Settings },
    ],
  },
];

export function PortalSidebar({
  userName,
  userEmail,
  organizationName,
}: {
  userName: string;
  userEmail: string;
  organizationName: string | null;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/portal/dashboard"
          className="flex items-center gap-2 px-2 py-1.5 font-semibold tracking-tight"
        >
          <span className="bg-navy flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white">
            U
          </span>
          <span className="group-data-[collapsible=icon]:hidden">
            UAMSATech
          </span>
        </Link>
        {organizationName && (
          <Badge
            variant="outline"
            className="ml-2 w-fit group-data-[collapsible=icon]:hidden"
          >
            {organizationName}
          </Badge>
        )}
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`)
                      }
                      tooltip={item.title}
                      render={
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-medium">
              {userName}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {userEmail}
            </p>
          </div>
        </div>
        <div className="px-2 group-data-[collapsible=icon]:hidden">
          <SignOutButton />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
