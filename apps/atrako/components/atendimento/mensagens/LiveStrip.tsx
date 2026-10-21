"use client";

import Link from "next/link";
import { useAtendimentoBase } from "@/components/layout/LpHostContext";
import type { Jornada } from "./useJornada";

/** Quantos leads estão em cada ponto da jornada agora. */
export function LiveStrip({ data }: { data: Jornada }) {
  const base = useAtendimentoBase();
  const items = [
    { key: "qualifying", label: "Em qualificação", value: data.live.qualifying, href: `${base}/leads`, tone: undefined },
    { key: "withTeam", label: "Com a equipe", value: data.live.withTeam, href: `${base}/conversas`, tone: "ok" },
    { key: "noReply", label: "Sem resposta", value: data.live.noReply, href: `${base}/leads`, tone: data.live.noReply ? "warn" : undefined },
    { key: "nurture", label: "Em nutrição", value: data.live.nurture, href: `${base}/leads`, tone: undefined },
  ] as const;

  return (
    <nav className="script-live" aria-label="Leads agora">
      {items.map((it) => (
        <Link key={it.key} href={it.href} className="script-live-item" data-zero={it.value === 0}>
          <span className="flex items-center gap-2 type-fine-print text-[var(--ink-muted-48)]">
            <span className="script-dot" data-tone={it.tone} aria-hidden />
            {it.label}
          </span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{it.value}</span>
        </Link>
      ))}
    </nav>
  );
}
