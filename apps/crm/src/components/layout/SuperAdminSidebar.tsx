"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { LayoutDashboard, Building2, CreditCard, Settings } from "lucide-react";

const nav = [
  { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/super-admin/billing", label: "Faturamento", icon: CreditCard },
  { href: "/super-admin/configuracoes", label: "Configurações", icon: Settings },
];

export interface SuperAdminSidebarProps {
  currentPath?: string;
  className?: string;
}

export function SuperAdminSidebar({ currentPath = "", className }: SuperAdminSidebarProps) {
  return (
    <aside
      className={clsx(
        "flex w-56 flex-col border-r border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900",
        className
      )}
    >
      <div className="flex h-14 items-center border-b border-neutral-200 px-4 dark:border-neutral-700">
        <Link href="/super-admin" className="text-lg font-semibold text-primary-600 transition-colors duration-normal hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
          CRM Admin
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const isActive = currentPath === href || (href !== "/super-admin" && currentPath.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors duration-normal",
                isActive
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-400"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
