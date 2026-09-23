import { NextRequest, NextResponse } from "next/server";

import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  disconnectWorkspaceConnection,
  upsertWorkspaceConnection,
} from "@/lib/atrako/workspace-connections";
import {
  normalizeStoreUrl,
  validateWooCredentials,
} from "@/lib/integrations/woocommerce/client";

/** Conectar / desconectar WooCommerce via sessão admin (Config). */
export async function POST(request: NextRequest) {
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

  if (b.action === "disconnect") {
    await disconnectWorkspaceConnection(workspaceId, "WOOCOMMERCE");
    return NextResponse.json({ ok: true, disconnected: true });
  }

  const credentials =
    b.credentials && typeof b.credentials === "object" && !Array.isArray(b.credentials)
      ? (b.credentials as Record<string, unknown>)
      : {};

  const storeUrl =
    typeof credentials.storeUrl === "string" ? credentials.storeUrl.trim() : "";
  const consumerKey =
    typeof credentials.consumerKey === "string" ? credentials.consumerKey.trim() : "";
  const consumerSecret =
    typeof credentials.consumerSecret === "string"
      ? credentials.consumerSecret.trim()
      : "";
  const webhookSecret =
    typeof credentials.webhookSecret === "string"
      ? credentials.webhookSecret.trim()
      : "";

  if (!storeUrl || !consumerKey || !consumerSecret) {
    return NextResponse.json(
      { error: "storeUrl, consumerKey e consumerSecret são obrigatórios" },
      { status: 400 },
    );
  }

  const validated = await validateWooCredentials({
    storeUrl,
    consumerKey,
    consumerSecret,
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const normalizedUrl = normalizeStoreUrl(storeUrl);
  const row = await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: "WOOCOMMERCE",
    label:
      typeof b.label === "string" && b.label.trim()
        ? b.label.trim()
        : validated.storeName || "WooCommerce",
    credentials: {
      storeUrl: normalizedUrl,
      consumerKey,
      consumerSecret,
      ...(webhookSecret ? { webhookSecret } : {}),
    },
    metadata: {
      storeUrl: normalizedUrl,
      storeName: validated.storeName,
    },
    status: "ACTIVE",
  });

  return NextResponse.json({
    ok: true,
    id: row.id,
    webhookUrl: `/api/webhooks/woocommerce/${workspaceId}`,
  });
}
