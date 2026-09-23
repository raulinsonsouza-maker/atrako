"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { assertTenantAccess } from "@/lib/dashboard-context";
import { mergeWithDefaults } from "@/lib/sdr/types";
import type { TenantSdrConfig } from "@/lib/sdr/types";
import { validateSdrConfig } from "@/lib/sdr/validation";

/** Retorna a configuração SDR do tenant (com defaults). Qualquer usuário do tenant pode ler. */
export async function getTenantSdrConfig(tenantId: string): Promise<TenantSdrConfig> {
  await assertTenantAccess(tenantId);
  const t = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  const config = t?.config as Record<string, unknown> | null | undefined;
  const sdr = (config?.sdr as Partial<TenantSdrConfig> | undefined) ?? null;
  return mergeWithDefaults(sdr);
}

/** Salva a configuração SDR do tenant. Apenas TENANT_ADMIN. Valida antes de persistir. */
export async function saveTenantSdrConfig(
  tenantId: string,
  data: Partial<TenantSdrConfig>
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");
  const role = (session.user as { role?: string }).role;
  if (role !== "TENANT_ADMIN") throw new Error("Apenas administrador do tenant pode alterar a configuração do SDR.");

  const result = validateSdrConfig(data);
  if (!result.ok) {
    const msg = result.errors.map((e) => (e.field ? `${e.field}: ` : "") + e.message).join(" ");
    return { ok: false, error: msg };
  }

  const curr = await db.tenant.findUnique({ where: { id: tenantId }, select: { config: true } });
  const prev = (curr?.config as Record<string, unknown>) || {};
  const prevSdr = (prev.sdr as Record<string, unknown>) || {};
  const next = { ...prev, sdr: { ...prevSdr, ...result.normalized } } as Record<string, unknown>;
  await db.tenant.update({
    where: { id: tenantId },
    data: { config: next as Prisma.InputJsonValue },
  });
  return { ok: true };
}
