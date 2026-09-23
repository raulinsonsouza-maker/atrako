"use client";

import { Logo } from "@/components/brand/Logo";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/admin/logout-action";
import { useIsAtrakoEmbed } from "@/hooks/useIsAtrakoEmbed";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Ticket,
  Layers,
  CreditCard,
  Settings,
  LogOut,
} from "lucide-react";

type NavLink = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

const links: NavLink[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/admin/cupons", label: "Cupons", icon: Ticket },
  { href: "/admin/ofertas", label: "Upsells", icon: Layers },
];

const EMBED_LINKS = links;

const FULL_LINKS: NavLink[] = [
  ...links,
  { href: "/admin/integracoes/mercado-pago", label: "Mercado Pago", icon: CreditCard },
  { href: "/admin/config", label: "Config", icon: Settings },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const embedded = useIsAtrakoEmbed();
  const navLinks = embedded ? EMBED_LINKS : FULL_LINKS;
  const activeLabel =
    navLinks.find(
      (l) => pathname === l.href || (l.href !== "/admin" && pathname.startsWith(l.href)),
    )?.label ?? "Admin";

  if (embedded) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg,#fafafa)] text-[var(--ink,#171717)]">
        <div className="flex h-11 shrink-0 items-stretch gap-1 border-b border-[#efefef] bg-white px-2">
          <nav
            className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto"
            aria-label="Seções do Commerce"
          >
            {navLinks.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/admin" && pathname.startsWith(link.href));
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative flex h-9 shrink-0 items-center gap-1.5 rounded-t-lg px-3 text-[13px] transition-colors",
                    active
                      ? "bg-[#f4f4f5] font-medium text-[#171717]"
                      : "text-[#71717a] hover:bg-[#fafafa] hover:text-[#171717]",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  <span className="whitespace-nowrap">{link.label}</span>
                  {active ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#171717]" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <a
            href="http://localhost:5000/admin/conexoes"
            target="_top"
            className="flex shrink-0 items-center px-2 text-[12px] text-[#2563eb] hover:underline"
          >
            Conexões Atrako
          </a>
          <a
            href="http://localhost:5000/modules/finance"
            target="_top"
            className="flex shrink-0 items-center px-2 text-[12px] text-[#2563eb] hover:underline"
          >
            Financeiro
          </a>
        </div>
        <main className="min-h-0 flex-1 overflow-auto p-4 md:p-5 animate-enter max-w-5xl w-full">
          {children}
        </main>
      </div>
    );
  }

  return (
    <DarkGradientBg showLights={false}>
      <div data-theme="admin" className="flex min-h-screen text-[var(--ink)]">
        <aside className="admin-sidebar w-[240px] min-w-[240px] shrink-0">
          <div className="admin-sidebar__brand">
            <Logo href="/admin" />
          </div>

          <nav className="admin-sidebar__nav" aria-label="Menu admin">
            {FULL_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/admin" && pathname.startsWith(link.href));
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn("admin-nav-link", active && "is-active")}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="admin-nav-link__icon-wrap">
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="admin-nav-link__label">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="admin-sidebar__foot">
            <form action={logoutAction}>
              <button type="submit" className="admin-nav-link admin-nav-link--logout">
                <span className="admin-nav-link__icon-wrap">
                  <LogOut size={16} strokeWidth={1.8} />
                </span>
                <span className="admin-nav-link__label">Sair</span>
              </button>
            </form>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="admin-topbar">
            <div className="cluster gap-2 text-[var(--text-sm)]">
              <span className="text-[var(--muted)]">Admin</span>
              <span className="text-[var(--muted)]">/</span>
              <span className="font-medium text-[var(--ink)]">{activeLabel}</span>
            </div>
          </header>
          <main className="flex-1 p-5 md:p-6 animate-enter max-w-5xl w-full">{children}</main>
        </div>
      </div>
    </DarkGradientBg>
  );
}
