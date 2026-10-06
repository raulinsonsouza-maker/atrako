"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot,
  ChevronLeft,
  LogOut,
  Plus,
  Settings2,
  PanelLeft,
  PanelLeftOpen,
} from "lucide-react";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useModules } from "@/hooks/useModules";
import { logoutEverywhere } from "@/lib/auth/logoutClient";
import { MODULES } from "@/lib/modules/registry";
import { NotificationBell } from "@/components/relacionamento/NotificationBell";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof Bot;
  status: "live" | "system";
  /** Selo no lugar da bolinha de status (Beta / Oculto). */
  badge?: string;
};

const PRIMARY: NavItem[] = [
  {
    href: "/assistente",
    label: "Assistente",
    description: "Pergunte e execute",
    icon: Bot,
    status: "live",
  },
];

const NAV_MODULES = MODULES.filter((m) => m.nav);

const SETTINGS: NavItem[] = [
  { href: "/config", label: "Configuração", description: "Empresa, equipe e conexões", icon: Settings2, status: "live" },
];

const COLLAPSED_KEY = "atrako-sidebar-collapsed";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** "Workspace Local" → "WL"; "Sense" → "S". */
function initials(nome: string) {
  const words = nome.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

type Tip = { label: string; desc?: string; top: number };

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsedPref, setCollapsedPref] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const { workspaces } = useActiveWorkspace();
  const { modules, isEnabled } = useModules();
  const systems: NavItem[] = NAV_MODULES.filter((m) => isEnabled(m.key)).map((m) => {
    const state = modules?.[m.key];
    return {
      href: m.routes[0],
      label: m.label,
      description: m.description,
      icon: m.icon,
      status: "live",
      badge: state?.preview ? "Oculto" : state?.release === "BETA" ? "Beta" : undefined,
    };
  });
  const clientes = workspaces
    .filter((c) => c.ativo !== false)
    .map((c) => ({ id: c.id, nome: c.nome, slug: c.slug ?? "" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

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

  const sectionTitle = (title: string, className = "pb-1 pt-3") =>
    collapsed ? (
      <div className="nav-collapsed-divider" aria-hidden />
    ) : (
      <p className={`type-fine-print px-3 uppercase tracking-[0.16em] text-[var(--ink-muted-48)] ${className}`}>
        {title}
      </p>
    );

  const navBlock = (title: string, items: NavItem[], withTitle = true) => (
    <div className="space-y-1">
      {withTitle ? sectionTitle(title) : null}
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
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
            href="/assistente"
            className="flex h-10 w-10 items-center justify-center rounded-sm bg-[var(--primary)] type-caption-strong text-[var(--on-primary)] active:scale-95"
            {...tipProps("Atrako")}
          >
            A
          </Link>
          <NotificationBell collapsed />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 px-3 py-4">
          <Link href="/assistente" className="type-tagline px-1 text-[var(--on-dark)]">
            Atrako
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              type="button"
              onClick={() => toggleCollapsed(true)}
              className="hidden h-8 w-8 items-center justify-center rounded-sm text-[var(--ink-muted-48)] hover:bg-[var(--surface-tile-2)] hover:text-[var(--on-dark)] md:inline-flex active:scale-95"
              title="Recolher menu"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <nav
        className={`flex-1 overflow-y-auto px-2 pb-4 ${collapsed ? "nav-collapsed space-y-2" : "space-y-4"}`}
        onScroll={() => setTip(null)}
      >
        {navBlock("Início", PRIMARY, !collapsed)}

        <div className="pt-1">
          {!collapsed ? (
            <p className="type-fine-print px-3 pb-2 uppercase tracking-[0.16em] text-[var(--ink-muted-48)]">
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

        {clientes.length > 0 || !collapsed ? (
          <div className="space-y-1">
            {sectionTitle("Contas")}
            {clientes.length === 0 && !collapsed ? (
              <p className="type-micro-legal px-3 py-2 text-[var(--ink-muted-48)]">Nenhuma conta cadastrada</p>
            ) : null}
            {clientes.map((cliente) => {
              const href = `/clientes/${cliente.id}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={cliente.id}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={itemClass(active)}
                  {...tipProps(cliente.nome, "Conta")}
                >
                  <span
                    className={`flex shrink-0 items-center justify-center rounded-sm ${
                      collapsed ? "h-7 w-7 type-fine-print" : "h-5 w-5 type-fine-print"
                    } ${
                      active
                        ? "bg-[var(--primary)] text-[var(--on-primary)]"
                        : "bg-[var(--surface-tile-3)] text-[var(--body-muted)]"
                    }`}
                  >
                    {collapsed ? initials(cliente.nome) : cliente.nome.slice(0, 1).toUpperCase()}
                  </span>
                  {!collapsed ? (
                    <span className="min-w-0 flex-1">
                      <span className="type-nav-link block truncate">{cliente.nome}</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}

        {navBlock("Operação", systems)}
        {navBlock("Ajustes", SETTINGS)}
      </nav>

      <div className={`border-t border-[var(--surface-tile-2)] px-2 py-3 ${collapsed ? "space-y-1" : ""}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={() => toggleCollapsed(false)}
            className={`${itemClass(false)} hidden md:flex`}
            {...tipProps("Expandir menu")}
          >
            <PanelLeftOpen className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className={`${itemClass(false)} ${collapsed ? "" : "w-full"} disabled:opacity-50`}
          {...tipProps("Sair")}
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          {!collapsed ? (
            <span className="type-nav-link">{loggingOut ? "Saindo…" : "Sair"}</span>
          ) : null}
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
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 inline-flex h-11 w-11 items-center justify-center rounded-sm border border-[var(--hairline)] bg-[var(--canvas)] text-[var(--ink)] md:hidden active:scale-95"
        aria-label="Abrir menu"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

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
