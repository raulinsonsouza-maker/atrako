"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { InfoHint, Switch } from "@/components/ui";
import { ToneIcon } from "@/components/relacionamento/ui";

export const NATIVE_RECOVERY_ITEMS: Array<{ key: string; label: string; path: string }> = [
  {
    key: "shopify",
    label: "Shopify",
    path: "Configurações → Notificações → Checkout abandonado: desmarque o envio automático.",
  },
  {
    key: "nuvemshop",
    label: "Nuvemshop",
    path: "Marketing → Carrinhos abandonados → desative o e-mail automático.",
  },
  {
    key: "tray",
    label: "Tray",
    path: "Marketing → Carrinho abandonado → desative a régua de recuperação.",
  },
  {
    key: "woocommerce",
    label: "WooCommerce",
    path: "Plugins → desative plugins de recuperação (CartFlows, Retainful, Abandoned Cart Lite…).",
  },
];

/** Recuperação de carrinho da própria loja — desligar para o cliente não receber mensagem dobrada. */
export function NativeRecoveryChecklistCard({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["workspace-config", workspaceId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const r = await fetch(`/api/atrako/config?workspaceId=${workspaceId}`);
      return (await r.json()) as { settings?: { messagingPrefs?: { nativeChecklist?: Record<string, boolean> } } };
    },
    enabled: Boolean(workspaceId),
  });

  const { data: detection } = useQuery({
    queryKey: ["native-recovery", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/relacionamento/native-recovery?workspaceId=${workspaceId}`);
      if (!r.ok) return { detections: [], stores: [] };
      return (await r.json()) as {
        detections: Array<{ provider: string; checked: boolean; suspects: string[]; error?: string }>;
        stores: string[];
      };
    },
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60_000,
  });
  const detected = new Map((detection?.detections ?? []).map((d) => [d.provider, d]));
  const stores = new Set(detection?.stores ?? []);

  const checklist = data?.settings?.messagingPrefs?.nativeChecklist ?? {};
  const relevant = NATIVE_RECOVERY_ITEMS.filter((i) => stores.size === 0 || stores.has(i.key));
  const done = relevant.every((i) => checklist[i.key]);
  const [open, setOpen] = useState(false);
  const expanded = open || !done;

  async function toggle(itemKey: string, value: boolean) {
    await fetch("/api/atrako/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        messagingPrefs: { nativeChecklist: { ...checklist, [itemKey]: value } },
      }),
    });
    await qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["rel-overview", workspaceId] });
  }

  return (
    <div className="rel-inset">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <ToneIcon tone={done ? "ok" : "warn"} />
          <span className="type-caption-strong text-[var(--ink)]">{done ? "Recuperação da loja desligada" : "Desligue a recuperação da loja"}</span>
          <InfoHint>A plataforma da loja também manda recuperação de carrinho. Desligue lá para o cliente não receber mensagem dobrada.</InfoHint>
        </div>
        {done ? (
          <button
            type="button"
            className="inline-flex items-center gap-0.5 type-fine-print text-[var(--ink-muted-48)] active:scale-95"
            aria-expanded={expanded}
            onClick={() => setOpen((v) => !v)}
          >
            {expanded ? "Ocultar" : "Ver"}
            <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
      {expanded ? (
        <ul className="rel-list mt-2">
          {relevant.map((item) => {
            const d = detected.get(item.key);
            const note = !d
              ? null
              : !d.checked
                ? "Não deu para verificar os plugins"
                : d.suspects.length
                  ? `Plugins ativos: ${d.suspects.join(", ")}`
                  : "Nenhum plugin de recuperação ativo";
            return (
              <li key={item.key} className="rel-list-row">
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-0.5">
                    <span className="type-caption text-[var(--ink)]">{item.label}</span>
                    <InfoHint label="Como desligar">{item.path}</InfoHint>
                  </span>
                  {note ? (
                    <span className={`block type-fine-print ${d?.suspects.length ? "text-[var(--ink)]" : "text-[var(--ink-muted-48)]"}`}>{note}</span>
                  ) : null}
                </div>
                <span className="type-fine-print text-[var(--ink-muted-48)]">Já desliguei</span>
                <Switch checked={Boolean(checklist[item.key])} onChange={(v) => void toggle(item.key, v)} aria-label={`${item.label}: recuperação desligada`} />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
