"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/clients": "Clients",
  "/invoices": "Invoices",
  "/reports": "Reports",
  "/settings": "Settings",
};

function getTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/clients/") && pathname.includes("/edit")) return "Edit Client";
  if (pathname.startsWith("/clients/new")) return "New Client";
  if (pathname.startsWith("/clients/")) return "Client Details";
  if (pathname.startsWith("/invoices/") && pathname.includes("/edit")) return "Edit Invoice";
  if (pathname.startsWith("/invoices/new")) return "New Invoice";
  if (pathname.startsWith("/invoices/")) return "Invoice Details";
  return "FreelanceInvoice";
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 lg:pl-60">
        <Header
          title={getTitle(pathname)}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayoutInner>{children}</DashboardLayoutInner>;
}
