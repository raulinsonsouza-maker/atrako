import { prisma } from "@/lib/db-social";
import {
  buildLinkTrackingUrl,
  contactClickedRewardLink,
} from "@/lib/symbius/linkTracking";
import { fetchIgUserMedia } from "./metaOAuth";
import {
  fetchIgScopedUserFollowStatus,
  followConfirmPayload,
  looksLikeEmail,
  sendInstagramMessage,
  type MessageButton,
} from "./messagingClient";

export type CommentDmTriggerConfig = Record<string, unknown>;

export async function enrichCommentDmTriggerConfig(
  organizationId: string,
  config: CommentDmTriggerConfig,
): Promise<CommentDmTriggerConfig> {
  const next = { ...config };
  if (String(config.mediaFilter) !== "next") return next;

  const account = await prisma.igAccount.findFirst({
    where: { organizationId, status: "CONNECTED" },
    orderBy: { createdAt: "desc" },
  });
  if (!account) {
    next.baselineMediaIds = [];
    return next;
  }

  const result = await fetchIgUserMedia({
    accessToken: account.accessToken,
    storedIgUserId: account.igUserId,
    limit: 50,
  });
  next.baselineMediaIds = result.media.map((m) => m.id);
  next.consumedNextMediaId = null;
  return next;
}

export function matchesCommentMediaFilter(
  triggerConfig: Record<string, unknown>,
  mediaId: string,
): boolean {
  const filter = String(triggerConfig.mediaFilter ?? "any");
  if (filter === "any") return true;
  if (filter === "specific") {
    return String(triggerConfig.mediaId ?? "") === mediaId;
  }
  if (filter === "next") {
    const baseline = (triggerConfig.baselineMediaIds as string[]) ?? [];
    const consumed = String(triggerConfig.consumedNextMediaId ?? "");
    if (!mediaId || baseline.includes(mediaId)) return false;
    if (consumed && consumed !== mediaId) return false;
    return true;
  }
  return true;
}

export async function markNextPostConsumed(
  fluxoId: string,
  mediaId: string,
): Promise<void> {
  const fluxo = await prisma.igFluxo.findUnique({ where: { id: fluxoId } });
  if (!fluxo) return;
  const cfg = fluxo.triggerConfig as Record<string, unknown>;
  if (String(cfg.mediaFilter) !== "next") return;
  await prisma.igFluxo.update({
    where: { id: fluxoId },
    data: {
      triggerConfig: {
        ...cfg,
        mediaFilter: "specific",
        mediaId,
        consumedNextMediaId: mediaId,
      } as object,
    },
  });
}

async function persistOutbound(
  organizationId: string,
  igAccountId: string,
  contatoId: string,
  messageId: string | undefined,
  text: string,
) {
  const conversa = await prisma.igConversa.findFirst({
    where: { contatoId, status: "OPEN" },
    orderBy: { updatedAt: "desc" },
  });
  const conv =
    conversa ??
    (await prisma.igConversa.create({
      data: {
        organizationId,
        igAccountId,
        contatoId,
        status: "OPEN",
        lastMessageAt: new Date(),
      },
    }));
  await prisma.igMensagem.create({
    data: {
      organizationId,
      conversaId: conv.id,
      direction: "OUTBOUND",
      mid: messageId ?? undefined,
      texto: text,
      isEcho: true,
    },
  });
}

type FlowStepParams = {
  fluxoId: string;
  organizationId: string;
  igAccount: { id: string; igUserId: string; accessToken: string; scopes?: string | null };
  contatoId: string;
  igsid: string;
  cfg: CommentDmTriggerConfig;
  reminderExecId?: string;
};

async function scheduleReminderExec(
  params: FlowStepParams,
): Promise<string | null> {
  if (params.cfg.welcomeEnabled === false) return null;
  if (params.cfg.reminderEnabled !== true) return null;
  const minutes = Number(params.cfg.reminderMinutes ?? 30);
  if (minutes <= 0) return null;

  const rewardUrl = rewardLinksFromConfig(params.cfg)[0]?.url ?? "";
  if (!rewardUrl) return null;

  const exec = await prisma.igFluxoExecucao.create({
    data: {
      organizationId: params.organizationId,
      fluxoId: params.fluxoId,
      contatoId: params.contatoId,
      status: "WAITING",
      scheduledAt: new Date(Date.now() + minutes * 60 * 1000),
      context: {
        step: "reminder",
        fluxoId: params.fluxoId,
        linkClicked: false,
        rewardUrl,
      } as object,
    },
  });
  return exec.id;
}

function resolveTrackedRewardUrl(
  params: FlowStepParams,
  reminderExecId: string | null,
  rewardUrl: string,
): string {
  if (!rewardUrl) return "";
  if (!reminderExecId) return rewardUrl;
  return buildLinkTrackingUrl({
    contatoId: params.contatoId,
    fluxoId: params.fluxoId,
    reminderExecId,
    destination: rewardUrl,
  });
}

export async function shouldSkipReminderExec(params: {
  execId: string;
  contatoId: string;
  fluxoId: string;
}): Promise<boolean> {
  const exec = await prisma.igFluxoExecucao.findUnique({
    where: { id: params.execId },
  });
  if (!exec) return true;

  const ctx = exec.context as Record<string, unknown>;
  if (ctx.linkClicked === true) return true;

  const contato = await prisma.igContato.findUnique({
    where: { id: params.contatoId },
  });
  if (!contato) return false;

  return contactClickedRewardLink(contato.tags, params.fluxoId);
}

export function rewardLinksFromConfig(cfg: CommentDmTriggerConfig): Array<{ label: string; url: string }> {
  const raw = cfg.rewardLinks;
  if (Array.isArray(raw)) {
    const links = raw
      .map((item) => {
        const row = item as { label?: string; url?: string };
        const url = String(row?.url ?? "").trim();
        const label = String(row?.label ?? "").trim() || "Acessar";
        return url ? { label, url } : null;
      })
      .filter((item): item is { label: string; url: string } => Boolean(item))
      .slice(0, 3);
    if (links.length) return links;
  }
  const url = String(cfg.rewardUrl ?? "").trim();
  if (!url) return [];
  return [{ label: String(cfg.rewardButton ?? "Acessar").trim() || "Acessar", url }];
}

export async function retireOtherNextPostFlows(organizationId: string, keepId: string) {
  const others = await prisma.igFluxo.findMany({
    where: {
      organizationId,
      status: "PUBLISHED",
      triggerType: "comment_keyword",
      NOT: { id: keepId },
    },
    select: { id: true, triggerConfig: true },
  });
  for (const fluxo of others) {
    const cfg = fluxo.triggerConfig as Record<string, unknown>;
    if (String(cfg.mediaFilter) !== "next") continue;
    await prisma.igFluxo.update({
      where: { id: fluxo.id },
      data: { status: "DRAFT" },
    });
  }
}

async function userFollowsBusiness(params: FlowStepParams): Promise<boolean | null> {
  const status = await fetchIgScopedUserFollowStatus({
    igsid: params.igsid,
    accessToken: params.igAccount.accessToken,
    scopes: params.igAccount.scopes,
  });
  if (!status) return null;
  if (status.username) {
    await prisma.igContato.update({
      where: { id: params.contatoId },
      data: { username: status.username },
    });
  }
  return status.follows;
}

export async function findAwaitingFollowExec(contatoId: string) {
  const pending = await prisma.igFluxoExecucao.findMany({
    where: { contatoId, status: "WAITING" },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return pending.find((e) => {
    const ctx = e.context as Record<string, unknown>;
    return ctx.step === "awaiting_follow";
  });
}

async function ensureAwaitingFollowExec(params: FlowStepParams) {
  const existing = await findAwaitingFollowExec(params.contatoId);
  if (existing) {
    if (existing.fluxoId !== params.fluxoId) {
      await prisma.igFluxoExecucao.update({
        where: { id: existing.id },
        data: {
          fluxoId: params.fluxoId,
          context: { step: "awaiting_follow", fluxoId: params.fluxoId } as object,
        },
      });
    }
    return existing;
  }
  return prisma.igFluxoExecucao.create({
    data: {
      organizationId: params.organizationId,
      fluxoId: params.fluxoId,
      contatoId: params.contatoId,
      status: "WAITING",
      context: { step: "awaiting_follow", fluxoId: params.fluxoId } as object,
    },
  });
}

async function completeAwaitingFollowExec(contatoId: string, fluxoId: string) {
  const pending = await findAwaitingFollowExec(contatoId);
  if (pending && pending.fluxoId === fluxoId) {
    await prisma.igFluxoExecucao.update({
      where: { id: pending.id },
      data: { status: "COMPLETED" },
    });
  }
}

async function advanceAfterFollowGate(params: FlowStepParams) {
  await sendRewardStep(params);
}

export async function sendFollowStep(params: FlowStepParams): Promise<void> {
  const text = String(
    params.cfg.followText ??
      "Obrigado pelo interesse! 💞 Este conteúdo exclusivo é apenas para seguidores. Siga a página que enviarei o link imediatamente!",
  );
  const button = String(params.cfg.followButton ?? "Já sigo");
  const sent = await sendInstagramMessage({
    igUserId: params.igAccount.igUserId,
    accessToken: params.igAccount.accessToken,
    scopes: params.igAccount.scopes,
    recipientIgsid: params.igsid,
    text,
    buttons: [
      {
        type: "postback",
        title: button,
        payload: followConfirmPayload(params.fluxoId),
      },
    ],
  });
  await persistOutbound(
    params.organizationId,
    params.igAccount.id,
    params.contatoId,
    sent.message_id,
    text,
  );
  await ensureAwaitingFollowExec(params);
}

export async function sendFollowNotYetStep(params: FlowStepParams): Promise<void> {
  const text = String(
    params.cfg.followNotYetText ??
      "Quase lá! Ainda não te encontrei como seguidor. Siga nosso perfil e toque em “Já sigo” novamente 👇",
  );
  const button = String(params.cfg.followButton ?? "Já sigo");
  const sent = await sendInstagramMessage({
    igUserId: params.igAccount.igUserId,
    accessToken: params.igAccount.accessToken,
    scopes: params.igAccount.scopes,
    recipientIgsid: params.igsid,
    text,
    buttons: [
      {
        type: "postback",
        title: button,
        payload: followConfirmPayload(params.fluxoId),
      },
    ],
  });
  await persistOutbound(
    params.organizationId,
    params.igAccount.id,
    params.contatoId,
    sent.message_id,
    text,
  );
}

export async function sendEmailRequestStep(params: FlowStepParams): Promise<void> {
  const text = String(
    params.cfg.emailText ??
      "Diga-me qual é seu e-mail para receber o link!",
  );
  const sent = await sendInstagramMessage({
    igUserId: params.igAccount.igUserId,
    accessToken: params.igAccount.accessToken,
    scopes: params.igAccount.scopes,
    recipientIgsid: params.igsid,
    text,
  });
  await persistOutbound(
    params.organizationId,
    params.igAccount.id,
    params.contatoId,
    sent.message_id,
    text,
  );
  await ensureAwaitingEmailExec(params);
}

export async function sendEmailInvalidStep(params: FlowStepParams): Promise<void> {
  const text = String(
    params.cfg.emailInvalidText ??
      "Hmm, não reconheci esse e-mail. Envie um endereço válido (ex.: nome@gmail.com) 📧",
  );
  const sent = await sendInstagramMessage({
    igUserId: params.igAccount.igUserId,
    accessToken: params.igAccount.accessToken,
    scopes: params.igAccount.scopes,
    recipientIgsid: params.igsid,
    text,
  });
  await persistOutbound(
    params.organizationId,
    params.igAccount.id,
    params.contatoId,
    sent.message_id,
    text,
  );
}

async function ensureAwaitingEmailExec(params: FlowStepParams) {
  const existing = await findAwaitingEmailExec(params.contatoId);
  if (existing) {
    if (existing.fluxoId !== params.fluxoId) {
      await prisma.igFluxoExecucao.update({
        where: { id: existing.id },
        data: {
          fluxoId: params.fluxoId,
          context: { step: "awaiting_email", fluxoId: params.fluxoId } as object,
        },
      });
    }
    return existing;
  }
  return prisma.igFluxoExecucao.create({
    data: {
      organizationId: params.organizationId,
      fluxoId: params.fluxoId,
      contatoId: params.contatoId,
      status: "WAITING",
      context: { step: "awaiting_email", fluxoId: params.fluxoId } as object,
    },
  });
}

export async function sendRewardStep(params: FlowStepParams): Promise<void> {
  const links = rewardLinksFromConfig(params.cfg);
  void import("./workspaceLead").then(({ openInstagramWorkspaceLead }) =>
    openInstagramWorkspaceLead({
      organizationId: params.organizationId,
      igContatoId: params.contatoId,
      rewardUrl: links[0]?.url ?? "",
    }),
  );
  const rewardText = String(params.cfg.rewardText ?? "Aqui está o seu acesso").trim() || "Aqui está o seu acesso";

  const reminderExecId =
    params.reminderExecId ?? (await scheduleReminderExec(params));
  const buttons: MessageButton[] = links.map((link) => ({
    type: "web_url" as const,
    title: link.label,
    url: resolveTrackedRewardUrl(params, reminderExecId, link.url),
  }));

  const text = buttons.length === 0 ? rewardText : rewardText;

  const sent = await sendInstagramMessage({
    igUserId: params.igAccount.igUserId,
    accessToken: params.igAccount.accessToken,
    scopes: params.igAccount.scopes,
    recipientIgsid: params.igsid,
    text,
    buttons: buttons.length ? buttons : undefined,
  });
  await persistOutbound(
    params.organizationId,
    params.igAccount.id,
    params.contatoId,
    sent.message_id,
    text,
  );
}

export async function sendReminderStep(params: FlowStepParams): Promise<void> {
  const text = String(
    params.cfg.reminderText ??
      "Se ainda estiver curiosa, não esqueça de tocar no link ⬇️ Acho que você irá adorar ❤️",
  );
  const rewardButton = String(params.cfg.rewardButton ?? "Abrir");
  const rewardUrl = String(params.cfg.rewardUrl ?? "").trim();

  const buttons: MessageButton[] = [];
  if (rewardUrl) {
    buttons.push({ type: "web_url", title: rewardButton, url: rewardUrl });
  }

  const sent = await sendInstagramMessage({
    igUserId: params.igAccount.igUserId,
    accessToken: params.igAccount.accessToken,
    scopes: params.igAccount.scopes,
    recipientIgsid: params.igsid,
    text,
    buttons: buttons.length ? buttons : undefined,
  });
  await persistOutbound(
    params.organizationId,
    params.igAccount.id,
    params.contatoId,
    sent.message_id,
    text,
  );
}

/** Após clicar no botão de boas-vindas: e-mail, depois seguir, depois o link. */
export async function advanceCommentDmAfterWelcomeClick(
  params: FlowStepParams,
): Promise<void> {
  if (params.cfg.emailEnabled === true) {
    await sendEmailRequestStep(params);
    return;
  }
  if (params.cfg.followEnabled === true) {
    const follows = await userFollowsBusiness(params);
    if (follows === true) {
      await sendRewardStep(params);
      return;
    }
    await sendFollowStep(params);
    return;
  }
  await sendRewardStep(params);
}

/** Após tocar em “Já sigo”. */
export async function advanceCommentDmAfterFollowConfirm(
  params: FlowStepParams,
): Promise<void> {
  const follows = await userFollowsBusiness(params);
  if (follows === false) {
    await sendFollowNotYetStep(params);
    return;
  }
  await completeAwaitingFollowExec(params.contatoId, params.fluxoId);
  await advanceAfterFollowGate(params);
}

/** Detecta follow espontâneo enquanto aguarda (ex.: seguiu e mandou mensagem). */
export async function tryAdvanceAwaitingFollow(params: {
  organizationId: string;
  igAccount: { id: string; igUserId: string; accessToken: string; scopes?: string | null };
  contatoId: string;
  igsid: string;
}): Promise<boolean> {
  const pending = await findAwaitingFollowExec(params.contatoId);
  if (!pending) return false;

  const fluxo = await prisma.igFluxo.findFirst({
    where: {
      id: pending.fluxoId,
      organizationId: params.organizationId,
      status: "PUBLISHED",
    },
  });
  if (!fluxo) return false;

  const cfg = fluxo.triggerConfig as CommentDmTriggerConfig;
  if (cfg.followEnabled !== true) return false;

  const stepParams: FlowStepParams = {
    fluxoId: fluxo.id,
    organizationId: params.organizationId,
    igAccount: params.igAccount,
    contatoId: params.contatoId,
    igsid: params.igsid,
    cfg,
  };

  const follows = await userFollowsBusiness(stepParams);
  if (follows !== true) return false;

  await completeAwaitingFollowExec(params.contatoId, fluxo.id);
  await advanceAfterFollowGate(stepParams);
  return true;
}

export async function findAwaitingEmailExec(contatoId: string) {
  const pending = await prisma.igFluxoExecucao.findMany({
    where: { contatoId, status: "WAITING" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return pending.find((e) => {
    const ctx = e.context as Record<string, unknown>;
    return ctx.step === "awaiting_email";
  });
}

export async function saveContactEmail(
  contatoId: string,
  email: string,
  fluxoId?: string,
): Promise<void> {
  const contato = await prisma.igContato.findUnique({ where: { id: contatoId } });
  if (!contato) return;
  const normalized = email.trim().toLowerCase();
  const tags = contato.tags.filter((t) => !t.startsWith("email:"));
  tags.push(`email:${normalized}`);
  await prisma.igContato.update({
    where: { id: contatoId },
    data: { tags },
  });

  const { recordConversion } = await import("@/lib/symbius/conversions");
  await recordConversion({
    organizationId: contato.organizationId,
    tipo: "email_captured",
    contatoId,
    fluxoId,
    metadata: { email: normalized },
  });

  const { appendGoogleSheetRow } = await import("@/lib/symbius/integrations");
  void import("./workspaceLead").then(({ openInstagramWorkspaceLead }) =>
    openInstagramWorkspaceLead({
      organizationId: contato.organizationId,
      igContatoId: contato.id,
      email: normalized,
      username: contato.username,
      nome: contato.nome,
    }),
  );
  void appendGoogleSheetRow(contato.organizationId, {
    email: normalized,
    nome: contato.nome ?? "",
    username: contato.username ?? "",
    phone: contato.phone ?? "",
    source: "comment_dm_email",
    at: new Date().toISOString(),
  });
}

export function extractContactEmail(tags: string[]): string | null {
  const tag = tags.find((t) => t.startsWith("email:"));
  return tag ? tag.slice("email:".length) : null;
}

/** Processa resposta na etapa de coleta de e-mail (válido ou inválido). */
export async function tryHandleAwaitingEmailResponse(params: {
  organizationId: string;
  igAccount: { id: string; igUserId: string; accessToken: string; scopes?: string | null };
  contatoId: string;
  igsid: string;
  text: string;
}): Promise<boolean> {
  const pending = await findAwaitingEmailExec(params.contatoId);
  if (!pending) return false;

  const fluxo = await prisma.igFluxo.findFirst({
    where: {
      id: pending.fluxoId,
      organizationId: params.organizationId,
      status: "PUBLISHED",
    },
  });
  if (!fluxo) return false;

  const cfg = fluxo.triggerConfig as CommentDmTriggerConfig;
  if (cfg.emailEnabled !== true) return false;

  const stepParams: FlowStepParams = {
    fluxoId: fluxo.id,
    organizationId: params.organizationId,
    igAccount: params.igAccount,
    contatoId: params.contatoId,
    igsid: params.igsid,
    cfg,
  };

  const trimmed = params.text.trim();
  if (!trimmed) return false;

  if (looksLikeEmail(trimmed)) {
    await saveContactEmail(params.contatoId, trimmed, fluxo.id);
    await prisma.igFluxoExecucao.update({
      where: { id: pending.id },
      data: { status: "COMPLETED" },
    });
    if (cfg.followEnabled === true) {
      const follows = await userFollowsBusiness(stepParams);
      if (follows === true) {
        await sendRewardStep(stepParams);
        return true;
      }
      await sendFollowStep(stepParams);
      return true;
    }
    await sendRewardStep(stepParams);
    return true;
  }

  await sendEmailInvalidStep(stepParams);
  return true;
}
