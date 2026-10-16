"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { BackLink } from "@/components/ui/back-link";

type Conexao = {
  id: string;
  nome: string;
  plataforma: string;
  ativo: boolean;
  contasCount: number;
};

export default function AdsConexoesPage() {
  const { data: conexoes = [], isLoading, error } = useQuery<Conexao[]>({
    queryKey: ["admin-conexoes-ads"],
    queryFn: async () => {
      const r = await fetch("/api/admin/conexoes");
      if (!r.ok) throw new Error("Falha ao carregar");
      return r.json();
    },
  });

  return (
    <AppPage
      title={
        <div>
          <BackLink href="/admin/apps">Apps</BackLink>
          <h1 className="type-tagline mt-2 text-[var(--ink)]">Conexões de mídia</h1>
        </div>
      }
    >
      <p className="type-fine-print text-[var(--ink-muted-48)]">
        BMs Meta / Google / LinkedIn. Instagram e Mercado Pago ficam em Config → Conexões do
        workspace.
      </p>

      {error ? (
        <div className="flex gap-2 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-4 py-3 type-caption text-[var(--ink)]">
          <AlertCircle className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          Não foi possível listar conexões.
        </div>
      ) : null}

      {isLoading ? (
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      ) : (
        <ul className="divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)]">
          {conexoes.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="type-nav-link truncate text-[var(--ink)]">{c.nome}</p>
                <p className="type-fine-print text-[var(--ink-muted-48)]">
                  {c.plataforma} · {c.contasCount} contas
                </p>
              </div>
              {c.ativo ? (
                <span className="inline-flex items-center gap-1 type-fine-print text-[var(--success)]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                </span>
              ) : (
                <span className="type-fine-print text-[var(--ink-muted-48)]">Inativo</span>
              )}
            </li>
          ))}
          {conexoes.length === 0 ? (
            <li className="px-4 py-8 text-center type-caption text-[var(--ink-muted-48)]">
              Nenhuma conexão de ads.
            </li>
          ) : null}
        </ul>
      )}
    </AppPage>
  );
}
