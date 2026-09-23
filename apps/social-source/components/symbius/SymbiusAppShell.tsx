"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Atom,
  BarChart2,
  CircleHelp,
  Home,
  Menu,
  MessageCircle,
  PanelLeft,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import type { SymbiusShellData } from "@/lib/symbius/shellData";
import { AccountSwitcher } from "@/components/symbius/AccountSwitcher";
import { useIsAtrakoEmbed } from "@/hooks/useIsAtrakoEmbed";

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: typeof Home;
  exact?: boolean;
  badge?: number;
};

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`symbius-nav-item ${active ? "symbius-nav-item-active" : ""} ${
        collapsed ? "symbius-nav-item-collapsed" : ""
      }`}
    >
      <Icon className="symbius-nav-icon" strokeWidth={1.5} />
      {!collapsed && <span className="symbius-nav-label">{item.label}</span>}
      {!collapsed && item.badge != null && item.badge > 0 ? (
        <span className="symbius-nav-badge">{item.badge}</span>
      ) : null}
      {collapsed && item.badge != null && item.badge > 0 ? (
        <span className="symbius-nav-badge-dot" />
      ) : null}
    </Link>
  );
}

export function SymbiusAppShell({
  children,
  shell,
}: {
  children: React.ReactNode;
  shell: SymbiusShellData;
}) {
  const pathname = usePathname();
  const embedded = useIsAtrakoEmbed();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const nav: NavItem[] = [
    { href: "/app", label: "Inicial", shortLabel: "Início", icon: Home, exact: true },
    { href: "/app/contacts", label: "Contatos", shortLabel: "Contatos", icon: UserRound },
    { href: "/app/flows", label: "Automação", shortLabel: "Fluxos", icon: Atom },
    {
      href: "/app/inbox",
      label: "Caixa de Entrada",
      shortLabel: "Inbox",
      icon: MessageCircle,
      badge: shell.inboxUnread,
    },
    { href: "/app/analytics", label: "Análises", shortLabel: "Análises", icon: BarChart2 },
  ];
  if (!embedded) {
    nav.push({
      href: "/app/settings",
      label: "Configurações",
      shortLabel: "Mais",
      icon: Settings,
    });
  }

  const embedNav = nav.filter((n) => n.href !== "/app/settings");

  const bottomNav = nav.filter((n) =>
    ["/app", "/app/flows", "/app/inbox", "/app/settings"].includes(n.href),
  );

  if (embedded) {
    return (
      <div className="symbius-app-shell flex h-screen flex-col overflow-hidden">
        {shell.needsReauth ? (
          <div className="symbius-reauth-banner" role="alert">
            <span>
              A conexão do Instagram expirou ou precisa ser renovada. Automações e
              inbox podem falhar.
            </span>
            <a
              href="http://localhost:5000/admin/conexoes"
              target="_top"
              className="symbius-reauth-banner-cta"
            >
              Reconectar no Atrako
            </a>
          </div>
        ) : null}
        <div className="flex h-11 shrink-0 items-stretch gap-1 border-b border-[#efefef] bg-white px-2">
          <nav
            className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto"
            aria-label="Seções do Social"
          >
            {embedNav.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex h-9 shrink-0 items-center gap-1.5 rounded-t-lg px-3 text-[13px] transition-colors ${
                    active
                      ? "bg-[#f4f4f5] font-medium text-[#171717]"
                      : "text-[#71717a] hover:bg-[#fafafa] hover:text-[#171717]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  <span className="whitespace-nowrap">{item.shortLabel}</span>
                  {item.badge != null && item.badge > 0 ? (
                    <span className="rounded-full bg-[#ef4444] px-1.5 text-[10px] font-medium text-white">
                      {item.badge}
                    </span>
                  ) : null}
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
        </div>
        <main className="symbius-main min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    );
  }

  return (
    <div className="symbius-app-shell">
      {shell.needsReauth ? (
        <div className="symbius-reauth-banner" role="alert">
          <span>
            A conexão do Instagram expirou ou precisa ser renovada. Automações e
            inbox podem falhar.
          </span>
          <Link href="/app/connect" className="symbius-reauth-banner-cta">
            Reconectar
          </Link>
        </div>
      ) : null}

      <div className="symbius-mobile-topbar">
        <button
          type="button"
          className="symbius-mobile-menu-btn"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" strokeWidth={1.5} />
          ) : (
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          )}
        </button>
        <Link href="/app" className="symbius-sidebar-logo-word">
          Symbius
        </Link>
        <div className="symbius-mobile-topbar-spacer" />
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="symbius-mobile-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="symbius-app-body">
        <aside
          className={`symbius-sidebar ${collapsed ? "symbius-sidebar-collapsed" : ""} ${
            mobileOpen ? "symbius-sidebar-mobile-open" : ""
          }`}
        >
          <div className="symbius-sidebar-header">
            <Link href="/app" className="symbius-sidebar-logo">
              {collapsed ? (
                <span className="symbius-sidebar-logo-mark">S</span>
              ) : (
                <span className="symbius-sidebar-logo-word">Symbius</span>
              )}
            </Link>

            <AccountSwitcher shell={shell} collapsed={collapsed} />

            {!collapsed && <div className="symbius-header-divider" />}
          </div>

          <nav className="symbius-sidebar-nav" aria-label="Principal">
            {nav.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <NavLink
                  key={item.href}
                  item={item}
                  active={active}
                  collapsed={collapsed}
                  onNavigate={() => setMobileOpen(false)}
                />
              );
            })}
          </nav>

          <div className="symbius-sidebar-bottom">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="symbius-sidebar-collapse"
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>

            <div className="symbius-sidebar-divider" />

            <div className="symbius-sidebar-footer">
              <Link
                href="/app/settings"
                className="symbius-sidebar-footer-link"
                title={collapsed ? "Meu perfil" : undefined}
                aria-label="Meu perfil"
              >
                <UserRound className="h-5 w-5" strokeWidth={1.5} />
                {!collapsed && <span>Meu perfil</span>}
              </Link>

              <a
                href="https://symbius.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="symbius-sidebar-footer-link"
                title={collapsed ? "Ajuda" : undefined}
                aria-label="Ajuda"
              >
                <CircleHelp className="h-5 w-5" strokeWidth={1.5} />
                {!collapsed && <span>Ajuda</span>}
              </a>
            </div>
          </div>
        </aside>

        <main className="symbius-main">{children}</main>
      </div>

      <nav className="symbius-bottom-nav" aria-label="Navegação móvel">
        {bottomNav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`symbius-bottom-nav-item ${active ? "is-active" : ""}`}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
                {item.badge != null && item.badge > 0 ? (
                  <span className="symbius-bottom-nav-badge">{item.badge}</span>
                ) : null}
              </span>
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
