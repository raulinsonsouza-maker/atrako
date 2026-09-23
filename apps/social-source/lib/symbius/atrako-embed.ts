import { prisma } from "@/lib/db";
import type { SymbiusSession } from "@/lib/symbius/session-token";

export function isAtrakoEmbedOpen() {
  return process.env.ATRAKO_EMBED_OPEN === "true";
}

const EMBED_EMAIL = "atrako-social@local";

/**
 * Garante user + org + membership para o Social embutido no Atrako (sem login).
 */
export async function getOrCreateEmbedSession(): Promise<SymbiusSession> {
  const user = await prisma.user.upsert({
    where: { email: EMBED_EMAIL },
    update: { nome: "Atrako" },
    create: {
      email: EMBED_EMAIL,
      nome: "Atrako",
      passwordHash: null,
    },
  });

  let membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    const slug = `atrako-social-${user.id.slice(-8)}`;
    try {
      const org = await prisma.organization.create({
        data: {
          nome: "Atrako Social",
          slug,
          plan: "PRO",
          status: "ACTIVE",
          onboardingDone: true,
          maxIgAccounts: 10,
          maxFluxos: 50,
          maxMembers: 10,
          members: {
            create: { userId: user.id, role: "OWNER" },
          },
        },
      });
      return {
        userId: user.id,
        organizationId: org.id,
        role: "OWNER",
        email: user.email,
        nome: user.nome,
      };
    } catch {
      membership = await prisma.organizationMember.findFirst({
        where: { userId: user.id },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      });
      if (!membership) throw new Error("Falha ao criar org embed do Social");
    }
  }

  if (!membership.organization.onboardingDone || membership.organization.status !== "ACTIVE") {
    await prisma.organization.update({
      where: { id: membership.organizationId },
      data: { onboardingDone: true, status: "ACTIVE" },
    });
  }

  return {
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
    email: user.email,
    nome: user.nome,
  };
}

/** Após sessão embed, tenta puxar Instagram do hub Atrako. */
export async function ensureEmbedIgFromHub(organizationId: string) {
  try {
    const { syncInstagramFromAtrakoHub } = await import("./atrako-connections");
    await syncInstagramFromAtrakoHub(organizationId);
  } catch {
    /* hub indisponível — Social segue com conta local se houver */
  }
}
