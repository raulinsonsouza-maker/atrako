"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Eye,
  List,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Rocket,
  Settings,
  Users,
} from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { BackLink } from "@/components/ui/back-link";
import { PillSelect } from "@/components/ui/pill-select";
import { UrlChip } from "@/components/criar/CopyLinkButton";

type Tab = "resumo" | "relatorio" | "leads";

type PageDetail = {
  product: {
    id: string;
    name: string;
    slug: string;
    priceCents: number;
    status: string;
    pageKind?: "leads" | "sales" | "mixed";
    checkoutProductId?: string | null;
    formId?: string | null;
  };
  metrics: {
    visits: { d7: number; d90: number };
    conversions: { d7: number; d90: number };
    conversionRate: { d7: number; d90: number };
    impressions: { d7: number; d90: number };
    frequency: { d7: number; d90: number };
  };
  leads: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    createdAt: string;
  }>;
};

function MetricCard({
  icon,
  title,
  d7,
  d90,
  suffix = "",
}: {
  icon: React.ReactNode;
  title: string;
  d7: string | number;
  d90: string | number;
  suffix?: string;
}) {
  return (
    <div className="lp-detail-metric">
      <div className="lp-detail-metric-top">
        <span className="lp-detail-metric-icon">{icon}</span>
        <span className="type-micro-legal text-[var(--ink-muted-48)]">
          +0,0%
        </span>
      </div>
      <p className="mt-3 type-caption-strong text-[var(--ink)]">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="lp-detail-metric-value tabular-nums">
            {d7}
            {suffix}
          </p>
          <p className="type-micro-legal text-[var(--ink-muted-48)]">
            Últimos 7 dias
          </p>
        </div>
        <div>
          <p className="lp-detail-metric-value tabular-nums">
            {d90}
            {suffix}
          </p>
          <p className="type-micro-legal text-[var(--ink-muted-48)]">
            Últimos 3 meses
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaginaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = String(params.productId || "");
  const [tab, setTab] = useState<Tab>("resumo");
  const [period, setPeriod] = useState("7");

  const { data: clientes = [] } = useQuery({
    queryKey: ["config-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
  });
  const workspaceId = clientes[0]?.id as string | undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["lp-page-detail", workspaceId, productId],
    queryFn: async () => {
      const r = await fetch(
        `/api/atrako/commerce/pages/${encodeURIComponent(productId)}?workspaceId=${workspaceId}`,
      );
      if (!r.ok) throw new Error("Não foi possível carregar a página.");
      return r.json() as Promise<PageDetail>;
    },
    enabled: Boolean(workspaceId && productId),
  });

  const path = data ? `/p/${data.product.slug}` : "";
  const editHref = `/criar/oferta?mode=manual&productId=${encodeURIComponent(productId)}&edit=1`;
  const pageKindLabel =
    data?.product.pageKind === "mixed"
      ? "Misto"
      : data?.product.pageKind === "sales"
        ? "Vendas"
        : data?.product.pageKind === "leads"
          ? "Leads"
          : null;
  const checkoutStandaloneHref = data?.product.checkoutProductId
    ? `/checkout/${data.product.checkoutProductId}`
    : null;

  const tabs = useMemo(
    () =>
      [
        { id: "resumo" as const, label: "Resumo", icon: List },
        { id: "relatorio" as const, label: "Relatório", icon: BarChart3 },
        { id: "leads" as const, label: "Leads", icon: Mail },
      ] as const,
    [],
  );

  if (isLoading || !workspaceId) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <AppPage title="Página" actions={<BackLink href="/criar/oferta?mode=manual" />}>
        <p className="type-caption text-[var(--danger)]">
          {error instanceof Error ? error.message : "Página não encontrada."}
        </p>
      </AppPage>
    );
  }

  const m = data.metrics;
  const leads = data.leads;

  return (
    <AppPage
      className="overflow-y-auto"
      title={
        <div className="flex min-w-0 items-center gap-3">
          <BackLink href="/criar/oferta?mode=manual" />
          <h1 className="type-tagline truncate text-[var(--ink)]">
            {data.product.name}
          </h1>
          {pageKindLabel ? (
            <span className="shrink-0 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-2 py-0.5 type-micro-legal text-[var(--ink-muted-48)]">
              {pageKindLabel}
            </span>
          ) : null}
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={path}
            target="_blank"
            rel="noreferrer"
            className="lp-pages-btn-primary"
          >
            <Rocket className="h-4 w-4" strokeWidth={1.75} />
            Publicar página
          </Link>
          <button
            type="button"
            className="lp-pages-icon-btn"
            aria-label="Configurações"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="lp-pages-icon-btn"
            aria-label="Mais opções"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      }
    >
      <nav className="lp-detail-tabs" aria-label="Seções da página">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className="lp-detail-tab"
              data-active={tab === t.id ? "true" : "false"}
              onClick={() => setTab(t.id)}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "resumo" ? (
        <div className="lp-detail-body">
          <div className="lp-detail-metrics">
            <MetricCard
              icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
              title="Visitas"
              d7={m.visits.d7}
              d90={m.visits.d90}
            />
            <MetricCard
              icon={<Mail className="h-4 w-4" strokeWidth={1.75} />}
              title="Conversão"
              d7={m.conversions.d7}
              d90={m.conversions.d90}
            />
            <MetricCard
              icon={<BarChart3 className="h-4 w-4" strokeWidth={1.75} />}
              title="Taxa de conversão"
              d7={m.conversionRate.d7.toFixed(2)}
              d90={m.conversionRate.d90.toFixed(2)}
              suffix="%"
            />
          </div>

          <div className="lp-detail-actions-bar">
            <UrlChip path={path} />
            <div className="lp-detail-actions-bar-btns">
              <Link
                href={path}
                target="_blank"
                rel="noreferrer"
                className="lp-pages-btn-secondary"
              >
                <Eye className="h-4 w-4" strokeWidth={1.75} />
                Pré-visualizar
              </Link>
              <Link href={editHref} className="lp-pages-btn-primary">
                <Pencil className="h-4 w-4" strokeWidth={1.75} />
                Editar design
              </Link>
              {checkoutStandaloneHref ? (
                <Link
                  href={checkoutStandaloneHref}
                  target="_blank"
                  rel="noreferrer"
                  className="lp-pages-btn-secondary"
                >
                  Checkout
                </Link>
              ) : null}
            </div>
          </div>

          <div className="lp-detail-preview">
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              Pré-visualização da landing — só o conteúdo público da página.
            </p>
            <iframe
              title={data.product.name}
              src={`${path}?embed=1`}
              className="lp-detail-iframe"
            />
          </div>
        </div>
      ) : null}

      {tab === "relatorio" ? (
        <div className="lp-detail-body">
          <div className="lp-detail-report-head">
            <h2 className="type-tagline text-[var(--ink)]">Números relevantes</h2>
            <PillSelect
              size="toolbar"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "7", label: "Últimos 7 dias" },
                { value: "90", label: "Últimos 3 meses" },
              ]}
              aria-label="Período"
            />
          </div>
          <p className="lp-detail-info type-fine-print">
            Visitas e impressões ficam guardadas por 3 meses. Períodos anteriores
            a isso não podem ser consultados.
          </p>
          <div className="lp-detail-metrics">
            <MetricCard
              icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
              title="Visitas"
              d7={m.visits.d7}
              d90={m.visits.d90}
            />
            <MetricCard
              icon={<Mail className="h-4 w-4" strokeWidth={1.75} />}
              title="Impressões"
              d7={m.impressions.d7}
              d90={m.impressions.d90}
            />
            <MetricCard
              icon={<BarChart3 className="h-4 w-4" strokeWidth={1.75} />}
              title="Frequência"
              d7={m.frequency.d7.toFixed(2).replace(".", ",")}
              d90={m.frequency.d90.toFixed(2).replace(".", ",")}
            />
          </div>
          <div className="lp-detail-chart">
            <p className="type-caption-strong text-[var(--ink)]">
              Visitas e impressões
            </p>
            <div className="lp-detail-chart-empty">
              <p className="type-fine-print text-[var(--ink-muted-48)]">
                Sem dados neste período — o gráfico aparece quando houver
                visitas.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "leads" ? (
        <div className="lp-detail-body">
          <div className="lp-detail-leads-head">
            <h2 className="type-tagline text-[var(--ink)]">
              Total de {leads.length} lead{leads.length === 1 ? "" : "s"}
            </h2>
          </div>
          <div className="lp-detail-leads-table">
            <div className="lp-detail-leads-cols type-micro-legal text-[var(--ink-muted-48)]">
              <span>Conversão em</span>
              <span>Leads</span>
              <span>Contacto</span>
            </div>
            {leads.length === 0 ? (
              <p className="lp-detail-leads-empty type-caption text-[var(--ink-muted-48)]">
                Nenhum lead encontrado neste período.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--divider-soft)]">
                {leads.map((l) => (
                  <li key={l.id} className="lp-detail-lead-row">
                    <span className="type-fine-print text-[var(--ink-muted-80)]">
                      {new Date(l.createdAt).toLocaleString("pt-BR")}
                    </span>
                    <span className="type-caption-strong text-[var(--ink)]">
                      {l.name || "—"}
                    </span>
                    <span className="type-fine-print text-[var(--ink-muted-80)] truncate">
                      {l.email || l.phone || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-4">
            <button
              type="button"
              className="lp-pages-btn-secondary"
              onClick={() => router.push("/crm")}
            >
              Abrir CRM
            </button>
          </div>
        </div>
      ) : null}
    </AppPage>
  );
}
