/**
 * Link que o agente manda no WhatsApp. A referência `lead:{id}` fecha o card
 * quando o Mercado Pago confirma. Checkout da loja e da agenda usam a página
 * que já existe.
 */

import { prisma } from "@/lib/db";
import { mpFetch } from "@/lib/integrations/mercadopago/payments";
import { getServerPublicOrigin } from "@/lib/http/public-origin";
import { attendanceCanQuote, type AttendanceProfile } from "@/lib/attendance/profile";

export type CheckoutLink = {
  kind: "checkout" | "agenda" | "fixed";
  ref: string;
  url: string;
  label: string;
  amount: number | null;
};

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export async function resolveAttendanceCheckout(input: {
  workspaceId: string;
  leadId: string;
  profile: AttendanceProfile;
}): Promise<{ ok: true; link: CheckoutLink } | { ok: false; reason: string }> {
  if (input.profile.mode !== "sell" || !attendanceCanQuote(input.profile)) {
    return { ok: false, reason: "sem_oferta" };
  }
  const origin = getServerPublicOrigin().replace(/\/$/, "");
  if (input.profile.offerKind === "checkout" && input.profile.checkoutProductId) {
    const product = await prisma.commerceProduct.findFirst({
      where: {
        id: input.profile.checkoutProductId,
        clienteId: input.workspaceId,
        active: true,
        status: "PUBLISHED",
      },
      select: { id: true, name: true, priceCents: true },
    });
    if (!product || product.priceCents <= 0) return { ok: false, reason: "checkout_indisponivel" };
    return {
      ok: true,
      link: {
        kind: "checkout",
        ref: product.id,
        url: `${origin}/checkout/${product.id}`,
        label: input.profile.offerLabel || product.name,
        amount: product.priceCents / 100,
      },
    };
  }
  if (input.profile.offerKind === "agenda" && input.profile.agendaLinkSlug) {
    const link = await prisma.agendaCheckoutLink.findFirst({
      where: { slug: input.profile.agendaLinkSlug, isActive: true, product: { clienteId: input.workspaceId, isActive: true } },
      include: { product: { select: { title: true, priceCents: true } } },
    });
    if (!link) return { ok: false, reason: "agenda_indisponivel" };
    return {
      ok: true,
      link: {
        kind: "agenda",
        ref: link.slug,
        url: `${origin}/c/${link.slug}`,
        label: input.profile.offerLabel || link.title || link.product.title,
        amount: link.product.priceCents > 0 ? link.product.priceCents / 100 : null,
      },
    };
  }
  if (input.profile.offerKind === "fixed" && input.profile.fixedAmount) {
    const lead = await prisma.nativeLead.findFirst({
      where: { id: input.leadId, clienteId: input.workspaceId },
      select: { metadata: true },
    });
    const prev = asMeta(asMeta(lead?.metadata).agentCheckout);
    if (prev.kind === "fixed" && prev.ref === input.leadId && typeof prev.url === "string" && prev.amount === input.profile.fixedAmount) {
      return {
        ok: true,
        link: {
          kind: "fixed",
          ref: input.leadId,
          url: prev.url,
          label: input.profile.offerLabel || "Pagamento",
          amount: input.profile.fixedAmount,
        },
      };
    }
    const created = await createLeadPreference({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      amount: input.profile.fixedAmount,
      title: input.profile.offerLabel || "Pagamento",
    });
    if (!created) return { ok: false, reason: "mercado_pago_indisponivel" };
    return {
      ok: true,
      link: {
        kind: "fixed",
        ref: input.leadId,
        url: created,
        label: input.profile.offerLabel || "Pagamento",
        amount: input.profile.fixedAmount,
      },
    };
  }
  return { ok: false, reason: "sem_oferta" };
}

async function createLeadPreference(input: {
  workspaceId: string;
  leadId: string;
  amount: number;
  title: string;
}) {
  const origin = getServerPublicOrigin().replace(/\/$/, "");
  const res = await mpFetch(input.workspaceId, "/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          title: input.title.slice(0, 120),
          quantity: 1,
          currency_id: "BRL",
          unit_price: input.amount,
        },
      ],
      external_reference: `lead:${input.leadId}`,
      notification_url: `${origin}/api/atrako/commerce/webhook?ref=${encodeURIComponent(`lead:${input.leadId}`)}`,
    }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json()) as { init_point?: string; sandbox_init_point?: string };
  return data.init_point || data.sandbox_init_point || null;
}

export async function rememberCheckout(input: { leadId: string; link: CheckoutLink }) {
  const lead = await prisma.nativeLead.findUnique({ where: { id: input.leadId }, select: { metadata: true } });
  const prev = asMeta(lead?.metadata);
  await prisma.nativeLead.update({
    where: { id: input.leadId },
    data: {
      metadata: {
        ...prev,
        agentCheckout: {
          kind: input.link.kind,
          ref: input.link.ref,
          url: input.link.url,
          amount: input.link.amount,
          label: input.link.label,
          at: new Date().toISOString(),
        },
      },
    },
  });
}
