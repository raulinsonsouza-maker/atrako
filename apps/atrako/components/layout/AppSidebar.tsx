"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings2,
  PanelLeftOpen,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useModules } from "@/hooks/useModules";
import { logoutEverywhere } from "@/lib/auth/logoutClient";
import { MODULES, type ModuleKey } from "@/lib/modules/registry";

type NavItem = {
  href: string;
  /** Prefixo que marca o item como ativo, quando difere do `href` (ex.: dashboard de qualquer conta). */
  match?: string;
  label: string;
  description: string;
  icon: typeof Bot;
  status: "live" | "system";
  /** Selo no lugar da bolinha de status (Beta / Oculto). */
  badge?: string;
};

const ASSISTENTE = MODULES.find((m) => m.key === "assistente")!;

const NAV_MODULES = MODULES.filter((m) => m.nav);

const COLLAPSED_KEY = "atrako-sidebar-collapsed";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Tip = { label: string; desc?: string; top: number };

export function AppSidebar({
  mobileOpen,
  onMobileOpenChange: setMobileOpen,
}: {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [collapsedPref, setCollapsedPref] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  /** A gaveta do celular é sempre aberta; recolher é só no desktop. */
  const collapsed = collapsedPref && !mobileOpen;

  useEffect(() => {
    setCollapsedPref(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  useEffect(() => {
    setTip(null);
  }, [pathname, collapsed]);

  const { workspaceId } = useActiveWorkspace();
  const { modules, isEnabled, homeHref } = useModules();
  const badgeFor = (key: ModuleKey) => {
    const state = modules?.[key];
    return state?.preview ? "Oculto" : state?.release === "BETA" ? "Beta" : undefined;
  };
  const dashboard: NavItem = {
    href: workspaceId ? `/clientes/${workspaceId}` : "/clientes",
    match: "/clientes",
    label: "Dashboard",
    description: "Mídia, vendas e resultados",
    icon: LayoutDashboard,
    status: "live",
  };
  // Tela inicial: fica visível enquanto a config carrega para o menu não pular.
  const primary: NavItem[] =
    modules && !modules.assistente?.enabled
      ? [dashboard]
      : [
          {
            href: ASSISTENTE.routes[0],
            label: ASSISTENTE.label,
            description: ASSISTENTE.description,
            icon: ASSISTENTE.icon,
            status: "live",
            badge: badgeFor("assistente"),
          },
          dashboard,
        ];
  const systems: NavItem[] = NAV_MODULES.filter((m) => isEnabled(m.key)).map((m) => ({
    href: m.routes[0],
    label: m.label,
    description: m.description,
    icon: m.icon,
    status: "live",
    badge: badgeFor(m.key),
  }));

  if (pathname.startsWith("/portal") || pathname.startsWith("/sign-in")) {
    return null;
  }

  function toggleCollapsed(next: boolean) {
    setCollapsedPref(next);
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setMobileOpen(false);
    await logoutEverywhere("/");
  }

  /** Recolhido: rótulo flutuante à direita (o `nav` rola, então o tooltip é fixo na tela). */
  const tipProps = (label: string, desc?: string) => {
    if (!collapsed) return {};
    const show = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      setTip({ label, desc, top: r.top + r.height / 2 });
    };
    return {
      "aria-label": desc ? `${label} — ${desc}` : label,
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(e.currentTarget),
      onFocus: (e: React.FocusEvent<HTMLElement>) => show(e.currentTarget),
      onMouseLeave: () => setTip(null),
      onBlur: () => setTip(null),
    };
  };

  const itemClass = (active: boolean) =>
    `group flex items-center rounded-sm transition active:scale-95 ${
      collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-3 px-3 py-2"
    } ${
      active
        ? "bg-[var(--surface-tile-1)] text-[var(--on-dark)]"
        : "text-[var(--body-muted)] hover:bg-[var(--surface-tile-2)] hover:text-[var(--on-dark)]"
    }`;

  const footerIconClass = (active: boolean) =>
    `flex h-10 w-10 shrink-0 items-center justify-center rounded-sm transition active:scale-95 ${
      active
        ? "bg-[var(--surface-tile-1)] text-[var(--primary-on-dark)]"
        : "text-[var(--body-muted)] hover:bg-[var(--surface-tile-2)] hover:text-[var(--on-dark)]"
    }`;

  const sectionTitle = (title: string, className = "pb-1 pt-3") =>
    collapsed ? (
      <div className="nav-collapsed-divider" aria-hidden />
    ) : (
      <p className={`type-fine-print px-3 uppercase text-[var(--ink-muted-48)] ${className}`}>
        {title}
      </p>
    );

  const navBlock = (title: string, items: NavItem[], withTitle = true) => (
    <div className="space-y-1">
      {withTitle ? sectionTitle(title) : null}
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.match ?? item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={itemClass(active)}
            {...tipProps(item.label, item.description)}
          >
            <Icon
              className={`h-5 w-5 shrink-0 ${active ? "text-[var(--primary-on-dark)]" : ""}`}
              strokeWidth={1.75}
            />
            {!collapsed ? (
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="type-nav-link block truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="shrink-0 rounded-full bg-[var(--surface-tile-2)] px-1.5 type-micro-legal text-[var(--body-muted)]">
                      {item.badge}
                    </span>
                  ) : (
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        item.status === "live" ? "bg-[var(--success)]" : "bg-[var(--ink-muted-48)]"
                      }`}
                      title={item.status === "live" ? "Integrado no Atrako" : "Sistema pronto"}
                    />
                  )}
                </span>
                <span className="type-fine-print mt-0.5 block truncate text-[var(--ink-muted-48)]">
                  {item.description}
                </span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );

  const sidebarBody = (
    <aside
      className={`sticky top-0 flex h-screen flex-col border-r border-[var(--surface-tile-2)] bg-[var(--surface-black)] transition-[width] ${
        collapsed ? "w-[72px]" : "w-[300px]"
      }`}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 px-2 py-4">
          <Link
            href={homeHref}
            className="flex h-10 w-10 items-center justify-center active:scale-95"
            {...tipProps("Atrako")}
          >
            <BrandLogo tone="on-dark" crop="symbol" />
          </Link>
        </div>
      ) : (
        <div className="flex h-16 items-center justify-between gap-2 pl-4 pr-2">
          <Link href={homeHref} className="flex h-8 items-center leading-none">
            <BrandLogo tone="on-dark" />
          </Link>
          <button
            type="button"
            onClick={() => toggleCollapsed(true)}
            className="hidden h-8 w-8 items-center justify-center rounded-sm text-[var(--ink-muted-48)] hover:bg-[var(--surface-tile-2)] hover:text-[var(--on-dark)] md:inline-flex active:scale-95"
            title="Recolher menu"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      <nav
        className={`flex-1 overflow-y-auto px-2 pb-4 ${collapsed ? "nav-collapsed space-y-2" : "space-y-4"}`}
        onScroll={() => setTip(null)}
      >
        {primary.length > 0 ? navBlock("Início", primary, !collapsed) : null}

        <div className="pt-1">
          {!collapsed ? (
            <p className="type-fine-print px-3 pb-2 uppercase text-[var(--ink-muted-48)]">
              Criar
            </p>
          ) : null}
          {collapsed ? (
            <Link
              href="/criar"
              onClick={() => setMobileOpen(false)}
              className="nav-criar-collapsed"
              data-active={isActive(pathname, "/criar") ? "true" : "false"}
              {...tipProps("Criar", "Onde tudo acontece")}
            >
              <Plus className="h-5 w-5" strokeWidth={2} />
            </Link>
          ) : (
            <Link
              href="/criar"
              onClick={() => setMobileOpen(false)}
              className="nav-criar"
              data-active={isActive(pathname, "/criar") ? "true" : "false"}
            >
              <span className="nav-criar-icon" aria-hidden>
                <Plus className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="nav-criar-label">Criar</span>
                <span className="nav-criar-desc">Onde tudo acontece</span>
              </span>
            </Link>
          )}
        </div>

        {navBlock("Operação", systems)}
      </nav>

      <div
        className={`flex border-t border-[var(--surface-tile-2)] px-2 py-3 ${
          collapsed ? "flex-col items-center gap-1" : "items-center justify-end gap-1"
        }`}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => toggleCollapsed(false)}
            className={`${footerIconClass(false)} hidden md:flex`}
            {...tipProps("Expandir menu")}
          >
            <PanelLeftOpen className="h-5 w-5" strokeWidth={1.75} />
          </button>
        ) : null}
        <Link
          href="/config"
          onClick={() => setMobileOpen(false)}
          className={footerIconClass(isActive(pathname, "/config"))}
          title={collapsed ? undefined : "Configuração"}
          aria-label="Configuração"
          {...tipProps("Configuração", "Empresa, equipe e conexões")}
        >
          <Settings2 className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className={`${footerIconClass(false)} disabled:opacity-50`}
          title={collapsed ? undefined : loggingOut ? "Saindo…" : "Sair"}
          aria-label="Sair"
          {...tipProps("Sair")}
        >
          <LogOut className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      {collapsed && tip ? (
        <div role="tooltip" className="nav-tip" style={{ top: tip.top }}>
          <span className="type-caption-strong block">{tip.label}</span>
          {tip.desc ? <span className="type-fine-print block text-[var(--ink-muted-48)]">{tip.desc}</span> : null}
        </div>
      ) : null}
    </aside>
  );

  return (
    <>
      <div className="hidden md:block">{sidebarBody}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--surface-black)]/40"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[300px]">{sidebarBody}</div>
        </div>
      ) : null}
    </>
  );
}
