import { prisma } from "@/lib/db";
import {
  newStId,
  normalizeEmail,
  normalizePhone,
} from "@/lib/symbius/attribution/ids";
import type { AliasType, TouchPoint } from "@/lib/symbius/attribution/types";
import { isMeaningfulTouch } from "@/lib/symbius/attribution/types";

export type IdentifyInput = {
  organizationId: string;
  anonymousId?: string | null;
  stId?: string | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  aliases?: Array<{ type: AliasType; value: string }>;
  leadSource?: TouchPoint | null;
};

async function findByAlias(
  organizationId: string,
  type: string,
  value: string,
) {
  return prisma.identityAlias.findUnique({
    where: {
      organizationId_type_value: { organizationId, type, value },
    },
    include: { identity: true },
  });
}

async function resolveCanonical(identityId: string) {
  let current = await prisma.trackingIdentity.findUnique({
    where: { id: identityId },
  });
  const seen = new Set<string>();
  while (current?.mergedIntoId && !seen.has(current.id)) {
    seen.add(current.id);
    current = await prisma.trackingIdentity.findUnique({
      where: { id: current.mergedIntoId },
    });
  }
  return current;
}

/**
 * Resolve or create TrackingIdentity; merge aliases onto one canonical identity.
 */
export async function identifyLead(input: IdentifyInput) {
  const orgId = input.organizationId;
  const candidates: string[] = [];

  if (input.stId?.trim()) {
    const bySt = await prisma.trackingIdentity.findUnique({
      where: {
        organizationId_stId: { organizationId: orgId, stId: input.stId.trim() },
      },
    });
    if (bySt) candidates.push(bySt.id);
  }

  const email = input.email ? normalizeEmail(input.email) : null;
  const phone = input.phone ? normalizePhone(input.phone) : null;

  if (email) {
    const a = await findByAlias(orgId, "email", email);
    if (a) candidates.push(a.identityId);
    const byEmail = await prisma.trackingIdentity.findFirst({
      where: { organizationId: orgId, email, mergedIntoId: null },
    });
    if (byEmail) candidates.push(byEmail.id);
  }

  if (phone) {
    const a = await findByAlias(orgId, "phone", phone);
    if (a) candidates.push(a.identityId);
    const byPhone = await prisma.trackingIdentity.findFirst({
      where: { organizationId: orgId, phone, mergedIntoId: null },
    });
    if (byPhone) candidates.push(byPhone.id);
  }

  for (const alias of input.aliases ?? []) {
    const value = alias.value.trim();
    if (!value) continue;
    const a = await findByAlias(orgId, alias.type, value);
    if (a) candidates.push(a.identityId);
  }

  const uniqueIds = Array.from(new Set(candidates));
  let canonical =
    uniqueIds.length > 0
      ? await resolveCanonical(uniqueIds[0])
      : null;

  if (uniqueIds.length > 1 && canonical) {
    for (const id of uniqueIds.slice(1)) {
      const other = await resolveCanonical(id);
      if (other && other.id !== canonical.id) {
        await mergeIdentities(orgId, canonical.id, other.id);
      }
    }
    canonical = await prisma.trackingIdentity.findUnique({
      where: { id: canonical.id },
    });
  }

  if (!canonical) {
    const stId = input.stId?.trim() || newStId();
    const leadSource =
      input.leadSource && isMeaningfulTouch(input.leadSource)
        ? input.leadSource
        : undefined;
    canonical = await prisma.trackingIdentity.create({
      data: {
        organizationId: orgId,
        stId,
        email: email ?? undefined,
        phone: phone ?? undefined,
        name: input.name ?? undefined,
        leadSource: leadSource as object | undefined,
      },
    });
  } else {
    canonical = await prisma.trackingIdentity.update({
      where: { id: canonical.id },
      data: {
        email: email ?? canonical.email,
        phone: phone ?? canonical.phone,
        name: input.name ?? canonical.name,
        leadSource:
          canonical.leadSource == null &&
          input.leadSource &&
          isMeaningfulTouch(input.leadSource)
            ? (input.leadSource as object)
            : undefined,
      },
    });
  }

  const aliasRows: Array<{ type: string; value: string }> = [
    ...(input.aliases ?? []).map((a) => ({
      type: a.type,
      value: a.value.trim(),
    })),
  ];
  if (email) aliasRows.push({ type: "email", value: email });
  if (phone) aliasRows.push({ type: "phone", value: phone });
  aliasRows.push({ type: "st_id" as AliasType, value: canonical.stId });

  for (const row of aliasRows) {
    if (!row.value) continue;
    const type = row.type === "st_id" ? "external_customer" : row.type;
    // Keep stId only on identity; skip fake st_id alias type
    if (row.type === "st_id") continue;
    try {
      await prisma.identityAlias.upsert({
        where: {
          organizationId_type_value: {
            organizationId: orgId,
            type,
            value: row.value,
          },
        },
        create: {
          organizationId: orgId,
          identityId: canonical.id,
          type,
          value: row.value,
        },
        update: { identityId: canonical.id },
      });
    } catch (e) {
      console.warn("[attribution/identify] alias upsert", e);
    }
  }

  if (input.anonymousId?.trim()) {
    await prisma.trackingVisitor.upsert({
      where: {
        organizationId_anonymousId: {
          organizationId: orgId,
          anonymousId: input.anonymousId.trim(),
        },
      },
      create: {
        organizationId: orgId,
        anonymousId: input.anonymousId.trim(),
        identityId: canonical.id,
      },
      update: { identityId: canonical.id },
    });
  }

  if (email || phone) {
    void import("@/lib/symbius/integrations").then(({ syncLeadToCentralCrm }) =>
      syncLeadToCentralCrm({
        organizationId: orgId,
        email: email ?? undefined,
        phone: phone ?? undefined,
        nome: canonical.name ?? undefined,
        stId: canonical.stId,
        dadosMarketing: {
          leadSource: canonical.leadSource,
        },
      }),
    );
    void import("@/lib/symbius/attribution/metaCapi").then(({ sendMetaCapiEvent }) =>
      sendMetaCapiEvent({
        organizationId: orgId,
        eventName: "Lead",
        eventId: `lead_${canonical.stId}`,
        email,
        phone,
      }),
    );
  }

  return canonical;
}

export async function mergeIdentities(
  organizationId: string,
  keepId: string,
  absorbId: string,
): Promise<void> {
  if (keepId === absorbId) return;
  const keep = await prisma.trackingIdentity.findFirst({
    where: { id: keepId, organizationId },
  });
  const absorb = await prisma.trackingIdentity.findFirst({
    where: { id: absorbId, organizationId },
  });
  if (!keep || !absorb) return;

  await prisma.$transaction(async (tx) => {
    await tx.identityAlias.updateMany({
      where: { identityId: absorb.id },
      data: { identityId: keep.id },
    });
    await tx.trackingVisitor.updateMany({
      where: { identityId: absorb.id },
      data: { identityId: keep.id },
    });
    await tx.trackingEvent.updateMany({
      where: { identityId: absorb.id },
      data: { identityId: keep.id },
    });
    await tx.attributionOrder.updateMany({
      where: { identityId: absorb.id },
      data: { identityId: keep.id },
    });
    await tx.igContato.updateMany({
      where: { trackingIdentityId: absorb.id },
      data: { trackingIdentityId: keep.id },
    });
    await tx.trackingIdentity.update({
      where: { id: absorb.id },
      data: {
        mergedIntoId: keep.id,
        status: "merged",
      },
    });
    await tx.trackingIdentity.update({
      where: { id: keep.id },
      data: {
        email: keep.email ?? absorb.email,
        phone: keep.phone ?? absorb.phone,
        name: keep.name ?? absorb.name,
        leadSource: (keep.leadSource ?? absorb.leadSource) as
          | object
          | undefined,
      },
    });
  });
}

export async function ensureIgContatoIdentity(params: {
  organizationId: string;
  contatoId: string;
  igsid: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}) {
  const identity = await identifyLead({
    organizationId: params.organizationId,
    email: params.email,
    phone: params.phone,
    name: params.name,
    aliases: [{ type: "igsid", value: params.igsid }],
  });

  await prisma.igContato.update({
    where: { id: params.contatoId },
    data: { trackingIdentityId: identity.id },
  });

  return identity;
}
