import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTextFromZapiMessage, phoneFromZapiPayload } from "@/lib/integrations/zapi";
import { addSdrReplyJob } from "@/lib/sdr-queue";

/** Z-API: ReceivedCallback. Encontra tenant por instanceId em Integration.config. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const instanceId = body.instanceId as string | undefined;
    if (!instanceId) return NextResponse.json({ ok: true });

    const integrations = await db.integration.findMany({
      where: { type: "WHATSAPP", status: "ACTIVE" },
      select: { id: true, tenantId: true, config: true },
    });
    const cfg = integrations.find(
      (i) => (i.config as { zapiInstanceId?: string })?.zapiInstanceId === instanceId
    );
    if (!cfg) return NextResponse.json({ ok: true });

    // Ignorar mensagens enviadas por mim
    if (body.fromMe === true) return NextResponse.json({ ok: true });

    const phone = phoneFromZapiPayload(body);
    const content = getTextFromZapiMessage(body);
    if (!phone || !content) return NextResponse.json({ ok: true });

    const tenantId = cfg.tenantId;
    const isGroup = body.isGroup === true;
    const rawPhone = (body.phone as string) || "";
    const participantPhone = (body.participantPhone as string) || "";
    const externalId = isGroup ? `group-${rawPhone}-${participantPhone}` : phone;

    let lead = await db.lead.findFirst({
      where: { tenantId, deletedAt: null, phone: phone || undefined },
    });
    if (!lead) {
      lead = await db.lead.create({
        data: {
          tenantId,
          name: `Contato ${phone}`,
          email: `wa-${phone}@placeholder.local`,
          phone: phone || null,
          source: "WHATSAPP",
          status: "NEW",
        },
      });
    }

    let conv = await db.conversation.findFirst({
      where: { tenantId, leadId: lead.id, channel: "WHATSAPP" },
    });
    if (!conv) {
      conv = await db.conversation.create({
        data: {
          tenantId,
          leadId: lead.id,
          channel: "WHATSAPP",
          externalId,
          status: "open",
        },
      });
    }

    await db.message.create({
      data: { conversationId: conv.id, direction: "IN", content },
    });
    await db.activity.create({
      data: {
        tenantId,
        leadId: lead.id,
        type: "WHATSAPP",
        content: content.slice(0, 500),
      },
    });
    await db.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date() },
    });

    if (process.env.REDIS_URL) {
      addSdrReplyJob(tenantId, conv.id, lead.id).catch((err) =>
        console.error("[webhook zapi] Falha ao enfileirar SDR:", err)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("webhook zapi", e);
    return NextResponse.json({ ok: true });
  }
}
