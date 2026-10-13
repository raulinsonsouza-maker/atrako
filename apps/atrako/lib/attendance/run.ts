/**
 * O mesmo motor do Atrako, com ferramentas só de atendimento.
 * Não responde mensagem repetida, opt-out, pausa humana, Food ou fora da janela.
 */

import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { resolveModules } from "@/lib/modules/resolve";
import { loadWorkspaceContext } from "@/lib/atrako-agent/context";
import { runAtrakoEngine } from "@/lib/atrako-agent/engine";
import { createLlmClient, resolveLlmChain } from "@/lib/atrako-agent/llm";
import { setCooldown } from "@/lib/atrako-agent/failover";
import { handoffConversation, isWithinCustomerWindow, sendAndPersistText } from "@/lib/whatsapp/domain";
import { attendanceCanQuote, attendanceIsOn, hoursLabel, isWithinAttendanceHours } from "@/lib/attendance/profile";
import { loadAttendance } from "@/lib/attendance/welcome";
import { whatsAppAttendanceTools } from "@/lib/attendance/wa-tools";

const HUMAN_RE =
  /(quero|preciso|pode|chama).{0,30}(atendente|pessoa|humano)|falar com (algu[eé]m|uma pessoa|atendente)|atendente humano/i;

export async function handleAttendanceInbound(input: {
  workspaceId: string;
  conversationId: string;
  contactId: string;
  leadId: string;
  phone: string;
  body: string | null;
}) {
  const text = (input.body ?? "").trim();
  if (!text || text.startsWith("[")) return;

  const { profile, timezone } = await loadAttendance(input.workspaceId);
  if (!attendanceIsOn(profile)) return;

  const [contact, conversation] = await Promise.all([
    prisma.nativeContact.findFirst({
      where: { id: input.contactId, clienteId: input.workspaceId },
      select: { waOptOutAt: true, name: true },
    }),
    prisma.waConversation.findFirst({
      where: { id: input.conversationId, clienteId: input.workspaceId },
      select: { status: true, windowExpiresAt: true },
    }),
  ]);
  if (!contact || contact.waOptOutAt) return;
  if (!conversation || conversation.status === "HANDED_OFF") return;
  if (!isWithinCustomerWindow(conversation.windowExpiresAt)) return;

  if (HUMAN_RE.test(text)) {
    await handoffConversation(input.conversationId, input.workspaceId);
    await sendAndPersistText({
      workspaceId: input.workspaceId,
      to: input.phone,
      body: "Vou chamar alguém da equipe para continuar com você.",
      contactId: input.contactId,
      contactName: contact.name,
    });
    await notify({
      clienteId: input.workspaceId,
      role: "ADMIN",
      type: "wa.handoff",
      title: "Lead pediu uma pessoa no WhatsApp",
      body: text.slice(0, 300),
      href: "/whatsapp",
      severity: "aviso",
      dedupeKey: `wa-human:${input.conversationId}`,
      email: false,
    });
    return;
  }

  if (!isWithinAttendanceHours(profile, timezone)) {
    const hours = hoursLabel(profile);
    await sendAndPersistText({
      workspaceId: input.workspaceId,
      to: input.phone,
      body: hours
        ? `Recebi sua mensagem. Nosso horário de atendimento é ${hours}.`
        : "Recebi sua mensagem. Retornamos no horário de atendimento.",
      contactId: input.contactId,
      contactName: contact.name,
    });
    return;
  }

  const chain = await resolveLlmChain(input.workspaceId);
  if (!chain.configured || chain.candidates.length === 0) {
    await notify({
      clienteId: input.workspaceId,
      role: "ADMIN",
      type: "wa.agent_no_ai",
      title: "Atendimento no WhatsApp parado: falta a IA",
      body: "Conecte um modelo em Configurações → IA.",
      href: "/config/ia",
      severity: "aviso",
      dedupeKey: `wa-agent-no-ai:${input.workspaceId}`,
      email: false,
    });
    return;
  }

  const ctx = await loadWorkspaceContext({
    clienteId: input.workspaceId,
    actor: { kind: "member", key: "whatsapp-agent", name: "WhatsApp", role: "OPERATOR", canManage: false },
    modules: await resolveModules(input.workspaceId),
  });
  if (!ctx) return;

  const historyRows = await prisma.waMessage.findMany({
    where: { conversationId: input.conversationId, clienteId: input.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { direction: true, body: true },
  });
  const history = historyRows
    .reverse()
    .slice(0, -1)
    .filter((row) => row.body && !row.body.startsWith("["))
    .map((row) => ({
      role: row.direction === "OUTBOUND" ? ("assistant" as const) : ("user" as const),
      content: (row.body ?? "").slice(0, 1500),
    }));

  const stages = await prisma.crmStage.findMany({
    where: { pipeline: { clienteId: input.workspaceId } },
    orderBy: { order: "asc" },
    select: { name: true, role: true },
  });
  const openStages = stages
    .filter((s) => !s.role || !/^(WON|LOST|ABANDONED)/.test(s.role))
    .map((s) => s.name);
  const quote = attendanceCanQuote(profile);

  let answer = "";
  try {
    const result = await runAtrakoEngine({
      candidates: chain.candidates,
      makeClient: createLlmClient,
      onFailover: (candidate, failure) => {
        void setCooldown(candidate.key, failure);
      },
      ctx,
      tools: whatsAppAttendanceTools(),
      history,
      question: text.slice(0, 2000),
      attendance: {
        leadId: input.leadId,
        conversationId: input.conversationId,
        phone: input.phone,
        contactId: input.contactId,
      },
      instructions: [
        "Você está no WhatsApp, falando com um lead. Responda em texto curto, sem markdown, como uma mensagem de conversa.",
        "Use a ficha de atendimento. Se ela estiver vazia, use o contexto comercial e não invente o que a empresa não disse.",
        quote
          ? "Você pode citar o preço que está na ficha ou na oferta. Não invente outro valor, desconto ou prazo."
          : "Não cite preço, valor ou parcela. Se pedirem preço, chame passar_para_pessoa.",
        profile.mode === "sell"
          ? "Se a pessoa quiser comprar e a oferta existir, chame enviar_checkout. Nunca marque Ganho: só o pagamento confirmado fecha a venda."
          : "Seu trabalho é o primeiro atendimento: entenda a necessidade, anote e mova o card. Não envie checkout.",
        openStages.length ? `Etapas abertas para mover_estagio: ${openStages.join(", ")}.` : "",
        "Quando a pessoa pedir um humano, ou quando você não souber, chame passar_para_pessoa.",
      ]
        .filter(Boolean)
        .join("\n"),
      timeoutMs: 25_000,
      maxRounds: 4,
      maxOutputTokens: 400,
    });
    answer = result.answer.trim();
  } catch (err) {
    console.warn("[attendance] agente", err instanceof Error ? err.message : err);
    return;
  }
  if (!answer) return;
  const still = await prisma.waConversation.findFirst({
    where: { id: input.conversationId, clienteId: input.workspaceId },
    select: { status: true, windowExpiresAt: true },
  });
  if (!still || still.status === "HANDED_OFF" || !isWithinCustomerWindow(still.windowExpiresAt)) return;
  await sendAndPersistText({
    workspaceId: input.workspaceId,
    to: input.phone,
    body: answer.slice(0, 4000),
    contactId: input.contactId,
    contactName: contact.name,
  });
}
