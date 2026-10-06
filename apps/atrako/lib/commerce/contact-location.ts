import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { contactLocation, orderLocation, type OrderLocation } from "./order-details";

/** Grava a cidade/UF do pedido no contato. `overwrite: false` só preenche quando ainda não há. */
export async function saveContactLocation(
  contactId: string | null | undefined,
  loc: OrderLocation | null,
  opts: { overwrite: boolean },
) {
  if (!contactId || !loc) return;
  const contact = await prisma.nativeContact.findUnique({ where: { id: contactId }, select: { metadata: true } });
  if (!contact) return;
  const meta =
    contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata)
      ? (contact.metadata as Record<string, unknown>)
      : {};
  const current = contactLocation(meta);
  if (current && (!opts.overwrite || (current.city === loc.city && current.state === loc.state))) return;
  await prisma.nativeContact.update({
    where: { id: contactId },
    data: { metadata: { ...meta, location: loc } as Prisma.InputJsonValue },
  });
}

export async function saveContactLocationFromOrder(
  contactId: string | null | undefined,
  provider: string,
  rawPayload: unknown,
  opts: { overwrite: boolean },
) {
  await saveContactLocation(contactId, orderLocation(provider, rawPayload), opts).catch((err) =>
    console.error("[contact-location]", err instanceof Error ? err.message : err),
  );
}
