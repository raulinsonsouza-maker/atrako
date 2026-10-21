"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { logoutEverywhere } from "@/lib/auth/logoutClient";
import { useAtendimentoBase } from "@/components/layout/LpHostContext";
import { CrmLinksProvider, type CrmLinks } from "@/components/crm/CrmLinksContext";
import "@/app/atendimento/atendimento-shell.css";

type Role = "OWNER" | "ADMIN" | "OPERATOR" | "ANALYST";

const TABS = [
  { path: "", label: "Início", manage: true },
  { path: "/leads", label: "Leads", manage: false },
  { path: "/conversas", label: "Conversas", manage: false },
  { path: "/mensagens", label: "Mensagens", manage: true },
];

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Responsável",
  ADMIN: "Gestão",
  OPERATOR: "Atendimento",
  ANALYST: "Análise",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AtendimentoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = useAtendimentoBase();
  const [leaving, setLeaving] = useState(false);
  const { workspaceId, isError } = useActiveWorkspace();
  const { data } = useQuery({
    queryKey: ["atendimento-shell", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/atendimento?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar a área");
      return res.json() as Promise<{ name: string; logoUrl: string | null; role: Role }>;
    },
  });
  const role = data?.role ?? "ADMIN";
  const manage = role !== "OPERATOR";
  const section = pathname.replace(/^\/(crm|atendimento)/, "");

  useEffect(() => {
    if (!data || manage) return;
    if (TABS.some((tab) => tab.manage && tab.path === section)) router.replace(`${base}/leads`);
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

  async function leave() {
    if (leaving) return;
    setLeaving(true);
    await logoutEverywhere(`/sign-in?next=${encodeURIComponent(base)}`);
  }

  const tabs = TABS.filter((tab) => manage || !tab.manage);

  return (
    <div className="atd-shell">
      <header className="atd-bar">
        <div className="atd-brand">
          {data?.logoUrl ? (
            <img className="atd-mark" src={data.logoUrl} alt="" />
          ) : (
            <span className="atd-mark" aria-hidden>
              {data ? initials(data.name) : ""}
            </span>
          )}
          <div className="min-w-0">
            <strong className="type-body-strong">{data?.name ?? "Atendimento"}</strong>
            <small className="type-fine-print">{ROLE_LABEL[role]}</small>
          </div>
        </div>
        <nav className="atd-tabs" aria-label="Área de atendimento">
          {tabs.map((tab) => {
            const active = tab.path === "" ? section === "" : section.startsWith(tab.path);
            return (
              <Link
                key={tab.path}
                href={`${base}${tab.path}`}
                className={`type-nav-link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <button type="button" className="atd-leave type-caption-strong" onClick={leave} disabled={leaving}>
          {leaving ? "Saindo…" : "Sair"}
        </button>
      </header>
      <main className="atd-main">
        <CrmLinksProvider value={links}>{children}</CrmLinksProvider>
      </main>
    </div>
  );
}
