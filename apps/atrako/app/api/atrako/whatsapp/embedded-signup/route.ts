import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  loadMetaPlatformAppCredentials,
  getMetaAppId,
  getMetaAppSecret,
  META_GRAPH_VERSION,
  metaGraphUrl,
} from "@/lib/integrations/meta/graph";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import { upsertWorkspaceConnection } from "@/lib/atrako/workspace-connections";

/**
 * Bootstrap Embedded Signup WhatsApp — App ID + Config ID (sem secrets).
 * GET /api/atrako/whatsapp/embedded-signup?workspaceId=
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

  await loadMetaPlatformAppCredentials();
  const app = await resolvePlatformApp("META");
  const appId = getMetaAppId() || app?.credentials.clientId?.trim() || null;
  const configId =
    (typeof app?.credentials.whatsappLoginConfigId === "string"
      ? app.credentials.whatsappLoginConfigId.trim()
      : "") ||
    process.env.META_WHATSAPP_LOGIN_CONFIG_ID?.trim() ||
    null;

  if (!appId) {
    return NextResponse.json(
      { error: "Meta App ID não configurado", hint: "Configure Meta em /admin/apps" },
      { status: 503 },
    );
  }
  if (!configId) {
    return NextResponse.json(
      {
        error: "WhatsApp Embedded Signup não configurado",
        hint: "Em /admin/apps → Meta, preencha Login Config ID (WhatsApp) — variação Embedded Signup",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    appId,
    configId,
    graphVersion: process.env.META_GRAPH_API_VERSION?.trim() || META_GRAPH_VERSION,
  });
}

/**
 * Troca o code do Embedded Signup pelo token e grava WorkspaceConnection WHATSAPP.
 * POST { workspaceId, code, wabaId, phoneNumberId, displayPhoneNumber? }
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId.trim() : "";
  const code = typeof b.code === "string" ? b.code.trim() : "";
  const wabaId = typeof b.wabaId === "string" ? b.wabaId.trim() : "";
  const phoneNumberId = typeof b.phoneNumberId === "string" ? b.phoneNumberId.trim() : "";
  const displayPhoneNumber =
    typeof b.displayPhoneNumber === "string" ? b.displayPhoneNumber.trim() : "";

  if (!workspaceId || !code || !wabaId || !phoneNumberId) {
    return NextResponse.json(
      { error: "workspaceId, code, wabaId e phoneNumberId são obrigatórios" },
      { status: 400 },
    );
  }

  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await loadMetaPlatformAppCredentials();
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecret();
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "Meta App ID/Secret não configurados" }, { status: 503 });
  }

  const tokenUrl = new URL(metaGraphUrl("/oauth/access_token"));
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString(), { cache: "no-store" });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    return NextResponse.json(
      { error: tokenJson.error?.message || "Falha ao trocar code por token WhatsApp" },
      { status: 502 },
    );
  }

  const accessToken = tokenJson.access_token;

  try {
    await fetch(metaGraphUrl(`/${wabaId}/subscribed_apps`), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    /* ignore */
  }

  const row = await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: "WHATSAPP",
    label: displayPhoneNumber
      ? `WhatsApp ${displayPhoneNumber}`
      : "WhatsApp Cloud API",
    credentials: {
      accessToken,
      phoneNumberId,
      wabaId,
      tokenType: tokenJson.token_type || "bearer",
      expiresAt:
        tokenJson.expires_in != null
          ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
          : null,
    },
    metadata: {
      phoneNumberId,
      wabaId,
      displayPhoneNumber: displayPhoneNumber || null,
      source: "embedded_signup",
    },
    status: "ACTIVE",
  });

  return NextResponse.json({
    ok: true,
    id: row.id,
    phoneNumberId,
    wabaId,
  });
}
