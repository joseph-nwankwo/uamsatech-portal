"use client";

import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Users,
  KeyRound,
  Grid2x2,
  Bell,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, isActive: true },
  { title: "Organizations", icon: Building2 },
  { title: "Billing", icon: CreditCard },
  { title: "Team", icon: Users },
  { title: "API Keys", icon: KeyRound },
  { title: "Products", icon: Grid2x2 },
  { title: "Notifications", icon: Bell },
];

export function PortalSidebarDemo() {
  return (
    <div className="border-border overflow-hidden rounded-2xl border">
      <SidebarProvider className="min-h-[420px]">
        <Sidebar collapsible="none" className="border-border w-56 border-r">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="bg-navy flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white">
                U
              </span>
              <span className="text-sm font-semibold">Portal</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton isActive={item.isActive}>
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="bg-muted/30 text-muted-foreground flex items-center justify-center p-8 text-sm">
          Portal content area (built in a later phase)
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
