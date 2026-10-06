"use client";

import type { CSSProperties } from "react";
import { MessageCircle } from "lucide-react";
import { channelColor } from "@/lib/commerce-attribution/channel-color";

export type CrmBoardLead = {
  id: string;
  contactId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  location?: string | null;
  source: string | null;
  /** Canal de aquisição (meta_ads, instagram, direct…); null quando não se sabe. */
  channel?: string | null;
  channelLabel?: string | null;
  status: string;
  dealValue: number | null;
  stageId: string | null;
  createdAt: string;
  updatedAt: string;
  openCartCents?: number | null;
  openCartAt?: string | null;
  /** Última atividade (entrada, carrinho ou pedido); ordena a coluna. */
  activityAt?: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  woocommerce: "WooCommerce",
  shopify: "Shopify",
  tray: "Tray",
  nuvemshop: "Nuvemshop",
  mercado_livre: "Mercado Livre",
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  tiktok_shop: "TikTok Shop",
  commerce: "Checkout próprio",
  whatsapp: "WhatsApp",
  meta: "Meta Ads",
  meta_lead: "Formulário Meta",
  form: "Formulário",
  lp: "Landing page",
  manual: "Manual",
  import: "Importação",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

const brtDay = (d: Date) => Date.parse(d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));

/** Dias corridos (Brasília) desde a data, rótulo curto e temperatura do lead. */
function leadAge(date: string) {
  const days = Math.max(0, Math.round((brtDay(new Date()) - brtDay(new Date(date))) / 86400000));
  const label = days === 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`;
  const heat = days <= 3 ? "hot" : days <= 14 ? "warm" : "cold";
  const on = new Date(date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return { label, heat, on };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function sourceLabel(source: string | null) {
  if (!source) return null;
  return SOURCE_LABEL[source.toLowerCase()] ?? source.charAt(0).toUpperCase() + source.slice(1);
}

export function CrmLeadCard({
  lead,
  drag,
  onOpen,
  showOpenCart = true,
}: {
  lead: CrmBoardLead;
  drag?: boolean;
  onOpen?: (leadId: string) => void;
  /** Colunas de abandono já dizem isso. */
  showOpenCart?: boolean;
}) {
  const contact = lead.phone
    ? formatPhone(lead.phone)
    : lead.email;
  const storeLabel = sourceLabel(lead.source);
  const source = lead.channelLabel ?? storeLabel;
  const sourceTitle = lead.channelLabel && storeLabel ? `Veio por ${lead.channelLabel} · ${storeLabel}` : undefined;
  const sourceColor = lead.channelLabel ? channelColor(lead.channel) : null;
  const hasValue = lead.dealValue != null && lead.dealValue > 0;
  const cartAge = lead.openCartAt ? leadAge(lead.openCartAt) : null;
  const activityAge = leadAge(lead.activityAt ?? lead.updatedAt ?? lead.createdAt);

  return (
    <div
      role="button"
      tabIndex={0}
      className="pipeline-lead-card"
      data-drag={drag ? "true" : "false"}
      onClick={() => onOpen?.(lead.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(lead.id);
        }
      }}
    >
      <div className="pipeline-lead-card-top">
        <span className="pipeline-lead-avatar" aria-hidden>
          {initials(lead.name)}
        </span>
        <div className="pipeline-lead-card-main">
          <div className="pipeline-lead-card-title-row">
            <span className="pipeline-lead-name type-caption-strong" title={lead.name}>{lead.name}</span>
            {hasValue ? (
              <span className="pipeline-lead-value type-caption-strong tabular-nums">
                {formatCurrency(lead.dealValue!)}
              </span>
            ) : null}
          </div>
          {contact ? (
            <p className="pipeline-lead-contact type-fine-print">{contact}</p>
          ) : null}
          {lead.location ? (
            <p className="pipeline-lead-contact type-fine-print" title={lead.location}>{lead.location}</p>
          ) : null}
        </div>
      </div>

      <div className="pipeline-lead-card-meta">
        <div className="pipeline-lead-meta-left">
          {source ? (
            <span
              className="pipeline-lead-source"
              title={sourceTitle}
              data-channel={sourceColor ? lead.channel ?? undefined : undefined}
              style={sourceColor ? ({ "--channel": sourceColor } as CSSProperties) : undefined}
            >
              {source}
            </span>
          ) : null}
          {showOpenCart && lead.openCartCents ? (
            <span className="rel-badge type-micro-legal" data-tone="bad">
              Carrinho aberto · {formatCurrency(lead.openCartCents / 100)}
            </span>
          ) : null}
          {!showOpenCart && cartAge ? (
            <span className="pipeline-lead-time type-micro-legal" data-heat={cartAge.heat} title={`Abandonou o carrinho em ${cartAge.on}`}>
              Abandonado {cartAge.label}
            </span>
          ) : (
            <span className="pipeline-lead-time type-micro-legal" data-heat={activityAge.heat} title={`Última atividade em ${activityAge.on}`}>
              {activityAge.label}
            </span>
          )}
        </div>
        {lead.phone ? (
          <a
            href="/whatsapp"
            onClick={(e) => e.stopPropagation()}
            className="pipeline-lead-wa"
            title="WhatsApp"
            aria-label="Abrir WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
          </a>
        ) : null}
      </div>
    </div>
  );
}
