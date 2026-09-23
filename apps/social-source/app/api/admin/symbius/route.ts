import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { limitsForPlan, hashPassword, uniqueOrgSlug } from "@/lib/symbius/auth";

function checkAdmin(request: NextRequest): boolean {
  const token =
    request.headers.get("x-admin-token") ??
    request.nextUrl.searchParams.get("token");
  return Boolean(token && token === process.env.ADMIN_SECRET);
}

export async function GET(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true, igAccounts: true, fluxos: true } },
      subscription: true,
    },
  });

  return NextResponse.json({ orgs });
}

const createSchema = z.object({
  orgNome: z.string().min(2),
  ownerNome: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  plan: z.enum(["FREE", "PRO", "AGENCY"]).default("FREE"),
});

export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const limits = limitsForPlan(parsed.data.plan);
  const slug = await uniqueOrgSlug(parsed.data.orgNome);
  const passwordHash = await hashPassword(parsed.data.ownerPassword);

  const org = await prisma.organization.create({
    data: {
      nome: parsed.data.orgNome,
      slug,
      plan: parsed.data.plan,
      maxIgAccounts: limits.maxIgAccounts,
      maxFluxos: limits.maxFluxos,
      maxMembers: limits.maxMembers,
      subscription: { create: { plan: parsed.data.plan } },
      members: {
        create: {
          role: "OWNER",
          user: {
            create: {
              nome: parsed.data.ownerNome,
              email: parsed.data.ownerEmail,
              passwordHash,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ org });
}

const patchSchema = z.object({
  id: z.string(),
  plan: z.enum(["FREE", "PRO", "AGENCY"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  maxIgAccounts: z.number().optional(),
  maxFluxos: z.number().optional(),
  maxMembers: z.number().optional(),
});

export async function PATCH(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { id, plan, ...rest } = parsed.data;
  const limits = plan ? limitsForPlan(plan) : null;

  const org = await prisma.organization.update({
    where: { id },
    data: {
      ...rest,
      ...(plan
        ? {
            plan,
            maxIgAccounts: limits!.maxIgAccounts,
            maxFluxos: limits!.maxFluxos,
            maxMembers: limits!.maxMembers,
          }
        : {}),
    },
  });

  if (plan) {
    await prisma.subscription.upsert({
      where: { organizationId: id },
      create: { organizationId: id, plan },
      update: { plan },
    });
  }

  return NextResponse.json({ org });
}
