import { NextRequest, NextResponse } from "next/server";
import {
  disconnectWorkspaceConnection,
  getWorkspaceConnection,
  upsertWorkspaceConnection,
} from "@/lib/atrako/workspace-connections";
import { assertCanManageConfig, requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import {
  AI_CONNECTION_PROVIDER,
  DEFAULT_AI_MODEL,
  findAiProvider,
  type AiConnectionMetadata,
} from "@/lib/atrako-agent/providers";
import {
  maskApiKey,
  platformChainAvailable,
  testLlmConfig,
  workspaceCooldownPrefix,
} from "@/lib/atrako-agent/llm";
import { clearCooldowns } from "@/lib/atrako-agent/failover";

export const dynamic = "force-dynamic";

async function statusResponse(workspaceId: string) {
  const row = await getWorkspaceConnection(workspaceId, AI_CONNECTION_PROVIDER).catch(() => null);
  const meta = (row?.metadata ?? {}) as AiConnectionMetadata;
  const hasKey = typeof row?.credentials.apiKey === "string" && row.credentials.apiKey.trim().length > 0;
  const [canManage, platformAi] = await Promise.all([
    assertCanManageConfig(workspaceId).then(
      () => true,
      () => false,
    ),
    platformChainAvailable().catch(() => false),
  ]);
  return NextResponse.json({
    connected: Boolean(row && row.status === "ACTIVE" && hasKey),
    provider: findAiProvider(meta.provider)?.id ?? "openai",
    model: meta.model ?? DEFAULT_AI_MODEL,
    baseUrl: meta.baseUrl ?? null,
    keyHint: hasKey ? meta.keyHint ?? "••••" : null,
    testedAt: meta.testedAt ?? null,
    platformAi,
    canManage,
  });
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim() ?? "";
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  return statusResponse(workspaceId);
}

/**
 * `action: "test"` só valida; `action: "save"` (padrão) valida e grava.
 * Chave em branco = mantém a já salva.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;

  const provider = findAiProvider(body.provider);
  if (!provider) return NextResponse.json({ error: "Provedor inválido" }, { status: 400 });

  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!model || model.length > 120) {
    return NextResponse.json({ error: "Informe o modelo" }, { status: 400 });
  }

  let baseUrl = provider.baseUrl;
  if (provider.id === "custom") {
    const raw = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("https");
      baseUrl = url.toString().replace(/\/$/, "");
    } catch {
      return NextResponse.json({ error: "Informe a URL base (https://…/v1)" }, { status: 400 });
    }
  }

  const existing = await getWorkspaceConnection(workspaceId, AI_CONNECTION_PROVIDER).catch(() => null);
  const typedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const apiKey =
    typedKey || (typeof existing?.credentials.apiKey === "string" ? existing.credentials.apiKey : "");
  if (!apiKey) return NextResponse.json({ error: "Cole a chave de API" }, { status: 400 });

  const test = await testLlmConfig({ apiKey, baseUrl, model });
  if (!test.ok) return NextResponse.json({ error: test.error }, { status: 422 });

  if (body.action === "test") return NextResponse.json({ ok: true });

  const metadata: AiConnectionMetadata = {
    provider: provider.id,
    model,
    baseUrl,
    keyHint: maskApiKey(apiKey),
    testedAt: new Date().toISOString(),
  };
  await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: AI_CONNECTION_PROVIDER,
    label: provider.label,
    credentials: { apiKey },
    metadata,
    status: "ACTIVE",
  });
  await clearCooldowns(workspaceCooldownPrefix(workspaceId));
  return statusResponse(workspaceId);
}

export async function DELETE(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim() ?? "";
  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  await disconnectWorkspaceConnection(workspaceId, AI_CONNECTION_PROVIDER);
  await clearCooldowns(workspaceCooldownPrefix(workspaceId));
  return statusResponse(workspaceId);
}
