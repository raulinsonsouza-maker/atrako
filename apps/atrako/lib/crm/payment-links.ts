/**
 * Link de pagamento do lead: valor negociado + parcelas máximas, pago no domínio do cliente
 * pelo Mercado Pago do workspace (Checkout Transparente via /v1/orders).
 * Pagamento aprovado → lead Ganho + entrada no caixa (mesma chave `crm-won:{leadId}`).
 */

import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { createMercadoPagoOrder, getMercadoPagoOrder, listMpInstallments } from "@/lib/commerce/mp";
import { resolveMercadoPago } from "@/lib/config/resolveConnection";
import { upsertLedgerEntry } from "@/lib/atrako/finance-ledger";
import { getServerPublicOrigin } from "@/lib/http/public-origin";
import { lpHostForWorkspace } from "@/lib/lp-domains";
import { loadEmailTheme } from "@/lib/flows/theme";
import { paymentKind } from "@/lib/stay/nights";
import {
  PAYLINK_REF_PREFIX,
  capInstallmentOptions,
  isValidInstallmentChoice,
  paymentLinkExpiry,
  paymentLinkUrl,
  paymentLinkViewStatus,
  type PaymentLinkInput,
} from "@/lib/crm/payment-link-rules";

type LinkRow = NonNullable<Awaited<ReturnType<typeof prisma.leadPaymentLink.findUnique>>>;

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const digits = (v: string) => v.replace(/\D/g, "");
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;

export async function isMercadoPagoReady(workspaceId: string) {
  const mp = await resolveMercadoPago(workspaceId);
  return Boolean(mp?.accessToken && mp.publicKey);
}

export async function urlForPaymentLink(link: { token: string; clienteId: string }) {
  const cliente = await prisma.cliente.findUnique({ where: { id: link.clienteId }, select: { slug: true } });
  return paymentLinkUrl({
    token: link.token,
    lpHost: lpHostForWorkspace(cliente?.slug),
    origin: getServerPublicOrigin(),
    production: process.env.NODE_ENV === "production",
  });
}

export function teamPaymentLinkView(link: LinkRow, url: string) {
  return {
    id: link.id,
    url,
    status: paymentLinkViewStatus(link),
    amountCents: link.amountCents,
    maxInstallments: link.maxInstallments,
    description: link.description,
    method: link.method,
    installments: link.installments,
    sentVia: link.sentVia,
    createdByName: link.createdByName,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    paidAt: link.paidAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
  };
}

export type TeamPaymentLink = ReturnType<typeof teamPaymentLinkView>;

export async function createPaymentLink(input: PaymentLinkInput & {
  workspaceId: string;
  leadId: string;
  createdById?: string | null;
  createdByName?: string | null;
}) {
  const lead = await prisma.nativeLead.findFirst({
    where: { id: input.leadId, clienteId: input.workspaceId },
    select: { id: true },
  });
  if (!lead) return { ok: false as const, error: "Lead não encontrado.", status: 404 };
  if (!(await isMercadoPagoReady(input.workspaceId))) {
    return {
      ok: false as const,
      error: "Conecte o Mercado Pago em Configurações → Conexões para cobrar pelo link.",
      status: 409,
    };
  }
  const link = await prisma.leadPaymentLink.create({
    data: {
      clienteId: input.workspaceId,
      leadId: lead.id,
      token: randomBytes(18).toString("base64url"),
      amountCents: input.amountCents,
      maxInstallments: input.maxInstallments,
      description: input.description,
      createdById: input.createdById ?? null,
      createdByName: input.createdByName?.slice(0, 160) ?? null,
      expiresAt: paymentLinkExpiry(),
    },
  });
  return { ok: true as const, link };
}

export async function listLeadPaymentLinks(workspaceId: string, leadId: string) {
  const rows = await prisma.leadPaymentLink.findMany({
    where: { clienteId: workspaceId, leadId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (!rows.length) return [];
  const url = await urlForPaymentLink(rows[0]);
  const base = url.slice(0, url.lastIndexOf("/") + 1);
  return rows.map((row) => teamPaymentLinkView(row, `${base}${encodeURIComponent(row.token)}`));
}

export async function cancelPaymentLink(workspaceId: string, id: string) {
  const res = await prisma.leadPaymentLink.updateMany({
    where: { id, clienteId: workspaceId, status: "PENDING" },
    data: { status: "CANCELED" },
  });
  return res.count > 0;
}

/** Reenvio renova o prazo de um link ainda não pago. */
export async function renewPaymentLink(workspaceId: string, id: string) {
  const res = await prisma.leadPaymentLink.updateMany({
    where: { id, clienteId: workspaceId, status: { in: ["PENDING", "EXPIRED"] } },
    data: { status: "PENDING", expiresAt: paymentLinkExpiry() },
  });
  return res.count > 0;
}

// --------------------------------------------------------------------------- público

async function findByToken(token: string) {
  if (!token || token.length > 64) return null;
  return prisma.leadPaymentLink.findUnique({ where: { token } });
}

export async function getPublicPaymentLink(token: string) {
  const link = await findByToken(token);
  if (!link) return null;
  const [mp, lead, { theme, brand }] = await Promise.all([
    resolveMercadoPago(link.clienteId),
    prisma.nativeLead.findUnique({
      where: { id: link.leadId },
      select: { contact: { select: { name: true, email: true } } },
    }),
    loadEmailTheme(link.clienteId),
  ]);
  return {
    token: link.token,
    status: paymentLinkViewStatus(link),
    ref: link.id.slice(-6).toUpperCase(),
    amountCents: link.amountCents,
    maxInstallments: link.maxInstallments,
    description: link.description,
    method: link.method,
    installments: link.installments,
    pixQrCode: link.status === "PENDING" && link.method === "pix" ? link.pixQrCode : null,
    pixQrCodeBase64: link.status === "PENDING" && link.method === "pix" ? link.pixQrCodeBase64 : null,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    paidAt: link.paidAt?.toISOString() ?? null,
    payer: {
      name: link.payerName || lead?.contact?.name || "",
      email: link.payerEmail || lead?.contact?.email || "",
    },
    brand: {
      storeName: brand.storeName,
      logoUrl: theme.logoUrl,
      headerBg: theme.headerBg,
      accent: theme.colors.accent,
      buttonText: theme.colors.buttonText,
      footer: theme.footer.address,
      legal: theme.footer.legal,
    },
    mp: { connected: Boolean(mp?.accessToken), publicKey: mp?.publicKey ?? null },
  };
}

export type PublicPaymentLink = NonNullable<Awaited<ReturnType<typeof getPublicPaymentLink>>>;

export async function publicPaymentLinkInstallments(token: string, bin: string) {
  const link = await findByToken(token);
  if (!link || paymentLinkViewStatus(link) !== "PENDING") throw new Error("Link indisponível.");
  if (!/^\d{6,8}$/.test(bin)) throw new Error("Cartão inválido.");
  const res = await listMpInstallments(link.clienteId, bin, link.amountCents / 100);
  const options = capInstallmentOptions(res.options, link.maxInstallments);
  if (!options.length) throw new Error("Este cartão não tem parcelas disponíveis.");
  return { paymentMethodId: res.paymentMethodId, options };
}

export type PaymentLinkCharge =
  | { method: "pix"; name: string; email: string; cpf: string }
  | {
      method: "card";
      name: string;
      email: string;
      cpf: string;
      token: string;
      paymentMethodId: string;
      installments: number;
    };

function findVerificationUrl(value: unknown, depth = 0): string | undefined {
  if (depth > 6 || value == null) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVerificationUrl(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["three_ds_url", "challenge_url", "redirect_url"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.startsWith("http")) return candidate;
    }
    for (const nested of Object.values(record)) {
      const found = findVerificationUrl(nested, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

function statementDescriptor(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, 13);
  return clean || "PAGAMENTO";
}

export async function chargePaymentLink(
  token: string,
  payment: PaymentLinkCharge,
): Promise<
  | { ok: true; status: "PAID" | "PENDING"; verificationUrl?: string }
  | { ok: false; error: string; status?: number }
> {
  const link = await findByToken(token);
  if (!link) return { ok: false, error: "Link não encontrado.", status: 404 };
  const view = paymentLinkViewStatus(link);
  if (view === "PAID") return { ok: true, status: "PAID" };
  if (view !== "PENDING") return { ok: false, error: "Este link não está mais disponível.", status: 410 };

  const name = payment.name.trim().replace(/\s+/g, " ").slice(0, 200);
  const email = payment.email.trim().toLowerCase();
  const cpf = digits(payment.cpf);
  if (name.split(" ").length < 2) return { ok: false, error: "Informe nome e sobrenome." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Informe um e-mail válido." };
  if (cpf.length !== 11) return { ok: false, error: "Informe um CPF válido." };

  if (payment.method === "pix" && link.method === "pix" && link.mpOrderId && link.pixQrCode) {
    return { ok: true, status: "PENDING" };
  }
  if (payment.method === "card") {
    if (!payment.token || !payment.paymentMethodId) return { ok: false, error: "Dados do cartão incompletos." };
    if (!isValidInstallmentChoice(payment.installments, link.maxInstallments)) {
      return { ok: false, error: `Escolha até ${link.maxInstallments}x.` };
    }
  }

  const { brand } = await loadEmailTheme(link.clienteId);
  const [firstName, ...rest] = name.split(" ");
  try {
    const mp = await createMercadoPagoOrder({
      workspaceId: link.clienteId,
      externalReference: `${PAYLINK_REF_PREFIX}${link.id}`,
      amount: link.amountCents / 100,
      description: link.description.slice(0, 120),
      statementDescriptor: statementDescriptor(brand.storeName),
      payer: {
        email,
        firstName,
        lastName: rest.join(" ") || undefined,
        identification: { type: "CPF", number: cpf },
      },
      payment:
        payment.method === "card"
          ? {
              type: "credit_card",
              token: payment.token,
              installments: Math.floor(payment.installments),
              paymentMethodId: payment.paymentMethodId,
            }
          : { type: "bank_transfer", paymentMethodId: "pix" },
    });
    const tx = mp.transactions?.payments?.[0];
    const pix = tx?.payment_method;
    await prisma.leadPaymentLink.update({
      where: { id: link.id },
      data: {
        mpOrderId: String(mp.id),
        method: payment.method,
        installments: payment.method === "card" ? Math.floor(payment.installments) : 1,
        payerName: name,
        payerEmail: email,
        pixQrCode: payment.method === "pix" ? pix?.qr_code ?? null : null,
        pixQrCodeBase64: payment.method === "pix" ? pix?.qr_code_base64 ?? null : null,
      },
    });
    if (payment.method === "pix") return { ok: true, status: "PENDING" };

    const verificationUrl = findVerificationUrl(mp);
    const kind = paymentKind(String(tx?.status || mp.status || ""));
    const failed = /fail|reject/i.test(String(mp.status || "")) || kind === "rejected";
    if (failed) {
      return { ok: false, error: "O pagamento foi recusado. Confira os dados ou use outro cartão." };
    }
    if (kind === "paid" && !verificationUrl) {
      await markPaymentLinkPaid(link.id);
      return { ok: true, status: "PAID" };
    }
    return { ok: true, status: "PENDING", ...(verificationUrl ? { verificationUrl } : {}) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Não foi possível processar o pagamento." };
  }
}

// --------------------------------------------------------------------------- confirmação

export async function markPaymentLinkPaid(linkId: string) {
  const paidAt = new Date();
  const claimed = await prisma.leadPaymentLink.updateMany({
    where: { id: linkId, status: { in: ["PENDING", "EXPIRED", "CANCELED"] } },
    data: { status: "PAID", paidAt },
  });
  if (!claimed.count) return null;
  const link = await prisma.leadPaymentLink.findUnique({ where: { id: linkId } });
  if (!link) return null;
  const amount = link.amountCents / 100;

  const { closeLeadOnPayment } = await import("@/lib/attendance/payment");
  const lead = await closeLeadOnPayment({ workspaceId: link.clienteId, leadId: link.leadId, amount }).catch((err) => {
    console.warn("[paylink] ganho", err instanceof Error ? err.message : err);
    return null;
  });
  const how = link.method === "card" ? `cartão ${link.installments ?? 1}x` : "Pix";
  await upsertLedgerEntry({
    clienteId: link.clienteId,
    type: "INCOME",
    amount,
    occurredAt: paidAt,
    source: "crm",
    sourceRef: link.leadId,
    idempotencyKey: `crm-won:${link.leadId}`,
    leadId: link.leadId,
    contact: link.payerName || (lead && "contact" in lead ? lead.contact?.name : null) || null,
    provider: "MERCADO_PAGO",
    description: `Pagamento · ${link.description}`,
    metadata: { paymentLinkId: link.id, method: link.method, installments: link.installments, mpOrderId: link.mpOrderId },
  });
  const { addLeadNote } = await import("@/lib/modules/crm");
  await addLeadNote({
    workspaceId: link.clienteId,
    leadId: link.leadId,
    text: `Pagamento confirmado pelo link: ${brl(link.amountCents)} no ${how}.`,
  }).catch(() => null);
  return link;
}

async function markPaymentLinkRefunded(link: LinkRow) {
  if (link.status !== "PAID") return link;
  await prisma.leadPaymentLink.update({ where: { id: link.id }, data: { status: "REFUNDED" } });
  await upsertLedgerEntry({
    clienteId: link.clienteId,
    type: "REFUND",
    amount: link.amountCents / 100,
    occurredAt: new Date(),
    source: "crm",
    sourceRef: link.leadId,
    idempotencyKey: `paylink-refund:${link.id}`,
    leadId: link.leadId,
    contact: link.payerName,
    provider: "MERCADO_PAGO",
    description: `Estorno · ${link.description}`,
    metadata: { paymentLinkId: link.id, mpOrderId: link.mpOrderId },
  });
  return link;
}

/** Status sempre confirmado no Mercado Pago; o corpo do webhook só aponta qual link olhar. */
export async function applyPaymentLinkWebhook(input: { linkId?: string | null; mpOrderId?: string | null }) {
  const link = input.linkId
    ? await prisma.leadPaymentLink.findUnique({ where: { id: input.linkId } })
    : input.mpOrderId
      ? await prisma.leadPaymentLink.findFirst({ where: { mpOrderId: input.mpOrderId } })
      : null;
  if (!link) return null;
  const lookup = link.mpOrderId || input.mpOrderId;
  if (!lookup) return link;
  let order: { id?: string; status?: string; external_reference?: string };
  try {
    order = (await getMercadoPagoOrder(link.clienteId, lookup)) as typeof order;
  } catch {
    return link;
  }
  if (order.external_reference && order.external_reference !== `${PAYLINK_REF_PREFIX}${link.id}`) return link;
  const kind = paymentKind(String(order.status || ""));
  if (kind === "paid") return markPaymentLinkPaid(link.id);
  if (kind === "refunded") return markPaymentLinkRefunded(link);
  return link;
}

const lastPoll = new Map<string, number>();

/** Polling da página (Pix): consulta o MP no máximo a cada 8s por link. */
export async function refreshPaymentLinkStatus(token: string) {
  const link = await findByToken(token);
  if (!link) return null;
  if (link.status === "PENDING" && link.mpOrderId) {
    const last = lastPoll.get(link.id) ?? 0;
    if (Date.now() - last > 8_000) {
      lastPoll.set(link.id, Date.now());
      await applyPaymentLinkWebhook({ linkId: link.id });
    }
  }
  const fresh = await prisma.leadPaymentLink.findUnique({ where: { id: link.id } });
  return fresh ? paymentLinkViewStatus(fresh) : null;
}
