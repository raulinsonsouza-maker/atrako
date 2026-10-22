"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button, MetricGrid, MetricTile, PillSelect, SectionCard, buttonClass } from "@/components/ui";
import { CICLO_STATUS_LABELS, formatCicloLabel, formatDayBR, type CicloStatus } from "@/lib/relatorios/ciclos";
import { formatBRL, formatDateTimeBR, formatPercent, type VendasMetaReport } from "@/lib/relatorios/vendas-meta-core";

export type CicloResumoView = {
  id: string;
  dataInicio: string;
  dataFim: string;
  status: CicloStatus;
  comissaoPercent: number;
  fechadoEm: string | null;
};

const STATUS_TONE: Record<CicloStatus, "ok" | "warn"> = {
  EM_ANDAMENTO: "warn",
  EM_APURACAO: "warn",
  FECHADO: "ok",
};

const STATUS_HINT: Record<CicloStatus, string> = {
  EM_ANDAMENTO: "Ciclo aberto: os números são atualizados todos os dias.",
  EM_APURACAO: "Ciclo encerrado, em apuração por 7 dias para cancelamentos e reembolsos entrarem. Depois disso o valor fica fechado.",
  FECHADO: "Ciclo fechado: valores congelados para cobrança.",
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Relatório mensal de comissão sobre vendas Meta — mesma tela na área interna e no link público.
 * `apiBase`: `/api/clientes/{id}/relatorios/vendas-meta` ou `/api/relatorio/{token}`.
 */
export function VendasMetaReportPanel({
  apiBase,
  ciclos,
  clienteNome,
  initialCicloId,
  pdfHref,
  autoPrint = false,
}: {
  apiBase: string;
  ciclos: CicloResumoView[];
  clienteNome: string;
  initialCicloId?: string | null;
  /** Abre a versão pública para imprimir (área interna). Sem isso, o botão imprime a própria página. */
  pdfHref?: (cicloId: string) => string;
  autoPrint?: boolean;
}) {
  const [cicloId, setCicloId] = useState<string>(
    () => (initialCicloId && ciclos.some((c) => c.id === initialCicloId) ? initialCicloId : ciclos[0]?.id) ?? "",
  );
  useEffect(() => {
    if (!ciclos.some((c) => c.id === cicloId) && ciclos[0]) setCicloId(ciclos[0].id);
  }, [ciclos, cicloId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["comissao-vendas-meta", apiBase, cicloId],
    enabled: Boolean(cicloId),
    queryFn: async () => {
      const res = await fetch(`${apiBase}/${cicloId}`);
      if (!res.ok) throw new Error("Falha ao carregar o relatório");
      return (await res.json()) as { ciclo: CicloResumoView; report: VendasMetaReport };
    },
  });

  const options = useMemo(
    () =>
      ciclos.map((c) => ({
        value: c.id,
        label: `${formatCicloLabel(c)} · ${CICLO_STATUS_LABELS[c.status]}`,
      })),
    [ciclos],
  );

  const ciclo = data?.ciclo ?? ciclos.find((c) => c.id === cicloId) ?? null;

  useEffect(() => {
    if (!ciclo) return;
    document.title = `Comissão Meta · ${clienteNome} · ${formatCicloLabel(ciclo)}`;
  }, [ciclo, clienteNome]);

  useEffect(() => {
    if (!autoPrint || !data) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [autoPrint, data]);

  if (!ciclos.length) {
    return (
      <SectionCard title="Nenhum ciclo ainda">
        <p className="type-caption text-[var(--ink-muted-48)]">O primeiro ciclo aparece aqui a partir da data de início do contrato.</p>
      </SectionCard>
    );
  }

  const csvHref = (tipo?: "itens") => `${apiBase}/${cicloId}/csv${tipo ? `?tipo=${tipo}` : ""}`;

  return (
    <div className="report-print-area flex flex-col gap-4">
      <div className="report-print-hide flex flex-wrap items-center gap-2">
        <PillSelect value={cicloId} onChange={setCicloId} options={options} aria-label="Ciclo" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <a href={csvHref()} className={buttonClass({ variant: "outline", size: "toolbar" })} download>
            <Download className="h-4 w-4" strokeWidth={1.75} /> CSV pedidos
          </a>
          <a href={csvHref("itens")} className={buttonClass({ variant: "outline", size: "toolbar" })} download>
            <Download className="h-4 w-4" strokeWidth={1.75} /> CSV itens
          </a>
          {pdfHref ? (
            <a
              href={pdfHref(cicloId)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ variant: "primary", size: "toolbar" })}
            >
              <FileText className="h-4 w-4" strokeWidth={1.75} /> Baixar PDF
            </a>
          ) : (
            <Button size="toolbar" onClick={() => window.print()} disabled={!data}>
              <FileText className="h-4 w-4" strokeWidth={1.75} /> Baixar PDF
            </Button>
          )}
        </div>
      </div>

      {isLoading || !data || !ciclo ? (
        <div className="rel-card flex items-center gap-2 type-caption text-[var(--ink-muted-48)]">
          {isError ? (
            "Não foi possível carregar este ciclo."
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Calculando vendas do ciclo…
            </>
          )}
        </div>
      ) : (
        <VendasMetaReportView report={data.report} ciclo={ciclo} clienteNome={clienteNome} />
      )}
    </div>
  );
}

export function VendasMetaReportView({
  report,
  ciclo,
  clienteNome,
}: {
  report: VendasMetaReport;
  ciclo: CicloResumoView;
  clienteNome: string;
}) {
  const r = report.resumo;
  const pct = formatPercent(report.comissaoPercent);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-fine-print text-[var(--ink-muted-48)]">Relatório de comissão · Vendas vindas do Meta</p>
          <h2 className="type-tagline text-[var(--ink)]">
            {clienteNome} · {formatDayBR(report.periodo.dataInicio)} a {formatDayBR(report.periodo.dataFim)}
          </h2>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            {ciclo.status === "FECHADO" && ciclo.fechadoEm
              ? `Fechado em ${formatDateTimeBR(ciclo.fechadoEm)}`
              : `Atualizado em ${formatDateTimeBR(report.geradoEm)}`}
          </p>
        </div>
        <span className="rel-badge type-micro-legal" data-tone={STATUS_TONE[ciclo.status]} title={STATUS_HINT[ciclo.status]}>
          {CICLO_STATUS_LABELS[ciclo.status]}
        </span>
      </header>

      <MetricGrid>
        <MetricTile
          label="Faturado via Meta"
          value={formatBRL(r.faturamentoCents)}
          detail={`${plural(r.pedidos, "venda paga", "vendas pagas")}`}
        />
        <MetricTile
          label={`Comissão (${pct})`}
          value={formatBRL(r.comissaoCents)}
          detail={`Sobre o total dos pedidos pagos`}
        />
        <MetricTile label="Ticket médio" value={formatBRL(r.ticketMedioCents)} detail={plural(r.unidades, "unidade", "unidades")} />
      </MetricGrid>

      {report.porCampanha.length ? (
        <SectionCard title="Por campanha">
          <div className="overflow-x-auto">
            <table className="rel-table min-w-[560px] type-caption">
              <thead>
                <tr className="type-fine-print">
                  <th>Campanha</th>
                  <th className="text-right">Vendas</th>
                  <th className="text-right">Faturado</th>
                  <th className="text-right">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {report.porCampanha.map((c) => (
                  <tr key={c.campanhaId ?? c.campanha}>
                    <td>{c.campanha}</td>
                    <td className="text-right tabular-nums">{c.pedidos}</td>
                    <td className="text-right tabular-nums">{formatBRL(c.faturamentoCents)}</td>
                    <td className="text-right tabular-nums">{formatBRL(c.comissaoCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {report.porAnuncio.length ? (
        <SectionCard title="Por conjunto e anúncio">
          <div className="overflow-x-auto">
            <table className="rel-table min-w-[720px] type-caption">
              <thead>
                <tr className="type-fine-print">
                  <th>Campanha</th>
                  <th>Conjunto</th>
                  <th>Anúncio</th>
                  <th className="text-right">Vendas</th>
                  <th className="text-right">Faturado</th>
                </tr>
              </thead>
              <tbody>
                {report.porAnuncio.map((a) => (
                  <tr key={`${a.campanha}|${a.conjunto}|${a.anuncio}`}>
                    <td className="text-[var(--ink-muted-48)]">{a.campanha}</td>
                    <td>{a.conjunto}</td>
                    <td>{a.anuncio}</td>
                    <td className="text-right tabular-nums">{a.pedidos}</td>
                    <td className="text-right tabular-nums">{formatBRL(a.faturamentoCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {report.porProduto.length ? (
        <SectionCard title="Produtos vendidos">
          <div className="overflow-x-auto">
            <table className="rel-table min-w-[560px] type-caption">
              <thead>
                <tr className="type-fine-print">
                  <th>Produto</th>
                  <th>SKU</th>
                  <th className="text-right">Unidades</th>
                  <th className="text-right">Pedidos</th>
                  <th className="text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {report.porProduto.map((p) => (
                  <tr key={p.sku || p.titulo}>
                    <td>{p.titulo}</td>
                    <td className="text-[var(--ink-muted-48)]">{p.sku ?? "—"}</td>
                    <td className="text-right tabular-nums">{p.quantidade}</td>
                    <td className="text-right tabular-nums">{p.pedidos}</td>
                    <td className="text-right tabular-nums">{formatBRL(p.receitaCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Vendas do ciclo" subtitle={plural(report.pedidos.length, "pedido pago", "pedidos pagos")}>
        {report.pedidos.length ? (
          <div className="overflow-x-auto">
            <table className="rel-table min-w-[980px] type-caption">
              <thead>
                <tr className="type-fine-print">
                  <th>Pedido</th>
                  <th>Data</th>
                  <th>Comprador</th>
                  <th>Itens</th>
                  <th>Origem no Meta</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {report.pedidos.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="tabular-nums">#{p.numero}</td>
                    <td className="whitespace-nowrap tabular-nums">{formatDateTimeBR(p.data)}</td>
                    <td>
                      {p.comprador ?? "—"}
                      {p.cidade || p.uf ? (
                        <span className="block type-fine-print text-[var(--ink-muted-48)]">
                          {[p.cidade, p.uf].filter(Boolean).join(" / ")}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {p.itens.length
                        ? p.itens.map((i, idx) => (
                            <span key={idx} className="block">
                              {i.quantidade}× {i.titulo}
                            </span>
                          ))
                        : "—"}
                    </td>
                    <td>
                      {p.campanha ?? "Campanha não identificada"}
                      {p.anuncio || p.conjunto ? (
                        <span className="block type-fine-print text-[var(--ink-muted-48)]">
                          {[p.conjunto, p.anuncio].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </td>
   350|                    <td className="text-right tabular-nums">{formatBRL(p.totalCents)}</td>
                    <td className="text-right tabular-nums">{formatBRL(p.comissaoCents)}</td>
                  </tr>
                ))}
                <tr className="type-caption-strong">
                  <td colSpan={6}>Total do ciclo</td>
                  <td className="text-right tabular-nums">{formatBRL(r.faturamentoCents)}</td>
                  <td className="text-right tabular-nums text-[var(--primary)]">{formatBRL(r.comissaoCents)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="type-caption text-[var(--ink-muted-48)]">Nenhuma venda paga atribuída ao Meta neste ciclo.</p>
        )}
      </SectionCard>

      <div className="rel-card flex flex-col gap-1 type-fine-print text-[var(--ink-muted-48)]">
        <p>
          Conferência: o Meta reportou {plural(report.meta.compras, "compra", "compras")} ({formatBRL(report.meta.valorCents)}) no
          período, contando clique em até 7 dias e visualização em 1 dia.
        </p>
        {report.naoConcretizados.pedidos ? (
          <p>
            Fora da comissão: {plural(report.naoConcretizados.pedidos, "pedido atribuído ao Meta", "pedidos atribuídos ao Meta")} sem
            pagamento confirmado, cancelados ou reembolsados ({formatBRL(report.naoConcretizados.valorCents)}).
          </p>
        ) : null}
        <p>
          Entram só pedidos pagos (status Pago ou Concluído na loja), pela data do pagamento, no horário de Brasília. Comissão de {pct}{" "}
          sobre o total do pedido.
        </p>
      </div>
    </div>
  );
}
