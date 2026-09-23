"use client";

import { usePathname } from "next/navigation";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { Header } from "./Header";

export interface SuperAdminShellProps {
  title?: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}

export function SuperAdminShell({ title, children, headerActions }: SuperAdminShellProps) {
  const pathname = usePathname() ?? "";
  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <SuperAdminSidebar currentPath={pathname} />
      <div className="flex flex-1 flex-col">
        <Header title={title}>{headerActions}</Header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
