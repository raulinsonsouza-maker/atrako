"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

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

export function NativeRecoveryChecklistCard({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["workspace-config", workspaceId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const r = await fetch(`/api/atrako/config?workspaceId=${workspaceId}`);
      return (await r.json()) as {
        settings?: { messagingPrefs?: { nativeChecklist?: Record<string, boolean> } };
        connections?: Array<{ provider: string; status: string }>;
      };
    },
    enabled: Boolean(workspaceId),
  });

  const { data: detection } = useQuery({
    queryKey: ["native-recovery", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/relacionamento/native-recovery?workspaceId=${workspaceId}`);
      if (!r.ok) return { detections: [] };
      return (await r.json()) as {
        detections: Array<{ provider: string; checked: boolean; suspects: string[]; error?: string }>;
      };
    },
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60_000,
  });
  const detected = new Map((detection?.detections ?? []).map((d) => [d.provider, d]));

  const checklist = data?.settings?.messagingPrefs?.nativeChecklist ?? {};
  const connected = new Set(
    (data?.connections ?? []).filter((c) => c.status === "ACTIVE").map((c) => c.provider),
  );
  const relevant = NATIVE_RECOVERY_ITEMS.filter(
    (i) => connected.size === 0 || connected.has(i.key.toUpperCase()) || i.key === "woocommerce",
  );

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
  }

  return (
    <div className="rounded-xl border border-[var(--hairline)] bg-white p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
        <div>
          <p className="type-nav-link text-[var(--ink)]">Recuperação nativa da loja</p>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            Desligue a recuperação de carrinho da plataforma para o cliente não receber mensagem
            dobrada.
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {relevant.map((item) => (
          <li key={item.key} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 accent-[var(--primary)]"
              checked={Boolean(checklist[item.key])}
              onChange={(e) => void toggle(item.key, e.target.checked)}
              aria-label={`${item.label} desligado`}
            />
            <div>
              <p className="type-caption-strong text-[var(--ink)]">{item.label}</p>
              <p className="type-fine-print text-[var(--ink-muted-48)]">{item.path}</p>
              {(() => {
                const d = detected.get(item.key);
                if (!d) return null;
                if (!d.checked) {
                  return (
                    <p className="type-fine-print text-[var(--ink-muted-48)]">
                      Não deu para verificar os plugins automaticamente.
                    </p>
                  );
                }
                if (!d.suspects.length) {
                  return (
                    <p className="type-fine-print text-[var(--ink-muted-48)]">
                      Verificado: nenhum plugin de recuperação ativo encontrado.
                    </p>
                  );
                }
                return (
                  <p className="type-fine-print text-[var(--ink)]">
                    Plugins ativos que podem enviar recuperação: {d.suspects.join(", ")}
                  </p>
                );
              })()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
