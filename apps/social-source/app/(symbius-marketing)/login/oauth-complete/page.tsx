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
  const returnTo = searchParams.get("returnTo") ?? "/app";
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const payload = {
      type: SYMBIUS_META_OAUTH_MESSAGE,
      ok,
      error: error ?? null,
      returnTo,
    };

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      setClosed(true);
      return;
    }

    if (ok) {
      window.location.replace(returnTo);
    }
  }, [ok, error, returnTo]);

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Link
          href="/login"
          className="rounded-xl bg-[#818cf8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6366f1]"
        >
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#818cf8]" />
      <p className="text-sm text-zinc-500">
        {closed ? "Pode fechar esta janela." : "Login concluído. Fechando…"}
      </p>
      <Link href={returnTo} className="text-sm text-[#6366f1] underline">
        Continuar no Symbius Flow
      </Link>
    </div>
  );
}

export default function LoginOAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#818cf8]" />
        </div>
      }
    >
      <OAuthCompleteInner />
    </Suspense>
  );
}
