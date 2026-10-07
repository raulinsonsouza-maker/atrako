/**
 * Registros individuais do CRM para o assistente: carrinhos, leads e o cartão do cliente.
 * O modelo recebe contato mascarado; o cartão (só na tela do dono do workspace) mostra o contato real.
 */

import { prisma } from "@/lib/db";
import { storeProviderLabel } from "@/lib/atrako/person";
import { contactLocation, formatLocation } from "@/lib/commerce/order-details";
import { artifactId, type ContactCardArtifact, type ContactCartItem } from "./artifacts";
import { maskEmail, maskPhone } from "./safety";

export const LIFECYCLE_LABELS: Record<string, string> = {
  LEAD: "Lead (ainda não comprou)",
  NOVO: "Cliente novo",
  RECORRENTE: "Cliente recorrente",
  VIP: "Cliente VIP",
  EM_RISCO: "Cliente em risco",
  INATIVO: "Cliente inativo",
  PERDIDO: "Cliente perdido",
};

export const MAX_CARDS = 3;

const DAY = 86_400_000;

function httpsUrl(v: unknown): string | null {
  return typeof v === "string" && /^https:\/\//i.test(v) ? v.slice(0, 600) : null;
}

export function cartItems(raw: unknown): ContactCartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is Record<string, unknown> => Boolean(i) && typeof i === "object")
    .map((i) => ({
      title: String(i.title ?? i.name ?? "Produto").slice(0, 140),
      quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
      unitPriceCents: Number.isFinite(Number(i.unitPriceCents)) ? Math.round(Number(i.unitPriceCents)) : null,
      imageUrl: httpsUrl(i.imageUrl),
    }))
    .slice(0, 12);
}

/** "05/10 18:45" no horário de Brasília. */
export function brtDateTime(d: Date): string {
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function purchaseHistory(clienteId: string, contactIds: Array<string | null>) {
  const ids = [...new Set(contactIds.filter((v): v is string => Boolean(v)))];
  if (!ids.length) return new Map<string, string>();
  const profiles = await prisma.customerProfile.findMany({
    where: { clienteId, contactId: { in: ids } },
    select: { contactId: true, lifecycle: true, ordersCount: true, totalSpentCents: true, lastOrderAt: true },
  });
  return new Map(
    profiles.map((p) => [
      p.contactId,
      [
        LIFECYCLE_LABELS[p.lifecycle] ?? p.lifecycle,
        p.ordersCount ? `${p.ordersCount} pedido(s), R$ ${(p.totalSpentCents / 100).toFixed(2)}` : null,
        p.lastOrderAt ? `última compra ${p.lastOrderAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : null,
      ]
        .filter(Boolean)
        .join("; "),
    ]),
  );
}

/** "hoje", "ontem", "há 3 dias" (dias corridos). */
export function ageLabel(date: Date, now = new Date()): string {
  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY));
  return days === 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`;
}

type CartRow = {
  id: string;
  provider: string;
  contactId: string | null;
  leadId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  totalCents: number;
  items: unknown;
  recoveryUrl: string | null;
  abandonedAt: Date;
  notifiedAt: Date | null;
  recoveredAt: Date | null;
  recoveredCents: number | null;
};

const CART_SELECT = {
  id: true,
  provider: true,
  contactId: true,
  leadId: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  totalCents: true,
  items: true,
  recoveryUrl: true,
  abandonedAt: true,
  notifiedAt: true,
  recoveredAt: true,
  recoveredCents: true,
} as const;

function cartStatus(s: string): "OPEN" | "RECOVERED" | "EXPIRED" {
  return s === "RECOVERED" ? "RECOVERED" : s === "EXPIRED" ? "EXPIRED" : "OPEN";
}

/** Monta o cartão de um contato (ou de um carrinho sem contato) com lead, perfil de compra e carrinho. */
export async function contactCard(
  clienteId: string,
  ref: { contactId?: string | null; leadId?: string | null; cart?: CartRow | null },
): Promise<ContactCardArtifact | null> {
  const contactId = ref.contactId ?? ref.cart?.contactId ?? null;
  const [contact, lead, cart] = await Promise.all([
    contactId
      ? prisma.nativeContact.findFirst({
          where: { id: contactId, clienteId },
          select: { id: true, name: true, email: true, phone: true, metadata: true, createdAt: true, profile: true },
        })
      : null,
    ref.leadId || ref.cart?.leadId || contactId
      ? prisma.nativeLead.findFirst({
          where: {
            clienteId,
            ...(ref.leadId || ref.cart?.leadId ? { id: (ref.leadId ?? ref.cart?.leadId)! } : { contactId: contactId! }),
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true, source: true, dealValue: true, createdAt: true, updatedAt: true, stage: { select: { name: true } } },
        })
      : null,
    ref.cart !== undefined
      ? ref.cart
      : contactId
        ? prisma.abandonedCart.findFirst({
            where: { clienteId, contactId, status: { in: ["OPEN", "RECOVERED"] } },
            orderBy: { abandonedAt: "desc" },
            select: CART_SELECT,
          })
        : null,
  ]);
  if (!contact && !cart) return null;

  const profile = contact?.profile ?? null;
  const activity = [lead?.updatedAt, cart?.abandonedAt, profile?.lastOrderAt].filter((d): d is Date => d instanceof Date);
  return {
    kind: "contact_card",
    id: artifactId("contact"),
    contactId: contact?.id ?? null,
    leadId: lead?.id ?? null,
    name: contact?.name || cart?.name || "Sem nome",
    email: contact?.email ?? cart?.email ?? null,
    phone: contact?.phone ?? cart?.phone ?? null,
    location: formatLocation(contactLocation(contact?.metadata)),
    stage: lead?.stage?.name ?? null,
    source: lead?.source ?? null,
    dealValue: lead?.dealValue != null ? Number(lead.dealValue) : null,
    createdAt: (lead?.createdAt ?? contact?.createdAt ?? cart?.abandonedAt ?? new Date()).toISOString(),
    activityAt: new Date(Math.max(...activity.map((d) => d.getTime()), 0) || Date.now()).toISOString(),
    customer:
      profile && (profile.ordersCount > 0 || profile.lifecycle !== "LEAD")
        ? {
            lifecycle: LIFECYCLE_LABELS[profile.lifecycle] ?? profile.lifecycle,
            orders: profile.ordersCount,
            totalSpentCents: profile.totalSpentCents,
            lastOrderAt: profile.lastOrderAt?.toISOString() ?? null,
          }
        : null,
    cart: cart
      ? {
          status: cartStatus(cart.status),
          store: storeProviderLabel(cart.provider),
          totalCents: cart.totalCents,
          abandonedAt: cart.abandonedAt.toISOString(),
          notifiedAt: cart.notifiedAt?.toISOString() ?? null,
          recoveredAt: cart.recoveredAt?.toISOString() ?? null,
          items: cartItems(cart.items),
          recoveryUrl: httpsUrl(cart.recoveryUrl),
        }
      : null,
  };
}

export type CartListStatus = "abertos" | "recuperados" | "todos";

/** Carrinhos individuais, mais recentes primeiro (o que o modelo vê: contato mascarado). */
export async function listCarts(
  clienteId: string,
  opts: { status: CartListStatus; limit: number; order: "recentes" | "maior_valor" },
) {
  const status =
    opts.status === "abertos" ? ["OPEN"] : opts.status === "recuperados" ? ["RECOVERED"] : ["OPEN", "RECOVERED", "EXPIRED"];
  const rows: CartRow[] = await prisma.abandonedCart.findMany({
    where: { clienteId, status: { in: status } },
    orderBy: opts.order === "maior_valor" ? [{ totalCents: "desc" }, { abandonedAt: "desc" }] : { abandonedAt: "desc" },
    take: Math.min(10, Math.max(1, opts.limit)),
    select: CART_SELECT,
  });
  const now = new Date();
  const history = await purchaseHistory(clienteId, rows.map((c) => c.contactId));
  return {
    rows,
    data: rows.map((c) => {
      const items = cartItems(c.items);
      return {
        cliente: c.name || "Sem nome",
        email: maskEmail(c.email),
        telefone: maskPhone(c.phone),
        loja: storeProviderLabel(c.provider),
        status: c.status === "OPEN" ? "aberto" : c.status === "RECOVERED" ? "recuperado" : "expirado",
        valor: c.totalCents / 100,
        abandonadoEm: brtDateTime(c.abandonedAt),
        idade: ageLabel(c.abandonedAt, now),
        itens: items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ""}${i.title}`),
        mensagemDeRecuperacao: c.notifiedAt ? `enviada ${ageLabel(c.notifiedAt, now)}` : "não enviada",
        historicoDeCompra: (c.contactId && history.get(c.contactId)) || "nunca comprou",
        recuperadoEm: c.recoveredAt ? brtDateTime(c.recoveredAt) : null,
        valorRecuperado: c.recoveredCents != null ? c.recoveredCents / 100 : null,
        contactId: c.contactId,
      };
    }),
  };
}

export type LeadListOrder = "recentes" | "maior_valor" | "parados";

/** Leads individuais do CRM com etapa, origem, valor e última atividade. */
export async function listLeads(
  clienteId: string,
  opts: { stage: string | null; source: string | null; from: Date | null; to: Date | null; order: LeadListOrder; limit: number },
) {
  const rows = await prisma.nativeLead.findMany({
    where: {
      clienteId,
      ...(opts.stage ? { stage: { name: { contains: opts.stage, mode: "insensitive" as const } } } : {}),
      ...(opts.source ? { source: { contains: opts.source, mode: "insensitive" as const } } : {}),
      ...(opts.from || opts.to ? { createdAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
      ...(opts.order === "parados" ? { status: "OPEN" } : {}),
    },
    orderBy:
      opts.order === "maior_valor"
        ? [{ dealValue: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }]
        : opts.order === "parados"
          ? { updatedAt: "asc" }
          : { createdAt: "desc" },
    take: Math.min(10, Math.max(1, opts.limit)),
    select: {
      id: true,
      contactId: true,
      status: true,
      source: true,
      dealValue: true,
      createdAt: true,
      updatedAt: true,
      stage: { select: { name: true } },
      contact: { select: { name: true, email: true, phone: true } },
    },
  });
  const now = new Date();
  const contactIds = rows.map((l) => l.contactId).filter((v): v is string => Boolean(v));
  const [history, carts] = await Promise.all([
    purchaseHistory(clienteId, contactIds),
    contactIds.length
      ? prisma.abandonedCart.findMany({
          where: { clienteId, contactId: { in: contactIds }, status: "OPEN" },
          orderBy: { abandonedAt: "desc" },
          select: { contactId: true, totalCents: true, abandonedAt: true, notifiedAt: true },
        })
      : [],
  ]);
  const openCart = new Map<string, (typeof carts)[number]>();
  for (const c of carts) if (c.contactId && !openCart.has(c.contactId)) openCart.set(c.contactId, c);
  return {
    rows,
    data: rows.map((l) => ({
      nome: l.contact?.name ?? "Sem nome",
      email: maskEmail(l.contact?.email),
      telefone: maskPhone(l.contact?.phone),
      etapa: l.stage?.name ?? "sem etapa",
      status: l.status,
      origem: l.source,
      valor: l.dealValue != null ? Number(l.dealValue) : null,
      entrouEm: l.createdAt.toISOString().slice(0, 10),
      atualizadoNoCrm: ageLabel(l.updatedAt, now),
      carrinhoAberto: (() => {
        const c = l.contactId ? openCart.get(l.contactId) : undefined;
        return c
          ? { valor: c.totalCents / 100, abandonado: ageLabel(c.abandonedAt, now), mensagemDeRecuperacao: c.notifiedAt ? "enviada" : "não enviada" }
          : null;
      })(),
      historicoDeCompra: (l.contactId && history.get(l.contactId)) || "nunca comprou",
      contactId: l.contactId,
    })),
  };
}
