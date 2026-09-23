"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CommentDmWizard } from "@/components/symbius/CommentDmWizard";
import { FlowEditor } from "@/components/symbius/FlowEditor";

type FluxoData = {
  id: string;
  nome: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
};

export function FlowEditClient({ fluxoId }: { fluxoId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceBuilder = searchParams.get("builder") === "1";
  const [fluxo, setFluxo] = useState<FluxoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/symbius/flows/${fluxoId}`)
      .then((r) => r.json())
      .then((d) => setFluxo(d.fluxo ?? null))
      .finally(() => setLoading(false));
  }, [fluxoId]);

  if (loading) {
    return (
      <div className="p-10 text-[var(--symbius-muted)]">Carregando…</div>
    );
  }
  if (!fluxo) {
    return (
      <div className="p-10">
        <p>Fluxo não encontrado</p>
        <Link href="/app/flows" className="text-[var(--symbius-primary)]">
          Voltar
        </Link>
      </div>
    );
  }

  const cfg = fluxo.triggerConfig ?? {};
  const isCommentWizard =
    !forceBuilder &&
    fluxo.triggerType === "comment_keyword" &&
    Boolean(cfg.welcomeText || cfg.rewardText || cfg.welcomeButton);

  if (isCommentWizard) {
    return (
      <div className="relative">
        <div className="absolute right-4 top-4 z-20 hidden md:block">
          <Link
            href={`/app/flows/${fluxoId}?builder=1`}
            className="rounded-lg bg-black/40 px-2 py-1 text-xs text-white/70 underline hover:text-white"
          >
            Builder avançado
          </Link>
        </div>
        <CommentDmWizard
          defaultName={fluxo.nome}
          initial={{
            fluxoId: fluxo.id,
            nome: fluxo.nome,
            mediaFilter:
              cfg.mediaFilter === "specific"
                ? "specific"
                : cfg.mediaFilter === "next"
                  ? "next"
                  : "any",
            mediaId: (cfg.mediaId as string) ?? null,
            anyKeyword: Boolean(cfg.anyKeyword),
            keywords: (cfg.keywords as string[]) ?? [],
            replyToComment: Boolean(cfg.replyToComment),
            welcomeEnabled: cfg.welcomeEnabled !== false,
            welcomeText: String(cfg.welcomeText ?? ""),
            welcomeButton: String(cfg.welcomeButton ?? "Me envie o link"),
            followEnabled: Boolean(cfg.followEnabled),
            followText: String(cfg.followText ?? ""),
            followButton: String(cfg.followButton ?? "Já sigo"),
            emailEnabled: Boolean(cfg.emailEnabled),
            emailText: String(cfg.emailText ?? ""),
            rewardText: String(cfg.rewardText ?? ""),
            rewardButton: String(cfg.rewardButton ?? "Acessar"),
            rewardUrl: String(cfg.rewardUrl ?? ""),
            reminderEnabled: Boolean(cfg.reminderEnabled),
            reminderText: String(cfg.reminderText ?? ""),
            reminderMinutes: Number(cfg.reminderMinutes ?? 30),
          }}
          onCancel={() => router.push("/app/flows")}
          onSaved={() => router.push("/app/flows")}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      {fluxo.triggerType === "comment_keyword" && (
        <div className="absolute right-4 top-16 z-20">
          <Link
            href={`/app/flows/${fluxoId}`}
            className="text-xs text-[var(--symbius-muted)] underline hover:text-white"
          >
            Voltar ao wizard
          </Link>
        </div>
      )}
      <FlowEditor fluxoId={fluxoId} />
    </div>
  );
}
