import { prisma } from "@/lib/db";
import { genderFromName } from "@/lib/geo/gender";
import { normalizePlace, type NormalizedPlace } from "@/lib/geo/place";
import { orderLocation } from "./order-details";

export function placeFromPayload(provider: string, rawPayload: unknown): NormalizedPlace {
  const loc = orderLocation(provider, rawPayload);
  return normalizePlace(loc?.city, loc?.state);
}

/** Grava F/M no contato só quando ainda está vazio. Nome ambíguo não altera. */
export async function rememberContactGender(
  contactId: string | null | undefined,
  name: string | null | undefined,
) {
  const gender = genderFromName(name);
  if (!contactId || !gender) return;
  await prisma.nativeContact.updateMany({
    where: { id: contactId, gender: null },
    data: { gender },
  });
}
