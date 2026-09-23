import { NextResponse } from "next/server";
import { runDailySync } from "@/lib/sync/runDailySync";
import { prisma } from "@/lib/db";

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
 * - successAt: marca a última conclusão OK → janela de 20h ("já rodou hoje").
 * - attemptAt: marca o início de uma tentativa → janela de 30min (evita disparos
 *   concorrentes enquanto um já está em andamento, sem prender o dia todo se
 *   falhar no meio).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAILY_WINDOW_MS = 20 * 60 * 60 * 1000; // 20h
const ATTEMPT_LOCK_MS = 30 * 60 * 1000; // 30min
const GLOBAL_ID = "global";

export async function POST() {
  try {
    const now = new Date();
    const dayThreshold = new Date(now.getTime() - DAILY_WINDOW_MS);
    const lockThreshold = new Date(now.getTime() - ATTEMPT_LOCK_MS);

    // Garante que o registro singleton exista antes do claim condicional.
    await prisma.syncState.upsert({
      where: { id: GLOBAL_ID },
      create: { id: GLOBAL_ID },
      update: {},
    });

    // Claim atômico: só prossegue se NÃO concluiu nas últimas 20h E não há uma
    // tentativa iniciada nos últimos 30min. Marca attemptAt=now (trava curta).
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
    // Em falha fatal, NÃO marcamos successAt → retenta após a janela de 30min.
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
