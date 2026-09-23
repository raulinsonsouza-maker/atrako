"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Users,
  Calendar,
  type LucideIcon,
} from "lucide-react";

const TABS: Array<{ href: string; label: string; icon: LucideIcon; match?: "exact" | "prefix" }> = [
  { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard, match: "exact" },
  { href: "/dashboard/leads", label: "Pipeline", icon: Users, match: "prefix" },
  { href: "/dashboard/agenda", label: "Agenda", icon: Calendar, match: "prefix" },
];

function isActive(pathname: string, href: string, match: "exact" | "prefix" = "prefix") {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Abas horizontais no embed Atrako — substitui a sidebar do CRM. */
export function EmbedTopTabs({ actions }: { actions?: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const atrakoBase =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ATRAKO_URL?.trim()) ||
    "http://localhost:5000";

  return (
    <div
      className={clsx(
        "flex h-11 shrink-0 items-stretch gap-1 border-b border-neutral-200/70 bg-white px-2",
        "dark:border-neutral-800 dark:bg-neutral-950"
      )}
    >
      <nav
        className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto"
        aria-label="Seções do CRM"
      >
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = isActive(pathname, href, match);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className={clsx(
                "group relative flex h-9 shrink-0 items-center gap-1.5 rounded-t-lg px-3 text-[13px] transition-colors",
                active
                  ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900/60 dark:hover:text-neutral-200"
              )}
            >
              <Icon
                className={clsx(
                  "h-3.5 w-3.5 shrink-0",
                  active ? "text-primary-500" : "text-neutral-400 group-hover:text-neutral-500"
                )}
                strokeWidth={1.75}
              />
              <span className="whitespace-nowrap">{label}</span>
              {active && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary-500" />
              )}
            </Link>
          );
        })}
      </nav>
      <a
        href={`${atrakoBase}/modules/finance`}
        target="_top"
        className="flex shrink-0 items-center px-2 text-[12px] text-blue-600 hover:underline"
      >
        Financeiro
      </a>
      <a
        href={`${atrakoBase}/admin/conexoes`}
        target="_top"
        className="flex shrink-0 items-center px-2 text-[12px] text-blue-600 hover:underline"
      >
        Conexões
      </a>
      {actions ? <div className="flex shrink-0 items-center gap-1.5 pl-2">{actions}</div> : null}
    </div>
  );
}
