import { prisma } from "@/lib/db-social";
import { recordConversion } from "@/lib/symbius/conversions";
import { fireOutboundWebhook } from "@/lib/symbius/integrations";
import { assignConversaRoundRobin } from "@/lib/symbius/inboxAssign";
import { saveContactEmail } from "./commentDmFlow";
import {
  advanceConversation,
  conversationFromConfig,
  conversationStepPayload,
  type Conversation,
  type ConversationAdvance,
  type ConversationWait,
} from "./conversation";
import { DIRECT_LINK_THANKS } from "./directCopy";
import { directLinkUrl, safeHttpUrl, type DmLinkPayload } from "./dmLinkToken";
import {
  isWithin24hWindow,
  replyToInstagramComment,
  sendInstagramMessage,
  type MessageButton,
} from "./messagingClient";
import { queueInstagramWorkspaceLead } from "./workspaceLead";

type Account = { id: string; igUserId: string; accessToken: string; scopes?: string | null };

type Run = {
  fluxoId: string;
  organizationId: string;
  igAccount: Account;
  contatoId: string;
  igsid: string;
  conversation: Conversation;
  commentId?: string;
};

function thanksSent(ctx: Record<string, unknown>): string[] {
  return Array.isArray(ctx.linkThanksSteps) ? ctx.linkThanksSteps.map((item) => String(item)) : [];
}

async function deliver(run: Run, result: ConversationAdvance, commentId?: string) {
  const outbound = result.send;
  if (!outbound || (!outbound.text.trim() && outbound.buttons.length === 0)) return;
  const buttons: MessageButton[] = outbound.buttons.map((button) => {
    if (button.type === "web_url") {
      let url = button.url;
      try {
        url = directLinkUrl({
          fluxoId: run.fluxoId,
          contatoId: run.contatoId,
          index: 0,
          url: button.url,
          stepId: button.stepId,
        });
      } catch (error) {
        console.warn("[instagram] link rastreado indisponível:", error instanceof Error ? error.message : error);
      }
      return { type: "web_url", title: button.title, url };
    }
    return {
      type: "postback",
      title: button.title,
      payload: conversationStepPayload(run.fluxoId, button.stepId),
    };
  });
  const sent = await sendInstagramMessage({
    igUserId: run.igAccount.igUserId,
    accessToken: run.igAccount.accessToken,
    scopes: run.igAccount.scopes,
    recipientIgsid: run.igsid,
    commentId,
    text: outbound.text,
    buttons,
  });
  const open = await prisma.igConversa.findFirst({
    where: { contatoId: run.contatoId, status: "OPEN" },
    orderBy: { updatedAt: "desc" },
  });
  const conversa =
    open ??
    (await prisma.igConversa.create({
      data: {
        organizationId: run.organizationId,
        igAccountId: run.igAccount.id,
        contatoId: run.contatoId,
        status: "OPEN",
        lastMessageAt: new Date(),
      },
    }));
  if (outbound.text.trim()) {
    await prisma.igMensagem.create({
      data: {
        organizationId: run.organizationId,
        conversaId: conversa.id,
        direction: "OUTBOUND",
        mid: sent.message_id,
        texto: outbound.text,
        isEcho: true,
      },
    });
  }
  await prisma.igConversa.update({
    where: { id: conversa.id },
    data: { lastMessageAt: new Date() },
  });
}

async function remember(run: Run, result: ConversationAdvance, previous?: Record<string, unknown>) {
  const context = {
    conversation: true,
    stepId: result.stepId,
    wait: result.wait,
    linkThanksSteps: thanksSent(previous ?? {}),
  };
  const open = await prisma.igFluxoExecucao.findFirst({
    where: {
      fluxoId: run.fluxoId,
      contatoId: run.contatoId,
      organizationId: run.organizationId,
      status: { in: ["RUNNING", "WAITING"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (open) {
    await prisma.igFluxoExecucao.update({
      where: { id: open.id },
      data: { status: result.status, context: context as object },
    });
    return;
  }
  await prisma.igFluxoExecucao.create({
    data: {
      organizationId: run.organizationId,
      fluxoId: run.fluxoId,
      contatoId: run.contatoId,
      status: result.status,
      context: context as object,
    },
  });
}

async function qualify(run: Run, result: ConversationAdvance) {
  const capture = result.capture;
  if (!capture) return;
  const contato = await prisma.igContato.findUnique({ where: { id: run.contatoId } });
  if (!contato) return;
  if (capture.field === "phone") {
    await prisma.igContato.update({
      where: { id: run.contatoId },
      data: { phone: capture.value },
    });
    await recordConversion({
      organizationId: run.organizationId,
      tipo: "phone_captured",
      contatoId: run.contatoId,
      fluxoId: run.fluxoId,
    });
    void import("./workspaceLead").then(({ openInstagramWorkspaceLead }) =>
      openInstagramWorkspaceLead({
        organizationId: run.organizationId,
        igContatoId: run.contatoId,
        phone: capture.value,
        username: contato.username,
        nome: contato.nome,
      }),
    );
    const { appendGoogleSheetRow } = await import("@/lib/symbius/integrations");
    void appendGoogleSheetRow(run.organizationId, {
      phone: capture.value,
      nome: contato.nome ?? "",
      username: contato.username ?? "",
      email: "",
      source: "fluxo_phone",
      at: new Date().toISOString(),
    });
    return;
  }
  await saveContactEmail(run.contatoId, capture.value, run.fluxoId);
}

async function handoff(run: Run) {
  await prisma.igContato.update({
    where: { id: run.contatoId },
    data: { botPaused: true },
  });
  const open = await prisma.igConversa.findFirst({
    where: { contatoId: run.contatoId, status: "OPEN" },
    orderBy: { updatedAt: "desc" },
  });
  const conversa =
    open ??
    (await prisma.igConversa.create({
      data: {
        organizationId: run.organizationId,
        igAccountId: run.igAccount.id,
        contatoId: run.contatoId,
        status: "OPEN",
        lastMessageAt: new Date(),
      },
    }));
  await prisma.igConversa.update({
    where: { id: conversa.id },
    data: { handoffHuman: true },
  });
  await assignConversaRoundRobin(run.organizationId, conversa.id);
  await recordConversion({
    organizationId: run.organizationId,
    tipo: "handoff",
    contatoId: run.contatoId,
    fluxoId: run.fluxoId,
  });
  void fireOutboundWebhook(run.organizationId, "admin.notify", {
    subject: "Handoff humano",
    body: `Conversa ${conversa.id} aguardando atendimento`,
  });
}

async function apply(run: Run, result: ConversationAdvance, previous?: Record<string, unknown>, commentId?: string) {
  await qualify(run, result);
  try {
    await deliver(run, result, commentId);
  } catch (error) {
    console.warn("[instagram] conversa:", error instanceof Error ? error.message : error);
  }
  if (result.handoff) await handoff(run);
  await remember(run, result, previous);
}

function runFrom(params: Omit<Run, "conversation"> & { conversation: Conversation }): Run {
  return params;
}

export async function startIgConversation(params: {
  fluxoId: string;
  organizationId: string;
  igAccount: Account;
  contatoId: string;
  igsid: string;
  cfg: Record<string, unknown>;
  commentId?: string;
  requireWindow: boolean;
  lastInteractionAt: Date | null;
}): Promise<boolean> {
  const conversation = conversationFromConfig(params.cfg);
  if (!conversation) return false;
  const open = await prisma.igFluxoExecucao.findFirst({
    where: {
      fluxoId: params.fluxoId,
      contatoId: params.contatoId,
      organizationId: params.organizationId,
      status: { in: ["RUNNING", "WAITING"] },
    },
  });
  if (open) return true;
  if (params.requireWindow && !isWithin24hWindow(params.lastInteractionAt)) return true;

  const replies = Array.isArray(params.cfg.publicReplies)
    ? params.cfg.publicReplies.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
    : [];
  if (params.commentId && (params.cfg.replyToComment === true || replies.length > 0)) {
    const message = replies.length ? replies[Math.floor(Math.random() * replies.length)] : "✓";
    try {
      await replyToInstagramComment({
        commentId: params.commentId,
        accessToken: params.igAccount.accessToken,
        scopes: params.igAccount.scopes,
        message,
      });
    } catch (error) {
      console.warn("[instagram] comment reply failed:", error instanceof Error ? error.message : error);
    }
  }

  const result = advanceConversation({ conversation, stepId: null, wait: null, event: { kind: "start" } });
  if (!result) return false;
  const run = runFrom({ ...params, conversation });
  await apply(run, result, undefined, params.commentId);
  queueInstagramWorkspaceLead(params.organizationId, params.contatoId, params.commentId ? "comment" : "dm");
  await recordConversion({
    organizationId: params.organizationId,
    tipo: "fluxo_started",
    contatoId: params.contatoId,
    fluxoId: params.fluxoId,
  });
  return true;
}

export async function continueIgConversationButton(params: {
  organizationId: string;
  igAccount: Account;
  contatoId: string;
  igsid: string;
  fluxoId: string;
  stepId: string;
}): Promise<boolean> {
  const fluxo = await prisma.igFluxo.findFirst({
    where: { id: params.fluxoId, organizationId: params.organizationId, status: "PUBLISHED" },
  });
  const conversation = conversationFromConfig(fluxo?.triggerConfig);
  if (!fluxo || !conversation) return false;
  const exec = await prisma.igFluxoExecucao.findFirst({
    where: { fluxoId: fluxo.id, contatoId: params.contatoId, organizationId: params.organizationId },
    orderBy: { updatedAt: "desc" },
  });
  const ctx = (exec?.context ?? {}) as Record<string, unknown>;
  const result = advanceConversation({
    conversation,
    stepId: typeof ctx.stepId === "string" ? ctx.stepId : null,
    wait: (ctx.wait as ConversationWait) ?? null,
    event: { kind: "goto", stepId: params.stepId },
  });
  if (!result) return false;
  await apply(runFrom({ ...params, conversation, fluxoId: fluxo.id }), result, ctx);
  return true;
}

export async function continueIgConversationText(params: {
  organizationId: string;
  igAccount: Account;
  contatoId: string;
  igsid: string;
  fluxoId: string;
  stepId: string | null;
  wait: ConversationWait | null;
  text: string;
  context: Record<string, unknown>;
}): Promise<boolean> {
  const fluxo = await prisma.igFluxo.findFirst({
    where: { id: params.fluxoId, organizationId: params.organizationId, status: "PUBLISHED" },
  });
  const conversation = conversationFromConfig(fluxo?.triggerConfig);
  if (!fluxo || !conversation) return false;
  const result = advanceConversation({
    conversation,
    stepId: params.stepId,
    wait: params.wait,
    event: { kind: "text", text: params.text },
  });
  if (!result) return false;
  await apply(runFrom({ ...params, conversation, fluxoId: fluxo.id }), result, params.context);
  return true;
}

export async function continueIgConversationAfterLink(payload: DmLinkPayload): Promise<void> {
  const target = safeHttpUrl(payload.u);
  if (!payload.s || !target) return;
  const fluxo = await prisma.igFluxo.findFirst({
    where: { id: payload.f, status: "PUBLISHED" },
  });
  const conversation = conversationFromConfig(fluxo?.triggerConfig);
  const step = conversation?.steps.find((item) => item.id === payload.s && item.type === "link");
  if (!fluxo || !conversation || !step || step.type !== "link") return;

  const contato = await prisma.igContato.findFirst({
    where: { id: payload.c, organizationId: fluxo.organizationId },
    include: { igAccount: true },
  });
  if (!contato || contato.botPaused || !isWithin24hWindow(contato.lastInteractionAt)) return;

  const exec = await prisma.igFluxoExecucao.findFirst({
    where: { fluxoId: fluxo.id, contatoId: contato.id, organizationId: fluxo.organizationId },
    orderBy: { updatedAt: "desc" },
  });
  const ctx = (exec?.context ?? {}) as Record<string, unknown>;
  const sent = thanksSent(ctx);
  if (sent.includes(step.id)) return;

  const thanks = step.thanks.trim() || DIRECT_LINK_THANKS;
  const run = runFrom({
    fluxoId: fluxo.id,
    organizationId: fluxo.organizationId,
    igAccount: contato.igAccount,
    contatoId: contato.id,
    igsid: contato.igsid,
    conversation,
  });
  try {
    await deliver(run, { send: { text: thanks, buttons: [] }, repeat: false, wait: null, stepId: step.id, capture: null, handoff: false, status: "WAITING" });
  } catch (error) {
    console.warn("[instagram] obrigado do link:", error instanceof Error ? error.message : error);
  }

  const marked = [...sent, step.id];
  if (step.goTo) {
    const result = advanceConversation({
      conversation,
      stepId: step.id,
      wait: "link",
      event: { kind: "goto", stepId: step.goTo },
    });
    if (result) {
      await apply(run, result, { ...ctx, linkThanksSteps: marked });
      return;
    }
  }
  if (exec) {
    await prisma.igFluxoExecucao.update({
      where: { id: exec.id },
      data: {
        status: "COMPLETED",
        context: { ...ctx, conversation: true, linkThanksSteps: marked } as object,
      },
    });
  }
}
