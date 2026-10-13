/** Confirma o celular pelo WhatsApp e guarda endereços com coordenada no contato da loja. */

import { createHash, randomBytes, randomInt } from "crypto";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { toPhoneE164, upsertPersonAndLead } from "@/lib/atrako/person";
import { sendAndPersistText } from "@/lib/whatsapp/domain";

const CODE_MS = 10 * 60 * 1000;
const SESSION_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type SavedFoodAddress = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  lat: number;
  lng: number;
};

type OtpState = { hash: string; expiresAt: string; attempts: number };
type SessionState = { token: string; expiresAt: string };

function metaOf(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function hashCode(phone: string, code: string) {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function asOtp(value: unknown): OtpState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<OtpState>;
  if (typeof raw.hash !== "string" || typeof raw.expiresAt !== "string") return null;
  return { hash: raw.hash, expiresAt: raw.expiresAt, attempts: Number(raw.attempts) || 0 };
}

export function asFoodAddresses(value: unknown): SavedFoodAddress[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const address = row && typeof row === "object" ? (row as Partial<SavedFoodAddress>) : {};
      const lat = Number(address.lat);
      const lng = Number(address.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        cep: String(address.cep ?? ""),
        street: String(address.street ?? ""),
        number: String(address.number ?? ""),
        complement: String(address.complement ?? ""),
        neighborhood: String(address.neighborhood ?? ""),
        lat,
        lng,
      };
    })
    .filter((row): row is SavedFoodAddress => Boolean(row));
}

function addressKey(address: SavedFoodAddress) {
  return `${address.lat.toFixed(4)}:${address.lng.toFixed(4)}:${address.number}:${address.complement}`;
}

async function conversationOpen(workspaceId: string, phoneE164: string) {
  const digits = phoneE164.replace(/\D/g, "");
  const conversation = await prisma.waConversation.findUnique({
    where: { clienteId_phone: { clienteId: workspaceId, phone: digits } },
    select: { windowExpiresAt: true },
  });
  return Boolean(conversation?.windowExpiresAt && conversation.windowExpiresAt.getTime() > Date.now());
}

export async function sendFoodCode(input: { workspaceId: string; phone: string; name: string }) {
  const phoneE164 = toPhoneE164(input.phone);
  if (!phoneE164) return { ok: false as const, error: "Celular inválido." };
  const { contact } = await upsertPersonAndLead({
    workspaceId: input.workspaceId,
    phone: phoneE164,
    name: input.name.trim() || "Cliente",
    source: "food",
  });
  if (!(await conversationOpen(input.workspaceId, phoneE164))) {
    return { ok: true as const, sent: false as const, contactId: contact.id };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const metadata = {
    ...metaOf(contact.metadata),
    foodOtp: { hash: hashCode(phoneE164, code), expiresAt: new Date(Date.now() + CODE_MS).toISOString(), attempts: 0 },
  };
  await prisma.nativeContact.update({
    where: { id: contact.id },
    data: { metadata: metadata as Prisma.InputJsonValue },
  });
  await sendAndPersistText({
    workspaceId: input.workspaceId,
    to: phoneE164,
    body: `Seu código da loja é ${code}. Ele vale por 10 minutos. Digite no cardápio, não responda por aqui.`,
    contactId: contact.id,
    contactName: contact.name,
  });
  return { ok: true as const, sent: true as const, contactId: contact.id };
}

export async function verifyFoodCode(input: { workspaceId: string; phone: string; code: string }) {
  const phoneE164 = toPhoneE164(input.phone);
  if (!phoneE164) return { ok: false as const, error: "Celular inválido." };
  const contact = await prisma.nativeContact.findFirst({
    where: { clienteId: input.workspaceId, phoneE164 },
  });
  if (!contact) return { ok: false as const, error: "Peça o código de novo." };
  const metadata = metaOf(contact.metadata);
  const otp = asOtp(metadata.foodOtp);
  if (!otp || Date.parse(otp.expiresAt) < Date.now()) return { ok: false as const, error: "Esse código venceu. Peça outro." };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false as const, error: "Muitas tentativas. Peça outro código." };
  if (otp.hash !== hashCode(phoneE164, input.code.replace(/\D/g, ""))) {
    await prisma.nativeContact.update({
      where: { id: contact.id },
      data: { metadata: { ...metadata, foodOtp: { ...otp, attempts: otp.attempts + 1 } } as Prisma.InputJsonValue },
    });
    return { ok: false as const, error: "Código incorreto." };
  }
  const token = randomBytes(24).toString("hex");
  const session: SessionState = { token, expiresAt: new Date(Date.now() + SESSION_MS).toISOString() };
  await prisma.nativeContact.update({
    where: { id: contact.id },
    data: {
      metadata: {
        ...metadata,
        foodOtp: null,
        foodVerifiedAt: new Date().toISOString(),
        foodSession: session,
      } as Prisma.InputJsonValue,
    },
  });
  return { ok: true as const, contactId: contact.id, token };
}

export async function contactFromFoodSession(workspaceId: string, cookie: string | undefined) {
  if (!cookie) return null;
  const [contactId, token] = cookie.split(".");
  if (!contactId || !token) return null;
  const contact = await prisma.nativeContact.findFirst({ where: { id: contactId, clienteId: workspaceId } });
  if (!contact) return null;
  const metadata = metaOf(contact.metadata);
  const session = metadata.foodSession;
  if (!session || typeof session !== "object") return null;
  const raw = session as Partial<SessionState>;
  if (raw.token !== token || !raw.expiresAt || Date.parse(raw.expiresAt) < Date.now()) return null;
  if (typeof metadata.foodVerifiedAt !== "string") return null;
  return contact;
}

export async function rememberFoodAddress(contactId: string, address: SavedFoodAddress) {
  const contact = await prisma.nativeContact.findUnique({ where: { id: contactId }, select: { metadata: true } });
  if (!contact) return;
  const metadata = metaOf(contact.metadata);
  const current = asFoodAddresses(metadata.foodAddresses);
  const next = [address, ...current.filter((row) => addressKey(row) !== addressKey(address))].slice(0, 8);
  await prisma.nativeContact.update({
    where: { id: contactId },
    data: { metadata: { ...metadata, foodAddresses: next } as Prisma.InputJsonValue },
  });
}

export function foodCodeIsPending(metadata: unknown, body: string) {
  if (!/^\d{6}$/.test(body.trim())) return false;
  const otp = asOtp(metaOf(metadata).foodOtp);
  return Boolean(otp && Date.parse(otp.expiresAt) > Date.now());
}
