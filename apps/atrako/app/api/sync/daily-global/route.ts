import { NextRequest, NextResponse } from "next/server";
import { runDailySync } from "@/lib/sync/runDailySync";
import { prisma } from "@/lib/db";
import { isInternalAdminAuthorized } from "@/lib/internalAccess";

/**
 * Disparo "1x por dia ao abrir o painel": sincroniza TODAS as contas + alertas
 * em segundo plano, no máximo uma vez por dia, com trava global atômica.
 *
 * Chamado em fire-and-forget pelo ClienteDashboard (apenas admin, !portalMode).
 * A requisição fica aberta enquanto o sync roda — assim o autoscale mantém a
 * instância viva até concluir (best-effort; se atingir o limite de ~300s, o
 * desenho incremental/idempotente se completa nos disparos seguintes).
 *
 * Trava (modelo SyncState, singleton id="global"):
 * - successAt: marca a última conclusão OK → compara com o INÍCIO DO DIA em BRT
 *   ("já rodou hoje?"). Dia-calendário, não janela rolante: uma janela rolante
 *   de 20h fazia o horário elegível escorregar para mais tarde a cada dia,
 *   impedindo o disparo matinal do agendador externo (cron 5h BRT).
 * - attemptAt: marca o início de uma tentativa → janela de 3h. O sync completo
 *   leva 80–147min em produção; a trava anterior de 6min permitia 4–6 execuções
 *   CONCORRENTES por dia, estourando rate limits e derrubando conexões do banco.
 *   Tradeoff aceito: se a instância morrer no meio, a retomada espera até 3h.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ATTEMPT_LOCK_MS = 3 * 60 * 60 * 1000; // 3h — deve exceder a duração real do sync (~2h30)
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // BRT = UTC-3
const GLOBAL_ID = "global";

/** Início do dia atual em BRT (00:00 America/Sao_Paulo), como instante UTC. */
function startOfTodayBRT(now: Date): Date {
  const brt = new Date(now.getTime() - BRT_OFFSET_MS);
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), 3, 0, 0, 0));
}

export async function POST(request: NextRequest) {
  try {
    const cronToken = request.headers.get("x-cron-token") ??
      (request.headers.get("authorization")?.startsWith("Bearer ")
        ? request.headers.get("authorization")!.slice(7)
        : null);
    const cronAuthorized = Boolean(process.env.SYNC_CRON_TOKEN && cronToken === process.env.SYNC_CRON_TOKEN);
    if (!cronAuthorized && !(await isInternalAdminAuthorized())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const now = new Date();
    const dayThreshold = startOfTodayBRT(now);
    const lockThreshold = new Date(now.getTime() - ATTEMPT_LOCK_MS);

    // Garante que o registro singleton exista antes do claim condicional.
    await prisma.syncState.upsert({
      where: { id: GLOBAL_ID },
      create: { id: GLOBAL_ID },
      update: {},
    });

    // Claim atômico: só prossegue se NÃO concluiu hoje (dia-calendário BRT) E
    // não há uma tentativa iniciada nas últimas 3h. Marca attemptAt=now.
    const claim = await prisma.syncState.updateMany({
      where: {
        id: GLOBAL_ID,
        AND: [
          { OR: [{ successAt: null }, { successAt: { lt: dayThreshold } }] },
          { OR: [{ attemptAt: null }, { attemptAt: { lt: lockThreshold } }] },
        ],
      },
      data: { attemptAt: now },
    });

    if (claim.count === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: "ran_today_or_running" });
    }

    const summary = await runDailySync();

    // Sucesso real só conta se nenhuma etapa falhou de forma fatal/sistêmica.
    // Em falha fatal, NÃO marcamos successAt → retenta após a janela de 3h.
    if (summary.fatalCount === 0) {
      await prisma.syncState
        .update({ where: { id: GLOBAL_ID }, data: { successAt: new Date() } })
        .catch(() => {});
    }

    return NextResponse.json({
      ok: summary.fatalCount === 0,
      ran: true,
      summary: {
        meta: summary.meta,
        google: summary.google,
        ga4: summary.ga4,
        alertas: summary.alertas,
        fatalCount: summary.fatalCount,
        durationMs: summary.durationMs,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
