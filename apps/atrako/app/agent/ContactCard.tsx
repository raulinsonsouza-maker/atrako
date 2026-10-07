"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { buttonClass } from "@/components/ui/button";
import { CrmLeadCard, type CrmBoardLead } from "@/components/crm/CrmLeadCard";
import type { ContactCardArtifact } from "@/lib/atrako-agent/artifacts";

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

function ago(iso: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return days === 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`;
}

const CART_STATUS: Record<NonNullable<ContactCardArtifact["cart"]>["status"], string> = {
  OPEN: "Em aberto",
  RECOVERED: "Recuperado",
  EXPIRED: "Expirado",
};

export function ContactCard({ artifact, onAsk }: { artifact: ContactCardArtifact; onAsk?: (text: string) => void }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const { cart, customer } = artifact;
  const open = cart?.status === "OPEN";
  const lead: CrmBoardLead = {
    id: artifact.leadId ?? artifact.id,
    contactId: artifact.contactId,
    name: artifact.name,
    email: artifact.email,
    phone: artifact.phone,
    location: artifact.location,
    source: artifact.source,
    status: "OPEN",
    dealValue: artifact.dealValue,
    stageId: null,
    createdAt: artifact.createdAt,
    updatedAt: artifact.activityAt,
    openCartCents: open ? cart.totalCents : null,
    openCartAt: open ? cart.abandonedAt : null,
    activityAt: artifact.activityAt,
  };
  const facts = [
    artifact.stage ? `Etapa: ${artifact.stage}` : null,
    customer?.lifecycle ?? null,
    customer && customer.orders > 0
      ? `${customer.orders} pedido${customer.orders === 1 ? "" : "s"} · ${brl(customer.totalSpentCents)}`
      : null,
    customer?.lastOrderAt ? `Última compra em ${day(customer.lastOrderAt)}` : null,
  ].filter(Boolean) as string[];

  const copyRecovery = async () => {
    if (!cart?.recoveryUrl) return;
    await navigator.clipboard.writeText(cart.recoveryUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="assistant-contact-card">
      <CrmLeadCard
        lead={lead}
        showOpenCart={!open}
        onOpen={artifact.leadId ? () => router.push(`/crm/leads/${artifact.leadId}`) : undefined}
      />

      {facts.length ? (
        <ul className="assistant-contact-facts">
          {facts.map((f) => (
            <li key={f} className="type-fine-print">
              {f}
            </li>
          ))}
        </ul>
      ) : null}

      {cart ? (
        <div className="assistant-contact-cart">
          <div className="flex items-center justify-between gap-3">
            <span className="type-caption-strong text-[var(--ink)]">
              Carrinho · {cart.store}
            </span>
            <span className="assistant-status-badge type-fine-print" data-status={cart.status === "RECOVERED" ? "PUBLISHED" : undefined}>
              {CART_STATUS[cart.status]}
            </span>
          </div>
          {cart.items.length ? (
            <ul className="assistant-contact-items">
              {cart.items.map((item, i) => (
                <li key={`${item.title}-${i}`} className="assistant-contact-item">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.title} loading="lazy" className="assistant-contact-thumb" />
                  ) : (
                    <span className="assistant-contact-thumb" aria-hidden />
                  )}
                  <span className="type-caption min-w-0 flex-1 truncate text-[var(--ink)]">
                    {item.quantity > 1 ? `${item.quantity}× ` : ""}
                    {item.title}
                  </span>
                  {item.unitPriceCents != null ? (
                    <span className="type-caption tabular-nums text-[var(--ink-muted-80)]">
                      {brl(item.unitPriceCents * item.quantity)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="assistant-contact-cart-foot">
            <span className="type-fine-print text-[var(--ink-muted-48)]">
              Abandonado em {day(cart.abandonedAt)}
              {cart.status === "RECOVERED" && cart.recoveredAt ? ` · recuperado em ${day(cart.recoveredAt)}` : ""}
              {" · "}
              {cart.notifiedAt ? `mensagem de recuperação enviada ${ago(cart.notifiedAt)}` : "sem mensagem de recuperação"}
            </span>
            <span className="type-caption-strong tabular-nums text-[var(--ink)]">{brl(cart.totalCents)}</span>
          </div>
        </div>
      ) : null}

      <div className="assistant-lp-preview-actions">
        {artifact.leadId ? (
          <Link href={`/crm/leads/${artifact.leadId}`} className={buttonClass({ size: "toolbar" })}>
            Abrir no CRM
          </Link>
        ) : null}
        {open && cart.recoveryUrl ? (
          <Button type="button" size="toolbar" variant="outline" onClick={() => void copyRecovery()}>
            {copied ? "Link copiado" : "Copiar link de recuperação"}
          </Button>
        ) : null}
        {artifact.contactId && onAsk ? (
          <Button
            type="button"
            size="toolbar"
            variant="outline"
            onClick={() => onAsk(`Mostre a jornada de ${artifact.name} (contactId ${artifact.contactId}).`)}
          >
            Ver jornada
          </Button>
        ) : null}
      </div>
    </div>
  );
}
