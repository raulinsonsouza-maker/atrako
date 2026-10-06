"use client";

import { MessageCircle } from "lucide-react";

export type CrmBoardLead = {
  id: string;
  contactId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  location?: string | null;
  source: string | null;
  status: string;
  dealValue: number | null;
  stageId: string | null;
  createdAt: string;
  updatedAt: string;
  openCartCents?: number | null;
  openCartAt?: string | null;
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

function formatTimeAgo(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 60) return `${Math.max(0, mins)}min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
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
  const source = sourceLabel(lead.source);
  const hasValue = lead.dealValue != null && lead.dealValue > 0;

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
          {source ? <span className="pipeline-lead-source">{source}</span> : null}
          {showOpenCart && lead.openCartCents ? (
            <span className="rel-badge type-micro-legal" data-tone="bad">
              Carrinho aberto · {formatCurrency(lead.openCartCents / 100)}
            </span>
          ) : null}
          {!showOpenCart && lead.openCartAt ? (
            <span className="pipeline-lead-time type-micro-legal" title="Abandonou o carrinho">
              {formatTimeAgo(lead.openCartAt)}
            </span>
          ) : (
            <span className="pipeline-lead-time type-micro-legal">
              {formatTimeAgo(lead.updatedAt || lead.createdAt)}
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
