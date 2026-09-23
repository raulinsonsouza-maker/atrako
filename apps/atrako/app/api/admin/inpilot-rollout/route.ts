import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireInternalAdmin } from "@/lib/internalAccess";
import {
  INPILOT_ROLLOUT_CONFIG_KEY,
  decideInPilotRolloutCas,
  disabledInPilotConfig,
  parseInPilotRolloutConfig,
  validateInPilotRolloutInput,
  type InPilotRolloutSelection,
} from "@/lib/inpilotRollout";
import {
  configWithRevision,
  getInPilotRolloutConfig,
  serializeInPilotRolloutConfig,
} from "@/lib/inpilotRolloutServer";

export const dynamic = "force-dynamic";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

async function activeOptions() {
  const [users, clients] = await Promise.all([
    prisma.internalUser.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, slug: true, inPilotEnabled: true },
    }),
  ]);
  return { users, clients };
}

export async function GET() {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;
  const [config, options] = await Promise.all([getInPilotRolloutConfig(), activeOptions()]);
  return noStore(NextResponse.json({ config, ...options }));
}

export async function PATCH(request: NextRequest) {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return noStore(NextResponse.json({ error: "Configuração do rollout inválida" }, { status: 400 }));
  }
  const allowedKeys = ["allowAllClients", "allowedClientIds", "allowedInternalUserIds", "confirmEnableAllClients", "confirmEnableGlobal", "enabled", "expectedRevision"];
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))
    || !("enabled" in body)
    || !("allowAllClients" in body)
    || !("allowedInternalUserIds" in body)
    || !("allowedClientIds" in body)
    || !("expectedRevision" in body)) {
    return noStore(NextResponse.json({ error: "Envie expectedRevision, enabled, allowAllClients e as duas listas de allowlist" }, { status: 400 }));
  }
  if ("confirmEnableGlobal" in body && typeof body.confirmEnableGlobal !== "boolean") {
    return noStore(NextResponse.json({ error: "A confirmação de ativação global é inválida" }, { status: 400 }));
  }
  if ("confirmEnableAllClients" in body && typeof body.confirmEnableAllClients !== "boolean") {
    return noStore(NextResponse.json({ error: "A confirmação de todos os clientes é inválida" }, { status: 400 }));
  }
  if (
    typeof body.expectedRevision !== "number"
    || !Number.isSafeInteger(body.expectedRevision)
    || body.expectedRevision < 0
  ) {
    return noStore(NextResponse.json({ error: "A revisão esperada é inválida" }, { status: 400 }));
  }

  let config: InPilotRolloutSelection;
  try {
    config = validateInPilotRolloutInput({
      enabled: body.enabled,
      allowAllClients: body.allowAllClients,
      allowedInternalUserIds: body.allowedInternalUserIds,
      allowedClientIds: body.allowedClientIds,
    });
  } catch (error) {
    return noStore(NextResponse.json({ error: error instanceof Error ? error.message : "Configuração do rollout inválida" }, { status: 400 }));
  }

  const result = await prisma.$transaction(async (tx) => {
    // The lock makes the read/compare/write one serialized CAS operation.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`system-config:${INPILOT_ROLLOUT_CONFIG_KEY}`}, 0))`;
    const row = await tx.systemConfig.findUnique({ where: { key: INPILOT_ROLLOUT_CONFIG_KEY } });
    const current = parseInPilotRolloutConfig(row?.value) ?? disabledInPilotConfig();
    const decision = decideInPilotRolloutCas({
      current,
      expectedRevision: body.expectedRevision,
      nextEnabled: config.enabled,
      nextAllowAllClients: config.allowAllClients,
      confirmedEnableGlobal: body.confirmEnableGlobal === true,
      confirmedEnableAllClients: body.confirmEnableAllClients === true,
    });
    if (!decision.ok) return { kind: decision.reason, current } as const;

    const [activeUsers, activeClients] = await Promise.all([
      tx.internalUser.findMany({
        where: { id: { in: config.allowedInternalUserIds }, active: true },
        select: { id: true },
      }),
      tx.cliente.findMany({
        where: { id: { in: config.allowedClientIds }, ativo: true },
        select: { id: true },
      }),
    ]);
    if (activeUsers.length !== config.allowedInternalUserIds.length) {
      return { kind: "invalid_users" as const, current };
    }
    if (activeClients.length !== config.allowedClientIds.length) {
      return { kind: "invalid_clients" as const, current };
    }

    const next = configWithRevision(config, decision.nextRevision);
    await tx.systemConfig.upsert({
      where: { key: INPILOT_ROLLOUT_CONFIG_KEY },
      create: { key: INPILOT_ROLLOUT_CONFIG_KEY, value: serializeInPilotRolloutConfig(next) },
      update: { value: serializeInPilotRolloutConfig(next) },
    });
    await tx.auditLog.create({
      data: {
        actorInternalUserId: authz.user.id,
        action: "INPILOT_ROLLOUT_UPDATED",
        metadata: {
          configKey: INPILOT_ROLLOUT_CONFIG_KEY,
          enabled: next.enabled,
          allowAllClients: next.allowAllClients,
          revision: next.revision,
          previousEnabled: current.enabled,
          previousRevision: current.revision,
          allowedInternalUserCount: next.allowedInternalUserIds.length,
          allowedClientCount: next.allowedClientIds.length,
        },
      },
    });
    return { kind: "updated" as const, config: next };
  });
  if (result.kind === "stale_revision") {
    return noStore(NextResponse.json({
      error: "O rollout foi alterado por outro administrador. Recarregue a configuração antes de salvar.",
      code: "ROLLOUT_REVISION_CONFLICT",
      config: result.current,
    }, { status: 409 }));
  }
  if (result.kind === "confirmation_required") {
    return noStore(NextResponse.json({
      error: "Confirme explicitamente a ativação global do InPilot na revisão atual",
      code: "GLOBAL_ENABLE_CONFIRMATION_REQUIRED",
      config: result.current,
    }, { status: 409 }));
  }
  if (result.kind === "all_clients_confirmation_required") {
    return noStore(NextResponse.json({
      error: "Confirme explicitamente a liberação do InPilot para todos os clientes",
      code: "ALL_CLIENTS_CONFIRMATION_REQUIRED",
      config: result.current,
    }, { status: 409 }));
  }
  if (result.kind === "invalid_revision") {
    return noStore(NextResponse.json({ error: "A revisão atual é inválida", config: result.current }, { status: 409 }));
  }
  if (result.kind === "invalid_users") {
    return noStore(NextResponse.json({ error: "A allowlist contém usuário interno inexistente ou inativo" }, { status: 400 }));
  }
  if (result.kind === "invalid_clients") {
    return noStore(NextResponse.json({ error: "A allowlist contém cliente inexistente ou inativo" }, { status: 400 }));
  }
  const options = await activeOptions();
  return noStore(NextResponse.json({ config: result.config, ...options }));
}