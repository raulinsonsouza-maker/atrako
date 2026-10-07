"use client";

import { useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { ChatPhone, type ChatItem } from "@/components/symbius/phone/ChatPhone";
import type { WaPreview } from "@/lib/flows/wa-preview";
import { interpolate } from "@/lib/flows/variables";

export const EMAIL_EXAMPLE_VALUES: Record<string, string> = {
  nome: "Maria Souza",
  primeiro_nome: "Maria",
  cupom: "VOLTA10",
  validade: "até domingo",
  itens: "Tênis Runner",
  produto: "Tênis Runner",
  total: "R$ 189,90",
  link: "",
};

export type PhoneItem =
  | { kind: "trigger"; label: string }
  | { kind: "delay"; label: string }
  | { kind: "whatsapp"; id: string; preview: WaPreview | null; image?: string }
  | { kind: "email"; id: string; subject: string; preheader?: string; loadHtml?: () => Promise<string> };

/** Um e-mail aberto no celular (prévia do editor). */
export function EmailPhone({ subject, html, error, scale }: { subject: string; html: string | null; error?: string | null; scale?: number }) {
  return (
    <ChatPhone
      theme="whatsapp"
      header={{ name: "E-mail" }}
      items={[]}
      scale={scale}
      overlay={
        <>
          <div className="phone-overlay-head">
            <span className="phone-overlay-back" aria-hidden>
              <ChevronLeft className="h-6 w-6" />
            </span>
            <span className="phone-overlay-title">{subject ? interpolate(subject, EMAIL_EXAMPLE_VALUES) : "Sem assunto"}</span>
          </div>
          {html ? (
            <iframe title="Prévia do e-mail no celular" sandbox="" srcDoc={html} className="min-h-0 w-full flex-1 border-0" />
          ) : (
            <div className="phone-overlay-empty">{error ?? <Loader2 className="h-6 w-6 animate-spin" />}</div>
          )}
        </>
      }
    />
  );
}

/** Celular do Relacionamento: a sequência de mensagens como o cliente vê (WhatsApp + e-mail). */
export function MessagePhone({
  storeName,
  avatarUrl,
  items,
  highlightId,
  onSelect,
  scale,
}: {
  storeName: string;
  avatarUrl?: string | null;
  items: PhoneItem[];
  highlightId?: string | null;
  onSelect?: (id: string) => void;
  scale?: number;
}) {
  const [openEmail, setOpenEmail] = useState<{ id: string; subject: string; html: string | null; error?: string } | null>(null);

  const open = (it: Extract<PhoneItem, { kind: "email" }>) => {
    onSelect?.(it.id);
    if (!it.loadHtml) return;
    setOpenEmail({ id: it.id, subject: interpolate(it.subject, { ...EMAIL_EXAMPLE_VALUES, loja: storeName }), html: null });
    it.loadHtml().then(
      (html) => setOpenEmail((cur) => (cur?.id === it.id ? { ...cur, html } : cur)),
      (e: Error) => setOpenEmail((cur) => (cur?.id === it.id ? { ...cur, error: e.message || "Não foi possível abrir" } : cur)),
    );
  };

  const chat: ChatItem[] = items.map((it, i): ChatItem => {
    if (it.kind === "trigger") return { kind: "system", id: `trigger-${i}`, tone: "trigger", text: it.label };
    if (it.kind === "delay") return { kind: "system", id: `delay-${i}`, text: it.label };
    if (it.kind === "email") {
      const values = { ...EMAIL_EXAMPLE_VALUES, loja: storeName };
      return {
        kind: "email",
        id: it.id,
        fromName: storeName,
        subject: interpolate(it.subject, values),
        preheader: it.preheader ? interpolate(it.preheader, values) : undefined,
        highlight: highlightId === it.id,
        onClick: () => open(it),
      };
    }
    const p = it.preview;
    return {
      kind: "received",
      id: it.id,
      text: p?.body || "Modelo do WhatsApp ainda não escolhido ou não aprovado.",
      image: p?.imageHeader ? it.image ?? true : undefined,
      headerText: p?.headerText,
      footer: p?.footer,
      buttons: p?.buttons,
      dim: !p?.body,
      highlight: highlightId === it.id,
      onClick: onSelect ? () => onSelect(it.id) : undefined,
    };
  });

  return (
    <ChatPhone
      theme="whatsapp"
      header={{ name: storeName, subtitle: "Conta comercial", avatarUrl }}
      items={chat}
      focusId={highlightId}
      scale={scale}
      overlay={
        openEmail ? (
          <>
            <div className="phone-overlay-head">
              <button type="button" className="phone-overlay-back" onClick={() => setOpenEmail(null)} aria-label="Voltar">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <span className="phone-overlay-title">{openEmail.subject || "E-mail"}</span>
            </div>
            {openEmail.html ? (
              <iframe title="E-mail" sandbox="" srcDoc={openEmail.html} className="min-h-0 w-full flex-1 border-0" />
            ) : (
              <div className="phone-overlay-empty">{openEmail.error ?? <Loader2 className="h-6 w-6 animate-spin" />}</div>
            )}
          </>
        ) : null
      }
    />
  );
}
