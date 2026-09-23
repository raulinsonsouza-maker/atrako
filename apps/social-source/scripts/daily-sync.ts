/**
 * Sincronização diária de TODAS as contas (Meta Ads, Google Ads, GA4) + alertas.
 *
 * Wrapper de CLI sobre `runDailySync` (lib/sync/runDailySync.ts), que concentra
 * a lógica e é compartilhado com o disparo em segundo plano do painel
 * (app/api/sync/daily-global). Roda direto contra o banco — sem HTTP, token,
 * cold-start de autoscale ou limite de 300s das funções serverless.
 *
 * Uso manual:  npx tsx scripts/daily-sync.ts [dateFrom] [dateTo]
 *   - sem argumentos: cada plataforma faz sync incremental (última data - 3 dias)
 *   - com datas:      força re-sync do período informado (YYYY-MM-DD)
 *
 * Comando npm: npm run sync:daily
 *
 * Exit code:
 *   0 = job concluiu (mesmo com erros pontuais por cliente, que são apenas logados)
 *   1 = falha fatal/inesperada em alguma etapa (visível como deployment "failed")
 */
import { runDailySync } from "../lib/sync/runDailySync";
import { prisma } from "../lib/db";

function ts() {
  return new Date().toISOString();
}

async function main() {
  const dateFrom = process.argv[2];
  const dateTo = process.argv[3];

  const summary = await runDailySync({
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  });

  if (summary.fatalCount > 0) {
    throw new Error(`${summary.fatalCount} etapa(s) falharam de forma fatal — verifique os logs acima.`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect().catch(() => {});
    console.log(`[${ts()}] ✔️  Job concluído com sucesso.`);
    process.exit(0);
  })
  .catch(async (e) => {
    await prisma.$disconnect().catch(() => {});
    const message = e instanceof Error ? e.stack || e.message : String(e);
    console.error(`[${ts()}] 💥 Job finalizou com erro:\n${message}`);
    process.exit(1);
  });
