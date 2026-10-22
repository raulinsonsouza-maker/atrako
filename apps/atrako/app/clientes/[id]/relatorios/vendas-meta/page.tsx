"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { BackLink, Button, SectionCard, TextField, buttonClass } from "@/components/ui";
import { VendasMetaReportPanel, type CicloResumoView } from "@/components/relatorios/VendasMetaReport";

type ComissaoData = {
  cliente: { id: string; nome: string; slug: string };
  config: { percent: number; inicio: string; diaCorte: number; shareToken: string | null } | null;
  podeEditar: boolean;
  ciclos: CicloResumoView[];
};

function ConfigCard({ clienteId, data }: { clienteId: string; data: ComissaoData }) {
  const qc = useQueryClient();
  const [percent, setPercent] = useState(String(data.config?.percent ?? 10));
  const [inicio, setInicio] = useState(data.config?.inicio ?? "");
  const [diaCorte, setDiaCorte] = useState(String(data.config?.diaCorte ?? ""));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!data.config) return;
    setPercent(String(data.config.percent));
    setInicio(data.config.inicio);
    setDiaCorte(String(data.config.diaCorte));
  }, [data.config]);

  const save = useMutation({
    mutationFn: async (extra: { regenerarLink?: boolean }) => {
      const res = await fetch(`/api/clientes/${clienteId}/relatorios/vendas-meta/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          percent: Number(percent.replace(",", ".")),
          inicio,
          diaCorte: Number(diaCorte || inicio.slice(8, 10)),
          ...extra,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comissao-config", clienteId] }),
  });

  const shareUrl =
    data.config?.shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/relatorio/${data.config.shareToken}`
      : null;

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <SectionCard
      title="Contrato de comissão"
      subtitle="Cada ciclo começa no dia de corte e termina na véspera do mesmo dia no mês seguinte. O ciclo fecha sozinho 7 dias depois do fim."
      className="report-print-hide"
    >
      <div className="grid gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end">
        <TextField
          label="Comissão (%)"
          inputMode="decimal"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          disabled={!data.podeEditar}
        />
        <TextField
          label="Início do primeiro ciclo"
          type="date"
          value={inicio}
          onChange={(e) => {
            setInicio(e.target.value);
            if (!diaCorte && e.target.value) setDiaCorte(String(Number(e.target.value.slice(8, 10))));
          }}
          disabled={!data.podeEditar}
        />
        <TextField
          label="Dia de corte"
          inputMode="numeric"
          value={diaCorte}
          onChange={(e) => setDiaCorte(e.target.value.replace(/\D/g, "").slice(0, 2))}
          hint="Ex.: 24 = ciclos de 24 a 23"
          disabled={!data.podeEditar}
        />
        {data.podeEditar ? (
          <Button onClick={() => save.mutate({})} disabled={save.isPending || !inicio}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {data.config ? "Salvar" : "Ativar relatório"}
          </Button>
        ) : null}
      </div>
      {save.isError ? <p className="mt-2 type-fine-print text-[var(--danger)]">{(save.error as Error).message}</p> : null}

      {shareUrl ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--divider-soft)] pt-4">
          <span className="type-caption-strong text-[var(--ink)]">Link do cliente</span>
          <code className="min-w-0 flex-1 truncate type-fine-print text-[var(--ink-muted-48)]">{shareUrl}</code>
          <Button variant="outline" size="toolbar" onClick={copy}>
            {copied ? <Check className="h-4 w-4" strokeWidth={1.75} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "outline", size: "toolbar" })}>
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} /> Abrir
          </a>
          {data.podeEditar ? (
            <Button
              variant="ghost"
              size="toolbar"
              onClick={() => {
                if (window.confirm("Gerar um novo link? O link atual deixa de funcionar.")) save.mutate({ regenerarLink: true });
              }}
            >
              Gerar novo link
            </Button>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}

export default function RelatorioVendasMetaPage() {
  const { id } = useParams<{ id: string }>();
  const apiBase = `/api/clientes/${id}/relatorios/vendas-meta`;
  const { data, isLoading } = useQuery({
    queryKey: ["comissao-config", id],
    queryFn: async () => {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error("Falha ao carregar");
      return (await res.json()) as ComissaoData;
    },
  });

  const token = data?.config?.shareToken;

  return (
    <AppPage
      title={
        <div className="flex flex-col gap-1">
          <BackLink href={`/clientes/${id}`}>{data?.cliente.nome ?? "Voltar"}</BackLink>
          <h1 className="type-tagline text-[var(--ink)]">Relatório de comissão · Vendas Meta</h1>
        </div>
      }
    >
      {isLoading || !data ? (
        <div className="rel-card flex items-center gap-2 type-caption text-[var(--ink-muted-48)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          <ConfigCard clienteId={id} data={data} />
          {data.config ? (
            <VendasMetaReportPanel
              apiBase={apiBase}
              ciclos={data.ciclos}
              clienteNome={data.cliente.nome}
              pdfHref={token ? (cicloId) => `/relatorio/${token}?ciclo=${cicloId}&imprimir=1` : undefined}
            />
          ) : null}
        </>
      )}
    </AppPage>
  );
}
