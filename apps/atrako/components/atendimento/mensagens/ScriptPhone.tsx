"use client";

import { ChatPhone, type ChatItem } from "@/components/symbius/phone/ChatPhone";
import type { ScriptBlockId, ScriptPreviewItem } from "@/lib/qualification/script";

/** Celular com o roteiro: o bloco aberto fica em destaque; tocar num balão abre o bloco dele. */
export function ScriptPhone({
  brand,
  items,
  active,
  onSelect,
}: {
  brand: string;
  items: ScriptPreviewItem[];
  active: ScriptBlockId | null;
  onSelect: (block: ScriptBlockId) => void;
}) {
  const chat = items.map((it): ChatItem => {
    if (it.kind === "system") return { kind: "system", id: it.id, text: it.text, tone: "event" };
    if (it.kind === "sent") return { kind: "sent", id: it.id, text: it.text };
    return {
      kind: "received",
      id: it.id,
      text: it.text,
      buttons: [
        ...it.buttons.map((text) => ({ text, kind: "reply" as const })),
        ...(it.list ? [{ text: it.list, kind: "other" as const }] : []),
      ],
      footer: it.template ? "Modelo aprovado pela Meta" : undefined,
      highlight: active === it.block,
      dim: Boolean(active) && active !== it.block,
      onClick: () => onSelect(it.block),
    };
  });
  const focusId = active ? items.find((i) => i.block === active && i.kind === "received")?.id ?? null : null;

  return (
    <div className="script-phone">
      <ChatPhone
        theme="whatsapp"
        header={{ name: brand || "Sua empresa", subtitle: "Conta comercial" }}
        items={chat}
        focusId={focusId}
      />
    </div>
  );
}
