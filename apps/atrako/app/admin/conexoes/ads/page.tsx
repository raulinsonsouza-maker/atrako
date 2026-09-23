"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

type Conexao = {
  id: string;
  nome: string;
  plataforma: string;
  ativo: boolean;
  contasCount: number;
  hasMetaAccessToken: boolean;
  hasGoogleRefreshToken: boolean;
  hasLinkedinAccessToken: boolean;
};

export default function AdsConexoesPage() {
  const { data: conexoes = [], isLoading, error } = useQuery<Conexao[]>({
    queryKey: ["admin-conexoes-ads"],
    queryFn: async () => {
      const r = await fetch("/api/admin/conexoes");
      if (!r.ok) throw new Error("Falha ao carregar (admin)");
      return r.json();
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/conexoes"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#efefef]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Conexões de mídia (Ads)</h1>
          <p className="text-sm text-[#737373]">
            BMs Meta / Google / LinkedIn compartilháveis. Instagram e Mercado Pago ficam no hub por
            workspace.
          </p>
        </div>
      </div>

      {error ? (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Não foi possível listar conexões admin. Use o cadastro via API ou seed existente.
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-[#737373]">Carregando…</p>
      ) : (
        <ul className="space-y-2">
          {conexoes.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-[#efefef] bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{c.nome}</p>
                <p className="text-xs text-[#737373]">
                  {c.plataforma} · {c.contasCount} contas
                </p>
              </div>
              {c.ativo ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                </span>
              ) : (
                <span className="text-xs text-[#a3a3a3]">Inativo</span>
              )}
            </li>
          ))}
          {conexoes.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#efefef] p-6 text-center text-sm text-[#737373]">
              Nenhuma conexão de ads ainda. Cadastre em Admin → API conexões ou reutilize as existentes
              vinculadas às contas do workspace.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
