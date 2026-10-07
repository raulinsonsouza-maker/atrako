"use client";

import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, Copy, CornerUpLeft, ExternalLink, Image as ImageIcon, Mail, Phone } from "lucide-react";
import "../iphone-preview.css";

export type ChatButton = { text: string; kind?: "url" | "copy" | "reply" | "phone" | "other" };

export type ChatItem =
  /** Linha central: "DIRECT", "1 dia depois", "Carrinho abandonado"… */
  | { kind: "system"; id?: string; text: ReactNode; tone?: "label" | "event" | "trigger" }
  /** Mensagem que o cliente recebe (balão à esquerda). */
  | {
      kind: "received";
      id?: string;
      text: string;
      image?: string | true;
      headerText?: string;
      footer?: string;
      time?: string;
      /** Botões de modelo do WhatsApp, colados embaixo do balão. */
      buttons?: ChatButton[];
      dim?: boolean;
      highlight?: boolean;
      onClick?: () => void;
    }
  /** Resposta do cliente (balão à direita). */
  | { kind: "sent"; id?: string; text: string; time?: string }
  /** Botão solto do Instagram (abaixo do balão). */
  | { kind: "action"; id?: string; label: string; variant?: "action" | "link"; dim?: boolean }
  /** E-mail na caixa de entrada; toque abre o conteúdo. */
  | {
      kind: "email";
      id?: string;
      fromName: string;
      subject: string;
      preheader?: string;
      time?: string;
      /** Selo na linha da caixa de entrada (tema mail). */
      tag?: string;
      reserve?: boolean;
      highlight?: boolean;
      onClick?: () => void;
    }
  | { kind: "node"; id?: string; node: ReactNode };

export type ChatPhoneProps = {
  /** instagram (Social), whatsapp (conversa) ou mail (caixa de entrada). */
  theme?: "instagram" | "whatsapp" | "mail";
  /** Mostrado quando não há itens. */
  empty?: ReactNode;
  header: { name: string; subtitle?: string; avatarUrl?: string | null };
  items: ChatItem[];
  /** Camada sobre a conversa (ex.: e-mail aberto). */
  overlay?: ReactNode;
  /** Rola até o item com este id. */
  focusId?: string | null;
  /** Abaixo do aparelho (ex.: abas Publicar / Comentários / DM). */
  below?: ReactNode;
  scale?: number;
  className?: string;
};

function SignalIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
      <rect x="0" y="8" width="3" height="4" rx="0.5" fill="currentColor" />
      <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="currentColor" />
      <rect x="9" y="2" width="3" height="10" rx="0.5" fill="currentColor" />
      <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="18" height="11" rx="2" stroke="currentColor" strokeOpacity="0.4" />
      <rect x="2" y="2" width="14" height="8" rx="1" fill="currentColor" />
      <path d="M19.5 4v4a1.5 1.5 0 0 0 0-4z" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** *negrito* e _itálico_ do WhatsApp. */
function richText(text: string): ReactNode {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return parts.map((p, i) =>
    /^\*[^*]+\*$/.test(p) ? <strong key={i}>{p.slice(1, -1)}</strong> : /^_[^_]+_$/.test(p) ? <em key={i}>{p.slice(1, -1)}</em> : <Fragment key={i}>{p}</Fragment>,
  );
}

const BUTTON_ICON = { url: ExternalLink, copy: Copy, reply: CornerUpLeft, phone: Phone, other: ExternalLink } as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** Aparelho com conversa: tema Instagram (Social), WhatsApp ou caixa de entrada de e-mail (Relacionamento). */
export function ChatPhone({ theme = "instagram", header, items, overlay, focusId, below, scale, className, empty }: ChatPhoneProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const wa = theme === "whatsapp";
  const mail = theme === "mail";

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !focusId) return;
    const el = body.querySelector<HTMLElement>(`[data-chat-id="${CSS.escape(focusId)}"]`);
    if (!el) return;
    body.scrollTo({ top: Math.max(0, el.offsetTop - body.clientHeight / 3), behavior: "smooth" });
  }, [focusId, items.length]);

  const style = scale ? ({ "--phone-scale": scale } as CSSProperties) : undefined;

  return (
    <div className={`symbius-iphone-wrap ${className ?? ""}`}>
      <div className="symbius-iphone-scale" data-theme={theme} style={style}>
        <div className="iphone-container">
          <div className="iphone-screen">
            <div className="top-bar">
              <span className="time">9:41</span>
              <div className="island" />
              <div className="status-icons">
                <SignalIcon />
                <BatteryIcon />
              </div>
            </div>

            {mail ? (
              <div className="mail-header">
                <span className="mail-header-back">
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                  Caixas
                </span>
                <div className="mail-header-title">{header.name}</div>
                {header.subtitle ? <div className="mail-header-sub">{header.subtitle}</div> : null}
              </div>
            ) : (
              <div className="chat-header">
                {wa ? <ChevronLeft className="chat-back" aria-hidden /> : null}
                <div className="profile-pic" style={header.avatarUrl ? { backgroundImage: `url(${header.avatarUrl})` } : undefined}>
                  {!header.avatarUrl && wa ? initials(header.name) : null}
                </div>
                <div className="profile-info">
                  <span className="username">{header.name}</span>
                  {header.subtitle ? <span className="subtitle">{header.subtitle}</span> : null}
                </div>
              </div>
            )}

            <div className="chat-body" ref={bodyRef}>
              {!items.length && empty ? <div className="mail-empty">{empty}</div> : null}
              {items.map((it, idx) => {
                const key = it.id ?? `${it.kind}-${idx}`;
                const dataId = it.id ? { "data-chat-id": it.id } : {};
                if (it.kind === "node") return <Fragment key={key}>{it.node}</Fragment>;
                if (mail && it.kind === "system") {
                  return (
                    <div key={key} {...dataId} className={it.tone === "trigger" ? "mail-section mail-section-trigger" : "mail-section"}>
                      {it.text}
                    </div>
                  );
                }
                if (mail && it.kind === "email") {
                  const Tag = it.onClick ? "button" : "div";
                  return (
                    <Tag
                      key={key}
                      {...dataId}
                      type={it.onClick ? "button" : undefined}
                      className="mail-row"
                      data-highlight={it.highlight || undefined}
                      data-reserve={it.reserve || undefined}
                      onClick={it.onClick}
                    >
                      <span className="mail-unread" aria-hidden />
                      <span className="mail-row-main">
                        <span className="mail-row-top">
                          <span className="mail-row-from">{it.fromName}</span>
                          {it.time ? <span className="mail-row-time">{it.time}</span> : null}
                        </span>
                        <span className="mail-row-subject">{it.subject || "Sem assunto"}</span>
                        {it.preheader ? <span className="mail-row-pre">{it.preheader}</span> : null}
                        {it.tag ? <span className="mail-row-tag">{it.tag}</span> : null}
                      </span>
                    </Tag>
                  );
                }
                if (it.kind === "system") {
                  return (
                    <div key={key} {...dataId} className={it.tone === "label" ? "direct-label" : it.tone === "trigger" ? "system-event system-trigger" : "system-event"}>
                      {it.text}
                    </div>
                  );
                }
                if (it.kind === "sent") {
                  return (
                    <div key={key} {...dataId} className="msg bubble-sent">
                      {it.text}
                      {it.time ? <span className="msg-time">{it.time} ✓✓</span> : null}
                    </div>
                  );
                }
                if (it.kind === "action") {
                  return (
                    <div key={key} {...dataId} className={`${it.variant === "link" ? "btn-link" : "btn-action"}${it.dim ? " opacity-80" : ""}`} role="presentation">
                      {it.label}
                    </div>
                  );
                }
                if (it.kind === "email") {
                  const Tag = it.onClick ? "button" : "div";
                  return (
                    <Tag key={key} {...dataId} type={it.onClick ? "button" : undefined} className="msg email-card" data-highlight={it.highlight || undefined} onClick={it.onClick}>
                      <span className="email-card-icon">
                        <Mail className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <span className="email-card-text">
                        <span className="email-card-from">
                          {it.fromName}
                          {it.time ? <span className="msg-time">{it.time}</span> : null}
                        </span>
                        <span className="email-card-subject">{it.subject || "Sem assunto"}</span>
                        {it.preheader ? <span className="email-card-pre">{it.preheader}</span> : null}
                        {it.onClick ? <span className="email-card-open">Toque para abrir</span> : null}
                      </span>
                    </Tag>
                  );
                }
                const Tag = it.onClick ? "button" : "div";
                const parts = it.text ? (wa ? paragraphs(it.text) : it.text.split(/\n+/).map((p) => p.trim()).filter(Boolean)) : [];
                return (
                  <Tag
                    key={key}
                    {...dataId}
                    type={it.onClick ? "button" : undefined}
                    className={`msg-group${it.dim ? " opacity-80" : ""}`}
                    data-highlight={it.highlight || undefined}
                    onClick={it.onClick}
                  >
                    <div className="msg bubble-received">
                      {it.image ? (
                        <div className="msg-image">
                          {typeof it.image === "string" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.image} alt="" />
                          ) : (
                            <span className="msg-image-ph">
                              <ImageIcon className="h-5 w-5" strokeWidth={1.5} />
                              foto do produto
                            </span>
                          )}
                        </div>
                      ) : null}
                      {it.headerText ? <p className="msg-header-text">{it.headerText}</p> : null}
                      {parts.map((p, i) => (
                        <p key={i}>{wa ? richText(p) : p}</p>
                      ))}
                      {it.footer ? <p className="msg-footer">{it.footer}</p> : null}
                      {it.time ? <span className="msg-time">{it.time}</span> : null}
                    </div>
                    {it.buttons?.length ? (
                      <div className="msg-buttons">
                        {it.buttons.map((b, i) => {
                          const Icon = BUTTON_ICON[b.kind ?? "other"];
                          return (
                            <span key={i} className="msg-button">
                              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                              {b.text}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </Tag>
                );
              })}
            </div>

            {overlay ? <div className="phone-overlay">{overlay}</div> : null}

            <div className="home-indicator-bar">
              <div className="home-indicator" />
            </div>
          </div>
        </div>
      </div>
      {below}
    </div>
  );
}
