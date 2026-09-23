import crypto from "crypto";
import { prisma } from "@/lib/db-social";
import { recordConversion } from "@/lib/symbius/conversions";
import {
  appendGoogleSheetRow,
  fireOutboundWebhook,
  syncLeadToCentralCrm,
} from "@/lib/symbius/integrations";
import { assignConversaRoundRobin } from "@/lib/symbius/inboxAssign";
import {
  enrichContatoProfile,
  ensureContatoSourceTag,
  persistCommentAsMessage,
} from "@/lib/symbius/contactPersistence";
import {
  advanceCommentDmAfterFollowConfirm,
  advanceCommentDmAfterWelcomeClick,
  markNextPostConsumed,
  matchesCommentMediaFilter,
  sendReminderStep,
  shouldSkipReminderExec,
  tryAdvanceAwaitingFollow,
  tryHandleAwaitingEmailResponse,
} from "./commentDmFlow";
import {
  isWithin24hWindow,
  parseFollowPayload,
  parseRewardPayload,
  replyToInstagramComment,
  rewardPayload,
  sendInstagramMessage,
  type MessageButton,
} from "./messagingClient";

type WebhookMessaging = {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    reply_to?: {
      story?: { id?: string; url?: string };
    };
    attachments?: Array<{
      type?: string;
      payload?: {
        url?: string;
        title?: string;
        reel_video_id?: string | number;
        ig_post_media_id?: string;
      };
    }>;
  };
  postback?: { title?: string; payload?: string };
  referral?: { ref?: string; source?: string };
  /** Receipts — não são mensagens; não persistir na inbox */
  read?: { mid?: string };
  delivery?: { mids?: string[]; watermark?: number };
};

type WebhookEntry = {
  id: string;
  messaging?: WebhookMessaging[];
  changes?: Array<{
    field: string;
    value: {
      id?: string;
      text?: string;
      from?: { id: string; username?: string };
      media?: { id: string };
      live_media?: { id: string };
    };
  }>;
};

async function triggerFluxosByTag(params: {
  organizationId: string;
  contatoId: string;
  tag: string;
}): Promise<void> {
  const contato = await prisma.igContato.findFirst({
    where: { id: params.contatoId, organizationId: params.organizationId },
  });
  if (!contato) return;

  const fluxos = await prisma.igFluxo.findMany({
    where: {
      organizationId: params.organizationId,
      status: "PUBLISHED",
      fluxoKind: "sequence",
      triggerType: "tag_entry",
    },
  });

  for (const fluxo of fluxos) {
    const cfg = fluxo.triggerConfig as Record<string, unknown>;
    const entryTag = String(cfg.entryTag ?? "");
    if (entryTag && entryTag === params.tag) {
      await startFluxo(fluxo.id, contato.id, params.organizationId, {
        tagEntry: params.tag,
      });
      break;
    }
  }
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase();
}

function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

async function notifyAdmins(
  organizationId: string,
  subject: string,
  body: string,
): Promise<void> {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId, role: { in: ["OWNER", "ADMIN"] } },
    include: { user: true },
  });
  for (const m of members) {
    console.info(`[symbius/notify] ${m.user.email}: ${subject} — ${body}`);
  }
  void fireOutboundWebhook(organizationId, "admin.notify", { subject, body });
}

async function getOrCreateContato(
  organizationId: string,
  igAccountId: string,
  igsid: string,
  nome?: string,
  username?: string,
  accessToken?: string,
) {
  const existing = await prisma.igContato.findUnique({
    where: { igAccountId_igsid: { igAccountId, igsid } },
  });
  if (existing) {
    const updated = await prisma.igContato.update({
      where: { id: existing.id },
      data: {
        lastInteractionAt: new Date(),
        nome: nome ?? existing.nome,
        username: username ?? existing.username,
      },
    });
    if (
      accessToken &&
      (!updated.username || !updated.profilePictureUrl || !updated.nome)
    ) {
      void enrichContatoProfile(updated.id, igsid, accessToken);
    }
    if (!updated.trackingIdentityId) {
      void import("@/lib/symbius/attribution/identify").then(({ ensureIgContatoIdentity }) =>
        ensureIgContatoIdentity({
          organizationId,
          contatoId: updated.id,
          igsid,
          name: updated.nome ?? updated.username,
          phone: updated.phone,
        }).catch((e) => console.warn("[attribution] ig identity", e)),
      );
    }
    return updated;
  }
  const created = await prisma.igContato.create({
    data: {
      organizationId,
      igAccountId,
      igsid,
      nome,
      username,
      lastInteractionAt: new Date(),
    },
  });
  if (accessToken) {
    void enrichContatoProfile(created.id, igsid, accessToken);
  }
  void import("@/lib/symbius/atrako-bridge")
    .then(({ publishSocialLeadEvent }) =>
      publishSocialLeadEvent({
        name: "lead.created",
        contactId: created.id,
        payload: {
          nome: created.nome || created.username || igsid,
          fonte: "instagram",
          igsid,
        },
      }),
    )
    .catch(() => null);
  void import("@/lib/symbius/attribution/identify").then(({ ensureIgContatoIdentity }) =>
    ensureIgContatoIdentity({
      organizationId,
      contatoId: created.id,
      igsid,
      name: nome ?? username,
    }).catch((e) => console.warn("[attribution] ig identity", e)),
  );
  return created;
}

async function getOrCreateConversa(
  organizationId: string,
  igAccountId: string,
  contatoId: string,
) {
  const open = await prisma.igConversa.findFirst({
    where: { contatoId, status: "OPEN" },
    orderBy: { updatedAt: "desc" },
  });
  if (open) return open;
  return prisma.igConversa.create({
    data: {
      organizationId,
      igAccountId,
      contatoId,
      status: "OPEN",
      lastMessageAt: new Date(),
    },
  });
}

async function persistInboundMessage(
  organizationId: string,
  conversaId: string,
  mid: string | undefined,
  texto: string | undefined,
  isEcho: boolean,
  attachments?: object,
) {
  const hasText = Boolean(texto?.trim());
  const hasAttachments = Boolean(
    attachments && Object.keys(attachments as object).length > 0,
  );
  // Evita bolhas vazias (ex.: eventos `read` / receipts sem conteúdo)
  if (!hasText && !hasAttachments) return null;

  if (mid) {
    const dup = await prisma.igMensagem.findUnique({ where: { mid } });
    if (dup) return dup;
  }
  return prisma.igMensagem.create({
    data: {
      organizationId,
      conversaId,
      direction: isEcho ? "OUTBOUND" : "INBOUND",
      mid: mid ?? undefined,
      texto,
      attachments: attachments as object | undefined,
      isEcho,
    },
  });
}

async function runFluxoFromNode(
  execucaoId: string,
  noId: string,
): Promise<void> {
  const exec = await prisma.igFluxoExecucao.findUniqueOrThrow({
    where: { id: execucaoId },
    include: {
      contato: { include: { igAccount: true } },
      fluxo: { include: { nos: true } },
    },
  });

  if (exec.status !== "RUNNING" && exec.status !== "WAITING") return;
  if (exec.contato.botPaused || exec.contato.igAccount.status !== "CONNECTED") {
    await prisma.igFluxoExecucao.update({
      where: { id: execucaoId },
      data: { status: "CANCELLED" },
    });
    return;
  }

  const no = exec.fluxo.nos.find((n) => n.id === noId);
  if (!no) {
    await prisma.igFluxoExecucao.update({
      where: { id: execucaoId },
      data: { status: "COMPLETED" },
    });
    return;
  }

  const config = no.config as Record<string, unknown>;

  switch (no.tipo) {
    case "send_message": {
      const text = String(config.text ?? "");
      const rawButtons = (config.buttons as MessageButton[] | undefined) ?? [];
      const imageUrl = String(config.imageUrl ?? "");
      if (
        (text || rawButtons.length > 0 || imageUrl) &&
        isWithin24hWindow(exec.contato.lastInteractionAt)
      ) {
        let sent: { message_id?: string };
        if (imageUrl) {
          const { sendInstagramImageMessage } = await import("./messagingClient");
          sent = await sendInstagramImageMessage({
            igUserId: exec.contato.igAccount.igUserId,
            accessToken: exec.contato.igAccount.accessToken,
            recipientIgsid: exec.contato.igsid,
            imageUrl,
            text,
          });
        } else {
          sent = await sendInstagramMessage({
            igUserId: exec.contato.igAccount.igUserId,
            accessToken: exec.contato.igAccount.accessToken,
            recipientIgsid: exec.contato.igsid,
            text,
            buttons: rawButtons,
          });
        }
        const conversa = await getOrCreateConversa(
          exec.organizationId,
          exec.contato.igAccountId,
          exec.contatoId,
        );
        await persistInboundMessage(
          exec.organizationId,
          conversa.id,
          sent.message_id,
          text || "[mídia]",
          true,
        );
        await prisma.igConversa.update({
          where: { id: conversa.id },
          data: { lastMessageAt: new Date() },
        });
      }
      break;
    }
    case "wait": {
      const minutes = Number(config.minutes ?? 0);
      const smartDelay = Boolean(config.smartDelay);
      let delayMs = minutes * 60 * 1000;
      if (smartDelay) {
        const now = new Date();
        const hour = now.getHours();
        if (hour < 9) {
          const start = new Date(now);
          start.setHours(9, 0, 0, 0);
          delayMs = Math.max(delayMs, start.getTime() - now.getTime());
        } else if (hour >= 18) {
          const start = new Date(now);
          start.setDate(start.getDate() + 1);
          start.setHours(9, 0, 0, 0);
          delayMs = Math.max(delayMs, start.getTime() - now.getTime());
        }
      }
      await prisma.igFluxoExecucao.update({
        where: { id: execucaoId },
        data: {
          status: "WAITING",
          noAtualId: noId,
          scheduledAt: new Date(Date.now() + delayMs),
        },
      });
      return;
    }
    case "wait_reply": {
      await prisma.igFluxoExecucao.update({
        where: { id: execucaoId },
        data: {
          status: "WAITING",
          noAtualId: noId,
          context: {
            ...(exec.context as object),
            awaitingReply: true,
            replyField: String(config.field ?? "text"),
            replyValidation: String(config.validation ?? "any"),
          } as object,
        },
      });
      return;
    }
    case "split": {
      const pctA = Number(config.percentA ?? 50);
      const pickA = Math.random() * 100 < pctA;
      const nextId = pickA ? no.nextIds[0] : no.nextIds[1];
      if (nextId) {
        await prisma.igFluxoExecucao.update({
          where: { id: execucaoId },
          data: { noAtualId: nextId, status: "RUNNING", scheduledAt: null },
        });
        await runFluxoFromNode(execucaoId, nextId);
      } else {
        await prisma.igFluxoExecucao.update({
          where: { id: execucaoId },
          data: { status: "COMPLETED" },
        });
      }
      return;
    }
    case "collect_phone": {
      const prompt = String(config.prompt ?? "Qual seu WhatsApp?");
      if (isWithin24hWindow(exec.contato.lastInteractionAt)) {
        await sendInstagramMessage({
          igUserId: exec.contato.igAccount.igUserId,
          accessToken: exec.contato.igAccount.accessToken,
          recipientIgsid: exec.contato.igsid,
          text: prompt,
        });
      }
      await prisma.igFluxoExecucao.update({
        where: { id: execucaoId },
        data: {
          status: "WAITING",
          noAtualId: noId,
          context: {
            ...(exec.context as object),
            awaitingReply: true,
            replyField: "phone",
            replyValidation: "phone",
          } as object,
        },
      });
      return;
    }
    case "send_poll": {
      const question = String(config.question ?? "Escolha uma opção");
      const options = ((config.options as string[]) ?? []).slice(0, 3);
      const buttons: MessageButton[] = options.map((opt, i) => ({
        type: "postback" as const,
        title: opt.slice(0, 20),
        payload: `poll:${exec.fluxoId}:${i}`,
      }));
      if (isWithin24hWindow(exec.contato.lastInteractionAt) && buttons.length) {
        await sendInstagramMessage({
          igUserId: exec.contato.igAccount.igUserId,
          accessToken: exec.contato.igAccount.accessToken,
          recipientIgsid: exec.contato.igsid,
          text: question,
          buttons,
        });
      }
      break;
    }
    case "dynamic_menu": {
      const items = ((config.items as Array<{ title: string; payload?: string; url?: string }>) ?? []).slice(0, 3);
      const buttons: MessageButton[] = items.map((item) =>
        item.url
          ? { type: "web_url", title: item.title, url: item.url }
          : { type: "postback", title: item.title, payload: item.payload ?? item.title },
      );
      const menuText = String(config.text ?? "Escolha:");
      if (isWithin24hWindow(exec.contato.lastInteractionAt) && buttons.length) {
        await sendInstagramMessage({
          igUserId: exec.contato.igAccount.igUserId,
          accessToken: exec.contato.igAccount.accessToken,
          recipientIgsid: exec.contato.igsid,
          text: menuText,
          buttons,
        });
      }
      break;
    }
    case "notify_admin": {
      await notifyAdmins(
        exec.organizationId,
        String(config.subject ?? "Notificação Symbius"),
        String(config.body ?? `Contato ${exec.contato.username ?? exec.contato.igsid}`),
      );
      break;
    }
    case "add_tag": {
      const tag = String(config.tag ?? "");
      if (tag) {
        const contato = exec.contato;
        const tags = new Set(contato.tags);
        tags.add(tag);
        await prisma.igContato.update({
          where: { id: contato.id },
          data: { tags: Array.from(tags) },
        });
        void triggerFluxosByTag({
          organizationId: exec.organizationId,
          contatoId: contato.id,
          tag,
        });
        void fireOutboundWebhook(exec.organizationId, "contact.tagged", {
          contatoId: contato.id,
          tag,
        });
      }
      break;
    }
    case "handoff_human": {
      await prisma.igContato.update({
        where: { id: exec.contatoId },
        data: { botPaused: true },
      });
      const conversa = await getOrCreateConversa(
        exec.organizationId,
        exec.contato.igAccountId,
        exec.contatoId,
      );
      await prisma.igConversa.update({
        where: { id: conversa.id },
        data: { handoffHuman: true },
      });
      await assignConversaRoundRobin(exec.organizationId, conversa.id);
      await recordConversion({
        organizationId: exec.organizationId,
        tipo: "handoff",
        contatoId: exec.contatoId,
        fluxoId: exec.fluxoId,
      });
      await notifyAdmins(
        exec.organizationId,
        "Handoff humano",
        `Conversa ${conversa.id} aguardando atendimento`,
      );
      await prisma.igFluxoExecucao.update({
        where: { id: execucaoId },
        data: { status: "COMPLETED" },
      });
      return;
    }
    case "condition": {
      const field = String(config.field ?? "text");
      const op = String(config.operator ?? "contains");
      const value = normalizeText(String(config.value ?? ""));
      const ctx = exec.context as Record<string, unknown>;
      const contato = exec.contato;
      let actual = normalizeText(String(ctx[field] ?? ""));
      if (field === "tag") {
        actual = contato.tags.includes(String(config.value ?? "")) ? String(config.value) : "";
      } else if (field.startsWith("campo.")) {
        const key = field.slice(6);
        const campos = (contato.campos ?? {}) as Record<string, unknown>;
        actual = normalizeText(String(campos[key] ?? ""));
      } else if (field === "clicked_link") {
        actual = contato.tags.some((t) => t.startsWith("link_clicked:")) ? "yes" : "";
      }
      let ok = false;
      if (op === "equals") ok = actual === value;
      else if (op === "contains") ok = actual.includes(value);
      else if (op === "has_tag") ok = contato.tags.includes(String(config.value ?? ""));
      const nextId = ok ? no.nextIds[0] : no.nextIds[1];
      if (nextId) {
        await prisma.igFluxoExecucao.update({
          where: { id: execucaoId },
          data: { noAtualId: nextId, status: "RUNNING", scheduledAt: null },
        });
        await runFluxoFromNode(execucaoId, nextId);
      } else {
        await prisma.igFluxoExecucao.update({
          where: { id: execucaoId },
          data: { status: "COMPLETED" },
        });
      }
      return;
    }
    default:
      break;
  }

  const nextId = no.nextIds[0];
  if (nextId) {
    await prisma.igFluxoExecucao.update({
      where: { id: execucaoId },
      data: { noAtualId: nextId, status: "RUNNING", scheduledAt: null },
    });
    await runFluxoFromNode(execucaoId, nextId);
  } else {
    await prisma.igFluxoExecucao.update({
      where: { id: execucaoId },
      data: { status: "COMPLETED" },
    });
  }
}

async function startFluxo(
  fluxoId: string,
  contatoId: string,
  organizationId: string,
  context: Record<string, unknown>,
) {
  const fluxo = await prisma.igFluxo.findFirst({
    where: { id: fluxoId, organizationId, status: "PUBLISHED" },
    include: { nos: true },
  });
  if (!fluxo || fluxo.nos.length === 0) return;

  const start =
    fluxo.nos.find((n) => n.tipo === "trigger") ?? fluxo.nos[0];
  const nextId = start.nextIds[0];
  if (!nextId) return;

  const exec = await prisma.igFluxoExecucao.create({
    data: {
      organizationId,
      fluxoId: fluxo.id,
      contatoId,
      noAtualId: nextId,
      status: "RUNNING",
      context: context as object,
    },
  });
  await recordConversion({
    organizationId,
    tipo: "fluxo_started",
    contatoId,
    fluxoId: fluxo.id,
  });
  await runFluxoFromNode(exec.id, nextId);
}

export async function startFluxoById(
  fluxoId: string,
  contatoId: string,
  organizationId: string,
  context: Record<string, unknown>,
): Promise<void> {
  await startFluxo(fluxoId, contatoId, organizationId, context);
}

function matchesKeywords(
  text: string,
  triggerConfig: Record<string, unknown>,
): boolean {
  if (Boolean(triggerConfig.anyKeyword)) {
    return true;
  }
  const keywords = (triggerConfig.keywords as string[] | undefined) ?? [];
  if (keywords.length === 0) return false;
  const mode = String(triggerConfig.matchMode ?? "contains");
  return keywords.some((k) => {
    const nk = normalizeText(k);
    if (!nk) return false;
    if (mode === "exact") return text === nk;
    if (mode === "starts_with") return text.startsWith(nk);
    return text.includes(nk);
  });
}

function matchesTrigger(
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean {
  const text = normalizeText(String(context.text ?? ""));
  if (triggerType === "unset" || triggerType === "none") {
    return false;
  }
  if (triggerType === "welcome") {
    return Boolean(context.isFirstMessage);
  }
  if (triggerType === "keyword") {
    return matchesKeywords(text, triggerConfig);
  }
  if (triggerType === "comment_keyword") {
    const comment = normalizeText(String(context.commentText ?? ""));
    if (!matchesKeywords(comment, triggerConfig)) return false;
    const mediaId = String(context.mediaId ?? "");
    return matchesCommentMediaFilter(triggerConfig, mediaId);
  }
  if (triggerType === "story_reply") {
    if (!context.isStoryReply) return false;
    const storyId = String(triggerConfig.storyId ?? "");
    if (storyId && String(context.storyId ?? "") !== storyId) return false;
    const keywords = (triggerConfig.keywords as string[] | undefined) ?? [];
    if (Boolean(triggerConfig.anyKeyword) || keywords.length === 0) return true;
    return matchesKeywords(text, triggerConfig);
  }
  if (triggerType === "story_mention") {
    return Boolean(context.isStoryMention);
  }
  if (triggerType === "live_comment") {
    return Boolean(context.isLiveComment) && matchesKeywords(
      normalizeText(String(context.commentText ?? "")),
      triggerConfig,
    );
  }
  if (triggerType === "manual") {
    return Boolean(context.manual);
  }
  if (triggerType === "tag_entry") {
    return (
      String(context.tagEntry ?? "") === String(triggerConfig.entryTag ?? "")
    );
  }
  if (triggerType === "ref") {
    return (
      String(context.referralRef ?? "") === String(triggerConfig.refTag ?? "")
    );
  }
  if (triggerType === "postback") {
    return (
      String(context.postbackPayload ?? "") ===
      String(triggerConfig.payload ?? "")
    );
  }
  return false;
}

async function sendCommentDmWelcome(params: {
  fluxoId: string;
  organizationId: string;
  igAccount: {
    id: string;
    igUserId: string;
    accessToken: string;
  };
  contatoId: string;
  igsid: string;
  triggerConfig: Record<string, unknown>;
  context: Record<string, unknown>;
}): Promise<void> {
  const cfg = params.triggerConfig;
  const welcomeEnabled = cfg.welcomeEnabled !== false;
  const welcomeText = String(
    cfg.welcomeText ??
      "Olá! Obrigado pelo interesse 😊 Clique abaixo e eu te mando o link.",
  );
  const welcomeButton = String(cfg.welcomeButton ?? "Me envie o link");

  if (cfg.replyToComment && params.context.commentId) {
    try {
      await replyToInstagramComment({
        commentId: String(params.context.commentId),
        accessToken: params.igAccount.accessToken,
        message: "✓",
      });
    } catch (e) {
      console.warn(
        "[instagram] comment reply failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  if (!welcomeEnabled) {
    await advanceCommentDmAfterWelcomeClick({
      fluxoId: params.fluxoId,
      organizationId: params.organizationId,
      igAccount: params.igAccount,
      contatoId: params.contatoId,
      igsid: params.igsid,
      cfg,
    });
    return;
  }

  await prisma.igContato.update({
    where: { id: params.contatoId },
    data: { lastInteractionAt: new Date() },
  });

  const contato = await prisma.igContato.findUniqueOrThrow({
    where: { id: params.contatoId },
  });

  if (!isWithin24hWindow(contato.lastInteractionAt)) {
    // Comment usually opens the window; try send anyway after touching lastInteraction
  }

  try {
    const sent = await sendInstagramMessage({
      igUserId: params.igAccount.igUserId,
      accessToken: params.igAccount.accessToken,
      recipientIgsid: params.igsid,
      text: welcomeText,
      buttons: [
        {
          type: "postback",
          title: welcomeButton,
          payload: rewardPayload(params.fluxoId),
        },
      ],
    });
    const conversa = await getOrCreateConversa(
      params.organizationId,
      params.igAccount.id,
      params.contatoId,
    );
    await persistInboundMessage(
      params.organizationId,
      conversa.id,
      sent.message_id,
      welcomeText,
      true,
    );
    await prisma.igFluxoExecucao.create({
      data: {
        organizationId: params.organizationId,
        fluxoId: params.fluxoId,
        contatoId: params.contatoId,
        status: "COMPLETED",
        context: { ...params.context, step: "welcome" } as object,
      },
    });
  } catch (e) {
    console.warn(
      "[instagram] welcome DM failed:",
      e instanceof Error ? e.message : e,
    );
  }
}

async function sendCommentDmReward(params: {
  fluxoId: string;
  organizationId: string;
  igAccount: {
    id: string;
    igUserId: string;
    accessToken: string;
  };
  contatoId: string;
  igsid: string;
  triggerConfig: Record<string, unknown>;
}): Promise<void> {
  await prisma.igContato.update({
    where: { id: params.contatoId },
    data: { lastInteractionAt: new Date() },
  });
  try {
    const { sendRewardStep } = await import("./commentDmFlow");
    await sendRewardStep({
      fluxoId: params.fluxoId,
      organizationId: params.organizationId,
      igAccount: params.igAccount,
      contatoId: params.contatoId,
      igsid: params.igsid,
      cfg: params.triggerConfig,
    });
    await prisma.igFluxoExecucao.create({
      data: {
        organizationId: params.organizationId,
        fluxoId: params.fluxoId,
        contatoId: params.contatoId,
        status: "COMPLETED",
        context: { step: "reward" } as object,
      },
    });
  } catch (e) {
    console.warn(
      "[instagram] reward DM failed:",
      e instanceof Error ? e.message : e,
    );
  }
}

export async function processAutomationForContato(
  organizationId: string,
  igAccountId: string,
  contatoId: string,
  context: Record<string, unknown>,
): Promise<void> {
  const contato = await prisma.igContato.findUnique({
    where: { id: contatoId },
    include: { igAccount: true },
  });
  if (!contato || contato.botPaused) return;

  const text = String(context.text ?? "").trim();

  // Opt-out global (keywords de sistema)
  if (/^(parar|stop|sair|cancelar|unsubscribe)$/i.test(text)) {
    const tags = Array.from(new Set([...contato.tags, "opted_out"]));
    await prisma.igContato.update({
      where: { id: contatoId },
      data: { botPaused: true, tags },
    });
    await prisma.igFluxoExecucao.updateMany({
      where: {
        contatoId,
        organizationId,
        status: { in: ["RUNNING", "WAITING"] },
      },
      data: { status: "CANCELLED" },
    });
    try {
      await sendInstagramMessage({
        igUserId: contato.igAccount.igUserId,
        accessToken: contato.igAccount.accessToken,
        recipientIgsid: contato.igsid,
        text: "Pronto! Você não receberá mais mensagens automáticas. Para reativar, fale com um atendente.",
      });
    } catch {
      // ignore send failure on opt-out
    }
    return;
  }

  const waitingExec = await prisma.igFluxoExecucao.findFirst({
    where: {
      contatoId,
      organizationId,
      status: "WAITING",
    },
    orderBy: { updatedAt: "desc" },
  });

  if (waitingExec && text) {
    const wctx = waitingExec.context as Record<string, unknown>;
    if (wctx.awaitingReply) {
      const validation = String(wctx.replyValidation ?? "any");
      const replyField = String(wctx.replyField ?? "text");
      let valid = true;
      if (validation === "email") valid = looksLikeEmail(text);
      else if (validation === "phone") valid = looksLikePhone(text);

      if (valid && waitingExec.noAtualId) {
        const updateData: Record<string, unknown> = {
          [replyField]: text,
          text,
          awaitingReply: false,
        };
        if (validation === "phone") {
          await prisma.igContato.update({
            where: { id: contatoId },
            data: { phone: text.replace(/\D/g, "") },
          });
          await recordConversion({
            organizationId,
            tipo: "phone_captured",
            contatoId,
            fluxoId: waitingExec.fluxoId,
          });
          void syncLeadToCentralCrm({
            organizationId,
            phone: text,
            username: contato.username ?? undefined,
            nome: contato.nome ?? undefined,
          });
          const { appendGoogleSheetRow } = await import(
            "@/lib/symbius/integrations"
          );
          void appendGoogleSheetRow(organizationId, {
            phone: text.replace(/\D/g, ""),
            nome: contato.nome ?? "",
            username: contato.username ?? "",
            email: "",
            source: "fluxo_phone",
            at: new Date().toISOString(),
          });
        }

        await prisma.igFluxoExecucao.update({
          where: { id: waitingExec.id },
          data: {
            status: "RUNNING",
            context: { ...wctx, ...updateData } as object,
          },
        });
        const no = await prisma.igFluxoNo.findUnique({
          where: { id: waitingExec.noAtualId },
        });
        const nextId = no?.nextIds[0];
        if (nextId) {
          await prisma.igFluxoExecucao.update({
            where: { id: waitingExec.id },
            data: { noAtualId: nextId },
          });
          await runFluxoFromNode(waitingExec.id, nextId);
        } else {
          await prisma.igFluxoExecucao.update({
            where: { id: waitingExec.id },
            data: { status: "COMPLETED" },
          });
        }
        return;
      }
    }
  }

  if (
    text &&
    (await tryHandleAwaitingEmailResponse({
      organizationId,
      igAccount: contato.igAccount,
      contatoId,
      igsid: contato.igsid,
      text,
    }))
  ) {
    return;
  }

  if (
    await tryAdvanceAwaitingFollow({
      organizationId,
      igAccount: contato.igAccount,
      contatoId,
      igsid: contato.igsid,
    })
  ) {
    return;
  }

  const followFluxoId = parseFollowPayload(String(context.postbackPayload ?? ""));
  if (followFluxoId) {
    const fluxo = await prisma.igFluxo.findFirst({
      where: { id: followFluxoId, organizationId, status: "PUBLISHED" },
    });
    if (fluxo) {
      await advanceCommentDmAfterFollowConfirm({
        fluxoId: fluxo.id,
        organizationId,
        igAccount: contato.igAccount,
        contatoId,
        igsid: contato.igsid,
        cfg: fluxo.triggerConfig as Record<string, unknown>,
      });
    }
    return;
  }

  const rewardFluxoId = parseRewardPayload(
    String(context.postbackPayload ?? ""),
  );
  if (rewardFluxoId) {
    const fluxo = await prisma.igFluxo.findFirst({
      where: {
        id: rewardFluxoId,
        organizationId,
        status: "PUBLISHED",
      },
    });
    if (fluxo) {
      await advanceCommentDmAfterWelcomeClick({
        fluxoId: fluxo.id,
        organizationId,
        igAccount: contato.igAccount,
        contatoId,
        igsid: contato.igsid,
        cfg: fluxo.triggerConfig as Record<string, unknown>,
      });
    }
    return;
  }

  const fluxos = await prisma.igFluxo.findMany({
    where: {
      organizationId,
      status: "PUBLISHED",
      fluxoKind: { not: "sequence" },
      OR: [{ igAccountId }, { igAccountId: null }],
    },
  });

  let matched = false;
  for (const fluxo of fluxos) {
    const cfg = fluxo.triggerConfig as Record<string, unknown>;
    if (!matchesTrigger(fluxo.triggerType, cfg, context)) continue;

    if (
      fluxo.triggerType === "comment_keyword" &&
      (cfg.welcomeText || cfg.rewardText || cfg.welcomeButton)
    ) {
      await sendCommentDmWelcome({
        fluxoId: fluxo.id,
        organizationId,
        igAccount: contato.igAccount,
        contatoId: contato.id,
        igsid: contato.igsid,
        triggerConfig: cfg,
        context,
      });
      const mediaId = String(context.mediaId ?? "");
      if (mediaId && String(cfg.mediaFilter) === "next") {
        await markNextPostConsumed(fluxo.id, mediaId);
      }
    } else if (
      fluxo.triggerType === "story_reply" &&
      (cfg.rewardText || cfg.rewardUrl)
    ) {
      await sendCommentDmReward({
        fluxoId: fluxo.id,
        organizationId,
        igAccount: contato.igAccount,
        contatoId: contato.id,
        igsid: contato.igsid,
        triggerConfig: cfg,
      });
    } else {
      await startFluxo(fluxo.id, contatoId, organizationId, context);
    }
    matched = true;
    break;
  }

  if (!matched && text && contato.igAccount.defaultReplyText) {
    if (isWithin24hWindow(contato.lastInteractionAt)) {
      await sendInstagramMessage({
        igUserId: contato.igAccount.igUserId,
        accessToken: contato.igAccount.accessToken,
        recipientIgsid: contato.igsid,
        text: contato.igAccount.defaultReplyText,
      });
    }
  }
}

export async function processWebhookPayload(payload: unknown): Promise<void> {
  const body = payload as { object?: string; entry?: WebhookEntry[] };
  if (body.object !== "instagram" && body.object !== "page") return;

  for (const entry of body.entry ?? []) {
    const igUserId = entry.id;
    const igAccount = await prisma.igAccount.findFirst({
      where: { igUserId, status: "CONNECTED" },
    });
    if (!igAccount) continue;

    for (const msg of entry.messaging ?? []) {
      // Receipts (read/delivery) não são mensagens — geravam bolhas só com data/hora
      if (msg.read || msg.delivery) continue;
      if (!msg.message && !msg.postback && !msg.referral) continue;

      const isEcho = Boolean(msg.message?.is_echo);
      const igsid = isEcho ? msg.recipient?.id : msg.sender?.id;
      if (!igsid || igsid === igUserId) continue;

      const contato = await getOrCreateContato(
        igAccount.organizationId,
        igAccount.id,
        igsid,
        undefined,
        undefined,
        igAccount.accessToken,
      );
      const conversa = await getOrCreateConversa(
        igAccount.organizationId,
        igAccount.id,
        contato.id,
      );

      if (isEcho) {
        const texto = msg.message?.text;
        if (texto) {
          await persistInboundMessage(
            igAccount.organizationId,
            conversa.id,
            msg.message?.mid,
            texto,
            true,
          );
          await prisma.igConversa.update({
            where: { id: conversa.id },
            data: { lastMessageAt: new Date() },
          });
        }
        continue;
      }

      const texto = msg.message?.text ?? msg.postback?.title;
      const isStoryMention = Boolean(
        msg.message?.attachments?.some((a) => a.type === "story_mention"),
      );
      const isStoryReply = Boolean(msg.message?.reply_to?.story);
      const storyId = msg.message?.reply_to?.story?.id ?? "";
      const attachments = msg.message?.attachments?.length
        ? { attachments: msg.message.attachments, postback: msg.postback }
        : msg.postback
          ? { postback: msg.postback }
          : undefined;

      const saved = await persistInboundMessage(
        igAccount.organizationId,
        conversa.id,
        msg.message?.mid,
        texto,
        false,
        attachments,
      );
      if (!saved) continue;

      await ensureContatoSourceTag(
        contato.id,
        isStoryReply || isStoryMention ? "story" : "dm",
      );

      await prisma.igConversa.update({
        where: { id: conversa.id },
        data: { lastMessageAt: new Date() },
      });

      if (!conversa.assignedUserId) {
        await assignConversaRoundRobin(igAccount.organizationId, conversa.id);
      }

      const priorCount = await prisma.igMensagem.count({
        where: { conversaId: conversa.id, direction: "INBOUND" },
      });

      void fireOutboundWebhook(igAccount.organizationId, "message.inbound", {
        contatoId: contato.id,
        conversaId: conversa.id,
        text: msg.message?.text ?? "",
      });

      await processAutomationForContato(
        igAccount.organizationId,
        igAccount.id,
        contato.id,
        {
          text: msg.message?.text ?? "",
          postbackPayload: msg.postback?.payload ?? "",
          isFirstMessage: priorCount <= 1,
          isStoryReply,
          isStoryMention,
          storyId,
          referralRef: msg.referral?.ref ?? "",
        },
      );
    }

    for (const change of entry.changes ?? []) {
      if (change.field !== "comments" && change.field !== "live_comments") {
        continue;
      }
      const commentText = change.value.text ?? "";
      const fromId = change.value.from?.id;
      if (!fromId) continue;

      const contato = await getOrCreateContato(
        igAccount.organizationId,
        igAccount.id,
        fromId,
        undefined,
        change.value.from?.username,
        igAccount.accessToken,
      );

      await persistCommentAsMessage({
        organizationId: igAccount.organizationId,
        igAccountId: igAccount.id,
        contatoId: contato.id,
        commentText,
        commentId: change.value.id,
        mediaId: change.value.media?.id ?? change.value.live_media?.id,
        field: change.field === "live_comments" ? "live_comments" : "comments",
      });

      await processAutomationForContato(
        igAccount.organizationId,
        igAccount.id,
        contato.id,
        {
          commentText,
          text: "",
          isFirstMessage: false,
          isLiveComment: change.field === "live_comments",
          mediaId:
            change.value.media?.id ?? change.value.live_media?.id ?? "",
          commentId: change.value.id ?? "",
        },
      );
    }
  }
}

export async function processScheduledExecutions(): Promise<number> {
  const due = await prisma.igFluxoExecucao.findMany({
    where: {
      status: "WAITING",
      scheduledAt: { lte: new Date() },
    },
    take: 50,
  });

  for (const exec of due) {
    const ctx = exec.context as Record<string, unknown>;
    if (ctx.step === "reminder") {
      const fluxo = await prisma.igFluxo.findUnique({
        where: { id: exec.fluxoId },
        include: { organization: true },
      });
      const contato = await prisma.igContato.findUnique({
        where: { id: exec.contatoId },
        include: { igAccount: true },
      });

      const skip = await shouldSkipReminderExec({
        execId: exec.id,
        contatoId: exec.contatoId,
        fluxoId: exec.fluxoId,
      });

      if (
        !skip &&
        fluxo &&
        contato &&
        contato.igAccount.status === "CONNECTED" &&
        fluxo.status === "PUBLISHED" &&
        isWithin24hWindow(contato.lastInteractionAt)
      ) {
        await sendReminderStep({
          fluxoId: fluxo.id,
          organizationId: exec.organizationId,
          igAccount: contato.igAccount,
          contatoId: contato.id,
          igsid: contato.igsid,
          cfg: fluxo.triggerConfig as Record<string, unknown>,
          reminderExecId: exec.id,
        });
      }

      await prisma.igFluxoExecucao.update({
        where: { id: exec.id },
        data: { status: "COMPLETED" },
      });
      continue;
    }

    if (exec.noAtualId) {
      await prisma.igFluxoExecucao.update({
        where: { id: exec.id },
        data: { status: "RUNNING" },
      });
      await runFluxoFromNode(exec.id, exec.noAtualId);
    }
  }
  return due.length;
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const appSecret =
    process.env.SYMBIUS_IG_APP_SECRET ??
    process.env.SYMBIUS_META_APP_SECRET ??
    process.env.META_APP_SECRET ??
    "";
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) {
    return process.env.NODE_ENV !== "production";
  }
  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  const received = signatureHeader.slice(7);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex"),
    );
  } catch {
    return false;
  }
}
