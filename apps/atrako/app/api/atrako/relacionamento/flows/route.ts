import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { bad, gate, readBody, str, flowActor } from "@/lib/flows/api";
import { ensureDefaultFlows, refreshDefaultCopy, resetStepCopy, playbookByKey } from "@/lib/flows/playbooks";
import { emailContentProblems, sanitizeEmailContent } from "@/lib/flows/render-email";
import { previewEmail } from "@/lib/flows/preview";
import { isEmailContent, type WhatsAppContent } from "@/lib/flows/types";
import { sampleContact } from "@/lib/flows/campaigns";
import { sendEmailMessage, sendWhatsAppMessage } from "@/lib/flows/send";

const DAY = 86_400_000;

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * DAY);

  const [flows, stepStats, active, conv] = await Promise.all([
    prisma.messageFlow.findMany({
      where: { clienteId: ws },
      orderBy: { priority: "asc" },
      include: { steps: { orderBy: { position: "asc" } } },
    }),
    prisma.messageDelivery.groupBy({
      by: ["stepId"],
      where: { clienteId: ws, isTest: false, flowId: { not: null }, createdAt: { gte: since } },
      _count: { _all: true, sentAt: true, openedAt: true, clickedAt: true, convertedAt: true },
      _sum: { convertedCents: true, costMicros: true },
    }),
    prisma.messageFlowEnrollment.groupBy({
      by: ["flowId", "status", "holdout"],
      where: { clienteId: ws, createdAt: { gte: since } },
      _count: { _all: true, convertedAt: true },
    }),
    prisma.messageDelivery.groupBy({
      by: ["flowId", "conversionKind"],
      where: { clienteId: ws, isTest: false, convertedAt: { gte: since }, flowId: { not: null } },
      _count: { _all: true },
      _sum: { convertedCents: true },
    }),
  ]);

  const statsByStep = new Map(stepStats.map((s) => [s.stepId, s]));
  return NextResponse.json({
    days,
    flows: flows.map((f) => {
      const enr = active.filter((a) => a.flowId === f.id);
      const byStatus: Record<string, number> = {};
      for (const a of enr) byStatus[a.status] = (byStatus[a.status] ?? 0) + a._count._all;
      const group = (holdout: boolean) => {
        const rows = enr.filter((a) => a.holdout === holdout);
        const n = rows.reduce((s, a) => s + a._count._all, 0);
        const converted = rows.reduce((s, a) => s + a._count.convertedAt, 0);
        return { n, converted, rate: n ? converted / n : 0 };
      };
      const attributed = conv.find((c) => c.flowId === f.id && c.conversionKind === "ATTRIBUTED");
      const influenced = conv.find((c) => c.flowId === f.id && c.conversionKind === "INFLUENCED");
      return {
        id: f.id,
        key: f.key,
        name: f.name,
        trigger: f.trigger,
        status: f.status,
        pausedReason: f.pausedReason,
        priority: f.priority,
        holdoutPercent: f.holdoutPercent,
        settings: f.settings,
        description: playbookByKey(f.key)?.description ?? null,
        enrollments: byStatus,
        holdout: { treated: group(false), control: group(true) },
        entered: enr.reduce((s, a) => s + a._count._all, 0),
        attributed: { orders: attributed?._count._all ?? 0, cents: attributed?._sum.convertedCents ?? 0 },
        influenced: { orders: influenced?._count._all ?? 0, cents: influenced?._sum.convertedCents ?? 0 },
        steps: f.steps.map((s) => {
          const st = statsByStep.get(s.id);
          const content = s.content as Record<string, unknown>;
          return {
            id: s.id,
            position: s.position,
            delayMinutes: s.delayMinutes,
            channel: s.channel,
            enabled: s.enabled,
            content: s.content,
            draftContent: s.draftContent,
            draftUpdatedAt: s.draftUpdatedAt?.toISOString() ?? null,
            testedAt: s.testedAt?.toISOString() ?? null,
            publishedAt: s.publishedAt?.toISOString() ?? null,
            couponCode: s.couponCode,
            couponConfirmed: s.couponConfirmed,
            conditions: s.conditions,
            customized: s.customized,
            label:
              s.channel === "EMAIL"
                ? String(content.subject ?? "E-mail")
                : String((content as WhatsAppContent).purpose ?? (content as WhatsAppContent).templateName ?? "WhatsApp"),
            stats: {
              sent: st?._count.sentAt ?? 0,
              opened: st?._count.openedAt ?? 0,
              clicked: st?._count.clickedAt ?? 0,
              converted: st?._count.convertedAt ?? 0,
              cents: st?._sum.convertedCents ?? 0,
              costMicros: st?._sum.costMicros ?? 0,
            },
          };
        }),
      };
    }),
  });
}

async function stepFor(ws: string, stepId: string) {
  return prisma.messageFlowStep.findFirst({
    where: { id: stepId, flow: { clienteId: ws } },
    include: { flow: { select: { id: true, key: true, name: true } } },
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const action = str(body.action);
  const needsManage = ["flow_update", "step_publish", "refresh_copy", "ensure_defaults", "step_reset"].includes(action);
  const g = await gate(request, needsManage ? "manage" : "operate", body);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;

  switch (action) {
    case "ensure_defaults":
      return NextResponse.json(await ensureDefaultFlows(ws, { status: "PAUSED" }));

    case "refresh_copy": {
      const tone = str(body.tone);
      return NextResponse.json(
        await refreshDefaultCopy(ws, tone === "neutro" || tone === "formal" || tone === "proximo" ? tone : undefined),
      );
    }

    case "preview": {
      const r = await previewEmail(ws, body.content, { couponCode: str(body.couponCode) || null });
      return NextResponse.json({ html: r.html, bytes: r.bytes, clipped: r.clipped, problems: emailContentProblems(sanitizeEmailContent(body.content)) });
    }

    case "flow_update": {
      const flowId = str(body.flowId);
      const flow = await prisma.messageFlow.findFirst({ where: { id: flowId, clienteId: ws } });
      if (!flow) return bad("Fluxo não encontrado", 404);
      const data: Prisma.MessageFlowUpdateInput = {};
      if (body.status === "ACTIVE" || body.status === "PAUSED" || body.status === "DRAFT") {
        if (body.status === "ACTIVE") {
          // Ativar exige e-mails publicados sem pendência
          const steps = await prisma.messageFlowStep.findMany({ where: { flowId, enabled: true, channel: "EMAIL" } });
          const problems = steps.flatMap((s) =>
            isEmailContent(s.content) ? emailContentProblems(sanitizeEmailContent(s.content)).map((p) => `Passo ${s.position + 1}: ${p}`) : [],
          );
          if (problems.length) return bad(`Corrija antes de ativar: ${problems.join("; ")}`);
        }
        data.status = body.status;
        data.pausedReason = body.status === "PAUSED" ? str(body.reason) || "Pausado manualmente" : null;
      }
      if (body.holdoutPercent != null) {
        data.holdoutPercent = Math.min(20, Math.max(0, Math.round(Number(body.holdoutPercent) || 0)));
      }
      if (body.settings && typeof body.settings === "object") {
        data.settings = { ...(flow.settings as object), ...(body.settings as object) } as Prisma.InputJsonValue;
      }
      if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 160);
      await prisma.messageFlow.update({ where: { id: flowId }, data });
      return NextResponse.json({ ok: true });
    }

    case "step_save": {
      const step = await stepFor(ws, str(body.stepId));
      if (!step) return bad("Passo não encontrado", 404);
      const data: Prisma.MessageFlowStepUpdateInput = {};
      if (body.content !== undefined) {
        const content =
          step.channel === "EMAIL" ? sanitizeEmailContent(body.content) : (body.content as Record<string, unknown>);
        data.draftContent = content as Prisma.InputJsonValue;
        data.draftUpdatedAt = new Date();
        data.customized = true;
      }
      if (body.delayMinutes != null) data.delayMinutes = Math.max(0, Math.min(60 * 24 * 120, Math.round(Number(body.delayMinutes) || 0)));
      if (typeof body.enabled === "boolean") data.enabled = body.enabled;
      if (body.couponCode !== undefined) {
        const code = str(body.couponCode).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
        data.couponCode = code || null;
        if (code !== step.couponCode) data.couponConfirmed = false;
      }
      if (typeof body.couponConfirmed === "boolean") data.couponConfirmed = body.couponConfirmed;
      if (body.conditions && typeof body.conditions === "object") {
        data.conditions = { ...(step.conditions as object), ...(body.conditions as object) } as Prisma.InputJsonValue;
      }
      await prisma.messageFlowStep.update({ where: { id: step.id }, data });
      return NextResponse.json({ ok: true });
    }

    case "step_discard": {
      const step = await stepFor(ws, str(body.stepId));
      if (!step) return bad("Passo não encontrado", 404);
      await prisma.messageFlowStep.update({
        where: { id: step.id },
        data: { draftContent: Prisma.DbNull, draftUpdatedAt: null },
      });
      return NextResponse.json({ ok: true });
    }

    case "step_reset": {
      const r = await resetStepCopy(ws, str(body.stepId));
      if (!r) return bad("Este passo não tem texto padrão");
      return NextResponse.json({ ok: true });
    }

    case "step_test": {
      const step = await stepFor(ws, str(body.stepId));
      if (!step) return bad("Passo não encontrado", 404);
      const actor = await flowActor(ws);
      const email = str(body.email) || actor.email || "";
      const phone = str(body.phone);
      const content = step.draftContent ?? step.content;
      const contact = await sampleContact(ws, email || null);
      const origin = { flowId: step.flow.id, flowKey: step.flow.key, stepId: step.id, stepPosition: step.position };
      if (step.channel === "EMAIL") {
        if (!email) return bad("Informe o e-mail de teste");
        const r = await sendEmailMessage({
          clienteId: ws,
          contact,
          content: sanitizeEmailContent(content),
          couponCode: step.couponCode,
          data: {},
          origin,
          idempotencyKey: `step-test-${step.id}-${Date.now()}`,
          isTest: true,
          testTo: email,
          draftTheme: true,
        });
        if (r.status !== "SENT") return bad(`Teste não enviado: ${r.reason}`);
        await prisma.messageFlowStep.update({ where: { id: step.id }, data: { testedAt: new Date() } });
        return NextResponse.json({ ok: true, deliveryId: r.deliveryId });
      }
      if (!phone) return bad("Informe o WhatsApp de teste");
      const r = await sendWhatsAppMessage({
        clienteId: ws,
        contact,
        content: content as WhatsAppContent,
        couponCode: step.couponCode,
        data: {},
        origin,
        automatic: false,
        reservePercent: 0,
        isTest: true,
        testPhone: phone,
      });
      if (r.status !== "SENT") return bad(`Teste não enviado: ${r.reason}`);
      await prisma.messageFlowStep.update({ where: { id: step.id }, data: { testedAt: new Date() } });
      return NextResponse.json({ ok: true, deliveryId: r.deliveryId });
    }

    case "step_publish": {
      const step = await stepFor(ws, str(body.stepId));
      if (!step) return bad("Passo não encontrado", 404);
      if (!step.draftContent) return bad("Nada para publicar");
      if (step.channel === "EMAIL") {
        const problems = emailContentProblems(sanitizeEmailContent(step.draftContent));
        if (problems.length) return bad(`Corrija: ${problems.join(", ")}`);
        if (!step.testedAt || (step.draftUpdatedAt && step.testedAt < step.draftUpdatedAt)) {
          return bad("Envie um teste da versão atual antes de publicar");
        }
      }
      await prisma.messageFlowStep.update({
        where: { id: step.id },
        data: {
          content: step.draftContent as Prisma.InputJsonValue,
          draftContent: Prisma.DbNull,
          draftUpdatedAt: null,
          publishedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true });
    }
  }
  return bad("Ação inválida");
}
