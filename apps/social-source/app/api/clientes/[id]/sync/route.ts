import { NextRequest, NextResponse } from "next/server";
import { syncClienteCanais } from "@/lib/sync/syncClienteCanais";
import { prisma } from "@/lib/db";

export const maxDuration = 300;

/**
 * Sincroniza os canais configurados deste cliente para o banco.
 *
 * Modos:
 * - Manual (botão "Atualizar agora"): POST sem query — sempre roda.
 * - Background (auto ao abrir o cliente): POST ?background=1 — só roda se os
 *   dados estiverem "velhos" (última sync > STALE_THRESHOLD). Usa um claim
 *   atômico no banco (updateMany condicional) para evitar syncs duplicados/
 *   concorrentes mesmo com várias instâncias (autoscale) e não martelar as
 *   APIs da Meta/Google.
 */
const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3h

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isBackground = request.nextUrl.searchParams.get("background") === "1";

  // Backfill manual: ?from=YYYY-MM-DD[&to=YYYY-MM-DD] força a janela de datas da
  // Meta e do Google Ads, ignorando a lógica incremental (que só revisita os
  // últimos dias). Usado para puxar histórico, ex.: desde 2026-01-01.
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");
  const dateFrom = fromParam && dateRe.test(fromParam) ? fromParam : undefined;
  const dateTo = toParam && dateRe.test(toParam) ? toParam : undefined;

  try {
    if (isBackground) {
      const threshold = new Date(Date.now() - STALE_THRESHOLD_MS);
      // Claim atômico: só prossegue se nunca sincronizou ou se está velho.
      // Marca ultimoSyncAt=now já aqui, funcionando como trava entre instâncias.
      const claim = await prisma.cliente.updateMany({
        where: {
          id,
          OR: [{ ultimoSyncAt: null }, { ultimoSyncAt: { lt: threshold } }],
        },
        data: { ultimoSyncAt: new Date() },
      });
      if (claim.count === 0) {
        // Dados ainda frescos (ou já há um sync em andamento) — nada a fazer.
        return NextResponse.json({ ok: true, skipped: true, reason: "fresh_or_running" });
      }
    }

    // Manual ("Atualizar agora") sync does a FULL CRM re-sync to repair leads
    // whose CV attribution (origem/mídia/conversão) was filled in after they were
    // first synced — the incremental background sync can never re-fetch those.
    const result = await syncClienteCanais(id, { crmFull: !isBackground, dateFrom, dateTo });

    // Atualiza o carimbo de tempo ao concluir (não bloqueia a resposta em caso de falha).
    await prisma.cliente
      .update({ where: { id }, data: { ultimoSyncAt: new Date() } })
      .catch(() => {});

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          sync: result,
          error:
            result.googleAds?.error ||
            result.meta?.error ||
            result.analytics?.error ||
            "Falha na sincronização",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      synced: true,
      sync: result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
