import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { requireInternalAnalyst } from "@/lib/internalAccess";
import { hasEffectiveInPilotAccessFor } from "@/lib/inpilotRolloutServer";
import { formatLocalDate, parseLocalDate, previousPeriod, saoPauloCalendarDate } from "@/lib/hotelAnalysis";
import {
  buildConversationSummary,
  appendClientAnalystMemory,
  conversationTitleFromIntent,
  analystClarificationForQuestion,
  analystPlannerUsage,
  parseAnalystIntent,
  planAnalystQuestionWithOpenAI,
  prepareAnalystQuestion,
  isBroadAccountQuestion,
  protectConversationTitle,
  runOpenAIAnalyst,
  serializeAnalystIntent,
} from "@/lib/analyst/openaiAgent";
import { resolveAccountAnalysisObjective, resolveCampaignObjective, type AnalystPeriodContext } from "@/lib/analyst/dataTools";

const MESSAGE_PAGE_SIZE = 30;
const DEFAULT_TITLE = "Nova análise";
const PROCESSING_LEASE_MS = 2 * 60 * 1000;
const CLIENT_MEMORY_ACTOR_KEY = "institutional-memory";
export const dynamic = "force-dynamic";
const ASSISTANT_RESERVATION_CONTEXT = {
  retryQuestion: "",
  retryIntentToken: "",
  retryStart: "",
  retryEnd: "",
};

type RouteContext = { params: Promise<{ id: string }> };

type AnalystActor = { actorKey: string };

function jsonWithActor(body: unknown, _actor: AnalystActor, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

async function resolvePilot(id: string, user: { id: string; active: boolean; role: "ADMIN" | "ANALYST" }) {
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    select: {
      id: true,
      ativo: true,
      inPilotEnabled: true,
      nome: true,
      slug: true,
      perfilPanel: true,
      segmento: true,
      objetivoMidia: true,
      orcamentoMidiaGoogleMensal: true,
      orcamentoMidiaMetaMensal: true,
      produtoServico: true,
      modeloNegocio: true,
      publicoAlvo: true,
      objetivoProjeto: true,
      diferenciais: true,
      observacoesAnaliticas: true,
    },
  });
  if (!cliente || !(await hasEffectiveInPilotAccessFor(user, cliente))) return null;
  return cliente;
}

function conversationView(conversation: { id: string; title: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function messageView(message: {
  id: string;
  role: string;
  content: string;
  status: string;
  sources: Prisma.JsonValue | null;
  toolContext: Prisma.JsonValue | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostMicros: number | null;
  durationMs: number | null;
  createdAt: Date;
}) {
  const retryQuestion = message.status === "ERROR"
    && message.toolContext
    && typeof message.toolContext === "object"
    && !Array.isArray(message.toolContext)
    && typeof message.toolContext.retryQuestion === "string"
      ? message.toolContext.retryQuestion
      : undefined;
  const retryIntentToken = message.status === "ERROR"
    && message.toolContext
    && typeof message.toolContext === "object"
    && !Array.isArray(message.toolContext)
    && typeof message.toolContext.retryIntentToken === "string"
      ? message.toolContext.retryIntentToken
      : undefined;
  const retryStart = message.status === "ERROR"
    && message.toolContext
    && typeof message.toolContext === "object"
    && !Array.isArray(message.toolContext)
    && typeof message.toolContext.retryStart === "string"
      ? message.toolContext.retryStart
      : undefined;
  const retryEnd = message.status === "ERROR"
    && message.toolContext
    && typeof message.toolContext === "object"
    && !Array.isArray(message.toolContext)
    && typeof message.toolContext.retryEnd === "string"
      ? message.toolContext.retryEnd
      : undefined;
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status,
    sources: message.sources ?? [],
    promptTokens: message.promptTokens,
    completionTokens: message.completionTokens,
    totalTokens: message.totalTokens,
    estimatedCostMicros: message.estimatedCostMicros,
    durationMs: message.durationMs,
    retryQuestion,
    retryIntentToken,
    retryStart,
    retryEnd,
    createdAt: message.createdAt.toISOString(),
  };
}

function cleanId(value: unknown, max = 160) {
  return typeof value === "string" && /^[a-zA-Z0-9:_-]+$/.test(value)
    ? value.slice(0, max)
    : "";
}

class AnalystReservationError extends Error {
  constructor(
    message: string,
    readonly status: 409 | 429,
  ) {
    super(message);
  }
}

function plannerCostMicros(usage: { prompt: number; completion: number; total: number }) {
  const inputRate = Number(process.env.OPENAI_INPUT_USD_PER_MILLION ?? "0.4");
  const outputRate = Number(process.env.OPENAI_OUTPUT_USD_PER_MILLION ?? "1.6");
  return Math.round(usage.prompt * inputRate + usage.completion * outputRate);
}

async function terminalizeReservedAssistant(input: {
  id: string;
  content: string;
  startedAt: number;
  retryContext: Prisma.InputJsonValue;
  usage?: { prompt: number; completion: number; total: number } | null;
}) {
  try {
    const usageData = input.usage ? {
      promptTokens: input.usage.prompt,
      completionTokens: input.usage.completion,
      totalTokens: input.usage.total,
      estimatedCostMicros: plannerCostMicros(input.usage),
    } : {};
    await prisma.analystMessage.updateMany({
      where: { id: input.id, status: "PROCESSING" },
      data: {
        content: input.content,
        status: "ERROR",
        toolContext: input.retryContext,
        durationMs: Math.max(0, Date.now() - input.startedAt),
        ...usageData,
      },
    });
    return await prisma.analystMessage.findUnique({ where: { id: input.id } });
  } catch {
    // A total database outage can prevent the terminal update. Never replace
    // the safe model-facing error with a second database exception.
    return null;
  }
}

async function reserveAnalystRequest(input: {
  clienteId: string;
  userId: string;
  conversationId: string;
  userRequestKey: string;
  assistantRequestKey: string;
  question: string;
}) {
  return prisma.$transaction(async (tx) => {
    // Advisory transaction locks serialize all reservations for a client and,
    // in deterministic order, the narrower client/user quota.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inpilot:client:${input.clienteId}`}, 0))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inpilot:user:${input.clienteId}:${input.userId}`}, 0))`;

    const existingAssistant = await tx.analystMessage.findUnique({
      where: { clientRequestId: input.assistantRequestKey },
    });
    if (existingAssistant) {
      const existingUser = await tx.analystMessage.findUnique({
        where: { clientRequestId: input.userRequestKey },
      });
      return { kind: "existing" as const, assistant: existingAssistant, user: existingUser };
    }

    const now = Date.now();
    const staleProcessing = await tx.analystMessage.findMany({
      where: {
        role: "ASSISTANT",
        status: "PROCESSING",
        createdAt: { lt: new Date(now - PROCESSING_LEASE_MS) },
        conversation: { clienteId: input.clienteId },
      },
      select: { id: true, createdAt: true },
    });
    await Promise.all(staleProcessing.map((row) => tx.analystMessage.update({
      where: { id: row.id },
      data: {
        status: "ERROR",
        content: "A análise foi interrompida antes de terminar. Você pode tentar novamente.",
        durationMs: Math.max(0, now - row.createdAt.getTime()),
      },
    })));
    const [recentRequests, dailyRequests, processingRequests] = await Promise.all([
      tx.analystMessage.count({
        where: {
          role: "USER",
          createdAt: { gte: new Date(now - 60_000) },
          conversation: { clienteId: input.clienteId, ownerUserId: input.userId },
        },
      }),
      tx.analystMessage.count({
        where: {
          role: "USER",
          createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) },
          conversation: { clienteId: input.clienteId, ownerUserId: input.userId },
        },
      }),
      tx.analystMessage.count({
        where: {
          role: "ASSISTANT",
          status: "PROCESSING",
          createdAt: { gte: new Date(now - PROCESSING_LEASE_MS) },
          conversation: { clienteId: input.clienteId },
        },
      }),
    ]);
    if (recentRequests >= 5 || dailyRequests >= 100) {
      throw new AnalystReservationError("Limite de análises atingido. Aguarde antes de tentar novamente.", 429);
    }
    if (processingRequests >= 2) {
      throw new AnalystReservationError(
        "Este cliente já possui duas análises em processamento. Aguarde a conclusão antes de tentar novamente.",
        429,
      );
    }

    const user = await tx.analystMessage.create({
      data: {
        conversationId: input.conversationId,
        role: "USER",
        content: input.question,
        status: "COMPLETE",
        clientRequestId: input.userRequestKey,
        toolContext: { reservation: true },
      },
    });
    const assistant = await tx.analystMessage.create({
      data: {
        conversationId: input.conversationId,
        role: "ASSISTANT",
        content: "Consultando as fontes selecionadas e organizando os sinais…",
        status: "PROCESSING",
        clientRequestId: input.assistantRequestKey,
        toolContext: {
          ...ASSISTANT_RESERVATION_CONTEXT,
          retryQuestion: input.question,
        },
      },
    });
    return { kind: "reserved" as const, assistant, user };
  });
}

function intentFromToolContext(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("protectedIntent" in value)) return undefined;
  return parseAnalystIntent(value.protectedIntent) ?? undefined;
}

function friendlyAIError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : null;
  if (status === 401 || status === 403) return "A credencial da OpenAI está inválida ou sem permissão.";
  if (status === 429) return "A OpenAI atingiu o limite de uso. Aguarde um momento e tente novamente.";
  if (error instanceof Error && /tempo limite|timeout/i.test(error.message)) {
    return "A análise demorou mais do que o esperado. Tente novamente com uma pergunta mais específica.";
  }
  if (error instanceof Error && /OPENAI_API_KEY/.test(error.message)) {
    return "A inteligência do InPilot ainda não foi configurada.";
  }
  return "Não foi possível concluir a análise agora. Os dados e a pergunta foram preservados para uma nova tentativa.";
}

async function findScopedConversation(id: string, clienteId: string, ownerUserId: string) {
  return prisma.analystConversation.findFirst({ where: { id, clienteId, ownerUserId } });
}

async function refreshConversationSummary(conversationId: string, title: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inout:analyst-conversation:${conversationId}`}, 0))`;
    const current = await tx.analystConversation.findUnique({ where: { id: conversationId }, select: { summary: true } });
    if (!current) return;
    const rows = await tx.analystMessage.findMany({
      where: { conversationId, status: "COMPLETE" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 12,
      select: { role: true, content: true, toolContext: true },
    });
    const summary = buildConversationSummary(rows.reverse().map((message) => ({
      role: message.role === "USER" ? "USER" : "ASSISTANT",
      content: message.content,
      intent: message.role === "USER" ? intentFromToolContext(message.toolContext) : undefined,
    })), current.summary);
    await tx.analystConversation.update({ where: { id: conversationId }, data: { title, summary } });
  });
}

async function loadInstitutionalClientMemory(clienteId: string) {
  const existing = await prisma.analystConversation.findFirst({
    where: { clienteId, actorKey: CLIENT_MEMORY_ACTOR_KEY, ownerUserId: null },
    select: { summary: true },
  });
  if (existing?.summary) return existing.summary;
  const priorAnswers = await prisma.analystMessage.findMany({
    where: {
      conversation: { clienteId, ownerUserId: { not: null } },
      role: "ASSISTANT",
      status: "COMPLETE",
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 12,
    select: { content: true },
  });
  return priorAnswers.reverse().reduce(
    (memory, message) => appendClientAnalystMemory(memory, message.content),
    "",
  );
}

async function appendInstitutionalClientMemory(clienteId: string, answer: string, seedMemory = "") {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inout:analyst-client-memory:${clienteId}`}, 0))`;
    const existing = await tx.analystConversation.findFirst({
      where: { clienteId, actorKey: CLIENT_MEMORY_ACTOR_KEY, ownerUserId: null },
      select: { id: true, summary: true },
    });
    const summary = appendClientAnalystMemory(existing?.summary ?? seedMemory, answer);
    if (existing) {
      await tx.analystConversation.update({ where: { id: existing.id }, data: { summary } });
    } else {
      await tx.analystConversation.create({
        data: {
          clienteId,
          actorKey: CLIENT_MEMORY_ACTOR_KEY,
          ownerUserId: null,
          title: "Memória institucional",
          summary,
        },
      });
    }
  });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const authz = await requireInternalAnalyst();
  if (authz.response) return authz.response;
  const actor = { actorKey: `user:${authz.user.id}` };
  const { id } = await params;
  const cliente = await resolvePilot(id, authz.user);
  if (!cliente) return NextResponse.json({ error: "Recurso indisponível" }, { status: 404 });

  const conversations = await prisma.analystConversation.findMany({
    where: { clienteId: id, ownerUserId: authz.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  const conversationId = cleanId(request.nextUrl.searchParams.get("conversationId"));
  if (!conversationId) {
    return jsonWithActor({ conversations: conversations.map(conversationView) }, actor);
  }

  const conversation = await findScopedConversation(conversationId, id, authz.user.id);
  if (!conversation) return jsonWithActor({ error: "Conversa não encontrada" }, actor, { status: 404 });

  const staleMessages = await prisma.analystMessage.findMany({
    where: {
      conversationId,
      status: "PROCESSING",
      createdAt: { lt: new Date(Date.now() - PROCESSING_LEASE_MS) },
    },
    select: { id: true, createdAt: true },
  });
  await Promise.all(staleMessages.map((stale) => prisma.analystMessage.update({
    where: { id: stale.id },
    data: {
      status: "ERROR",
      content: "A análise foi interrompida antes de terminar. Você pode tentar novamente.",
      durationMs: Math.max(0, Date.now() - stale.createdAt.getTime()),
    },
  })));
  const cursor = cleanId(request.nextUrl.searchParams.get("cursor"));
  const rows = await prisma.analystMessage.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MESSAGE_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      role: true,
      content: true,
      status: true,
      sources: true,
      toolContext: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      estimatedCostMicros: true,
      durationMs: true,
      createdAt: true,
    },
  });
  const hasMore = rows.length > MESSAGE_PAGE_SIZE;
  const page = rows.slice(0, MESSAGE_PAGE_SIZE);
  const nextCursor = hasMore ? page.at(-1)?.id ?? null : null;

  return jsonWithActor({
    conversations: conversations.map(conversationView),
    messages: page.reverse().map(messageView),
    nextCursor,
  }, actor);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const authz = await requireInternalAnalyst();
  if (authz.response) return authz.response;
  const actor = { actorKey: `user:${authz.user.id}` };
  const { id } = await params;
  const cliente = await resolvePilot(id, authz.user);
  if (!cliente) return NextResponse.json({ error: "Recurso indisponível" }, { status: 404 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action === "ask" ? "ask" : body.action === "create" ? "create" : "";
  if (!action) return jsonWithActor({ error: "Ação inválida" }, actor, { status: 400 });

  if (action === "create") {
    const conversation = await prisma.analystConversation.create({
      data: { clienteId: id, actorKey: actor.actorKey, ownerUserId: authz.user.id },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    return jsonWithActor({ conversation: conversationView(conversation) }, actor, { status: 201 });
  }

  const sanitized = prepareAnalystQuestion(body.question);
  if (sanitized.unsafe) {
    return jsonWithActor({
      error: "Por segurança, reformule a pergunta sem nomes de pessoas, endereços ou outros identificadores pessoais.",
    }, actor, { status: 400 });
  }
  const question = sanitized.originalText;
  if (!question) return jsonWithActor({ error: "Informe uma pergunta" }, actor, { status: 400 });
  const requestedConversationId = cleanId(body.conversationId);
  if (!requestedConversationId) {
    return jsonWithActor({ error: "Crie ou selecione uma conversa antes de perguntar" }, actor, { status: 400 });
  }
  const conversation = await findScopedConversation(requestedConversationId, id, authz.user.id);
  if (!conversation) {
    return jsonWithActor({ error: "Conversa não encontrada" }, actor, { status: 404 });
  }
  const requestDeadline = Date.now() + 45_000;
  const remainingRequestMs = () => requestDeadline - Date.now();
  // Idempotência é resolvida antes do planejador: retries do cliente não
  // devem gastar outra chamada à OpenAI nem consultar o banco novamente.
  const suppliedKey = cleanId(body.idempotencyKey, 120);
  if (!suppliedKey) return jsonWithActor({ error: "Identificador de envio inválido" }, actor, { status: 400 });
  const requestKey = `${conversation.id}:${suppliedKey}`;
  const userRequestKey = `${requestKey}:user`;
  const assistantRequestKey = `${requestKey}:assistant`;
  const existingAssistant = await prisma.analystMessage.findUnique({
    where: { clientRequestId: assistantRequestKey },
  });
  if (existingAssistant) {
    if (existingAssistant.conversationId !== conversation.id) {
      return jsonWithActor({ error: "Identificador de envio já utilizado" }, actor, { status: 409 });
    }
    const existingUser = await prisma.analystMessage.findUnique({ where: { clientRequestId: userRequestKey } });
    const now = Date.now();
    if (existingAssistant.status === "PROCESSING" && existingAssistant.createdAt.getTime() < now - PROCESSING_LEASE_MS) {
      const stale = await prisma.analystMessage.update({
        where: { id: existingAssistant.id },
        data: {
          status: "ERROR",
          content: "A análise foi interrompida antes de terminar. Você pode tentar novamente.",
          durationMs: Math.max(0, now - existingAssistant.createdAt.getTime()),
        },
      });
      return jsonWithActor({
        conversation: conversationView(conversation),
        userMessage: existingUser ? messageView(existingUser) : undefined,
        message: messageView(stale),
      }, actor);
    }
    return jsonWithActor({
      conversation: conversationView(conversation),
      userMessage: existingUser ? messageView(existingUser) : undefined,
      message: messageView(existingAssistant),
    }, actor);
  }
  const reservationStartedAt = Date.now();
  let reservation;
  try {
    reservation = await reserveAnalystRequest({
      clienteId: id,
      userId: authz.user.id,
      conversationId: conversation.id,
      userRequestKey,
      assistantRequestKey,
      question,
    });
  } catch (error) {
    if (error instanceof AnalystReservationError) {
      return jsonWithActor({ error: error.message }, actor, { status: error.status });
    }
    throw error;
  }
  if (reservation.kind === "existing") {
    return jsonWithActor({
      conversation: conversationView(conversation),
      userMessage: reservation.user ? messageView(reservation.user) : undefined,
      message: messageView(reservation.assistant),
    }, actor);
  }
  const userMessage = reservation.user;
  const assistantMessage = reservation.assistant;
  if (remainingRequestMs() <= 0) {
    const failed = await terminalizeReservedAssistant({
      id: assistantMessage.id,
      content: "A análise excedeu o tempo limite antes de consultar a IA. Tente novamente.",
      retryContext: { ...ASSISTANT_RESERVATION_CONTEXT, retryQuestion: question },
      startedAt: reservationStartedAt,
    });
    return failed
      ? jsonWithActor({ conversation: conversationView(conversation), userMessage: messageView(userMessage), message: messageView(failed) }, actor, { status: 504 })
      : jsonWithActor({ error: "A análise excedeu o tempo limite antes de consultar a IA. Tente novamente." }, actor, { status: 504 });
  }
  const analysisStartedAt = reservationStartedAt;
  const retryIntent = parseAnalystIntent(body.retryIntentToken);
  const retryStart = parseLocalDate(body.retryStart);
  const retryEnd = parseLocalDate(body.retryEnd);
  if (body.retryIntentToken && (!retryIntent || !retryStart || !retryEnd || retryStart > retryEnd)) {
    const failed = await terminalizeReservedAssistant({
      id: assistantMessage.id,
      content: "O contexto desta tentativa não é mais válido. Envie a pergunta novamente.",
      retryContext: { ...ASSISTANT_RESERVATION_CONTEXT, retryQuestion: question },
      startedAt: analysisStartedAt,
    });
    return failed
      ? jsonWithActor({ conversation: conversationView(conversation), userMessage: messageView(userMessage), message: messageView(failed) }, actor, { status: 400 })
      : jsonWithActor({ error: "O contexto desta tentativa não é mais válido. Envie a pergunta novamente." }, actor, { status: 400 });
  }
  let recentRows: { role: string; content: string; toolContext: Prisma.JsonValue | null }[] = [];
  let clientMemory = "";
  let sourceAvailability = { metaAds: false, googleAds: false, crm: false, analytics: false };
  let planned: Awaited<ReturnType<typeof planAnalystQuestionWithOpenAI>>;
  try {
    recentRows = await prisma.analystMessage.findMany({
      where: {
        conversationId: conversation.id,
        status: "COMPLETE",
        id: { not: userMessage.id },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 12,
      select: { role: true, content: true, toolContext: true },
    });
    const [metaRecord, googleCampaign, crmRecord, analyticsRecord, institutionalMemory] = await Promise.all([
      prisma.fatoMidiaDiario.findFirst({ where: { clienteId: id, canal: "META" }, select: { id: true } }),
      prisma.googleAdsCampanha.findFirst({ where: { clienteId: id }, select: { id: true } }),
      prisma.leadCrm.findFirst({ where: { clienteId: id }, select: { id: true } }),
      prisma.fatoAnalyticsDiario.findFirst({ where: { clienteId: id }, select: { id: true } }),
      loadInstitutionalClientMemory(id),
    ]);
    sourceAvailability = {
      metaAds: Boolean(metaRecord),
      googleAds: Boolean(googleCampaign),
      crm: Boolean(crmRecord),
      analytics: Boolean(analyticsRecord),
    };
    clientMemory = institutionalMemory;
    planned = retryIntent && retryStart && retryEnd
      ? {
          intent: retryIntent,
          period: {
            start: formatLocalDate(retryStart),
            end: formatLocalDate(retryEnd),
            basis: "question" as const,
          },
          usage: { prompt: 0, completion: 0, total: 0 },
        }
      : await planAnalystQuestionWithOpenAI({
          question,
          conversationSummary: conversation.summary,
          clientMemory,
          recentMessages: recentRows.slice().reverse().map((message) => ({
            role: message.role === "USER" ? "USER" : "ASSISTANT",
            content: message.content,
          })),
          timeoutMs: Math.min(20_000, Math.max(1, remainingRequestMs())),
          sourceAvailability,
        });
  } catch (error) {
    const failed = await terminalizeReservedAssistant({
      id: assistantMessage.id,
      content: friendlyAIError(error),
      retryContext: { ...ASSISTANT_RESERVATION_CONTEXT, retryQuestion: question },
      startedAt: analysisStartedAt,
      usage: analystPlannerUsage(error),
    });
    return failed
      ? jsonWithActor({ conversation: conversationView(conversation), userMessage: messageView(userMessage), message: messageView(failed), piiRedacted: sanitized.redacted }, actor)
      : jsonWithActor({ error: friendlyAIError(error), piiRedacted: sanitized.redacted }, actor, { status: 500 });
  }
  try {
    await prisma.$transaction([
      prisma.analystMessage.update({
        where: { id: userMessage.id },
        data: { toolContext: { protectedIntent: planned.intent } },
      }),
      prisma.analystMessage.update({
        where: { id: assistantMessage.id },
        data: {
          promptTokens: planned.usage.prompt,
          completionTokens: planned.usage.completion,
          totalTokens: planned.usage.total,
          estimatedCostMicros: plannerCostMicros(planned.usage),
        },
      }),
    ]);
  } catch (error) {
    const failed = await terminalizeReservedAssistant({
      id: assistantMessage.id,
      content: friendlyAIError(error),
      retryContext: { ...ASSISTANT_RESERVATION_CONTEXT, retryQuestion: question },
      startedAt: analysisStartedAt,
      usage: planned.usage,
    });
    return failed
      ? jsonWithActor({ conversation: conversationView(conversation), userMessage: messageView(userMessage), message: messageView(failed) }, actor)
      : jsonWithActor({ error: friendlyAIError(error) }, actor, { status: 500 });
  }
  if (remainingRequestMs() <= 0) {
    const failed = await terminalizeReservedAssistant({
      id: assistantMessage.id,
      content: "A interpretação da pergunta excedeu o tempo limite. Tente novamente.",
      retryContext: { ...ASSISTANT_RESERVATION_CONTEXT, retryQuestion: question },
      startedAt: analysisStartedAt,
      usage: planned.usage,
    });
    return failed
      ? jsonWithActor({ conversation: conversationView(conversation), userMessage: messageView(userMessage), message: messageView(failed) }, actor, { status: 504 })
      : jsonWithActor({ error: "A interpretação da pergunta excedeu o tempo limite. Tente novamente." }, actor, { status: 504 });
  }
  const analystIntent = planned.intent;
  const clarification = analystClarificationForQuestion(question, analystIntent);
  if (clarification) {
    try {
      const clarificationUsage = planned.usage;
      const clarifiedUser = await prisma.analystMessage.update({
        where: { id: userMessage.id },
        data: { toolContext: { protectedIntent: analystIntent } },
      });
      const clarifiedAssistant = await prisma.analystMessage.update({
        where: { id: assistantMessage.id },
        data: {
          content: clarification,
          status: "COMPLETE",
          toolContext: { clarification: true, protectedIntent: analystIntent },
          promptTokens: clarificationUsage.prompt,
          completionTokens: clarificationUsage.completion,
          totalTokens: clarificationUsage.total,
          estimatedCostMicros: plannerCostMicros(clarificationUsage),
          durationMs: Math.max(0, Date.now() - analysisStartedAt),
        },
      });
      const updatedConversation = await prisma.analystConversation.update({
        where: { id: conversation.id },
        data: {
          title: conversation.title === DEFAULT_TITLE ? conversationTitleFromIntent(analystIntent) : conversation.title,
        },
        select: { id: true, title: true, createdAt: true, updatedAt: true },
      });
      return jsonWithActor({
        conversation: conversationView(updatedConversation),
        userMessage: messageView(clarifiedUser),
        message: messageView(clarifiedAssistant),
        clarification: true,
      }, actor);
    } catch (error) {
      const failed = await terminalizeReservedAssistant({
        id: assistantMessage.id,
        content: friendlyAIError(error),
        retryContext: { ...ASSISTANT_RESERVATION_CONTEXT, retryQuestion: question },
        startedAt: analysisStartedAt,
        usage: planned.usage,
      });
      return failed
        ? jsonWithActor({ conversation: conversationView(conversation), userMessage: messageView(userMessage), message: messageView(failed) }, actor)
        : jsonWithActor({ error: friendlyAIError(error) }, actor, { status: 500 });
    }
  }
  const plannedStart = parseLocalDate(planned.period.start);
  const plannedEnd = parseLocalDate(planned.period.end);
  if (planned.period.basis === "question" && (!plannedStart || !plannedEnd || plannedStart > plannedEnd)) {
    const failed = await terminalizeReservedAssistant({
      id: assistantMessage.id,
      content: "Não foi possível interpretar o período informado na pergunta",
      retryContext: { ...ASSISTANT_RESERVATION_CONTEXT, retryQuestion: question },
      startedAt: analysisStartedAt,
      usage: planned.usage,
    });
    return failed
      ? jsonWithActor({ conversation: conversationView(conversation), userMessage: messageView(userMessage), message: messageView(failed) }, actor, { status: 400 })
      : jsonWithActor({ error: "Não foi possível interpretar o período informado na pergunta" }, actor, { status: 400 });
  }
  let start: Date;
  let endDay: Date;
  try {
    const [mediaRange, googleRange, analyticsRange, crmRange] = plannedStart ? [null, null, null, null] : await Promise.all([
      prisma.fatoMidiaDiario.aggregate({ where: { clienteId: id }, _min: { data: true } }),
      prisma.googleAdsCampanha.aggregate({ where: { clienteId: id }, _min: { data: true } }),
      prisma.fatoAnalyticsDiario.aggregate({ where: { clienteId: id }, _min: { data: true } }),
      prisma.leadCrm.aggregate({ where: { clienteId: id }, _min: { dataEntrada: true } }),
    ]);
    const historicalStarts = [
      mediaRange?._min.data,
      googleRange?._min.data,
      analyticsRange?._min.data,
      crmRange?._min.dataEntrada,
    ].filter((value): value is Date => value instanceof Date);
    if (remainingRequestMs() <= 0) {
      throw new Error("A consulta do período excedeu o tempo limite. Tente novamente.");
    }
    start = plannedStart
      ?? historicalStarts.sort((left, right) => left.getTime() - right.getTime())[0]
      ?? parseLocalDate(body.dataInicio);
    endDay = plannedEnd ?? saoPauloCalendarDate();
    if (!start || !endDay || start > endDay) {
      throw new Error("Período inválido");
    }
  } catch (error) {
    const failed = await terminalizeReservedAssistant({
      id: assistantMessage.id,
      content: friendlyAIError(error),
      retryContext: { ...ASSISTANT_RESERVATION_CONTEXT, retryQuestion: question },
      startedAt: analysisStartedAt,
      usage: planned.usage,
    });
    const status = error instanceof Error && /tempo limite/i.test(error.message) ? 504 : 400;
    return failed
      ? jsonWithActor({ conversation: conversationView(conversation), userMessage: messageView(userMessage), message: messageView(failed) }, actor, { status })
      : jsonWithActor({ error: friendlyAIError(error) }, actor, { status });
  }
  const retryContext = {
    retryQuestion: question,
    retryIntentToken: serializeAnalystIntent(analystIntent),
    retryStart: formatLocalDate(start),
    retryEnd: formatLocalDate(endDay),
  };
  try {
    await prisma.analystMessage.update({
      where: { id: assistantMessage.id },
      data: { toolContext: retryContext },
    });
  } catch (error) {
    const failed = await terminalizeReservedAssistant({
      id: assistantMessage.id,
      content: friendlyAIError(error),
      retryContext: retryContext as Prisma.InputJsonValue,
      startedAt: analysisStartedAt,
      usage: planned.usage,
    });
    return failed
      ? jsonWithActor({ conversation: conversationView(conversation), userMessage: messageView(userMessage), message: messageView(failed) }, actor)
      : jsonWithActor({ error: friendlyAIError(error) }, actor, { status: 500 });
  }

  const end = new Date(endDay);
  end.setHours(23, 59, 59, 999);
  const comparison = previousPeriod(
    start,
    endDay,
    null,
  );
  const previousEnd = new Date(comparison.end);
  previousEnd.setHours(23, 59, 59, 999);
  // O chat usa todas as fontes da conta; plataforma específica vem da pergunta interpretada pela IA.
  const channel = "geral" as const;
  try {
    const commerceSignals = await prisma.fatoMidiaDiario.aggregate({
      where: { clienteId: id, canal: "META", data: { gte: start, lte: end } },
      _sum: {
        purchases: true,
        websitePurchasesConversionValue: true,
        messagingConversationsStarted: true,
      },
    });
    if (remainingRequestMs() <= 0) {
      throw new Error("A preparação dos dados excedeu o tempo limite");
    }
    const resolvedObjective = resolveAccountAnalysisObjective(cliente.objetivoMidia, {
      purchases: commerceSignals._sum.purchases,
      attributedValue: Number(commerceSignals._sum.websitePurchasesConversionValue ?? 0),
    });
    const resolvedTaxonomy = resolveCampaignObjective({
      accountObjective: cliente.objetivoMidia,
      observed: {
        conversations: commerceSignals._sum.messagingConversationsStarted,
        purchases: commerceSignals._sum.purchases,
        revenue: Number(commerceSignals._sum.websitePurchasesConversionValue ?? 0),
      },
    });
    const analystContext: AnalystPeriodContext = {
      clienteId: id,
      nome: cliente.nome,
      segmento: cliente.segmento,
      objetivoMidia: cliente.objetivoMidia,
      analysisObjective: resolvedObjective.objective,
      analysisObjectiveBasis: resolvedObjective.basis,
      objectiveTaxonomy: resolvedTaxonomy.objective,
      objectiveTaxonomyBasis: resolvedTaxonomy.source,
      orcamentoMidiaGoogleMensal: cliente.orcamentoMidiaGoogleMensal == null ? null : Number(cliente.orcamentoMidiaGoogleMensal),
      orcamentoMidiaMetaMensal: cliente.orcamentoMidiaMetaMensal == null ? null : Number(cliente.orcamentoMidiaMetaMensal),
      start,
      end,
      previousStart: comparison.start,
      previousEnd,
      startLabel: formatLocalDate(start),
      endLabel: formatLocalDate(endDay),
      previousStartLabel: formatLocalDate(comparison.start),
      previousEndLabel: formatLocalDate(comparison.end),
      channel,
      accountWide: isBroadAccountQuestion(question),
      hasMetaData: sourceAvailability.metaAds,
      hasGoogleCampaigns: sourceAvailability.googleAds,
      hasCrmData: sourceAvailability.crm,
      hasAnalyticsData: sourceAvailability.analytics,
      commercialContext: {
        produtoServico: cliente.produtoServico,
        modeloNegocio: cliente.modeloNegocio,
        publicoAlvo: cliente.publicoAlvo,
        objetivoProjeto: cliente.objetivoProjeto,
        diferenciais: cliente.diferenciais,
        observacoesAnaliticas: cliente.observacoesAnaliticas,
      },
    };
    const result = await runOpenAIAnalyst({
      question,
      intent: analystIntent,
      conversationSummary: conversation.summary,
      clientMemory,
      recentMessages: recentRows.reverse().map((message) => ({
        role: message.role === "USER" ? "USER" : "ASSISTANT",
        content: message.content,
        intent: message.role === "USER" ? intentFromToolContext(message.toolContext) : undefined,
      })),
      context: analystContext,
      initialUsage: planned.usage,
      maxOutputTokens: 750,
      timeoutMs: Math.max(1, remainingRequestMs()),
    });
    const completed = await prisma.analystMessage.update({
      where: { id: assistantMessage.id },
      data: {
        content: result.answer,
        status: "COMPLETE",
        sources: result.sources as Prisma.InputJsonValue,
        toolContext: result.toolContext as Prisma.InputJsonValue,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        estimatedCostMicros: result.estimatedCostMicros,
        durationMs: Math.max(0, Date.now() - analysisStartedAt),
      },
    });
    const newTitle = conversation.title === DEFAULT_TITLE ? conversationTitleFromIntent(analystIntent) : conversation.title;
    await Promise.allSettled([
      refreshConversationSummary(conversation.id, newTitle),
      appendInstitutionalClientMemory(id, result.answer, clientMemory),
    ]);
    const updatedConversation = await prisma.analystConversation.findUniqueOrThrow({
      where: { id: conversation.id },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });

    return jsonWithActor({
      conversation: conversationView(updatedConversation),
      userMessage: messageView(userMessage),
      message: messageView(completed),
      piiRedacted: sanitized.redacted,
    }, actor);
  } catch (error) {
    const failed = await terminalizeReservedAssistant({
      id: assistantMessage.id,
      content: friendlyAIError(error),
      retryContext: retryContext as Prisma.InputJsonValue,
      startedAt: analysisStartedAt,
      usage: null,
    });
    try {
      await prisma.analystConversation.update({
        where: { id: conversation.id },
        data: { title: conversation.title === DEFAULT_TITLE ? conversationTitleFromIntent(sanitized.intent) : conversation.title },
      });
    } catch {
      // The assistant terminal state is the lifecycle invariant; title is best effort.
    }
    return failed
      ? jsonWithActor({
          conversation: conversationView(conversation),
          userMessage: messageView(userMessage),
          message: messageView(failed),
          piiRedacted: sanitized.redacted,
        }, actor)
      : jsonWithActor({ error: friendlyAIError(error), piiRedacted: sanitized.redacted }, actor, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const authz = await requireInternalAnalyst();
  if (authz.response) return authz.response;
  const actor = { actorKey: `user:${authz.user.id}` };
  const { id } = await params;
  const cliente = await resolvePilot(id, authz.user);
  if (!cliente) return NextResponse.json({ error: "Recurso indisponível" }, { status: 404 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const conversationId = cleanId(body.conversationId);
  const requestedTitle = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  const guardedTitle = protectConversationTitle(requestedTitle);
  if (!conversationId || !requestedTitle) return jsonWithActor({ error: "Dados inválidos" }, actor, { status: 400 });
  if (guardedTitle.unsafe) {
    return jsonWithActor({ error: "O título não pode conter dados pessoais" }, actor, { status: 400 });
  }
  const conversation = await findScopedConversation(conversationId, id, authz.user.id);
  if (!conversation) return jsonWithActor({ error: "Conversa não encontrada" }, actor, { status: 404 });
  const updated = await prisma.analystConversation.update({
    where: { id: conversationId },
    data: { title: guardedTitle.text },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return jsonWithActor({ conversation: conversationView(updated) }, actor);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const authz = await requireInternalAnalyst();
  if (authz.response) return authz.response;
  const actor = { actorKey: `user:${authz.user.id}` };
  const { id } = await params;
  const cliente = await resolvePilot(id, authz.user);
  if (!cliente) return NextResponse.json({ error: "Recurso indisponível" }, { status: 404 });
  const conversationId = cleanId(request.nextUrl.searchParams.get("conversationId"));
  if (!conversationId) return jsonWithActor({ error: "Conversa inválida" }, actor, { status: 400 });
  const conversation = await findScopedConversation(conversationId, id, authz.user.id);
  if (!conversation) return jsonWithActor({ error: "Conversa não encontrada" }, actor, { status: 404 });
  await prisma.analystConversation.delete({ where: { id: conversationId } });
  return jsonWithActor({ ok: true }, actor);
}