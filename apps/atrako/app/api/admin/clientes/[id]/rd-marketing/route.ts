import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;
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
  const access = await requireInternalAdmin();
  if (access.response) return access.response;
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
  await writeAuditLog({
    action: "RD_MARKETING_CONFIG_UPDATED",
    actorInternalUserId: access.user.id,
    metadata: {
      clientId: id,
      operationType: "upsert",
      changedFields: [
        ...(body.clientId !== undefined ? ["clientId"] : []),
        ...(body.clientSecret !== undefined ? ["clientSecret"] : []),
        ...(body.ativo !== undefined ? ["ativo"] : []),
        ...(body.segmentationId !== undefined ? ["segmentationId"] : []),
      ],
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;
  const { id } = await params;
  const deleted = await prisma.rdMarketingConfig.deleteMany({ where: { clienteId: id } });
  if (deleted.count > 0) {
    await writeAuditLog({
      action: "RD_MARKETING_CONFIG_DELETED",
      actorInternalUserId: access.user.id,
      metadata: { clientId: id, operationType: "delete" },
    });
  }
  return NextResponse.json({ ok: true });
}
