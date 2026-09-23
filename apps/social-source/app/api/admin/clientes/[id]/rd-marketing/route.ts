import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";

function isAdmin(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const config = await prisma.rdMarketingConfig.findUnique({ where: { clienteId: id } });
  if (!config) return NextResponse.json(null);

  const creds = config.credenciais as Record<string, unknown>;
  return NextResponse.json({
    clienteId: config.clienteId,
    ativo: config.ativo,
    ultimoSyncAt: config.ultimoSyncAt,
    credenciais: {
      clientId: creds.clientId ?? "",
      clientSecretSet: !!creds.clientSecret,
      connected: !!creds.accessToken,
      segmentationId: creds.segmentationId ?? "",
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json() as {
    clientId?: string;
    clientSecret?: string;
    ativo?: boolean;
    segmentationId?: string;
  };

  const existing = await prisma.rdMarketingConfig.findUnique({ where: { clienteId: id } });
  const existingCreds = (existing?.credenciais ?? {}) as Record<string, unknown>;

  const credenciais: Record<string, unknown> = { ...existingCreds };
  if (body.clientId !== undefined) credenciais.clientId = body.clientId.trim();
  if (body.clientSecret && !body.clientSecret.startsWith("•")) {
    credenciais.clientSecret = body.clientSecret.trim();
  }
  if (body.segmentationId !== undefined) credenciais.segmentationId = body.segmentationId.trim();

  await prisma.rdMarketingConfig.upsert({
    where: { clienteId: id },
    create: {
      clienteId: id,
      credenciais: credenciais as Prisma.InputJsonValue,
      ativo: body.ativo ?? true,
    },
    update: {
      credenciais: credenciais as Prisma.InputJsonValue,
      ativo: body.ativo ?? existing?.ativo ?? true,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.rdMarketingConfig.deleteMany({ where: { clienteId: id } });
  return NextResponse.json({ ok: true });
}
