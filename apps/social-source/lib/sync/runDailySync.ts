/**
 * Orquestração da sincronização diária de TODAS as contas (Meta Ads, Google Ads,
 * GA4) + alertas. Esta é a fonte única da lógica, compartilhada por:
 *  - `scripts/daily-sync.ts` (Scheduled Deployment / execução manual via CLI)
 *  - `app/api/sync/daily-global` (disparo em segundo plano ao abrir o painel)
 *
 * Roda direto contra o banco, sequencial (evita estourar rate limits), e isola
 * falhas: erro de uma plataforma NÃO interrompe as demais. Não chama
 * `process.exit` nem `prisma.$disconnect` — quem invoca decide o ciclo de vida.
 */
import { syncMetaTodosClientes } from "@/lib/sync/metaApiSync";
import { syncGoogleAdsTodosClientes } from "@/lib/sync/googleAdsApiSync";
import { syncAnalyticsTodosClientes } from "@/lib/sync/analyticsApiSync";
import { syncCrmTodosClientes } from "@/lib/sync/crmSync";
import { syncInstagramTodosClientes } from "@/lib/sync/syncInstagram";
import { runDailyAlerts } from "@/lib/alerts/sendAlerts";

type SyncResult = { clienteId: string; error?: string };

export interface StageResult {
  ok: number;
  erros: number;
  fatal: boolean;
}

export interface DailySyncSummary {
  meta: StageResult;
  instagram: StageResult;
  google: StageResult;
  ga4: StageResult;
  alertas: { ok: boolean; saldosBaixos: number; anomalias: number; error?: string };
  fatalCount: number;
  durationMs: number;
}

function ts() {
  return new Date().toISOString();
}

function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

/**
 * Detecta erro de credencial global (token expirado/inválido), que afeta TODOS
 * os clientes de uma plataforma — diferente de um erro pontual de configuração
 * de um cliente isolado (ex.: "Sem conta Meta configurada").
 */
function isCredencialError(msg: string | undefined): boolean {
  if (!msg) return false;
  return /(access token|session has expired|invalid_grant|invalid_token|unauthorized|expired|credential|authenticat)/i.test(
    msg,
  );
}

/**
 * Executa uma etapa de sync isolando falhas. `fatal` é marcado quando a etapa
 * lança exceção OU quando há sinal de falha SISTÊMICA de credencial (a maioria
 * dos clientes falhou por token expirado/inválido).
 */
async function runStage(
  nome: string,
  fn: () => Promise<SyncResult[]>,
): Promise<StageResult> {
  const inicio = Date.now();
  console.log(`[${ts()}] ▶️  ${nome}: iniciando...`);
  try {
    const results = await fn();
    const comErro = results.filter((r) => r.error);
    const ok = results.length - comErro.length;

    for (const r of comErro) {
      console.warn(`[${ts()}]   ⚠️  ${nome} · cliente ${r.clienteId}: ${r.error}`);
    }

    const credErros = comErro.filter((r) => isCredencialError(r.error)).length;
    const sistemica = ok === 0 && credErros > 0 && results.length > 1;
    if (sistemica) {
      console.error(
        `[${ts()}] ❌ ${nome}: FALHA SISTÊMICA — ${credErros}/${results.length} clientes com erro de credencial/token. Renove as credenciais desta plataforma.`,
      );
    }

    console.log(
      `[${ts()}] ${sistemica ? "❌" : "✅"} ${nome}: ${ok} ok / ${comErro.length} com erro (${results.length} total) em ${fmtDuration(
        Date.now() - inicio,
      )}`,
    );
    return { ok, erros: comErro.length, fatal: sistemica };
  } catch (e) {
    const message = e instanceof Error ? e.stack || e.message : String(e);
    console.error(`[${ts()}] ❌ ${nome}: FALHA FATAL em ${fmtDuration(Date.now() - inicio)}\n${message}`);
    return { ok: 0, erros: 0, fatal: true };
  }
}

export async function runDailySync(options?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<DailySyncSummary> {
  const opts = {
    ...(options?.dateFrom ? { dateFrom: options.dateFrom } : {}),
    ...(options?.dateTo ? { dateTo: options.dateTo } : {}),
  };

  const inicioGeral = Date.now();
  console.log("============================================================");
  console.log(`[${ts()}] 🔄 SYNC DIÁRIO — Central de Clientes Inout`);
  console.log(`[${ts()}] Período: ${options?.dateFrom ?? "incremental"}${options?.dateTo ? ` → ${options.dateTo}` : ""}`);
  console.log("============================================================");

  // Sequencial (não paralelo) para evitar estourar rate limits das APIs.
  const meta = await runStage("Meta Ads", () => syncMetaTodosClientes(opts));
  const instagram = await runStage("Instagram", () => syncInstagramTodosClientes());
  const google = await runStage("Google Ads", () => syncGoogleAdsTodosClientes(opts));
  const ga4 = await runStage("Google Analytics", () => syncAnalyticsTodosClientes(opts));
  await runStage("CRM", () => syncCrmTodosClientes());

  let fatalCount = [meta, instagram, google, ga4].filter((r) => r.fatal).length;

  // Alertas rodam por último, após os dados estarem atualizados.
  console.log(`[${ts()}] ▶️  Alertas de gestão: iniciando...`);
  let alertas: DailySyncSummary["alertas"] = { ok: false, saldosBaixos: 0, anomalias: 0 };
  try {
    const r = await runDailyAlerts();
    alertas = { ok: true, saldosBaixos: r.saldosBaixos.length, anomalias: r.anomalias.length };
    console.log(
      `[${ts()}] ✅ Alertas: ${r.saldosBaixos.length} saldos baixos, ${r.anomalias.length} anomalias` +
        ` (email=${r.emailEnviado ? "sim" : "não"}, webhook=${r.webhookEnviado ? "sim" : "não"})`,
    );
    if (r.erros?.length) {
      for (const erro of r.erros) console.warn(`[${ts()}]   ⚠️  Alertas: ${erro}`);
    }
  } catch (e) {
    fatalCount++;
    const message = e instanceof Error ? e.stack || e.message : String(e);
    alertas = { ok: false, saldosBaixos: 0, anomalias: 0, error: message };
    console.error(`[${ts()}] ❌ Alertas: FALHA FATAL\n${message}`);
  }

  const durationMs = Date.now() - inicioGeral;
  console.log("============================================================");
  console.log(`[${ts()}] 📊 RESUMO`);
  console.log(`   Meta Ads:         ${meta.ok} ok / ${meta.erros} erros${meta.fatal ? " (FATAL)" : ""}`);
  console.log(`   Instagram:        ${instagram.ok} ok / ${instagram.erros} erros${instagram.fatal ? " (FATAL)" : ""}`);
  console.log(`   Google Ads:       ${google.ok} ok / ${google.erros} erros${google.fatal ? " (FATAL)" : ""}`);
  console.log(`   Google Analytics: ${ga4.ok} ok / ${ga4.erros} erros${ga4.fatal ? " (FATAL)" : ""}`);
  console.log(`   Tempo total:      ${fmtDuration(durationMs)}`);
  console.log("============================================================");

  return { meta, instagram, google, ga4, alertas, fatalCount, durationMs };
}
