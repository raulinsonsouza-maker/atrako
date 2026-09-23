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
import { syncLinkedinTodosClientes } from "@/lib/sync/linkedinApiSync";
import { syncAnalyticsTodosClientes } from "@/lib/sync/analyticsApiSync";
import { syncCrmTodosClientes } from "@/lib/sync/crmSync";
import { syncInstagramTodosClientes } from "@/lib/sync/syncInstagram";
import { runDailyAlerts } from "@/lib/alerts/sendAlerts";
import { sendTelegramSummaries } from "@/lib/telegram/sendTelegramSummaries";
import { logInfo, logWarn, logError } from "@/lib/logger";

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
  linkedin: StageResult;
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
  await logInfo(`${nome}: iniciando…`, { plataforma: nome });
  try {
    const results = await fn();
    const comErro = results.filter((r) => r.error);
    const ok = results.length - comErro.length;

    for (const r of comErro) {
      await logWarn(`${nome}: erro em cliente ${r.clienteId} — ${r.error}`, {
        plataforma: nome,
        clienteId: r.clienteId,
      });
    }

    const credErros = comErro.filter((r) => isCredencialError(r.error)).length;
    const sistemica = ok === 0 && credErros > 0 && results.length > 1;
    if (sistemica) {
      await logError(
        `${nome}: FALHA SISTÊMICA — ${credErros}/${results.length} clientes com erro de credencial/token. Renove as credenciais desta plataforma.`,
        { plataforma: nome, credErros, total: results.length },
      );
    }

    await logInfo(
      `${nome}: ${ok} ok / ${comErro.length} com erro (${results.length} total) em ${fmtDuration(Date.now() - inicio)}`,
      { plataforma: nome, ok, erros: comErro.length, fatal: sistemica },
    );
    return { ok, erros: comErro.length, fatal: sistemica };
  } catch (e) {
    const message = e instanceof Error ? e.stack || e.message : String(e);
    await logError(`${nome}: FALHA FATAL em ${fmtDuration(Date.now() - inicio)} — ${message}`, {
      plataforma: nome,
    });
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
  await logInfo(
    `SYNC DIÁRIO iniciado — período: ${options?.dateFrom ?? "incremental"}${options?.dateTo ? ` → ${options.dateTo}` : ""}`,
    { plataforma: "sync" },
  );

  // Sequencial (não paralelo) para evitar estourar rate limits das APIs.
  const meta = await runStage("Meta Ads", () => syncMetaTodosClientes(opts));
  const instagram = await runStage("Instagram", () => syncInstagramTodosClientes());
  const google = await runStage("Google Ads", () => syncGoogleAdsTodosClientes(opts));
  const linkedin = await runStage("LinkedIn Ads", () => syncLinkedinTodosClientes(opts));
  const ga4 = await runStage("Google Analytics", () => syncAnalyticsTodosClientes(opts));
  await runStage("CRM", () => syncCrmTodosClientes());

  let fatalCount = [meta, instagram, google, linkedin, ga4].filter((r) => r.fatal).length;

  // Alertas rodam por último, após os dados estarem atualizados.
  await logInfo("Alertas de gestão: iniciando…", { plataforma: "alertas" });
  let alertas: DailySyncSummary["alertas"] = { ok: false, saldosBaixos: 0, anomalias: 0 };
  try {
    const r = await runDailyAlerts();
    alertas = { ok: true, saldosBaixos: r.saldosBaixos.length, anomalias: r.anomalias.length };
    await logInfo(
      `Alertas: ${r.saldosBaixos.length} saldos baixos, ${r.anomalias.length} anomalias (email=${r.emailEnviado ? "sim" : "não"}, webhook=${r.webhookEnviado ? "sim" : "não"})`,
      { plataforma: "alertas", saldosBaixos: r.saldosBaixos.length, anomalias: r.anomalias.length },
    );
    if (r.erros?.length) {
      for (const erro of r.erros) await logWarn(`Alertas: ${erro}`, { plataforma: "alertas" });
    }
  } catch (e) {
    fatalCount++;
    const message = e instanceof Error ? e.stack || e.message : String(e);
    alertas = { ok: false, saldosBaixos: 0, anomalias: 0, error: message };
    await logError(`Alertas: FALHA FATAL — ${message}`, { plataforma: "alertas" });
  }

  // Resumos Telegram: rodam aqui (fonte única) para que TANTO o script CLI
  // quanto o disparo em produção (/api/sync/daily-global) enviem as mensagens.
  // Falha no Telegram é logada mas NUNCA fatal (não pode bloquear o successAt).
  try {
    await logInfo("Telegram: enviando resumos diários…", { plataforma: "telegram" });
    await sendTelegramSummaries();
    await logInfo("Telegram: resumos enviados.", { plataforma: "telegram" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logError(`Telegram: erro ao enviar resumos — ${message}`, { plataforma: "telegram" });
  }

  const durationMs = Date.now() - inicioGeral;
  await logInfo(
    `SYNC DIÁRIO concluído em ${fmtDuration(durationMs)} — Meta: ${meta.ok}ok/${meta.erros}err | Instagram: ${instagram.ok}ok/${instagram.erros}err | Google: ${google.ok}ok/${google.erros}err | LinkedIn: ${linkedin.ok}ok/${linkedin.erros}err | GA4: ${ga4.ok}ok/${ga4.erros}err | fatais: ${fatalCount}`,
    { plataforma: "sync", durationMs, fatalCount },
  );

  return { meta, instagram, google, linkedin, ga4, alertas, fatalCount, durationMs };
}
