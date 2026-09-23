import { NextRequest, NextResponse } from "next/server";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

export async function POST(request: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;

  const config = await getIntegrationsConfig();
  if (!config.telegramBotToken || !config.telegramChannelId) {
    return NextResponse.json(
      {
        error:
          "Telegram não configurado. Preencha Bot Token e Channel ID e salve antes de testar.",
      },
      { status: 400 }
    );
  }

  try {
    await sendTelegramMessage(
      config.telegramBotToken,
      config.telegramChannelId,
      "✅ <b>Teste de conexão</b>\n\nO bot está configurado corretamente e consegue enviar mensagens para este canal."
    );
    await writeAuditLog({
      action: "TELEGRAM_TEST_SENT",
      actorInternalUserId: access.user.id,
      metadata: { operationType: "test_send" },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
