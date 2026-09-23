"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Calendar,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/dashboard/leads", label: "Pipeline", icon: Users },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/dashboard/agenda", label: "Agenda", icon: Calendar },
];

const SIDEBAR_COLLAPSED_KEY = "crm-sidebar-collapsed";

export interface SidebarProps {
  currentPath?: string;
  className?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  appName?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** No embed Atrako, marca mais enxuta (sem logo de tenant duplicado). */
  compactBrand?: boolean;
}

export function Sidebar({
  currentPath = "",
  className,
  logoUrl,
  primaryColor,
  appName = "CRM",
  collapsed: controlledCollapsed,
  onCollapsedChange,
  compactBrand = false,
}: SidebarProps) {
  const pathname = usePathname() ?? currentPath;
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  useEffect(() => {
    if (controlledCollapsed === undefined && typeof window !== "undefined") {
      setInternalCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    }
  }, []);

  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const setCollapsed = (value: boolean) => {
    if (!isControlled) {
      setInternalCollapsed(value);
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(value));
      }
    }
    onCollapsedChange?.(value);
  };

  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  const NavItem = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof LayoutDashboard }) => {
    const active = isActive(href);
    const pending = navigatingTo === href;
    return (
      <Link
        href={href}
        prefetch={true}
        onClick={() => setNavigatingTo(href)}
        title={collapsed ? label : undefined}
        className={clsx(
          "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5",
          "transition-all duration-fast",
          active
            ? "bg-primary-500/15 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400"
            : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60",
          pending && "opacity-70",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon
          className={clsx(
            "h-4 w-4 shrink-0",
            active ? "text-primary-500" : "text-neutral-500 dark:text-neutral-500"
          )}
          strokeWidth={1.75}
        />
        {!collapsed && (
          <span className={clsx("text-[13px]", active ? "font-medium" : "font-normal")}>
            {label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={clsx(
        "flex flex-col shrink-0 transition-all duration-200 ease-apple",
        "bg-neutral-50/80 dark:bg-neutral-900/80",
        "backdrop-blur-xl backdrop-saturate-150",
        "border-r border-neutral-200/60 dark:border-neutral-800/60",
        collapsed ? "w-14" : "w-56",
        className
      )}
    >
      {/* Logo / App Name */}
      <div className={clsx("flex h-12 items-center", collapsed ? "justify-center px-0" : "px-4")}>
        <Link
          href="/dashboard"
          className={clsx("flex items-center gap-2.5 transition-opacity hover:opacity-80", collapsed && "justify-center")}
        >
          {logoUrl && !compactBrand ? (
            <img
              src={logoUrl}
              alt={appName}
              className={clsx(
                "object-contain object-center",
                collapsed ? "h-7 w-7 max-w-[2.5rem]" : "h-7 max-h-7 w-auto max-w-[120px]"
              )}
            />
          ) : (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: primaryColor || "#007AFF" }}
            >
              {appName.charAt(0)}
            </div>
          )}
          {!collapsed && (
            <span className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100 truncate">
              {compactBrand ? "CRM" : appName}
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5" aria-label="Menu principal">
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Settings + Collapse */}
      <div className="border-t border-neutral-200/60 px-3 py-2 space-y-0.5 dark:border-neutral-800/60">
        <Link
          href="/dashboard/configuracoes"
          prefetch={true}
          onClick={() => setNavigatingTo("/dashboard/configuracoes")}
          title={collapsed ? "Configurações" : undefined}
          className={clsx(
            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5",
            "transition-all duration-fast",
            pathname === "/dashboard/configuracoes"
              ? "bg-neutral-200/60 text-neutral-900 dark:bg-neutral-800/60 dark:text-neutral-100"
              : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60",
            navigatingTo === "/dashboard/configuracoes" && "opacity-70",
            collapsed && "justify-center px-2"
          )}
        >
          <Settings
            className="h-4 w-4 shrink-0 text-neutral-500"
            strokeWidth={1.75}
          />
          {!collapsed && <span className="text-[13px]">Configurações</span>}
        </Link>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className={clsx(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5",
            "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60",
            "transition-all duration-fast",
            collapsed && "justify-center px-2"
          )}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="text-[13px]">Recolher menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
