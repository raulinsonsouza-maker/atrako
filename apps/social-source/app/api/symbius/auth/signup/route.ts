import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  limitsForPlan,
  setSessionCookie,
  uniqueOrgSlug,
} from "@/lib/symbius/auth";

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  orgNome: z.string().min(2),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { nome, email, password, orgNome } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const slug = await uniqueOrgSlug(orgNome);
  const limits = limitsForPlan("FREE");

  const user = await prisma.user.create({
    data: {
      nome,
      email,
      passwordHash,
      memberships: {
        create: {
          role: "OWNER",
          organization: {
            create: {
              nome: orgNome,
              slug,
              plan: "FREE",
              maxIgAccounts: limits.maxIgAccounts,
              maxFluxos: limits.maxFluxos,
              maxMembers: limits.maxMembers,
              subscription: { create: { plan: "FREE" } },
            },
          },
        },
      },
    },
    include: {
      memberships: { include: { organization: true } },
    },
  });

  const membership = user.memberships[0];
  const token = await createSessionToken({
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
    email: user.email,
    nome: user.nome,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
