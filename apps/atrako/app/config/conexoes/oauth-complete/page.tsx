"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ATRAKO_OAUTH_MESSAGE, type AtrakoOAuthMessage } from "@/lib/oauth/openOAuthPopup";

function hubUrlFromParams(sp: URLSearchParams): string {
  const hub = new URL("/config/conexoes", window.location.origin);
  for (const key of [
    "workspaceId",
    "connected",
    "error",
    "meta",
    "metaError",
    "pick",
  ]) {
    const v = sp.get(key);
    if (v) hub.searchParams.set(key, v);
  }
  return hub.pathname + hub.search;
}

function OAuthCompleteInner() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? searchParams.get("metaError");
  const meta = searchParams.get("meta");
  const okExplicit = searchParams.get("ok");
  const connected = searchParams.get("connected");
  const cancelledMeta = meta === "cancelled" || meta === "error";
  const ok =
    okExplicit === "1" ||
    (Boolean(connected) && !error && !cancelledMeta) ||
    meta === "ready" ||
    meta === "select_account" ||
    meta === "no_ad_account";

  const [closed, setClosed] = useState(false);

  const payload: AtrakoOAuthMessage = useMemo(
    () => ({
      type: ATRAKO_OAUTH_MESSAGE,
      ok,
      error: error ?? (cancelledMeta && meta === "cancelled" ? "cancelled" : null),
      provider: connected ?? searchParams.get("provider"),
      workspaceId: searchParams.get("workspaceId"),
      connected,
      meta,
      metaError: searchParams.get("metaError"),
      pick: searchParams.get("pick"),
    }),
    [ok, error, connected, meta, cancelledMeta, searchParams],
  );

  useEffect(() => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      setClosed(true);
      return;
    }
    window.location.replace(hubUrlFromParams(searchParams));
  }, [payload, searchParams]);

  if (error || cancelledMeta) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 bg-[var(--canvas-parchment)] p-8 text-center">
        <p className="type-body text-[var(--danger)]">
          {error || "Conexão cancelada."}
        </p>
        <Link
          href={hubUrlFromParams(searchParams)}
          className="type-fine-print text-[var(--primary)] underline"
        >
          Voltar às conexões
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 bg-[var(--canvas-parchment)] p-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      <p className="type-body text-[var(--ink-muted-48)]">
        {closed ? "Pode fechar esta janela." : "Conexão concluída. Fechando…"}
      </p>
      <Link
        href={hubUrlFromParams(searchParams)}
        className="type-fine-print text-[var(--primary)] underline"
      >
        Continuar nas conexões
      </Link>
    </div>
  );
}

export default function ConexoesOAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-[var(--canvas-parchment)] p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <OAuthCompleteInner />
    </Suspense>
  );
}
