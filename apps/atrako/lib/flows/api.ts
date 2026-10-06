import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getInternalUser } from "@/lib/internalUsers";
import { getWorkspaceMember } from "@/lib/tenancy/memberAuth";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { readerKey } from "@/lib/notifications";
import type { CampaignActor } from "@/lib/flows/campaigns";

export type FlowActor = CampaignActor & { readerKey: string; email: string | null };

/** Quem está agindo no workspace (membro ou equipe da plataforma). */
export async function flowActor(workspaceId: string): Promise<FlowActor> {
  const [internal, session] = await Promise.all([getInternalUser(), getWorkspaceMember()]);
  const email = session?.email ?? internal?.email ?? null;
  const member = email
    ? await prisma.workspaceMember.findUnique({
        where: { clienteId_email: { clienteId: workspaceId, email: email.toLowerCase() } },
      })
    : null;
  const activeMember = member?.active ? member : null;
  const platform = !activeMember && Boolean(internal);
  return {
    memberId: activeMember?.id ?? null,
    role: activeMember?.role ?? (platform ? "ADMIN" : null),
    name: activeMember?.name ?? internal?.name ?? internal?.username ?? email,
    platform,
    email,
    readerKey: readerKey({ memberId: activeMember?.id ?? null, internalId: internal?.id ?? null }),
  };
}

export async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** workspaceId da query (GET) ou do body (POST/PATCH) + gate de acesso. */
export async function gate(
  request: NextRequest,
  minRole: "operate" | "manage" = "operate",
  body?: Record<string, unknown> | null,
) {
  const workspaceId = str(body?.workspaceId) || request.nextUrl.searchParams.get("workspaceId")?.trim() || "";
  const access = await requireWorkspaceAccess(workspaceId, minRole);
  if (!access.ok) return { ok: false as const, response: access.response };
  return { ok: true as const, workspaceId };
}

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

const DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DateRange = { since: Date; until: Date; days: number };

/**
 * Período do filtro (`dataInicio`/`dataFim` em YYYY-MM-DD, fim inclusivo) com fallback
 * para o legado `days` (últimos N dias até agora).
 */
export function parseRange(request: NextRequest, defaultDays = 30): DateRange {
  const sp = request.nextUrl.searchParams;
  const ini = sp.get("dataInicio") ?? "";
  const fim = sp.get("dataFim") ?? "";
  if (ISO_DATE.test(ini) && ISO_DATE.test(fim)) {
    const since = new Date(`${ini}T00:00:00`);
    const until = new Date(`${fim}T23:59:59.999`);
    if (!Number.isNaN(since.getTime()) && !Number.isNaN(until.getTime()) && since <= until) {
      return { since, until, days: Math.max(1, Math.round((until.getTime() - since.getTime()) / DAY)) };
    }
  }
  const days = Math.min(730, Math.max(1, Number(sp.get("days")) || defaultDays));
  const until = new Date();
  return { since: new Date(until.getTime() - days * DAY), until, days };
}

/** Mesmo comprimento, imediatamente antes — base da variação "vs período anterior". */
export function previousRange(r: DateRange): DateRange {
  const len = r.until.getTime() - r.since.getTime();
  return { since: new Date(r.since.getTime() - len - 1), until: new Date(r.since.getTime() - 1), days: r.days };
}
