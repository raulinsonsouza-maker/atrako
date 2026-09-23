"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SYMBIUS_META_OAUTH_MESSAGE } from "@/lib/instagram/metaOAuth";

function OAuthCompleteInner() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const ok = searchParams.get("ok") === "1";
  const step = searchParams.get("step") ?? "5";
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const payload = {
      type: SYMBIUS_META_OAUTH_MESSAGE,
      ok,
      error: error ?? null,
      step,
    };

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      setClosed(true);
      return;
    }

    if (ok) {
      window.location.replace(`/app/connect?step=${step}`);
    }
  }, [ok, error, step]);

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <Link href="/app/connect" className="symbius-btn-primary">
          Voltar ao connect
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--symbius-primary)]" />
      <p className="text-sm text-[var(--symbius-muted)]">
        {closed
          ? "Pode fechar esta janela."
          : "Conexão concluída. Fechando…"}
      </p>
      <Link
        href={`/app/connect?step=${step}`}
        className="text-sm text-[var(--symbius-primary)] underline"
      >
        Continuar no Symbius Flow
      </Link>
    </div>
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--symbius-primary)]" />
        </div>
      }
    >
      <OAuthCompleteInner />
    </Suspense>
  );
}
