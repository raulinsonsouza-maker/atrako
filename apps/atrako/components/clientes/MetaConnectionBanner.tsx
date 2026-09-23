"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Link2 } from "lucide-react";

type MetaStatus = {
  connected: boolean;
  health: string;
  businessName: string | null;
  selectedAdAccountId: string | null;
};

/** Banner no painel do cliente quando Meta não está ready. */
export function MetaConnectionBanner({ workspaceId }: { workspaceId: string }) {
  const { data } = useQuery({
    queryKey: ["meta-connection-status", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/meta/connection?workspaceId=${workspaceId}`);
      if (!r.ok) return null;
      return r.json() as Promise<MetaStatus>;
    },
    staleTime: 60_000,
  });

  if (!data) return null;
  if (data.health === "ready" && data.connected) return null;

  const needsReauth = data.health === "needs_reauth";
  const pendingAccount =
    data.health === "connected_pending_account" ||
    (data.connected && !data.selectedAdAccountId);

  let title = "Conecte a Meta Ads para sincronizar campanhas";
  let cta = "Conectar Meta";
  if (needsReauth) {
    title = "A conexão com a Meta expirou. Reconecte sua conta.";
    cta = "Reconectar Meta";
  } else if (pendingAccount) {
    title = "Selecione a conta de anúncio Meta em Integrações.";
    cta = "Escolher conta";
  } else if (data.health === "sync_error") {
    title = "Falha na última sincronização Meta. Verifique a conexão.";
    cta = "Ver integração";
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="type-fine-print">{title}</p>
      </div>
      <Link
        href={`/config/conexoes?workspaceId=${workspaceId}`}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-fine-print text-[var(--on-primary)] active:scale-95"
      >
        <Link2 className="h-3.5 w-3.5" />
        {cta}
      </Link>
    </div>
  );
}
