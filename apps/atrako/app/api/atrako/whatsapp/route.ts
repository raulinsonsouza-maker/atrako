import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { resolveWhatsApp } from "@/lib/config/resolveConnection";
import {
  handoffConversation,
  sendAndPersistCta,
  sendAndPersistTemplate,
  sendAndPersistText,
} from "@/lib/whatsapp/domain";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const conversationId = request.nextUrl.searchParams.get("conversationId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const wa = await resolveWhatsApp(workspaceId);

  if (conversationId) {
    const conversation = await prisma.waConversation.findFirst({
      where: { id: conversationId, clienteId: workspaceId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 200 },
      },
    });
    if (!conversation) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ connected: Boolean(wa), conversation });
  }

  const conversations = await prisma.waConversation.findMany({
    where: { clienteId: workspaceId },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json({
    connected: Boolean(wa),
    displayPhone: wa?.displayPhoneNumber ?? null,
    conversations,
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  const action = typeof b.action === "string" ? b.action : "send";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (action === "handoff") {
    const conversationId = typeof b.conversationId === "string" ? b.conversationId : "";
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }
    await handoffConversation(conversationId, workspaceId);
    const conv = await prisma.waConversation.findFirst({
      where: { id: conversationId, clienteId: workspaceId },
    });
    if (conv) {
      try {
        const { createEvent, publishEventBatch } = await import("@atrako/events");
        await publishEventBatch([
          createEvent({
            name: "conversation.handoff_requested",
            source: "whatsapp",
            idempotencyKey: `wa-handoff-${conversationId}-${Date.now()}`,
            context: { workspaceId, contactId: conv.contactId ?? undefined },
            payload: {
              channel: "whatsapp",
              conversationId,
              phone: conv.phone,
            },
          }),
        ]);
      } catch {
        /* ignore publish errors */
      }
    }
    return NextResponse.json({ ok: true, status: "HANDED_OFF" });
  }

  const to = typeof b.to === "string" ? b.to : "";
  if (!to) return NextResponse.json({ error: "to (phone) required" }, { status: 400 });

  try {
    if (action === "cta") {
      const text = typeof b.body === "string" ? b.body : "";
      const url = typeof b.url === "string" ? b.url : "";
      const buttonText = typeof b.buttonText === "string" ? b.buttonText : "Abrir";
      if (!text || !url) {
        return NextResponse.json({ error: "body e url obrigatórios" }, { status: 400 });
      }
      const result = await sendAndPersistCta({
        workspaceId,
        to,
        body: text,
        buttonText,
        url,
        contactId: typeof b.contactId === "string" ? b.contactId : null,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "template") {
      const templateName = typeof b.templateName === "string" ? b.templateName : "";
      if (!templateName) {
        return NextResponse.json({ error: "templateName required" }, { status: 400 });
      }
      const result = await sendAndPersistTemplate({
        workspaceId,
        to,
        templateName,
        languageCode: typeof b.languageCode === "string" ? b.languageCode : "pt_BR",
        bodyParams: Array.isArray(b.bodyParams)
          ? (b.bodyParams as unknown[]).filter((x): x is string => typeof x === "string")
          : undefined,
        buttonUrlSuffix: typeof b.buttonUrlSuffix === "string" ? b.buttonUrlSuffix : undefined,
        contactId: typeof b.contactId === "string" ? b.contactId : null,
        previewBody: typeof b.body === "string" ? b.body : undefined,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const text = typeof b.body === "string" ? b.body.trim() : "";
    if (!text) return NextResponse.json({ error: "body required" }, { status: 400 });
    const result = await sendAndPersistText({
      workspaceId,
      to,
      body: text,
      contactId: typeof b.contactId === "string" ? b.contactId : null,
      contactName: typeof b.contactName === "string" ? b.contactName : null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao enviar" },
      { status: 400 },
    );
  }
}
