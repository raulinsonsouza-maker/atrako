"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MessageSquare,
  Plus,
  Settings2,
  ShoppingBag,
  Users,
  PanelLeft,
  Wallet,
} from "lucide-react";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { logoutEverywhere } from "@/lib/auth/logoutClient";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof Bot;
  status: "live" | "system";
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

const SYSTEMS: NavItem[] = [
  { href: "/crm", label: "Leads", description: "Funil até o fechamento", icon: Users, status: "live" },
  { href: "/whatsapp", label: "Atendimento", description: "Conversas no WhatsApp", icon: MessageSquare, status: "live" },
  { href: "/social", label: "Instagram", description: "Conteúdo e automações", icon: MessageSquare, status: "live" },
  { href: "/agenda", label: "Agenda", description: "Calendário de reservas", icon: CalendarDays, status: "live" },
  { href: "/commerce", label: "Loja", description: "Produtos e pedidos", icon: ShoppingBag, status: "live" },
  { href: "/finance", label: "Caixa", description: "Entradas e saídas", icon: Wallet, status: "live" },
];

const SETTINGS: NavItem[] = [
  { href: "/config", label: "Configuração", description: "Empresa, equipe e conexões", icon: Settings2, status: "live" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const { workspaces } = useActiveWorkspace();
  const clientes = workspaces
    .filter((c) => c.ativo !== false)
    .map((c) => ({ id: c.id, nome: c.nome, slug: c.slug ?? "" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (pathname.startsWith("/portal") || pathname.startsWith("/sign-in")) {
    return null;
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setMobileOpen(false);
    await logoutEverywhere("/");
  }

  const NavBlock = ({ title, items }: { title: string; items: NavItem[] }) => (
    <div className="space-y-1">
      {!collapsed ? (
        <p className="type-fine-print px-3 pb-1 pt-3 uppercase tracking-[0.16em] text-[var(--ink-muted-48)]">
          {title}
        </p>
      ) : null}
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? item.label : undefined}
            className={`group flex items-center gap-3 rounded-sm px-3 py-2 transition active:scale-95 ${
              active
                ? "bg-[var(--surface-tile-1)] text-[var(--on-dark)]"
                : "text-[var(--body-muted)] hover:bg-[var(--surface-tile-2)] hover:text-[var(--on-dark)]"
            }`}
          >
            <Icon
              className={`h-5 w-5 shrink-0 ${active ? "text-[var(--primary-on-dark)]" : ""}`}
              strokeWidth={1.75}
            />
            {!collapsed ? (
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="type-nav-link block truncate">{item.label}</span>
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      item.status === "live" ? "bg-[var(--success)]" : "bg-[var(--ink-muted-48)]"
                    }`}
                    title={item.status === "live" ? "Integrado no Atrako" : "Sistema pronto"}
                  />
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
      <div className={`flex items-center gap-2 px-3 py-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed ? (
          <Link href="/assistente" className="type-tagline px-1 text-[var(--on-dark)]">
            Atrako
          </Link>
        ) : (
          <Link
            href="/assistente"
            className="flex h-9 w-9 items-center justify-center rounded-sm bg-[var(--primary)] type-caption-strong text-[var(--on-primary)] active:scale-95"
          >
            A
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="hidden h-8 w-8 items-center justify-center rounded-sm text-[var(--ink-muted-48)] hover:bg-[var(--surface-tile-2)] hover:text-[var(--on-dark)] md:inline-flex active:scale-95"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        <NavBlock title="Início" items={PRIMARY} />

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
              title="Criar"
              className="nav-criar-collapsed"
              data-active={isActive(pathname, "/criar") ? "true" : "false"}
              aria-label="Criar — onde tudo acontece"
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

        <div className="space-y-1">
          {!collapsed ? (
            <p className="type-fine-print px-3 pb-1 pt-3 uppercase tracking-[0.16em] text-[var(--ink-muted-48)]">
              Contas
            </p>
          ) : null}
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
                title={collapsed ? cliente.nome : undefined}
                className={`flex items-center gap-3 rounded-sm px-3 py-2 transition active:scale-95 ${
                  active
                    ? "bg-[var(--surface-tile-1)] text-[var(--on-dark)]"
                    : "text-[var(--body-muted)] hover:bg-[var(--surface-tile-2)] hover:text-[var(--on-dark)]"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm type-fine-print ${
                    active
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "bg-[var(--surface-tile-3)] text-[var(--body-muted)]"
                  }`}
                >
                  {cliente.nome.slice(0, 1).toUpperCase()}
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

        <NavBlock title="Operação" items={SYSTEMS} />
        <NavBlock title="Ajustes" items={SETTINGS} />
      </nav>

      <div className="border-t border-[var(--surface-tile-2)] px-2 py-3">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? "Sair" : undefined}
          className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-[var(--body-muted)] transition hover:bg-[var(--surface-tile-2)] hover:text-[var(--on-dark)] active:scale-95 disabled:opacity-50"
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          {!collapsed ? (
            <span className="type-nav-link">{loggingOut ? "Saindo…" : "Sair"}</span>
          ) : null}
        </button>
      </div>
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
