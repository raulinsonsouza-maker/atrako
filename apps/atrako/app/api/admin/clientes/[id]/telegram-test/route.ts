import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { buildClientSummary } from "@/lib/telegram/buildClientSummary";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;

  const { id } = await params;

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    select: { id: true, nome: true },
  });
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const config = await getIntegrationsConfig();
  if (!config.telegramBotToken || !config.telegramChannelId) {
    return NextResponse.json(
      { error: "Telegram não configurado. Configure Bot Token e Channel ID em Configurações → Telegram." },
      { status: 400 }
    );
  }

  try {
    const text = await buildClientSummary(id);
    await sendTelegramMessage(config.telegramBotToken, config.telegramChannelId, text);
    await writeAuditLog({
      action: "TELEGRAM_CLIENT_TEST_SENT",
      actorInternalUserId: access.user.id,
      metadata: { clientId: id, operationType: "test_send" },
    });
    return NextResponse.json({ ok: true, preview: text });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
