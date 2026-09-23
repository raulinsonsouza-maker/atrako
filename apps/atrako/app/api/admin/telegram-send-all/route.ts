import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { buildClientSummary } from "@/lib/telegram/buildClientSummary";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

export async function POST(request: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;

  const config = await getIntegrationsConfig();
  if (!config.telegramBotToken || !config.telegramChannelId) {
    return NextResponse.json(
      { error: "Telegram não configurado. Configure Bot Token e Channel ID primeiro." },
      { status: 400 }
    );
  }

  const clientes = await prisma.cliente.findMany({
    where: { ativo: true, telegramAtivo: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  if (clientes.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      errors: 0,
      message: "Nenhum cliente com resumo Telegram ativo. Ative o toggle nos clientes desejados.",
    });
  }

  const results: { nome: string; ok: boolean; error?: string }[] = [];

  for (const c of clientes) {
    try {
      const text = await buildClientSummary(c.id);
      await sendTelegramMessage(config.telegramBotToken, config.telegramChannelId, text);
      results.push({ nome: c.nome, ok: true });
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ nome: c.nome, ok: false, error: msg });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  const errors = results.filter((r) => !r.ok).length;
  if (sent > 0) {
    await writeAuditLog({
      action: "TELEGRAM_BULK_SUMMARY_SENT",
      actorInternalUserId: access.user.id,
      metadata: { operationType: "bulk_send" },
    });
  }

  return NextResponse.json({ ok: true, sent, errors, results });
}
