import { NextRequest, NextResponse } from "next/server";

import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { prisma } from "@/lib/db-social";
import { getOrCreateOrgSettings } from "@/lib/symbius/integrations";

type ConnectorKey = "shopify" | "nuvemshop";

function maskSecret(secret: string | undefined): boolean {
  return Boolean(secret && secret.length > 0);
}

/**
 * Secrets de webhooks legados (Nuvemshop stub Symbius).
 * Tray/Shopify usam OAuth canônico + WorkspaceConnection.
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const org = await prisma.organization.findFirst({
    where: { centralClienteId: workspaceId },
    select: { id: true, nome: true },
  });
  if (!org) {
    return NextResponse.json({
      workspaceId,
      available: false,
      organizationId: null,
      connectors: {
        shopify: { configured: false },
        nuvemshop: { configured: false },
      },
    });
  }

  const settings = await getOrCreateOrgSettings(org.id);
  const ec = (settings.ecommerceConnectors ?? {}) as Record<
    string,
    { webhookSecret?: string }
  >;

  return NextResponse.json({
    workspaceId,
    available: true,
    organizationId: org.id,
    connectors: {
      shopify: { configured: maskSecret(ec.shopify?.webhookSecret) },
      nuvemshop: { configured: maskSecret(ec.nuvemshop?.webhookSecret) },
    },
  });
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const org = await prisma.organization.findFirst({
    where: { centralClienteId: workspaceId },
    select: { id: true },
  });
  if (!org) {
    return NextResponse.json(
      {
        error:
          "Nenhuma organização Symbius ligada a este workspace (centralClienteId). Crie/vincule a org para salvar secrets de Nuvemshop.",
      },
      { status: 400 },
    );
  }

  const connector =
    typeof b.connector === "string" ? (b.connector as ConnectorKey) : null;
  if (!connector || !["shopify", "nuvemshop"].includes(connector)) {
    return NextResponse.json(
      { error: "connector deve ser shopify ou nuvemshop" },
      { status: 400 },
    );
  }

  const action = b.action === "disconnect" ? "disconnect" : "save";
  const existing = await getOrCreateOrgSettings(org.id);
  const prev =
    (existing.ecommerceConnectors as Record<string, { webhookSecret?: string }> | null) ??
    {};

  let next = { ...prev };
  if (action === "disconnect") {
    const { [connector]: _, ...rest } = next;
    next = rest;
  } else {
    const secret =
      typeof b.webhookSecret === "string" ? b.webhookSecret.trim() : "";
    if (!secret || secret.startsWith("••")) {
      return NextResponse.json(
        { error: "webhookSecret obrigatório" },
        { status: 400 },
      );
    }
    next = {
      ...prev,
      [connector]: {
        ...(prev[connector] ?? {}),
        webhookSecret: secret,
      },
    };
  }

  await prisma.igOrgSettings.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      ecommerceConnectors: next as object,
    },
    update: {
      ecommerceConnectors: next as object,
    },
  });

  return NextResponse.json({
    ok: true,
    organizationId: org.id,
    connector,
    configured: action !== "disconnect",
  });
}
