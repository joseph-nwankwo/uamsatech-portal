"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DollarSign,
  Users,
  Megaphone,
  Activity,
  Filter,
  ShieldAlert,
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
import { SignOutButton } from "@/features/auth/components/sign-out-button";

const navItems = [
  { title: "Revenue", href: "/admin/revenue", icon: DollarSign },
  { title: "Customers", href: "/admin/customers", icon: Users },
  { title: "Marketing", href: "/admin/marketing", icon: Megaphone },
  { title: "Product", href: "/admin/product", icon: Activity },
  { title: "Conversion", href: "/admin/conversion", icon: Filter },
];

export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/admin/revenue"
          className="flex items-center gap-2 px-2 py-1.5 font-semibold tracking-tight"
        >
          <span className="bg-navy flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white">
            <ShieldAlert className="size-4" />
          </span>
          <span className="group-data-[collapsible=icon]:hidden">Internal</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
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
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
          <p className="text-muted-foreground truncate text-xs">{userEmail}</p>
        </div>
        <div className="px-2 group-data-[collapsible=icon]:hidden">
          <SignOutButton />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
