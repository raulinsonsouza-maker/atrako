/**
 * Reserva de temporada: noites exclusivas, lead no CRM e Pix da plataforma.
 */

import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { toPhoneE164, upsertPersonAndLead } from "@/lib/atrako/person";
import { upsertLedgerEntry } from "@/lib/atrako/finance-ledger";
import { createMercadoPagoOrder, getMercadoPagoOrder } from "@/lib/commerce/mp";
import { notify } from "@/lib/notifications";
import {
  addDays,
  eachNight,
  monthCells,
  nightsBetween,
  occupiedNights,
  parseDay,
  paymentKind,
  quoteStay,
  stayPaidLead,
  todayInTimeZone,
  type OccupyingStay,
} from "@/lib/stay/nights";

export const STAY_REF_PREFIX = "stay:";
const HOLD_MS = 20 * 60_000;

type PropertyRow = {
  id: string;
  clienteId: string;
  slug: string;
  name: string;
  nightlyCents: number;
  cleaningFeeCents: number;
  minNights: number;
  maxNights: number;
  timezone: string;
  published: boolean;
  acceptingBookings: boolean;
};

function payerEmail(email: string | null | undefined, phoneE164: string) {
  const clean = email?.trim().toLowerCase();
  if (clean && clean.includes("@")) return clean;
  return `stay.${phoneE164.replace(/\D/g, "")}@checkout.atrako.app`;
}

export function publicReservationView(row: {
  publicToken: string;
  number: number;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  amountCents: number;
  status: string;
  pixQrCode: string | null;
  pixQrCodeBase64: string | null;
  pixCopyPaste: string | null;
  holdExpiresAt: Date | null;
}) {
  return {
    token: row.publicToken,
    number: row.number,
    guestName: row.guestName,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    nights: row.nights,
    guests: row.guests,
    amountCents: row.amountCents,
    status: row.status,
    pixQrCode: row.pixQrCode,
    pixQrCodeBase64: row.pixQrCodeBase64,
    pixCopyPaste: row.pixCopyPaste,
    holdExpiresAt: row.holdExpiresAt?.toISOString() ?? null,
  };
}

async function loadOccupancy(propertyId: string, now = new Date()) {
  const [reservations, blocks] = await Promise.all([
    prisma.stayReservation.findMany({
      where: { propertyId, status: { in: ["CONFIRMED", "PENDING_PAYMENT"] } },
      select: { checkIn: true, checkOut: true, status: true, holdExpiresAt: true },
    }),
    prisma.stayBlock.findMany({
      where: { propertyId },
      select: { startDate: true, endDate: true },
    }),
  ]);
  return occupiedNights({
    reservations: reservations as OccupyingStay[],
    blocks,
    now,
  });
}

export async function quotePropertyStay(property: PropertyRow, checkIn: string, checkOut: string, now = new Date()) {
  const occupied = await loadOccupancy(property.id, now);
  return quoteStay({
    checkIn,
    checkOut,
    nightlyCents: property.nightlyCents,
    cleaningFeeCents: property.cleaningFeeCents,
    minNights: property.minNights,
    maxNights: property.maxNights,
    occupied,
    today: todayInTimeZone(property.timezone, now),
  });
}

async function insertReservation(input: {
  property: PropertyRow;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountCents: number;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string;
  phoneE164: string;
  guests: number;
  channel: "STORE" | "MANUAL";
  notes: string | null;
  clientRequestId: string | null;
  contactId: string | null;
  leadId: string | null;
}) {
  const holdExpiresAt = new Date(Date.now() + HOLD_MS);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "StayProperty" WHERE id = ${input.property.id} FOR UPDATE`;
    const [reservations, blocks] = await Promise.all([
      tx.stayReservation.findMany({
        where: { propertyId: input.property.id, status: { in: ["CONFIRMED", "PENDING_PAYMENT"] } },
        select: { checkIn: true, checkOut: true, status: true, holdExpiresAt: true },
      }),
      tx.stayBlock.findMany({
        where: { propertyId: input.property.id },
        select: { startDate: true, endDate: true },
      }),
    ]);
    const occupied = occupiedNights({ reservations: reservations as OccupyingStay[], blocks });
    const again = quoteStay({
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nightlyCents: input.property.nightlyCents,
      cleaningFeeCents: input.property.cleaningFeeCents,
      minNights: input.property.minNights,
      maxNights: input.property.maxNights,
      occupied,
      today: todayInTimeZone(input.property.timezone),
    });
    if (!again.ok) throw new Error(again.error);
    const numbered = await tx.stayProperty.update({
      where: { id: input.property.id },
      data: { nextNumber: { increment: 1 } },
      select: { nextNumber: true },
    });
    return tx.stayReservation.create({
      data: {
        clienteId: input.property.clienteId,
        propertyId: input.property.id,
        number: numbered.nextNumber,
        publicToken: randomBytes(16).toString("hex"),
        clientRequestId: input.clientRequestId,
        contactId: input.contactId,
        leadId: input.leadId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        phoneE164: input.phoneE164,
        guests: input.guests,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        nights: input.nights,
        amountCents: input.amountCents,
        nightlyCents: input.property.nightlyCents,
        cleaningFeeCents: input.property.cleaningFeeCents,
        status: "PENDING_PAYMENT",
        channel: input.channel,
        notes: input.notes,
        holdExpiresAt,
      },
    });
  });
}

export type StayPaymentInput =
  | { method: "pix"; cpf?: string }
  | {
      method: "card";
      token: string;
      paymentMethodId: string;
      installments: number;
      cpf?: string;
    };

export async function createStayReservation(input: {
  property: PropertyRow;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone: string;
  guests?: number;
  clientRequestId: string;
  payment?: StayPaymentInput;
  birthDate?: string | null;
}) {
  if (!input.property.published || !input.property.acceptingBookings) {
    return { ok: false as const, error: "Este imóvel não está aceitando reservas.", status: 409 };
  }
  const phoneE164 = toPhoneE164(input.guestPhone);
  if (!phoneE164) return { ok: false as const, error: "Celular inválido.", status: 400 };
  const name = input.guestName.trim().slice(0, 200);
  if (name.length < 2) return { ok: false as const, error: "Informe seu nome.", status: 400 };
  const guests = Math.min(16, Math.max(1, Math.floor(input.guests ?? 1)));
  const email = input.guestEmail?.trim().toLowerCase().slice(0, 255) || null;
  const requestId = input.clientRequestId.trim().slice(0, 80);
  if (!requestId) return { ok: false as const, error: "Pedido inválido.", status: 400 };
  if (input.payment?.method === "pix" && (input.payment.cpf || "").replace(/\D/g, "").length !== 11) {
    return { ok: false as const, error: "Informe um CPF válido.", status: 400 };
  }
  if (input.payment?.method === "card") {
    const installments = Math.floor(input.payment.installments);
    if (!input.payment.token || !input.payment.paymentMethodId || installments < 1 || installments > 12) {
      return { ok: false as const, error: "Dados do cartão incompletos.", status: 400 };
    }
  }

  const existing = await prisma.stayReservation.findUnique({
    where: { propertyId_clientRequestId: { propertyId: input.property.id, clientRequestId: requestId } },
  });
  if (existing) {
    if (existing.status === "PENDING_PAYMENT" && !existing.mpOrderId) {
      const charged = await chargeStay(existing.id, input.payment);
      const again = await prisma.stayReservation.findUnique({ where: { id: existing.id } });
      return {
        ok: true as const,
        reservation: publicReservationView(again ?? existing),
        replay: true,
        ...(charged.verificationUrl ? { verificationUrl: charged.verificationUrl } : {}),
        ...(charged.ok ? {} : { pixError: charged.error, paymentError: charged.error }),
      };
    }
    return { ok: true as const, reservation: publicReservationView(existing), replay: true };
  }

  const priced = await quotePropertyStay(input.property, input.checkIn, input.checkOut);
  if (!priced.ok) return { ok: false as const, error: priced.error, status: 409 };

  const { contact, lead } = await upsertPersonAndLead({
    workspaceId: input.property.clienteId,
    name,
    email,
    phone: phoneE164,
    source: "stay",
    metadata: {
      channel: "stay",
      propertySlug: input.property.slug,
      ...(input.birthDate ? { birthDate: input.birthDate } : {}),
      ...(input.payment?.cpf ? { cpf: input.payment.cpf.replace(/\D/g, "") } : {}),
    },
  });

  let created;
  try {
    created = await insertReservation({
      property: input.property,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights: priced.nights,
      amountCents: priced.amountCents,
      guestName: name,
      guestEmail: email,
      guestPhone: input.guestPhone.trim().slice(0, 40),
      phoneE164,
      guests,
      channel: "STORE",
      notes: null,
      clientRequestId: requestId,
      contactId: contact.id,
      leadId: lead.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Essas noites já estão ocupadas.";
    return { ok: false as const, error: message, status: 409 };
  }

  await notify({
    clienteId: created.clienteId,
    type: "stay.reservation",
    title: `Reserva #${created.number} aguardando pagamento`,
    body: `${created.guestName} · ${created.checkIn} a ${created.checkOut}`,
    href: "/hospedagem/reservas",
    severity: "aviso",
    dedupeKey: `stay-reservation:${created.id}`,
    email: false,
  }).catch(() => null);

  const charged = await chargeStay(created.id, input.payment);
  const fresh = await prisma.stayReservation.findUnique({ where: { id: created.id } });
  if (fresh?.status === "PENDING_PAYMENT") {
    await enrollStayUnpaid(fresh).catch(() => null);
  }
  return {
    ok: true as const,
    reservation: publicReservationView(fresh ?? created),
    ...(charged.verificationUrl ? { verificationUrl: charged.verificationUrl } : {}),
    ...(charged.ok ? {} : { pixError: charged.error, paymentError: charged.error }),
  };
}

export async function createManualStayReservation(input: {
  property: PropertyRow;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone: string;
  guests?: number;
  notes?: string | null;
}) {
  const phoneE164 = toPhoneE164(input.guestPhone);
  if (!phoneE164) return { ok: false as const, error: "Celular inválido.", status: 400 };
  const name = input.guestName.trim().slice(0, 200);
  if (name.length < 2) return { ok: false as const, error: "Informe o nome.", status: 400 };
  const priced = await quotePropertyStay(input.property, input.checkIn, input.checkOut);
  if (!priced.ok) return { ok: false as const, error: priced.error, status: 409 };
  const email = input.guestEmail?.trim().toLowerCase().slice(0, 255) || null;
  const { contact, lead } = await upsertPersonAndLead({
    workspaceId: input.property.clienteId,
    name,
    email,
    phone: phoneE164,
    source: "stay",
    metadata: { channel: "stay", propertySlug: input.property.slug, manual: true },
  });
  let created;
  try {
    created = await insertReservation({
      property: input.property,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights: priced.nights,
      amountCents: priced.amountCents,
      guestName: name,
      guestEmail: email,
      guestPhone: input.guestPhone.trim().slice(0, 40),
      phoneE164,
      guests: Math.min(16, Math.max(1, Math.floor(input.guests ?? 1))),
      channel: "MANUAL",
      notes: input.notes?.trim().slice(0, 500) || null,
      clientRequestId: null,
      contactId: contact.id,
      leadId: lead.id,
    });
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Essas noites já estão ocupadas.", status: 409 };
  }
  await markStayPaid(created.id);
  const fresh = await prisma.stayReservation.findUnique({ where: { id: created.id } });
  return { ok: true as const, reservation: fresh ?? created };
}

async function enrollStayUnpaid(row: { id: string; contactId: string | null }) {
  if (!row.contactId) return;
  const { enrollStayFlow } = await import("@/lib/stay/messages");
  await enrollStayFlow({ reservationId: row.id, trigger: "stay_unpaid", dedupeKey: `stay-unpaid:${row.id}` });
}

function paymentLooksPaid(status: string | undefined) {
  const value = (status || "").toLowerCase();
  return value === "processed" || value === "approved" || value === "accredited" || value === "paid";
}

function findVerificationUrl(value: unknown, depth = 0): string | undefined {
  if (depth > 6 || value == null) return undefined;
  if (typeof value === "string" && /^https?:\/\//i.test(value) && /3ds|challenge|redirect|ticket/i.test(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVerificationUrl(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["three_ds_url", "challenge_url", "external_resource_url", "ticket_url", "redirect_url"]) {
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

async function chargeStay(
  reservationId: string,
  payment?: StayPaymentInput,
): Promise<{ ok: true; verificationUrl?: string } | { ok: false; error: string; verificationUrl?: string }> {
  const row = await prisma.stayReservation.findUnique({
    where: { id: reservationId },
    include: { property: true },
  });
  if (!row || row.channel !== "STORE" || row.status !== "PENDING_PAYMENT" || row.mpOrderId) return { ok: true };
  if (row.amountCents <= 0) {
    await markStayPaid(row.id);
    return { ok: true };
  }
  const card = payment?.method === "card" ? payment : null;
  const cpf = (payment?.cpf || "").replace(/\D/g, "");
  if (payment?.method === "pix" && cpf.length !== 11) {
    return { ok: false, error: "Informe um CPF válido." };
  }
  if (card) {
    const installments = Math.floor(card.installments);
    if (!card.token || !card.paymentMethodId || installments < 1 || installments > 12) {
      return { ok: false, error: "Dados do cartão incompletos." };
    }
  }
  const [firstName, ...rest] = row.guestName.split(" ");
  try {
    const mp = await createMercadoPagoOrder({
      workspaceId: row.clienteId,
      externalReference: `${STAY_REF_PREFIX}${row.id}`,
      amount: row.amountCents / 100,
      description: `Reserva ${row.property.name} #${row.number}`,
      payer: {
        email: payerEmail(row.guestEmail, row.phoneE164 || row.guestPhone),
        firstName,
        lastName: rest.join(" ") || undefined,
        ...(cpf.length === 11 ? { identification: { type: "CPF", number: cpf } } : {}),
      },
      payment: card
        ? {
            type: "credit_card",
            token: card.token,
            installments: Math.floor(card.installments),
            paymentMethodId: card.paymentMethodId,
          }
        : { type: "bank_transfer", paymentMethodId: "pix" },
    });
    const pix = mp.transactions?.payments?.[0]?.payment_method;
    const payStatus = mp.transactions?.payments?.[0]?.status;
    await prisma.stayReservation.update({
      where: { id: row.id },
      data: {
        mpOrderId: mp.id,
        ...(!card
          ? {
              pixQrCode: pix?.qr_code ?? null,
              pixQrCodeBase64: pix?.qr_code_base64 ?? null,
              pixCopyPaste: pix?.qr_code ?? null,
            }
          : {}),
      },
    });
    const verificationUrl = findVerificationUrl(mp);
    if (card && (paymentLooksPaid(mp.status) || paymentLooksPaid(payStatus)) && !verificationUrl) {
      await markStayPaid(row.id);
    }
    return { ok: true, ...(verificationUrl ? { verificationUrl } : {}) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao cobrar a reserva." };
  }
}

export async function markStayPaid(reservationId: string) {
  const row = await prisma.stayReservation.findUnique({ where: { id: reservationId }, include: { property: true } });
  if (!row || row.status === "CONFIRMED") return row;
  if (row.status === "CANCELLED" || row.status === "EXPIRED") return row;

  const updated = await prisma.stayReservation.update({
    where: { id: reservationId },
    data: { status: "CONFIRMED", paidAt: new Date(), confirmedAt: new Date(), holdExpiresAt: null },
    include: { property: true },
  });

  const won = stayPaidLead(updated.amountCents);
  let leadId = updated.leadId;
  if (updated.contactId) {
    const pipeline = await prisma.crmPipeline.findFirst({
      where: { clienteId: updated.clienteId, isDefault: true },
      include: { stages: true },
    });
    const wonStage = pipeline?.stages.find((s) => s.role === "WON");
    const lead = await prisma.nativeLead.findFirst({
      where: { clienteId: updated.clienteId, contactId: updated.contactId, status: { in: ["OPEN", "WON"] } },
      orderBy: { updatedAt: "desc" },
    });
    if (lead) {
      leadId = lead.id;
      await prisma.nativeLead.update({
        where: { id: lead.id },
        data: {
          status: won.status,
          stageId: wonStage?.id ?? lead.stageId,
          dealValue: new Prisma.Decimal(won.dealValue),
        },
      });
    }
  }

  await upsertLedgerEntry({
    clienteId: updated.clienteId,
    type: "INCOME",
    amount: updated.amountCents / 100,
    occurredAt: updated.paidAt ?? new Date(),
    source: "stay",
    sourceRef: updated.id,
    idempotencyKey: `stay-reservation-${updated.id}`,
    leadId,
    contact: updated.phoneE164 || updated.guestPhone,
    provider: updated.channel === "STORE" ? "MERCADO_PAGO" : "MANUAL",
    description: `Reserva ${updated.property.name} #${updated.number}`,
    metadata: { niche: "stay", reservationId: updated.id, number: updated.number, amountCents: updated.amountCents },
  });

  const { onOrderPaid } = await import("@/lib/flows/attribution");
  await onOrderPaid({
    workspaceId: updated.clienteId,
    contactId: updated.contactId,
    leadId,
    email: updated.guestEmail,
    phone: updated.phoneE164 || updated.guestPhone,
    orderRef: `STAY:${updated.id}`,
    totalCents: updated.amountCents,
    paidAt: updated.paidAt ?? new Date(),
    provider: "STAY",
    items: [{ title: `${updated.property.name} · ${updated.nights} noites`, quantity: 1, unitPriceCents: updated.amountCents }],
  }).catch((err) => console.error("[stay-flows]", err));

  const { enrollStayFlow } = await import("@/lib/stay/messages");
  await enrollStayFlow({
    reservationId: updated.id,
    trigger: "stay_confirmed",
    dedupeKey: `stay-confirmed:${updated.id}`,
  }).catch((err) => console.error("[stay-confirmed]", err));
  return updated;
}

export async function markStayRefunded(reservationId: string) {
  const row = await prisma.stayReservation.findUnique({ where: { id: reservationId }, include: { property: true } });
  if (!row || row.status === "CANCELLED") return row;
  const wasPaid = row.status === "CONFIRMED";
  const updated = await prisma.stayReservation.update({
    where: { id: reservationId },
    data: { status: "CANCELLED" },
  });
  if (wasPaid) {
    await upsertLedgerEntry({
      clienteId: row.clienteId,
      type: "REFUND",
      amount: row.amountCents / 100,
      occurredAt: new Date(),
      source: "stay",
      sourceRef: row.id,
      idempotencyKey: `stay-refund-${row.id}`,
      contact: row.phoneE164 || row.guestPhone,
      provider: "MERCADO_PAGO",
      description: `Estorno ${row.property.name} #${row.number}`,
      metadata: { niche: "stay", reservationId: row.id, number: row.number, amountCents: row.amountCents },
    });
  }
  return updated;
}

export async function applyStayPaymentWebhook(input: {
  reservationId?: string | null;
  mpOrderId?: string | null;
  hintedStatus?: string;
}) {
  const row = input.reservationId
    ? await prisma.stayReservation.findUnique({ where: { id: input.reservationId } })
    : input.mpOrderId
      ? await prisma.stayReservation.findFirst({ where: { mpOrderId: input.mpOrderId } })
      : null;
  if (!row) return null;
  let status = input.hintedStatus ?? "";
  const lookup = row.mpOrderId || input.mpOrderId;
  if (lookup) {
    try {
      const mp = await getMercadoPagoOrder(row.clienteId, lookup);
      status = String(mp.status || status);
      if (!row.mpOrderId && mp.id) {
        await prisma.stayReservation.update({ where: { id: row.id }, data: { mpOrderId: String(mp.id) } });
      }
    } catch {
      /* mantém o status informado */
    }
  }
  const kind = paymentKind(status);
  if (kind === "paid") return markStayPaid(row.id);
  if (kind === "refunded") return markStayRefunded(row.id);
  if (kind === "rejected" && row.status === "PENDING_PAYMENT") {
    return prisma.stayReservation.update({
      where: { id: row.id },
      data: { status: "EXPIRED", holdExpiresAt: new Date() },
    });
  }
  return row;
}

export async function cancelStayReservation(clienteId: string, reservationId: string) {
  const row = await prisma.stayReservation.findFirst({ where: { id: reservationId, clienteId } });
  if (!row) return { ok: false as const, error: "Reserva não encontrada.", status: 404 };
  if (row.status === "CANCELLED" || row.status === "EXPIRED") return { ok: true as const, reservation: row };
  const updated = await prisma.stayReservation.update({
    where: { id: row.id },
    data: { status: "CANCELLED", holdExpiresAt: new Date() },
  });
  return { ok: true as const, reservation: updated };
}

export async function expireStayHolds(now = new Date()) {
  const due = await prisma.stayReservation.findMany({
    where: { status: "PENDING_PAYMENT", holdExpiresAt: { lt: now } },
    select: { id: true },
    take: 100,
  });
  if (!due.length) return 0;
  await prisma.stayReservation.updateMany({
    where: { id: { in: due.map((r) => r.id) }, status: "PENDING_PAYMENT" },
    data: { status: "EXPIRED" },
  });
  return due.length;
}

export async function staySummary(clienteId: string) {
  const property = await prisma.stayProperty.findUnique({ where: { clienteId } });
  if (!property) return null;
  const today = todayInTimeZone(property.timezone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = addDays(monthStart, 32).slice(0, 7);
  const nextMonth = `${monthEnd}-01`;
  const [upcoming, confirmed, blocks, monthPaid, arrivals, pending] = await Promise.all([
    prisma.stayReservation.findMany({
      where: { propertyId: property.id, status: "CONFIRMED", checkOut: { gt: today } },
      orderBy: { checkIn: "asc" },
      take: 8,
    }),
    prisma.stayReservation.findMany({
      where: { propertyId: property.id, status: { in: ["CONFIRMED", "PENDING_PAYMENT"] } },
      select: { checkIn: true, checkOut: true, status: true, holdExpiresAt: true },
    }),
    prisma.stayBlock.findMany({ where: { propertyId: property.id }, select: { startDate: true, endDate: true } }),
    prisma.stayReservation.findMany({
      where: { propertyId: property.id, status: "CONFIRMED", paidAt: { gte: new Date(`${monthStart}T00:00:00.000Z`) } },
      select: { amountCents: true, paidAt: true },
    }),
    prisma.stayReservation.findMany({
      where: { propertyId: property.id, status: "CONFIRMED", checkIn: today },
      orderBy: { guestName: "asc" },
    }),
    prisma.stayReservation.findMany({
      where: { propertyId: property.id, status: "PENDING_PAYMENT" },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  const occupied = occupiedNights({ reservations: confirmed as OccupyingStay[], blocks });
  let nightsThisMonth = 0;
  for (const night of occupied) {
    if (night >= monthStart && night < nextMonth) nightsThisMonth += 1;
  }
  const receivedCents = monthPaid.reduce((sum, row) => sum + row.amountCents, 0);
  return {
    property: {
      id: property.id,
      name: property.name,
      slug: property.slug,
      acceptingBookings: property.acceptingBookings,
      published: property.published,
    },
    today,
    publicPath: `/estadia/${property.slug}`,
    nightsThisMonth,
    receivedCents,
    arrivals: arrivals.map(summaryStay),
    pending: pending.map(summaryStay),
    upcoming: upcoming.map((row) => ({
      id: row.id,
      number: row.number,
      guestName: row.guestName,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      nights: row.nights,
      amountCents: row.amountCents,
      guests: row.guests,
      status: row.status,
    })),
  };
}

function summaryStay(row: {
  id: string;
  number: number;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountCents: number;
  guests: number;
  status: string;
}) {
  return {
    id: row.id,
    number: row.number,
    guestName: row.guestName,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    nights: row.nights,
    amountCents: row.amountCents,
    guests: row.guests,
    status: row.status,
  };
}

export async function stayGuests(clienteId: string) {
  const property = await prisma.stayProperty.findUnique({ where: { clienteId } });
  if (!property) return [];
  const today = todayInTimeZone(property.timezone);
  const rows = await prisma.stayReservation.findMany({
    where: { propertyId: property.id, contactId: { not: null } },
    orderBy: { checkIn: "asc" },
    select: {
      contactId: true,
      guestName: true,
      guestPhone: true,
      phoneE164: true,
      checkIn: true,
      checkOut: true,
      status: true,
      contact: { select: { name: true, phone: true, phoneE164: true } },
    },
  });
  const grouped = new Map<string, {
    id: string;
    name: string;
    phone: string;
    lastStay: { checkIn: string; checkOut: string } | null;
    nextStay: { checkIn: string; checkOut: string } | null;
  }>();
  for (const row of rows) {
    if (!row.contactId) continue;
    const guest = grouped.get(row.contactId) ?? {
      id: row.contactId,
      name: row.contact?.name || row.guestName,
      phone: row.contact?.phoneE164 || row.contact?.phone || row.phoneE164 || row.guestPhone,
      lastStay: null,
      nextStay: null,
    };
    const stay = { checkIn: row.checkIn, checkOut: row.checkOut };
    if (row.status === "CONFIRMED" && row.checkOut <= today) {
      if (!guest.lastStay || row.checkOut > guest.lastStay.checkOut) guest.lastStay = stay;
    }
    if ((row.status === "CONFIRMED" || row.status === "PENDING_PAYMENT") && row.checkIn >= today) {
      if (!guest.nextStay || row.checkIn < guest.nextStay.checkIn) guest.nextStay = stay;
    }
    grouped.set(row.contactId, guest);
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function createStayBlock(input: {
  propertyId: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
}) {
  if (!parseDay(input.startDate) || !parseDay(input.endDate) || nightsBetween(input.startDate, input.endDate) < 1) {
    return { ok: false as const, error: "Informe um intervalo de noites.", status: 400 };
  }
  const property = await prisma.stayProperty.findUnique({ where: { id: input.propertyId } });
  if (!property) return { ok: false as const, error: "Imóvel não encontrado.", status: 404 };
  const occupied = await loadOccupancy(property.id);
  for (const night of eachNight(input.startDate, input.endDate)) {
    if (occupied.has(night)) {
      return { ok: false as const, error: "Esse intervalo já tem reserva ou bloqueio.", status: 409 };
    }
  }
  const block = await prisma.stayBlock.create({
    data: {
      propertyId: property.id,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason?.trim().slice(0, 160) || null,
    },
  });
  return { ok: true as const, block };
}

export async function calendarMonth(property: { id: string; timezone: string }, month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const mon = Number(match[2]);
  if (mon < 1 || mon > 12) return null;
  const today = todayInTimeZone(property.timezone);
  const [reservations, blocks] = await Promise.all([
    prisma.stayReservation.findMany({
      where: { propertyId: property.id, status: { in: ["CONFIRMED", "PENDING_PAYMENT"] } },
      select: {
        id: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        status: true,
        holdExpiresAt: true,
        number: true,
      },
    }),
    prisma.stayBlock.findMany({
      where: { propertyId: property.id },
      select: { id: true, startDate: true, endDate: true, reason: true },
    }),
  ]);
  const days = monthCells(year, mon)
    .filter((d): d is string => Boolean(d))
    .map((date) => {
      const reservation = reservations.find(
        (row) =>
          date >= row.checkIn &&
          date < row.checkOut &&
          (row.status === "CONFIRMED" || (row.holdExpiresAt != null && row.holdExpiresAt.getTime() > Date.now())),
      );
      const block = blocks.find((row) => date >= row.startDate && date < row.endDate);
      const state = date < today ? "past" : reservation ? "occupied" : block ? "blocked" : "free";
      return {
        date,
        state,
        reservationId: reservation?.id ?? null,
        guestName: reservation?.guestName ?? null,
        number: reservation?.number ?? null,
        blockId: block?.id ?? null,
        blockReason: block?.reason ?? null,
      };
    });
  return { month, today, days };
}
