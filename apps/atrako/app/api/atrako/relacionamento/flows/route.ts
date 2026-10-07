import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { bad, gate, parseRange, readBody, str, flowActor } from "@/lib/flows/api";
import { ensureDefaultFlows, refreshDefaultCopy, resetStepCopy, playbookByKey } from "@/lib/flows/playbooks";
import { emailContentProblems, sanitizeEmailContent } from "@/lib/flows/render-email";
import { previewEmail } from "@/lib/flows/preview";
import { isEmailContent, type WhatsAppContent } from "@/lib/flows/types";
import { sampleContact } from "@/lib/flows/campaigns";
import { sendEmailMessage, sendWhatsAppMessage } from "@/lib/flows/send";
import { WA_TEMPLATE_LIBRARY } from "@/lib/flows/wa-templates";
import { WA_EXAMPLE_PARAMS, waPreviewFromComponents, waPreviewFromDraft, type WaPreview } from "@/lib/flows/wa-preview";

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const { since, until, days } = parseRange(request);
  const range = { gte: since, lte: until };

  const [flows, stepStats, active, conv] = await Promise.all([
    prisma.messageFlow.findMany({
      where: { clienteId: ws },
      orderBy: { priority: "asc" },
      include: { steps: { orderBy: { position: "asc" } } },
    }),
    prisma.messageDelivery.groupBy({
      by: ["stepId"],
      where: { clienteId: ws, isTest: false, flowId: { not: null }, createdAt: range },
      _count: { _all: true, sentAt: true, openedAt: true, clickedAt: true, convertedAt: true },
      _sum: { convertedCents: true, costMicros: true },
    }),
    prisma.messageFlowEnrollment.groupBy({
      by: ["flowId", "status", "holdout"],
      where: { clienteId: ws, createdAt: range },
      _count: { _all: true, convertedAt: true },
    }),
    prisma.messageDelivery.groupBy({
      by: ["flowId", "conversionKind"],
      where: { clienteId: ws, isTest: false, convertedAt: range, flowId: { not: null } },
      _count: { _all: true },
      _sum: { convertedCents: true },
    }),
  ]);

  const statsByStep = new Map(stepStats.map((s) => [s.stepId, s]));

  const [store, tplRows] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: ws }, select: { nome: true, logoUrl: true } }),
    prisma.waTemplateRef.findMany({
      where: { clienteId: ws, status: { notIn: ["DELETED", "PENDING_DELETION"] } },
      select: { id: true, status: true, purpose: true, version: true, components: true },
      orderBy: { version: "desc" },
    }),
  ]);
  const params = { ...WA_EXAMPLE_PARAMS, store_name: store?.nome || WA_EXAMPLE_PARAMS.store_name };
  const waPreviewFor = (wa: WhatsAppContent): WaPreview | null => {
    const ref = wa.templateRefId
      ? tplRows.find((t) => t.id === wa.templateRefId)
      : wa.purpose
        ? tplRows.find((t) => t.purpose === wa.purpose && t.status === "APPROVED")
        : undefined;
    if (ref?.components) return waPreviewFromComponents(ref.components, params);
    const def = wa.purpose ? WA_TEMPLATE_LIBRARY.find((d) => d.purpose === wa.purpose) : undefined;
    if (def) {
      return waPreviewFromComponents(
        [
          ...(def.imageHeader || def.carouselCards ? [{ type: "HEADER", format: "IMAGE" }] : []),
          { type: "BODY", text: def.body.proximo },
          ...(def.footer ? [{ type: "FOOTER", text: def.footer }] : []),
          { type: "BUTTONS", buttons: def.buttons },
        ],
        params,
      );
    }
    return wa.previewBody ? waPreviewFromDraft({ body: wa.previewBody }, params) : null;
  };
  const waStatusFor = (wa: WhatsAppContent) => {
    const ref = wa.templateRefId
      ? tplRows.find((t) => t.id === wa.templateRefId)
      : tplRows.find((t) => t.purpose === wa.purpose && t.status === "APPROVED") ?? tplRows.find((t) => t.purpose === wa.purpose);
    return ref?.status ?? null;
  };

  return NextResponse.json({
    days,
    store: { name: store?.nome ?? "Sua loja", logoUrl: store?.logoUrl ?? null },
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
          const live = (s.draftContent ?? s.content) as Record<string, unknown>;
          return {
            preview:
              s.channel === "EMAIL"
                ? { kind: "email" as const, subject: String(live.subject ?? ""), preheader: String(live.preheader ?? "") }
                : { kind: "whatsapp" as const, wa: waPreviewFor(live as WhatsAppContent), templateStatus: waStatusFor(live as WhatsAppContent) },
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
          const steps = await prisma.messageFlowStep.findMany({ where: { flowId, enabled: true } });
          const problems = steps.flatMap((s) => {
            const wa = s.content as WhatsAppContent | null;
            const email = s.channel === "EMAIL" ? s.content : wa?.fallbackToEmail !== false ? wa?.fallbackEmail : null;
            const where = s.channel === "EMAIL" ? `Passo ${s.position + 1}` : `E-mail reserva do passo ${s.position + 1}`;
            return isEmailContent(email) ? emailContentProblems(sanitizeEmailContent(email)).map((p) => `${where}: ${p}`) : [];
          });
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
        let content: Record<string, unknown>;
        if (step.channel === "EMAIL") content = sanitizeEmailContent(body.content);
        else {
          content = { ...(body.content as Record<string, unknown>) };
          if (content.fallbackEmail != null) {
            content.fallbackEmail = isEmailContent(content.fallbackEmail) ? sanitizeEmailContent(content.fallbackEmail) : undefined;
          }
        }
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
      const reserve = step.channel === "WHATSAPP" && body.reserve === true ? (content as WhatsAppContent).fallbackEmail : null;
      if (step.channel === "WHATSAPP" && body.reserve === true && !isEmailContent(reserve)) return bad("Este passo não tem e-mail reserva");
      if (step.channel === "EMAIL" || reserve) {
        if (!email) return bad("Informe o e-mail de teste");
        const r = await sendEmailMessage({
          clienteId: ws,
          contact,
          content: sanitizeEmailContent(reserve ?? content),
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
      } else {
        const wa = step.draftContent as WhatsAppContent;
        if (wa.fallbackToEmail !== false && isEmailContent(wa.fallbackEmail)) {
          const problems = emailContentProblems(sanitizeEmailContent(wa.fallbackEmail));
          if (problems.length) return bad(`Corrija o e-mail reserva: ${problems.join(", ")}`);
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
