"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { getLeads as getMetaLeads } from "@/lib/integrations/meta";
import { getLeads as getGoogleLeads } from "@/lib/integrations/google-ads";
import { getOrCreateClient, getState } from "@/lib/wweb-manager";

export async function getWhatsAppIntegration(tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  return db.integration.findFirst({
    where: { tenantId, type: "WHATSAPP" },
  });
}

export type SaveWhatsAppData = {
  provider: "evolution" | "wweb" | "zapi";
  evolutionInstance?: string;
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  zapiInstanceId?: string;
  zapiToken?: string;
  wwebServiceUrl?: string;
};

export async function saveWhatsAppIntegration(tenantId: string, data: SaveWhatsAppData) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  let config: Record<string, unknown>;
  if (data.provider === "wweb") {
    // Modo integrado (sem URL) ou serviço externo (com URL)
    const serviceUrl = data.wwebServiceUrl?.trim();
    config = { provider: "wweb", wwebServiceUrl: serviceUrl || undefined };
  } else if (data.provider === "zapi") {
    const inst = (data.zapiInstanceId || "").trim();
    const token = (data.zapiToken || "").trim();
    if (!inst || !token) throw new Error("Instance ID e Token da Z-API são obrigatórios.");
    config = { provider: "zapi", zapiInstanceId: inst, zapiToken: token };
  } else {
    const inst = (data.evolutionInstance || "").trim();
    if (!inst) throw new Error("Nome da instância Evolution é obrigatório.");
    config = {
      provider: "evolution",
      evolutionInstance: inst,
      evolutionApiUrl: data.evolutionApiUrl?.trim() || undefined,
      evolutionApiKey: data.evolutionApiKey?.trim() || undefined,
    };
  }

  const existing = await db.integration.findFirst({
    where: { tenantId, type: "WHATSAPP" },
  });
  const payload = { config: config as object, status: "ACTIVE" as const };
  if (existing) {
    await db.integration.update({
      where: { id: existing.id },
      data: payload,
    });
  } else {
    await db.integration.create({
      data: { tenantId, type: "WHATSAPP", ...payload },
    });
  }

  // Não inicializa o cliente aqui — apenas em ação explícita do usuário.
}

/** Status e QR do WhatsApp Web integrado. Usado pelo formulário em Configurações. */
export async function getWwebStatus(tenantId: string, forceRecreate = false): Promise<{ status: string; qr?: string; error?: string } | null> {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const int = await db.integration.findFirst({ where: { tenantId, type: "WHATSAPP" } });
  const cfg = (int?.config || {}) as { provider?: string; wwebServiceUrl?: string };
  if (cfg.provider !== "wweb") return null;

  if (cfg.wwebServiceUrl) {
    const base = cfg.wwebServiceUrl.replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/status`, { cache: "no-store" });
      if (!res.ok) {
        return { status: "disconnected", error: "Serviço WhatsApp externo indisponível." };
      }
      const json = (await res.json().catch(() => ({}))) as { status?: string; qr?: string };
      return { status: json.status || "disconnected", qr: json.qr || undefined };
    } catch {
      return { status: "disconnected", error: "Serviço WhatsApp externo indisponível." };
    }
  }

  await getOrCreateClient(tenantId, forceRecreate);
  const s = getState(tenantId);
  return { status: s.status, qr: s.qr ?? undefined };
}

export async function disconnectWhatsApp(tenantId: string): Promise<void> {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const int = await db.integration.findFirst({ where: { tenantId, type: "WHATSAPP" } });
  const cfg = (int?.config || {}) as { provider?: string; wwebServiceUrl?: string };
  if (cfg.provider === "wweb" && !cfg.wwebServiceUrl) {
    const { disconnectClient } = await import("@/lib/wweb-manager");
    await disconnectClient(tenantId);
  }

  // Remove a integração do banco
  await db.integration.deleteMany({
    where: { tenantId, type: "WHATSAPP" },
  });
}

export async function getMetaIntegration(tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");
  return db.integration.findFirst({ where: { tenantId, type: "META" } });
}

export async function saveMetaIntegration(tenantId: string, data: { accessToken: string; pageId: string }) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");
  const config = { accessToken: data.accessToken.trim(), pageId: data.pageId.trim() };
  if (!config.accessToken || !config.pageId) throw new Error("Token e Page ID são obrigatórios.");

  const existing = await db.integration.findFirst({ where: { tenantId, type: "META" } });
  if (existing) {
    await db.integration.update({ where: { id: existing.id }, data: { config, status: "ACTIVE" } });
  } else {
    await db.integration.create({ data: { tenantId, type: "META", config, status: "ACTIVE" } });
  }
}

export async function getGoogleIntegration(tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");
  return db.integration.findFirst({ where: { tenantId, type: "GOOGLE_ADS" } });
}

export async function saveGoogleIntegration(tenantId: string, data: { refreshToken?: string; customerId?: string }) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");
  const config = { refreshToken: data.refreshToken?.trim(), customerId: data.customerId?.trim() };

  const existing = await db.integration.findFirst({ where: { tenantId, type: "GOOGLE_ADS" } });
  if (existing) {
    await db.integration.update({ where: { id: existing.id }, data: { config, status: "ACTIVE" } });
  } else {
    await db.integration.create({ data: { tenantId, type: "GOOGLE_ADS", config, status: "ACTIVE" } });
  }
}

async function getFirstStageId(tenantId: string): Promise<string | null> {
  const pipe = await db.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" }, take: 1 } },
  });
  return pipe?.stages[0]?.id ?? null;
}

export async function runAdsSync(tenantId: string): Promise<{ meta: number; google: number }> {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  let metaCount = 0;
  let googleCount = 0;

  const [metaInt, googleInt, tenant, firstStageId] = await Promise.all([
    db.integration.findFirst({ where: { tenantId, type: "META", status: "ACTIVE" } }),
    db.integration.findFirst({ where: { tenantId, type: "GOOGLE_ADS", status: "ACTIVE" } }),
    db.tenant.findUnique({ where: { id: tenantId }, select: { config: true } }),
    getFirstStageId(tenantId),
  ]);
  const ac = (tenant?.config as { autoAssignUserId?: string } | null)?.autoAssignUserId;

  if (metaInt?.config) {
    const cfg = metaInt.config as { accessToken?: string; pageId?: string };
    if (cfg.accessToken && cfg.pageId) {
      const leads = await getMetaLeads({ accessToken: cfg.accessToken, pageId: cfg.pageId });
      for (const l of leads) {
        const ex = await db.lead.findFirst({ where: { tenantId, sourceId: l.sourceId } });
        if (ex) continue;
        await db.lead.create({
          data: {
            tenantId,
            source: "META",
            sourceId: l.sourceId,
            name: l.name,
            email: l.email,
            phone: l.phone ?? null,
            status: "NEW",
            stageId: firstStageId,
            assignedToId: ac || undefined,
          },
        });
        metaCount++;
      }
    }
  }

  if (googleInt?.config) {
    const leads = await getGoogleLeads(googleInt.config as Record<string, unknown>);
    for (const l of leads) {
      const ex = await db.lead.findFirst({ where: { tenantId, sourceId: l.sourceId } });
      if (ex) continue;
      await db.lead.create({
        data: {
          tenantId,
          source: "GOOGLE",
          sourceId: l.sourceId,
          name: l.name,
          email: l.email,
          phone: l.phone ?? null,
          status: "NEW",
          stageId: firstStageId,
          assignedToId: ac || undefined,
        },
      });
      googleCount++;
    }
  }

  return { meta: metaCount, google: googleCount };
}
