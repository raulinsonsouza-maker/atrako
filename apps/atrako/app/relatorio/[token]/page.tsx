"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { VendasMetaReportPanel, type CicloResumoView } from "@/components/relatorios/VendasMetaReport";

type RelatorioPublico = {
  cliente: { nome: string; logoUrl: string | null };
  config: { percent: number };
  ciclos: CicloResumoView[];
};

function RelatorioPublicoPage() {
  const { token } = useParams<{ token: string }>();
  const search = useSearchParams();
  const apiBase = `/api/relatorio/${encodeURIComponent(token)}`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["relatorio-publico", token],
    queryFn: async () => {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error("not_found");
      return (await res.json()) as RelatorioPublico;
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[var(--ink-muted-48)]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="type-tagline text-[var(--ink)]">Relatório não encontrado</h1>
        <p className="max-w-sm type-caption text-[var(--ink-muted-48)]">
          Este link não é válido ou foi substituído. Solicite o link atualizado à sua agência.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas-parchment)]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-6 md:px-8">
        <header className="report-print-hide flex items-center gap-3">
          {data.cliente.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.cliente.logoUrl} alt={data.cliente.nome} className="h-9 w-auto max-w-[160px] object-contain" />
          ) : null}
          <div className="min-w-0">
            <h1 className="type-tagline text-[var(--ink)]">{data.cliente.nome}</h1>
            <p className="type-fine-print text-[var(--ink-muted-48)]">Vendas vindas de campanhas do Meta · relatório mensal</p>
          </div>
        </header>
        <VendasMetaReportPanel
          apiBase={apiBase}
          ciclos={data.ciclos}
          clienteNome={data.cliente.nome}
          initialCicloId={search.get("ciclo")}
          autoPrint={search.get("imprimir") === "1"}
        />
        <p className="report-print-hide type-micro-legal text-[var(--ink-muted-48)]">Relatório gerado pela Atrako.</p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RelatorioPublicoPage />
    </Suspense>
  );
}
