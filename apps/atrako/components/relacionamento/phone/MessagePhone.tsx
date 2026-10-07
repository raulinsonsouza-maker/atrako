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

export type PhoneChannel = "WHATSAPP" | "EMAIL";

export type PhoneItem =
  | { kind: "trigger"; label: string }
  | { kind: "delay"; label: string }
  | { kind: "whatsapp"; id: string; preview: WaPreview | null; image?: string }
  | {
      kind: "email";
      id: string;
      subject: string;
      preheader?: string;
      /** Tempo desde o gatilho, mostrado à direita na caixa de entrada. */
      time?: string;
      /** E-mail reserva de um passo de WhatsApp. */
      reserve?: boolean;
      tag?: string;
      loadHtml?: () => Promise<string>;
    };

/** Um e-mail aberto no celular (prévia do editor). */
export function EmailPhone({ subject, html, error, scale }: { subject: string; html: string | null; error?: string | null; scale?: number }) {
  return (
    <ChatPhone
      theme="mail"
      header={{ name: "Caixa de entrada" }}
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

/**
 * Celular do Relacionamento, um canal por vez:
 * WHATSAPP = conversa com os balões; EMAIL = caixa de entrada (toque abre o e-mail).
 */
export function MessagePhone({
  storeName,
  avatarUrl,
  items,
  channel = "WHATSAPP",
  highlightId,
  onSelect,
  scale,
}: {
  storeName: string;
  avatarUrl?: string | null;
  items: PhoneItem[];
  channel?: PhoneChannel;
  highlightId?: string | null;
  onSelect?: (id: string) => void;
  scale?: number;
}) {
  const [openEmail, setOpenEmail] = useState<{ id: string; subject: string; html: string | null; error?: string } | null>(null);
  const mail = channel === "EMAIL";
  const values = { ...EMAIL_EXAMPLE_VALUES, loja: storeName };

  const open = (it: Extract<PhoneItem, { kind: "email" }>) => {
    onSelect?.(it.id);
    if (!it.loadHtml) return;
    setOpenEmail({ id: it.id, subject: interpolate(it.subject, values), html: null });
    it.loadHtml().then(
      (html) => setOpenEmail((cur) => (cur?.id === it.id ? { ...cur, html } : cur)),
      (e: Error) => setOpenEmail((cur) => (cur?.id === it.id ? { ...cur, error: e.message || "Não foi possível abrir" } : cur)),
    );
  };

  const chat: ChatItem[] = [];
  items.forEach((it, i) => {
    if (it.kind === "trigger") {
      chat.push({ kind: "system", id: `trigger-${i}`, tone: "trigger", text: it.label });
    } else if (it.kind === "delay") {
      if (!mail) chat.push({ kind: "system", id: `delay-${i}`, text: it.label });
    } else if (it.kind === "email") {
      if (!mail) return;
      chat.push({
        kind: "email",
        id: it.id,
        fromName: storeName,
        subject: interpolate(it.subject, values),
        preheader: it.preheader ? interpolate(it.preheader, values) : undefined,
        time: it.time,
        tag: it.tag,
        reserve: it.reserve,
        highlight: highlightId === it.id,
        onClick: () => open(it),
      });
    } else {
      if (mail) return;
      const p = it.preview;
      chat.push({
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
      });
    }
  });
  const hasMessages = chat.some((c) => c.kind !== "system");

  return (
    <ChatPhone
      theme={mail ? "mail" : "whatsapp"}
      header={mail ? { name: "Caixa de entrada", subtitle: storeName } : { name: storeName, subtitle: "Conta comercial", avatarUrl }}
      items={hasMessages ? chat : []}
      empty={mail ? "Nenhum e-mail neste fluxo." : "Nenhuma mensagem de WhatsApp neste fluxo."}
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
