"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Settings, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui";
import { BrandLogo } from "@/components/ui/brand-logo";
import { useOAuthPopup } from "@/hooks/useOAuthPopup";
import { useAtendimentoInfo } from "@/components/atendimento/useAtendimentoInfo";

type MpConnection = {
  status: string;
  label: string | null;
  hasCredentials: boolean;
  updatedAt: string;
} | null;

function Sheet({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = ["mp-connection", workspaceId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const r = await fetch(`/api/atrako/connections?workspaceId=${encodeURIComponent(workspaceId)}&provider=MERCADO_PAGO`);
      if (!r.ok) throw new Error("fail");
      return ((await r.json()) as { connection: MpConnection }).connection;
    },
  });
  const connected = Boolean(data && data.status === "ACTIVE" && data.hasCredentials);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: key });
    await qc.invalidateQueries({ queryKey: ["atendimento-finance", workspaceId] });
  }

  const { open, pending } = useOAuthPopup({
    onDone: (msg) => {
      void refresh();
      if ("cancelled" in msg) return;
      setFlash(msg.ok ? { ok: true, text: "Mercado Pago conectado." } : { ok: false, text: "Não foi possível conectar. Tente de novo." });
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function connect() {
    setFlash(null);
    open(`/api/atrako/oauth/mercadopago/start?workspaceId=${encodeURIComponent(workspaceId)}`);
  }

  async function disconnect() {
    setBusy(true);
    setFlash(null);
    try {
      const r = await fetch("/api/atrako/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, provider: "MERCADO_PAGO", action: "disconnect" }),
      });
      if (!r.ok) throw new Error();
      await refresh();
    } catch {
      setFlash({ ok: false, text: "Não foi possível desconectar." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="panel-modal-backdrop"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="panel-modal max-w-[440px]" role="dialog" aria-labelledby="recebimentos-title">
        <div className="panel-modal-header flex items-center justify-between gap-3">
          <h2 id="recebimentos-title" className="type-body-strong text-[var(--ink)]">
            Recebimentos
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-xs)] p-1 text-[var(--ink-muted-48)] active:scale-95"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="panel-modal-body space-y-4">
          <section className="rel-card space-y-4 p-5">
            <div className="flex items-center gap-3">
              <BrandLogo provider="MERCADO_PAGO" size={40} />
              <div className="min-w-0 flex-1">
                <p className="type-body-strong text-[var(--ink)]">Mercado Pago</p>
                {isLoading ? (
                  <p className="type-fine-print text-[var(--ink-muted-48)]">Pix e cartão dos links de cobrança</p>
                ) : (
                  <p className="flex min-w-0 items-center gap-1.5 type-fine-print text-[var(--ink-muted-80)]">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`}
                      aria-hidden
                    />
                    <span className="truncate">
                      {connected
                        ? `Conectado${data?.label ? ` · ${data.label}` : ""} · desde ${new Date(data!.updatedAt).toLocaleDateString("pt-BR")}`
                        : "Não conectado · links de cobrança desativados"}
                    </span>
                  </p>
                )}
              </div>
            </div>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-muted-48)]" />
            ) : connected ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="toolbar" onClick={connect} disabled={pending || busy}>
                  Trocar conta
                </Button>
                <Button type="button" variant="ghost" size="toolbar" onClick={() => void disconnect()} disabled={pending || busy}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Desconectar
                </Button>
              </div>
            ) : (
              <Button type="button" variant="primary" size="toolbar" onClick={connect} disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {pending ? "Aguardando o Mercado Pago…" : "Conectar Mercado Pago"}
              </Button>
            )}
            {flash ? (
              <p className={`type-fine-print ${flash.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{flash.text}</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Engrenagem do Financeiro: conecta a conta de recebimento (só quem gerencia o workspace). */
export function RecebimentosConfig({ workspaceId }: { workspaceId: string | null }) {
  const { info } = useAtendimentoInfo();
  const [open, setOpen] = useState(false);
  if (!workspaceId || !info || (info.role !== "OWNER" && info.role !== "ADMIN")) return null;
  return (
    <>
      <IconButton size="toolbar" aria-label="Configurar recebimentos" title="Recebimentos" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" strokeWidth={1.75} />
      </IconButton>
      {open ? <Sheet workspaceId={workspaceId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
