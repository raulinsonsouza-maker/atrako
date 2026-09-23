import { prisma } from "@/lib/db";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { buildClientSummary } from "./buildClientSummary";
import { sendTelegramMessage } from "./sendTelegramMessage";
import { logInfo, logError } from "@/lib/logger";

export async function sendTelegramSummaries(): Promise<void> {
  const config = await getIntegrationsConfig();
  const { telegramBotToken, telegramChannelId } = config;

  if (!telegramBotToken || !telegramChannelId) {
    await logInfo("Telegram: sem configuração de bot/canal — resumos ignorados.", { plataforma: "telegram" });
    return;
  }

  const clientes = await prisma.cliente.findMany({
    where: { ativo: true, telegramAtivo: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  if (clientes.length === 0) {
    await logInfo("Telegram: nenhum cliente com resumo ativo.", { plataforma: "telegram" });
    return;
  }

  await logInfo(`Telegram: enviando resumos para ${clientes.length} cliente(s)…`, { plataforma: "telegram" });

  let ok = 0;
  let erros = 0;
  for (const c of clientes) {
    try {
      const text = await buildClientSummary(c.id);
      await sendTelegramMessage(telegramBotToken, telegramChannelId, text);
      await logInfo(`Telegram: resumo enviado — ${c.nome}`, { plataforma: "telegram", clienteId: c.id, clienteNome: c.nome });
      ok++;
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      erros++;
      const msg = e instanceof Error ? e.message : String(e);
      await logError(`Telegram: falha ao enviar resumo — ${c.nome}: ${msg}`, { plataforma: "telegram", clienteId: c.id, clienteNome: c.nome });
    }
  }

  await logInfo(`Telegram: concluído — ${ok} enviados, ${erros} erros.`, { plataforma: "telegram", ok, erros });
}
