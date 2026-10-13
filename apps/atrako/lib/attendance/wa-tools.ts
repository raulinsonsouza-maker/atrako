/**
 * Ferramentas só do atendimento no WhatsApp.
 * O agente dentro do Atrako não recebe este conjunto.
 */

import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { addLeadNote, isLostStage, isWonStage, updateLeadStage } from "@/lib/modules/crm";
import { handoffConversation, sendAndPersistCta } from "@/lib/whatsapp/domain";
import type { AtrakoTool, ToolResult } from "@/lib/atrako-agent/tools";
import { objectSchema } from "@/lib/atrako-agent/tools";
import { rememberCheckout, resolveAttendanceCheckout } from "@/lib/attendance/checkout";
import { attendanceFromPrefs, attendanceIsOn } from "@/lib/attendance/profile";

function ok(data: unknown, label: string): ToolResult {
  return { data, coverage: "available", source: { tool: label, label } };
}

function fail(reason: string, label: string): ToolResult {
  return { data: { ok: false, reason }, coverage: "empty", source: { tool: label, label } };
}

export function whatsAppAttendanceTools(): AtrakoTool[] {
  return [
    {
      name: "anotar_lead",
      step: "Anotando no card",
      description: "Grava uma nota curta no card do lead que está nesta conversa.",
      risk: "WRITE",
      parameters: objectSchema({
        texto: { type: "string", description: "O que ficou combinado ou o que o lead disse." },
      }),
      async run(args, rt) {
        const leadId = rt.attendance?.leadId;
        const text = typeof args.texto === "string" ? args.texto : "";
        if (!leadId) return fail("sem_lead", "Nota");
        await addLeadNote({ workspaceId: rt.ctx.clienteId, leadId, text });
        return ok({ ok: true }, "Nota");
      },
    },
    {
      name: "mover_estagio",
      step: "Movendo o card",
      description:
        "Move o card para uma etapa aberta do funil (Qualificado, Em conversa, Proposta). Não marca Ganho nem Perdido.",
      risk: "WRITE",
      parameters: objectSchema({
        etapa: { type: "string", description: "Nome exato da etapa aberta." },
      }),
      async run(args, rt) {
        const leadId = rt.attendance?.leadId;
        const name = typeof args.etapa === "string" ? args.etapa.trim() : "";
        if (!leadId || !name) return fail("etapa_invalida", "Funil");
        const stages = await prisma.crmStage.findMany({
          where: { pipeline: { clienteId: rt.ctx.clienteId } },
        });
        const stage = stages.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (!stage || isWonStage(stage) || isLostStage(stage)) return fail("etapa_fechada", "Funil");
        await updateLeadStage({ workspaceId: rt.ctx.clienteId, leadId, stageId: stage.id });
        return ok({ ok: true, etapa: stage.name }, "Funil");
      },
    },
    {
      name: "enviar_checkout",
      step: "Enviando o checkout",
      description:
        "Envia o link de pagamento configurado. Só no modo de fechar a venda, e só se houver oferta com valor. Não marca o card como Ganho.",
      risk: "WRITE",
      parameters: objectSchema({}),
      async run(_args, rt) {
        const attendance = rt.attendance;
        if (!attendance) return fail("sem_conversa", "Checkout");
        const settings = await prisma.workspaceSettings.findUnique({
          where: { clienteId: rt.ctx.clienteId },
          select: { messagingPrefs: true },
        });
        const profile = attendanceFromPrefs(settings?.messagingPrefs);
        if (!attendanceIsOn(profile) || profile.mode !== "sell") return fail("modo_sem_venda", "Checkout");
        const resolved = await resolveAttendanceCheckout({
          workspaceId: rt.ctx.clienteId,
          leadId: attendance.leadId,
          profile,
        });
        if (!resolved.ok) return fail(resolved.reason, "Checkout");
        await rememberCheckout({ leadId: attendance.leadId, link: resolved.link });
        await sendAndPersistCta({
          workspaceId: rt.ctx.clienteId,
          to: attendance.phone,
          body: `Segue o link para concluir: ${resolved.link.label}.`,
          buttonText: "Abrir",
          url: resolved.link.url,
          contactId: attendance.contactId,
        });
        return ok(
          {
            ok: true,
            label: resolved.link.label,
            amount: resolved.link.amount,
            url: resolved.link.url,
          },
          "Checkout",
        );
      },
    },
    {
      name: "passar_para_pessoa",
      step: "Passando para uma pessoa",
      description: "Para de responder sozinho e avisa o time. Use quando a pessoa pedir um atendente ou quando faltar preço.",
      risk: "WRITE",
      parameters: objectSchema({
        motivo: { type: "string", description: "Por que a conversa foi passada." },
      }),
      async run(args, rt) {
        const attendance = rt.attendance;
        if (!attendance) return fail("sem_conversa", "Atendimento");
        await handoffConversation(attendance.conversationId, rt.ctx.clienteId);
        const motivo = typeof args.motivo === "string" ? args.motivo.slice(0, 300) : "";
        await notify({
          clienteId: rt.ctx.clienteId,
          role: "ADMIN",
          type: "wa.handoff",
          title: "WhatsApp pediu uma pessoa",
          body: motivo || "O agente passou a conversa.",
          href: "/whatsapp",
          severity: "aviso",
          dedupeKey: `wa-agent-handoff:${attendance.conversationId}`,
          email: false,
        });
        return ok({ ok: true }, "Atendimento");
      },
    },
  ];
}
