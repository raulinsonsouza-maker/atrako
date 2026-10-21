import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { bad, gate, readBody } from "@/lib/flows/api";
import { resolveWhatsApp } from "@/lib/config/resolveConnection";
import { resolveResend } from "@/lib/integrations/resend/connection";
import { ensureDefaultWaTemplates } from "@/lib/flows/wa-templates";
import { franchiseRegicenterPatch, loadQualificationPrefs } from "@/lib/qualification/playbook";
import { parseLeadQualification } from "@/lib/qualification/store";
import { journeyStageOf, type JourneyStageKey } from "@/lib/qualification/journey";
import { REGICENTER_LP_FORM } from "@/lib/qualification/forms";
import type { QualifyFieldKey } from "@/lib/qualification/fields";

const QUALIFY_TEMPLATES = ["qualify_open", "qualify_nudge"];

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export async function GET(request: NextRequest) {
  const g = await gate(request, "operate");
  if (!g.ok) return g.response;
  const ws = g.workspaceId;

  const [prefs, wa, resend, cliente, templates, leads] = await Promise.all([
    loadQualificationPrefs(ws),
    resolveWhatsApp(ws),
    resolveResend(ws),
    prisma.cliente.findUnique({ where: { id: ws }, select: { nome: true } }),
    prisma.waTemplateRef.findMany({
      where: { clienteId: ws, purpose: { in: QUALIFY_TEMPLATES }, status: { notIn: ["DELETED", "PENDING_DELETION"] } },
      select: { purpose: true, status: true, version: true },
      orderBy: { version: "desc" },
    }),
    prisma.nativeLead.findMany({
      where: { clienteId: ws, status: "OPEN", metadata: { path: ["qualification", "playbookId"], not: Prisma.AnyNull } },
      select: { metadata: true },
      orderBy: { createdAt: "desc" },
      take: 3000,
    }),
  ]);

  const stages: Record<JourneyStageKey, number> = { entrada: 0, abertura: 0, perguntas: 0, horario: 0, equipe: 0, nutricao: 0 };
  const priorities = { A: 0, B: 0, C: 0 };
  let stalled = 0;
  for (const lead of leads) {
    const q = parseLeadQualification(lead.metadata);
    const stage = journeyStageOf(q.currentState);
    if (stage) stages[stage] += 1;
    if (q.priority) priorities[q.priority] += 1;
    const waiting = stage === "abertura" || stage === "perguntas" || stage === "horario";
    const cadence = asRecord(asRecord(asRecord(lead.metadata).qualification).cadence);
    if (waiting && q.cadenceStatus === "done" && !cadence.nextAt) stalled += 1;
  }

  const templateStatus = Object.fromEntries(
    QUALIFY_TEMPLATES.map((purpose) => {
      const rows = templates.filter((t) => t.purpose === purpose);
      const live = rows.find((t) => t.status === "APPROVED") ?? rows[0];
      return [purpose, live?.status ?? null];
    }),
  ) as Record<string, string | null>;

  const lpKeys = REGICENTER_LP_FORM.steps.flatMap((s) => s.fields.map((f) => f.id)) as QualifyFieldKey[];

  return NextResponse.json({
    brand: cliente?.nome ?? "",
    qualification: { enabled: prefs.enabled, askKeys: prefs.askKeys, lpKeys },
    channels: {
      whatsapp: { connected: Boolean(wa), phone: wa?.displayPhoneNumber ?? null },
      email: { connected: Boolean(resend?.fromEmail), from: resend?.fromEmail ?? null },
    },
    templates: templateStatus,
    stages,
    priorities,
    stalled,
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const g = await gate(request, "manage", body);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "toggle") {
    const enabled = body?.enabled === true;
    const settings = await prisma.workspaceSettings.findUnique({ where: { clienteId: ws }, select: { messagingPrefs: true } });
    if (!settings) return bad("Configurações do workspace não encontradas", 404);
    const prefs = asRecord(settings.messagingPrefs);
    const defaults = asRecord(franchiseRegicenterPatch(enabled).qualification);
    const qualification = { ...defaults, ...asRecord(prefs.qualification), enabled };
    await prisma.workspaceSettings.update({
      where: { clienteId: ws },
      data: { messagingPrefs: { ...prefs, qualification } as Prisma.InputJsonValue },
    });
    const created = enabled ? await ensureDefaultWaTemplates(ws, undefined, QUALIFY_TEMPLATES).catch(() => null) : null;
    return NextResponse.json({ ok: true, enabled, templates: created });
  }

  if (action === "templates") {
    const result = await ensureDefaultWaTemplates(ws, undefined, QUALIFY_TEMPLATES);
    if ("skipped" in result && result.skipped) return bad("Conecte o WhatsApp primeiro", 409);
    return NextResponse.json({ ok: true, ...result });
  }

  return bad("Ação inválida");
}
