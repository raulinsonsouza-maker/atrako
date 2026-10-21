import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { bad, gate, readBody } from "@/lib/flows/api";
import { resolveWhatsApp } from "@/lib/config/resolveConnection";
import { resolveResend } from "@/lib/integrations/resend/connection";
import { ensureDefaultWaTemplates } from "@/lib/flows/wa-templates";
import { franchiseRegicenterPatch, loadQualificationPrefs } from "@/lib/qualification/playbook";
import { parseLeadQualification } from "@/lib/qualification/store";
import { journeyStageOf } from "@/lib/qualification/journey";
import { REGICENTER_LP_FORM } from "@/lib/qualification/forms";
import {
  DEFAULT_SCRIPT,
  applyBlock,
  customizedBlocks,
  formFieldsFromSteps,
  resetBlock,
  resolveScript,
  templateTextProblem,
  type ScriptBlockId,
} from "@/lib/qualification/script";
import {
  QUALIFY_TEMPLATES,
  isTemplateBlock,
  scriptTemplateBodies,
  scriptTemplateStates,
  syncScriptTemplate,
  templateTextOf,
} from "@/lib/qualification/templates";

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

const BLOCK_RE = /^(opening|questions|bestTime|handoff|nurture|rules|question:[a-z_]+|followUp:(reask|nudge|team))$/;

export async function GET(request: NextRequest) {
  const g = await gate(request, "operate");
  if (!g.ok) return g.response;
  const ws = g.workspaceId;

  const prefs = await loadQualificationPrefs(ws);
  const [wa, resend, cliente, templates, lpForm, leads] = await Promise.all([
    resolveWhatsApp(ws),
    resolveResend(ws),
    prisma.cliente.findUnique({ where: { id: ws }, select: { nome: true } }),
    scriptTemplateStates(ws),
    prisma.captureForm.findFirst({
      where: { clienteId: ws, slug: prefs.lpFormSlug, active: true },
      select: { name: true, steps: true },
    }),
    prisma.nativeLead.findMany({
      where: { clienteId: ws, status: "OPEN", metadata: { path: ["qualification", "playbookId"], not: Prisma.AnyNull } },
      select: { metadata: true },
      orderBy: { createdAt: "desc" },
      take: 3000,
    }),
  ]);

  const live = { qualifying: 0, withTeam: 0, noReply: 0, nurture: 0 };
  for (const lead of leads) {
    const q = parseLeadQualification(lead.metadata);
    const stage = journeyStageOf(q.currentState);
    const cadence = asRecord(asRecord(asRecord(lead.metadata).qualification).cadence);
    const waiting = stage === "entrada" || stage === "abertura" || stage === "perguntas" || stage === "horario";
    if (waiting) {
      const stepsLeft = q.cadenceStatus === "running" && Number(cadence.step ?? 0) === 0;
      if (stepsLeft) live.qualifying += 1;
      else live.noReply += 1;
    }
    if (stage === "equipe") live.withTeam += 1;
    if (stage === "nutricao") live.nurture += 1;
  }

  const formFields = formFieldsFromSteps(lpForm?.steps ?? REGICENTER_LP_FORM.steps);
  /** Obrigatórios no cadastro: nunca são perguntados no WhatsApp. */
  const lpKeys = formFields.filter((f) => f.required).map((f) => f.key);

  return NextResponse.json({
    brand: cliente?.nome ?? "",
    enabled: prefs.enabled,
    form: { name: lpForm?.name ?? REGICENTER_LP_FORM.name, fields: formFields },
    lpKeys,
    script: prefs.script,
    defaults: DEFAULT_SCRIPT,
    customized: customizedBlocks(prefs.scriptOverrides),
    channels: {
      whatsapp: { connected: Boolean(wa), phone: wa?.displayPhoneNumber ?? null },
      email: { connected: Boolean(resend?.fromEmail), from: resend?.fromEmail ?? null },
    },
    templates,
    live,
  });
}

async function loadPrefs(ws: string) {
  const settings = await prisma.workspaceSettings.findUnique({ where: { clienteId: ws }, select: { messagingPrefs: true } });
  return settings ? asRecord(settings.messagingPrefs) : null;
}

async function saveQualification(ws: string, prefs: Record<string, unknown>, qualification: Record<string, unknown>) {
  await prisma.workspaceSettings.update({
    where: { clienteId: ws },
    data: { messagingPrefs: { ...prefs, qualification } as Prisma.InputJsonValue },
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
    const prefs = await loadPrefs(ws);
    if (!prefs) return bad("Configurações do workspace não encontradas", 404);
    const defaults = asRecord(franchiseRegicenterPatch(enabled).qualification);
    const qualification: Record<string, unknown> = { ...defaults, ...asRecord(prefs.qualification), enabled };
    await saveQualification(ws, prefs, qualification);
    const script = resolveScript(qualification.script);
    const created = enabled
      ? await ensureDefaultWaTemplates(ws, undefined, QUALIFY_TEMPLATES, scriptTemplateBodies(script)).catch(() => null)
      : null;
    return NextResponse.json({ ok: true, enabled, templates: created });
  }

  if (action === "templates") {
    const { script } = await loadQualificationPrefs(ws);
    const result = await ensureDefaultWaTemplates(ws, undefined, QUALIFY_TEMPLATES, scriptTemplateBodies(script));
    if ("skipped" in result && result.skipped) return bad("Conecte o WhatsApp primeiro", 409);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "save_block" || action === "reset_block" || action === "save_rules") {
    const block = (action === "save_rules" ? "rules" : String(body?.block ?? "")) as ScriptBlockId;
    if (!BLOCK_RE.test(block)) return bad("Bloco inválido");
    const prefs = await loadPrefs(ws);
    if (!prefs) return bad("Configurações do workspace não encontradas", 404);
    const current = asRecord(prefs.qualification);
    const patch = action === "save_rules" ? body?.rules : body?.patch;
    const overrides = action === "reset_block" ? resetBlock(current.script, block) : applyBlock(current.script, block, patch);
    const script = resolveScript(overrides);

    if (isTemplateBlock(block)) {
      const problem = templateTextProblem(templateTextOf(script, block));
      if (problem) return bad(problem);
    }
    if (block === "rules" && !Object.values(script.rules.A).some((codes) => codes?.length)) {
      return bad("Defina ao menos uma condição para A");
    }

    await saveQualification(ws, prefs, { ...current, script: overrides });

    let template: { synced: boolean; reason?: string; error?: string } | null = null;
    if (isTemplateBlock(block)) {
      template = await syncScriptTemplate(ws, block, script).catch((err) => ({
        synced: false,
        error: err instanceof Error ? err.message : "Falha ao enviar o modelo para a Meta",
      }));
    }
    return NextResponse.json({ ok: true, script, customized: customizedBlocks(overrides), template });
  }

  return bad("Ação inválida");
}
