"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Instagram,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  PanelLeftOpen,
  Send,
  SquareKanban,
} from "lucide-react";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { logoutEverywhere } from "@/lib/auth/logoutClient";
import { useAtendimentoBase } from "@/components/layout/LpHostContext";
import { CrmLinksProvider, type CrmLinks } from "@/components/crm/CrmLinksContext";
import "@/app/atendimento/atendimento-shell.css";

type Role = "OWNER" | "ADMIN" | "OPERATOR" | "ANALYST";
type Channel = "meta" | "instagram";

type Tab = {
  path: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  manage: boolean;
  channel?: Channel;
};

const ATENDIMENTO_TABS: Tab[] = [
  { path: "", label: "Início", description: "Funil e ações do dia", icon: LayoutDashboard, manage: true },
  { path: "/leads", label: "Leads", description: "Pipeline da equipe", icon: SquareKanban, manage: false },
  { path: "/conversas", label: "Conversas", description: "WhatsApp dos leads", icon: MessagesSquare, manage: false },
  { path: "/mensagens", label: "Mensagens", description: "Fluxos automáticos", icon: Send, manage: true },
];

const MARKETING_TABS: Tab[] = [
  { path: "/anuncios", label: "Anúncios", description: "Campanhas no Meta", icon: Megaphone, manage: true, channel: "meta" },
  { path: "/instagram", label: "Instagram", description: "Perfil, alcance e posts", icon: Instagram, manage: true, channel: "instagram" },
];

const MANAGE_PATHS = [...ATENDIMENTO_TABS, ...MARKETING_TABS].filter((tab) => tab.manage).map((tab) => tab.path);

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Responsável",
  ADMIN: "Gestão",
  OPERATOR: "Atendimento",
  ANALYST: "Análise",
};

const COLLAPSED_KEY = "atrako-atendimento-collapsed";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type Tip = { label: string; desc?: string; top: number };

export function AtendimentoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = useAtendimentoBase();
  const [leaving, setLeaving] = useState(false);
  const [collapsedPref, setCollapsedPref] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const [mounted, setMounted] = useState(false);
  /** A gaveta do celular é sempre aberta; recolher é só no desktop. */
  const collapsed = collapsedPref && !mobileOpen;

  const { workspaceId, isError } = useActiveWorkspace();
  const { data } = useQuery({
    queryKey: ["atendimento-shell", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/atendimento?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar a área");
      return res.json() as Promise<{
        name: string;
        logoUrl: string | null;
        role: Role;
        channels: Record<Channel, boolean>;
      }>;
    },
  });
  const role = data?.role ?? "ADMIN";
  const manage = role !== "OPERATOR";
  const section = pathname.replace(/^\/(crm|atendimento)/, "");

  useEffect(() => {
    setCollapsedPref(localStorage.getItem(COLLAPSED_KEY) === "1");
    setMounted(true);
  }, []);

  useEffect(() => {
    setTip(null);
  }, [pathname, collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!data || manage) return;
    if (MANAGE_PATHS.includes(section)) router.replace(`${base}/leads`);
  }, [data, manage, section, base, router]);

  useEffect(() => {
    if (isError) window.location.assign(`/sign-in?next=${encodeURIComponent(base)}`);
  }, [isError, base]);

  const links = useMemo<CrmLinks>(
    () => ({
      leadsHref: `${base}/leads`,
      leadHref: (leadId) => `${base}/leads?lead=${encodeURIComponent(leadId)}`,
      conversationHref: (phone) => `${base}/conversas?phone=${encodeURIComponent(phone)}`,
      journeyLinks: false,
    }),
    [base],
  );

  function toggleCollapsed(next: boolean) {
    setCollapsedPref(next);
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  }

  async function leave() {
    if (leaving) return;
    setLeaving(true);
    await logoutEverywhere(`/sign-in?next=${encodeURIComponent(base)}`);
  }

  /** Recolhido: rótulo flutuante à direita (fixo na tela, fora do `nav` que rola). */
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

  const visible = (tab: Tab) =>
    (manage || !tab.manage) && (!tab.channel || Boolean(data?.channels?.[tab.channel]));
  const atendimentoTabs = ATENDIMENTO_TABS.filter(visible);
  const marketingTabs = MARKETING_TABS.filter(visible);

  const mark = data?.logoUrl ? (
    <img className="atd-mark" src={data.logoUrl} alt="" />
  ) : (
    <span className="atd-mark" aria-hidden>
      {data ? initials(data.name) : ""}
    </span>
  );

  const navBlock = (title: string, tabs: Tab[]) =>
    tabs.length ? (
      <div className="space-y-1">
        {collapsed ? (
          <div className="nav-collapsed-divider" aria-hidden />
        ) : (
          <p className="type-fine-print px-3 pb-1 pt-3 uppercase text-[var(--ink-muted-48)]">{title}</p>
        )}
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.path === "" ? section === "" : section.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              href={`${base}${tab.path}`}
              className={`atd-nav-item${collapsed ? " is-collapsed" : ""}${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              {...tipProps(tab.label, tab.description)}
            >
              <Icon className="atd-nav-icon h-5 w-5 shrink-0" strokeWidth={1.75} />
              {!collapsed ? (
                <span className="min-w-0 flex-1">
                  <span className="type-nav-link block truncate">{tab.label}</span>
                  <span className="type-fine-print mt-0.5 block truncate text-[var(--ink-muted-48)]">
                    {tab.description}
                  </span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    ) : null;

  const sidebar = (
    <aside className={`atd-side${collapsed ? " is-collapsed" : ""}`}>
      {collapsed ? (
        <div className="flex justify-center px-2 py-4" {...tipProps(data?.name ?? "Atendimento", ROLE_LABEL[role])}>
          {mark}
        </div>
      ) : (
        <div className="atd-side-brand">
          {mark}
          <div className="min-w-0 flex-1">
            <strong className="type-body-strong">{data?.name ?? "\u00a0"}</strong>
            <small className="type-fine-print">{data ? ROLE_LABEL[role] : "\u00a0"}</small>
          </div>
          <button
            type="button"
            onClick={() => toggleCollapsed(true)}
            className="atd-side-btn hidden md:inline-flex"
            title="Recolher menu"
            aria-label="Recolher menu"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      <nav
        className={`flex-1 overflow-y-auto px-2 pb-4 ${collapsed ? "nav-collapsed space-y-2" : "space-y-3"}`}
        aria-label="Área de atendimento"
        onScroll={() => setTip(null)}
      >
        {navBlock("Atendimento", atendimentoTabs)}
        {navBlock("Marketing", marketingTabs)}
      </nav>

      <div className={`atd-side-foot${collapsed ? " is-collapsed" : ""}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={() => toggleCollapsed(false)}
            className="atd-foot-icon hidden md:flex"
            {...tipProps("Expandir menu")}
          >
            <PanelLeftOpen className="h-5 w-5" strokeWidth={1.75} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={leave}
          disabled={leaving}
          className={collapsed ? "atd-foot-icon" : "atd-foot-leave"}
          aria-label="Sair"
          {...tipProps("Sair")}
        >
          <LogOut className="h-5 w-5" strokeWidth={1.75} />
          {!collapsed ? <span className="type-nav-link">{leaving ? "Saindo…" : "Sair"}</span> : null}
        </button>
      </div>
    </aside>
  );

  const tipNode =
    collapsed && tip ? (
      <div role="tooltip" className="nav-tip" style={{ top: tip.top }}>
        <span className="type-caption-strong block">{tip.label}</span>
        {tip.desc ? <span className="type-fine-print block text-[var(--ink-muted-48)]">{tip.desc}</span> : null}
      </div>
    ) : null;

  return (
    <div className="atd-shell">
      <div className="hidden md:flex">{sidebar}</div>

      <header className="atd-mobile-bar md:hidden">
        <button
          type="button"
          className="atd-side-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {mark}
        <strong className="type-body-strong truncate">{data?.name ?? ""}</strong>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--surface-black)]/40"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex">{sidebar}</div>
        </div>
      ) : null}

      <main className="atd-main">
        <CrmLinksProvider value={links}>{children}</CrmLinksProvider>
      </main>

      {mounted && tipNode ? createPortal(tipNode, document.body) : null}
    </div>
  );
}
