"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShoppingBag } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { BackLink, Button, PillSelect, buttonVariants } from "@/components/ui";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

function TrayVincularInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const apiAddress = searchParams.get("api_address") ?? "";
  const store = searchParams.get("store") ?? "";
  const { workspaceId, setWorkspaceId, workspaces, isReady } = useActiveWorkspace();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    try {
      setFramed(window.top !== window.self);
    } catch {
      setFramed(true);
    }
  }, []);

  const missing = !code || !apiAddress;

  async function vincular() {
    if (!workspaceId || missing) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/oauth/tray/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, code, apiAddress, store: store || null }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Não foi possível vincular a loja.");
      router.replace(
        `/config/conexoes?workspaceId=${encodeURIComponent(workspaceId)}&connected=TRAY`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível vincular a loja.");
      setSaving(false);
    }
  }

  return (
    <AppPage title="Vincular loja Tray" narrow>
      <BackLink href="/config/conexoes">Conexões</BackLink>
      <div className="space-y-4 rounded-xl border border-[var(--hairline)] bg-white p-5">
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-5 w-5 text-[var(--primary)]" />
          <div>
            <p className="type-caption-strong text-[var(--ink)]">
              {store ? `Loja Tray #${store}` : "Loja Tray"}
            </p>
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              O app Atrako foi instalado no painel da Tray. Escolha a empresa que vai receber
              os pedidos.
            </p>
          </div>
        </div>

        {missing ? (
          <p className="type-body text-[var(--danger)]">
            Link de instalação incompleto. Reinstale o app Atrako pelo painel da Tray.
          </p>
        ) : framed ? (
          <a
            href={window.location.href}
            target="_top"
            rel="noopener"
            className={buttonVariants({ variant: "primary" })}
          >
            Continuar no Atrako
          </a>
        ) : !isReady ? (
          <div className="flex items-center gap-2 type-caption text-[var(--ink-muted-48)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando empresas…
          </div>
        ) : (
          <>
            <div>
              <label className="type-fine-print text-[var(--ink-muted-48)]">Empresa</label>
              <PillSelect
                className="mt-1 w-full"
                size="field"
                value={workspaceId}
                onChange={setWorkspaceId}
                options={
                  workspaces.length === 0
                    ? [{ value: "", label: "Nenhuma empresa — crie em Configurações" }]
                    : workspaces.map((c) => ({ value: c.id, label: c.nome }))
                }
                aria-label="Empresa"
              />
            </div>
            {error ? <p className="type-fine-print text-[var(--danger)]">{error}</p> : null}
            <Button onClick={vincular} disabled={!workspaceId || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Vincular loja
            </Button>
          </>
        )}
      </div>
    </AppPage>
  );
}

export default function TrayVincularPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-[var(--canvas-parchment)] p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <TrayVincularInner />
    </Suspense>
  );
}
