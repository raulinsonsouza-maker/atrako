"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { viaToMode, type CriarVia } from "@/lib/criar/modules";

/**
 * Compat: /criar/escolher?via= → /criar (ou assistente) / plataforma padrão.
 * Filtro antigo (instagram, vendas…) mapeia para /criar/p/[platform].
 */
const FILTER_TO_PLATFORM: Record<string, string> = {
  instagram: "instagram",
  anuncios: "anuncios",
  vendas: "loja",
  captura: "captura",
  agenda: "agenda",
};

function EscolherRedirect() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const viaRaw = sp.get("via");
    const via: CriarVia = viaRaw === "assistente" ? "assistente" : "manual";
    const mode = viaToMode(via);
    const filter = sp.get("filter") || "";
    const platform = FILTER_TO_PLATFORM[filter];

    if (platform) {
      const q = mode === "ai" ? "?mode=ai" : "";
      router.replace(`/criar/p/${platform}${q}`);
      return;
    }

    if (via === "assistente") {
      router.replace("/criar?assistente=1");
      return;
    }

    router.replace("/criar");
  }, [router, sp]);

  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
    </div>
  );
}

export default function CriarEscolherPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <EscolherRedirect />
    </Suspense>
  );
}
