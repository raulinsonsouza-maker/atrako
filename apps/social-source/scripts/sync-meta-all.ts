/**
 * Script para sincronizar dados Meta de todos os clientes em um período.
 * Uso: npx tsx scripts/sync-meta-all.ts [dateFrom] [dateTo]
 * Exemplo: npx tsx scripts/sync-meta-all.ts 2026-01-01 2026-03-27
 */
import { syncMetaTodosClientes } from "../lib/sync/metaApiSync";

async function main() {
  const dateFrom = process.argv[2] ?? "2026-01-01";
  const dateTo = process.argv[3] ?? new Date().toISOString().slice(0, 10);

  console.log(`\n🔄 Iniciando sync Meta: ${dateFrom} → ${dateTo}`);
  console.log(`⏳ Isso pode levar vários minutos com muitos clientes...\n`);

  const results = await syncMetaTodosClientes({ dateFrom, dateTo });

  let ok = 0, erros = 0, semConta = 0;
  for (const r of results) {
    if (r.error?.includes("Sem conta Meta")) {
      semConta++;
      console.log(`  ⚠️  [${r.clienteId}] Sem conta Meta vinculada`);
    } else if (r.error) {
      erros++;
      console.log(`  ❌ [${r.clienteId}] Erro: ${r.error}`);
    } else {
      ok++;
      console.log(`  ✅ [${r.clienteId}] ${r.daysProcessed} dias | ${r.creativesProcessed} criativos`);
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Sincronizados: ${ok}`);
  console.log(`   ⚠️  Sem conta Meta: ${semConta}`);
  console.log(`   ❌ Erros: ${erros}`);
  console.log(`   Total: ${results.length}`);
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
