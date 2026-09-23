import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTextFromEvolutionMessage, phoneFromRemoteJid } from "@/lib/integrations/whatsapp";
import { addSdrReplyJob } from "@/lib/sdr-queue";

/** Evolution API: messages.upsert e similares. Encontra tenant por instance em Integration.config. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const instance = (body.instance as string) || (body as { data?: { instance?: string } }).data?.instance;
    if (!instance) return NextResponse.json({ ok: true });

    const integrations = await db.integration.findMany({
      where: { type: "WHATSAPP", status: "ACTIVE" },
      select: { id: true, tenantId: true, config: true },
    });
    const cfg = integrations.find((i) => (i.config as { evolutionInstance?: string })?.evolutionInstance === instance);
    if (!cfg) return NextResponse.json({ ok: true });

    const tenantId = cfg.tenantId;
    const data = (body.data ?? body) as {
      key?: { remoteJid?: string };
      message?: Record<string, unknown>;
    };
    const remoteJid = data?.key?.remoteJid;
    if (!remoteJid) return NextResponse.json({ ok: true });

    const phone = phoneFromRemoteJid(remoteJid);
    const content = getTextFromEvolutionMessage(data?.message ?? {});
    if (!content) return NextResponse.json({ ok: true });

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
          externalId: remoteJid,
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
        console.error("[webhook whatsapp] Falha ao enfileirar SDR:", err)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("webhook whatsapp", e);
    return NextResponse.json({ ok: true });
  }
}
