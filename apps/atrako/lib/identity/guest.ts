import { prisma } from "@/lib/db";
import { upsertPersonContact } from "@/lib/atrako/person";
import type { GuestSession } from "@/lib/identity/guest-session";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function saveGuestProfile(input: {
  workspaceId: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  cpf?: string | null;
  promoOptOut?: boolean;
  googleSub?: string | null;
  source?: string | null;
}): Promise<GuestSession> {
  const first = clean(input.firstName, 80);
  const last = clean(input.lastName, 80);
  const name = (clean(input.name, 160) || `${first} ${last}`.trim()).slice(0, 200);
  const email = clean(input.email, 255).toLowerCase();
  const phone = clean(input.phone, 40);
  if (name.length < 2) throw new Error("Informe seu nome.");
  if (!email.includes("@") && phone.length < 8) throw new Error("Informe e-mail ou telefone.");

  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(clean(input.birthDate, 10)) ? clean(input.birthDate, 10) : null;
  const cpf = clean(input.cpf, 20).replace(/\D/g, "");
  const promoOptOut = Boolean(input.promoOptOut);
  const contact = await upsertPersonContact({
    workspaceId: input.workspaceId,
    name,
    email: email.includes("@") ? email : null,
    phone: phone || null,
    source: input.source || "guest",
    marketingConsent: !promoOptOut,
    consentSource: "guest",
    metadata: {
      channel: input.googleSub ? "google" : "guest",
      ...(birthDate ? { birthDate } : {}),
      ...(cpf.length === 11 ? { cpf } : {}),
      ...(input.googleSub ? { googleSub: input.googleSub } : {}),
    },
  });

  const prev = (contact.metadata as Record<string, unknown> | null) ?? {};
  const metadata = {
    ...prev,
    ...(birthDate ? { birthDate } : {}),
    ...(cpf.length === 11 ? { cpf } : {}),
    ...(input.googleSub ? { googleSub: input.googleSub } : {}),
  };
  const updated = await prisma.nativeContact.update({
    where: { id: contact.id },
    data: {
      metadata,
      emailOptOutAt: promoOptOut ? contact.emailOptOutAt ?? new Date() : null,
    },
  });
  const savedBirth = typeof metadata.birthDate === "string" ? metadata.birthDate : null;
  return {
    v: 1,
    clienteId: input.workspaceId,
    contactId: updated.id,
    email: updated.email,
    name: updated.name,
    phone: updated.phone,
    birthDate: savedBirth,
    promoOptOut: Boolean(updated.emailOptOutAt),
  };
}
