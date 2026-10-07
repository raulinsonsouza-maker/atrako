import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { isModuleEnabled, resolveModules } from "@/lib/modules/resolve";
import { loadWorkspaceContext } from "@/lib/atrako-agent/context";
import { resolveAssistantSession, type AssistantSession } from "@/lib/atrako-agent/session";
import { WEB_TOOLS } from "@/lib/atrako-agent/web";
import { CREATOR_TOOLS } from "@/lib/atrako-agent/creator";
import { createLlmClient, describeLlmError, resolveLlmChain } from "@/lib/atrako-agent/llm";
import { setCooldown } from "@/lib/atrako-agent/failover";
import { EngineError, estimateCostMicros, runAtrakoEngine, type EngineEvent, type EngineStep } from "@/lib/atrako-agent/engine";
import { toolsForWorkspace, type PendingAction } from "@/lib/atrako-agent/tools";
import { executePendingAction, type ActionResult } from "@/lib/atrako-agent/actions";
import { createPiiVault, protectUserText } from "@/lib/atrako-agent/safety";
import { checkAssistantRateLimit } from "@/lib/atrako-agent/limits";
import { historyNote, type Artifact } from "@/lib/atrako-agent/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_TITLE = "Nova conversa";
const MAX_MESSAGE_CHARS = 4000;

type Session = AssistantSession;
const resolveSession = resolveAssistantSession;

type ToolContext = {
  steps?: Array<Pick<EngineStep, "tool" | "label" | "source" | "coverage">>;
  pendingAction?: PendingAction | null;
  actionStatus?: "pending" | "confirmed" | "cancelled" | "failed";
  actionResult?: ActionResult | null;
  artifacts?: Artifact[];
  rounds?: number;
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  status: string;
  toolContext: Prisma.JsonValue | null;
  createdAt: Date;
};

function messageView(m: MessageRow) {
  const tc = (m.toolContext ?? {}) as ToolContext;
  return {
    id: m.id,
    role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
    content: m.content,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    steps: tc.steps ?? [],
    pendingAction: tc.pendingAction ?? null,
    actionStatus: tc.actionStatus ?? null,
    actionResult: tc.actionResult ?? null,
    artifacts: tc.artifacts ?? [],
  };
}

function conversationView(c: { id: string; title: string; createdAt: Date; updatedAt: Date }) {
  return { id: c.id, title: c.title, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() };
}

const messageSelect = { id: true, role: true, content: true, status: true, toolContext: true, createdAt: true } as const;

async function ownConversation(session: Session, id: unknown) {
  if (typeof id !== "string" || !id.trim()) return null;
  return prisma.atrakoConversation.findFirst({
    where: { id: id.trim(), clienteId: session.workspaceId, actorKey: session.actor.key },
  });
}

function titleFrom(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t || DEFAULT_TITLE;
}

export async function GET(request: NextRequest) {
  const s = await resolveSession();
  if (!s.ok) return s.response;
  const { session } = s;

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (conversationId) {
    const conversation = await ownConversation(session, conversationId);
    if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    const messages = await prisma.atrakoMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: messageSelect,
      take: 200,
    });
    return NextResponse.json({ conversation: conversationView(conversation), messages: messages.map(messageView) });
  }

  const [conversations, chain] = await Promise.all([
    prisma.atrakoConversation.findMany({
      where: { clienteId: session.workspaceId, actorKey: session.actor.key },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    }),
    resolveLlmChain(session.workspaceId),
  ]);
  return NextResponse.json({
    workspaceId: session.workspaceId,
    conversations: conversations.map(conversationView),
    ai: {
      ready: chain.configured,
      canManage: session.actor.canManage,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const s = await resolveSession();
  if (!s.ok) return s.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const conversation = await ownConversation(s.session, body?.conversationId);
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  const title = typeof body?.title === "string" ? body.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (!title) return NextResponse.json({ error: "Título vazio" }, { status: 400 });
  const updated = await prisma.atrakoConversation.update({
    where: { id: conversation.id },
    data: { title },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ conversation: conversationView(updated) });
}

export async function DELETE(request: NextRequest) {
  const s = await resolveSession();
  if (!s.ok) return s.response;
  const conversation = await ownConversation(s.session, request.nextUrl.searchParams.get("conversationId"));
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  await prisma.atrakoConversation.delete({ where: { id: conversation.id } });
  return NextResponse.json({ ok: true });
}

/** Confirma/cancela o rascunho proposto numa mensagem do Atrako. */
async function handleDecision(session: Session, body: Record<string, unknown>) {
  const conversation = await ownConversation(session, body.conversationId);
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  const messageId = typeof body.messageId === "string" ? body.messageId : "";
  const row = await prisma.atrakoMessage.findFirst({
    where: { id: messageId, conversationId: conversation.id, role: "ASSISTANT" },
    select: messageSelect,
  });
  const tc = (row?.toolContext ?? {}) as ToolContext;
  if (!row || !tc.pendingAction || tc.actionStatus !== "pending") {
    return NextResponse.json({ error: "Não há ação pendente nesta mensagem" }, { status: 409 });
  }
  const action = tc.pendingAction;

  let next: ToolContext;
  let reply: string;
  if (body.decision === "cancel") {
    next = { ...tc, actionStatus: "cancelled" };
    reply = "Tudo bem, não criei nada. Se quiser, me diga o que ajustar e eu monto de novo.";
  } else {
    if (action.tool === "criar_formulario_rascunho" && !(await isModuleEnabled(session.workspaceId, "forms"))) {
      return NextResponse.json({ error: "O módulo Formulários está desativado neste workspace." }, { status: 403 });
    }
    try {
      const result = await executePendingAction(session.workspaceId, action);
      next = { ...tc, actionStatus: "confirmed", actionResult: result };
      reply =
        result.kind === "landing_page"
          ? `Pronto! Criei a landing page **${result.name}** como rascunho. Ela ainda não está no ar — abra para revisar e publicar quando quiser.`
          : `Pronto! Criei o formulário **${result.name}** como rascunho. Revise as perguntas e publique quando estiver tudo certo.`;
    } catch (error) {
      console.warn("[atrako-assistant] action", error instanceof Error ? error.message : error);
      next = { ...tc, actionStatus: "failed" };
      reply = "Não consegui criar o rascunho agora. Tente confirmar de novo em instantes.";
    }
  }

  const [updated, followUp] = await prisma.$transaction([
    prisma.atrakoMessage.update({
      where: { id: row.id },
      data: { toolContext: next as unknown as Prisma.InputJsonValue },
      select: messageSelect,
    }),
    prisma.atrakoMessage.create({
      data: {
        conversationId: conversation.id,
        clienteId: session.workspaceId,
        role: "ASSISTANT",
        content: reply,
        status: "COMPLETE",
        toolContext: (next.actionResult ? { actionResult: next.actionResult } : {}) as Prisma.InputJsonValue,
      },
      select: messageSelect,
    }),
    prisma.atrakoConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }),
  ]);
  return NextResponse.json({ message: messageView(updated), followUp: messageView(followUp) });
}

function sse(event: string, data: unknown) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
  const s = await resolveSession();
  if (!s.ok) return s.response;
  const { session } = s;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  if (body.decision === "confirm" || body.decision === "cancel") return handleDecision(session, body);

  const text = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_CHARS) : "";
  if (!text) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

  const chain = await resolveLlmChain(session.workspaceId);
  if (!chain.configured) {
    return NextResponse.json(
      { error: "ai_not_configured", message: "Conecte sua IA em Config → IA para conversar com o Atrako." },
      { status: 409 },
    );
  }

  const limit = await checkAssistantRateLimit(session.workspaceId);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: limit.message },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const clientRequestId =
    typeof body.clientRequestId === "string" && body.clientRequestId.trim()
      ? `${session.workspaceId}:${body.clientRequestId.trim().slice(0, 100)}`
      : null;
  if (clientRequestId) {
    const dup = await prisma.atrakoMessage.findUnique({ where: { clientRequestId }, select: { id: true } });
    if (dup) return NextResponse.json({ error: "Mensagem já enviada" }, { status: 409 });
  }

  let conversation = await ownConversation(session, body.conversationId);
  if (body.conversationId && !conversation) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }
  if (!conversation) {
    conversation = await prisma.atrakoConversation.create({
      data: { clienteId: session.workspaceId, actorKey: session.actor.key, title: titleFrom(text) },
    });
  }

  const traceId = crypto.randomUUID();
  const history = await prisma.atrakoMessage.findMany({
    where: { conversationId: conversation.id, status: "COMPLETE" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 12,
    select: { role: true, content: true, toolContext: true },
  });
  const userMessage = await prisma.atrakoMessage.create({
    data: {
      conversationId: conversation.id,
      clienteId: session.workspaceId,
      role: "USER",
      content: text,
      status: "COMPLETE",
      traceId,
      clientRequestId,
    },
    select: messageSelect,
  });

  const vault = createPiiVault();
  const protectedHistory = history.reverse().map((m) => ({
    role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
    content:
      protectUserText(m.content, vault).text +
      (m.role === "USER" ? "" : historyNote(((m.toolContext ?? {}) as ToolContext).artifacts)),
  }));
  const question = protectUserText(text, vault).text;

  const conv = conversation;
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(sse(event, data));
        } catch {
          open = false;
        }
      };
      send("meta", { conversation: conversationView(conv), userMessage: messageView(userMessage), traceId });
      // Geração de página pode passar de 1 min sem texto: comentário SSE mantém proxies abertos.
      const keepAlive = setInterval(() => {
        if (!open) return;
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          open = false;
        }
      }, 15_000);

      try {
        const ctx = await loadWorkspaceContext({
          clienteId: session.workspaceId,
          actor: session.actor,
          modules: await resolveModules(session.workspaceId),
        });
        if (!ctx) throw new EngineError("Workspace não encontrado.", "llm");

        const result = await runAtrakoEngine({
          candidates: chain.candidates,
          makeClient: createLlmClient,
          onFailover: (candidate, failure, error) => {
            console.warn(
              "[atrako-assistant] failover",
              traceId,
              candidate.key,
              failure.reason,
              error instanceof Error ? error.message.slice(0, 160) : "",
            );
            void setCooldown(candidate.key, failure);
          },
          ctx,
          tools: toolsForWorkspace(ctx, [...WEB_TOOLS, ...CREATOR_TOOLS]),
          longTimeoutMs: 290_000,
          history: protectedHistory,
          question,
          vault,
          signal: request.signal,
          onEvent: (e: EngineEvent) => send(e.type, e),
        });

        const toolContext: ToolContext = {
          steps: result.steps.map((st) => ({ tool: st.tool, label: st.label, source: st.source, coverage: st.coverage })),
          pendingAction: result.pendingAction,
          actionStatus: result.pendingAction ? "pending" : undefined,
          ...(result.artifacts.length ? { artifacts: result.artifacts } : {}),
          rounds: result.rounds,
        };
        const saved = await prisma.atrakoMessage.create({
          data: {
            conversationId: conv.id,
            clienteId: session.workspaceId,
            role: "ASSISTANT",
            content: result.answer,
            status: "COMPLETE",
            sources: result.sources as unknown as Prisma.InputJsonValue,
            toolContext: toolContext as unknown as Prisma.InputJsonValue,
            model: result.model.slice(0, 120),
            promptTokens: result.usage.prompt,
            completionTokens: result.usage.completion,
            totalTokens: result.usage.total,
            estimatedCostMicros: estimateCostMicros(result.usage),
            durationMs: Date.now() - started,
            traceId,
          },
          select: messageSelect,
        });
        const updatedConv = await prisma.atrakoConversation.update({
          where: { id: conv.id },
          data: { updatedAt: new Date() },
          select: { id: true, title: true, createdAt: true, updatedAt: true },
        });
        send("done", { message: messageView(saved), conversation: conversationView(updatedConv) });
      } catch (error) {
        const onlyOwnAi = chain.candidates.length > 0 && chain.candidates.every((c) => c.source === "workspace");
        const friendly =
          error instanceof EngineError
            ? error.code === "exhausted" && onlyOwnAi && error.cause
              ? describeLlmError(error.cause)
              : error.message
            : "Algo deu errado ao analisar. Tente de novo.";
        console.warn("[atrako-assistant]", traceId, error instanceof Error ? error.message : error);
        const failed = await prisma.atrakoMessage
          .create({
            data: {
              conversationId: conv.id,
              clienteId: session.workspaceId,
              role: "ASSISTANT",
              content: friendly,
              status: "ERROR",
              durationMs: Date.now() - started,
              traceId,
            },
            select: messageSelect,
          })
          .catch(() => null);
        send("error", { message: friendly, failed: failed ? messageView(failed) : null });
      } finally {
        clearInterval(keepAlive);
        open = false;
        try {
          controller.close();
        } catch {
          /* já fechado */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
