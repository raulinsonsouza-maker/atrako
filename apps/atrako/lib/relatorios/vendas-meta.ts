/** Relatório mensal de comissão sobre vendas Meta: leitura do banco, ciclos e fechamento automático. */

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import {
  cicloStatus,
  dateToDay,
  dayToDate,
  listCiclos,
  todayBRT,
  type CicloStatus,
} from "./ciclos";
import { aggregateVendasMetaReport, type VendasMetaReport } from "./vendas-meta-core";

export async function buildVendasMetaReport(opts: {
  clienteId: string;
  dataInicio: string;
  dataFim: string;
  comissaoPercent: number;
}): Promise<VendasMetaReport> {
  const from = new Date(`${opts.dataInicio}T00:00:00-03:00`);
  const to = new Date(`${opts.dataFim}T23:59:59.999-03:00`);
  const [orders, metaPurchases] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where: {
        clienteId: opts.clienteId,
        occurredAt: { gte: from, lte: to },
        source: { is: { channel: "meta_ads" } },
      },
      orderBy: { occurredAt: "asc" },
      select: {
        id: true,
        externalId: true,
        provider: true,
        status: true,
        totalCents: true,
        buyerName: true,
        cityName: true,
        cityRaw: true,
        stateUf: true,
        occurredAt: true,
        createdAt: true,
        rawPayload: true,
        items: { select: { title: true, sku: true, quantity: true, unitPriceCents: true, lineTotalCents: true } },
        source: {
          select: {
            adMethod: true,
            adWindow: true,
            metaCampaignId: true,
            metaCampaignName: true,
            metaAdsetId: true,
            metaAdsetName: true,
            metaAdId: true,
            metaAdName: true,
          },
        },
      },
    }),
    prisma.metaAdPurchaseDaily.findMany({
      where: { clienteId: opts.clienteId, date: { gte: dayToDate(opts.dataInicio), lte: dayToDate(opts.dataFim) } },
      select: { clickPurchases: true, clickValueCents: true, viewPurchases: true, viewValueCents: true },
    }),
  ]);
  return aggregateVendasMetaReport({
    periodo: { dataInicio: opts.dataInicio, dataFim: opts.dataFim },
    comissaoPercent: opts.comissaoPercent,
    orders,
    metaPurchases,
  });
}

/* ───────────── Configuração do cliente ───────────── */

export type ComissaoConfig = {
  percent: number;
  inicio: string;
  diaCorte: number;
  shareToken: string | null;
};

export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

type ClienteComissaoRow = {
  comissaoMetaPercent: Prisma.Decimal | null;
  comissaoMetaInicio: Date | null;
  comissaoMetaDiaCorte: number | null;
  comissaoMetaShareToken: string | null;
};

export function comissaoConfigOf(c: ClienteComissaoRow): ComissaoConfig | null {
  if (c.comissaoMetaPercent == null || !c.comissaoMetaInicio) return null;
  const inicio = dateToDay(c.comissaoMetaInicio);
  return {
    percent: Number(c.comissaoMetaPercent.toString()),
    inicio,
    diaCorte: c.comissaoMetaDiaCorte ?? Number(inicio.slice(8, 10)),
    shareToken: c.comissaoMetaShareToken,
  };
}

const CLIENTE_COMISSAO_SELECT = {
  id: true,
  nome: true,
  slug: true,
  logoUrl: true,
  comissaoMetaPercent: true,
  comissaoMetaInicio: true,
  comissaoMetaDiaCorte: true,
  comissaoMetaShareToken: true,
} as const;

export async function getClienteComissao(clienteId: string) {
  const c = await prisma.cliente.findUnique({ where: { id: clienteId }, select: CLIENTE_COMISSAO_SELECT });
  return c ? { cliente: c, config: comissaoConfigOf(c) } : null;
}

export async function getClienteComissaoByToken(token: string) {
  if (!token || token.length < 16) return null;
  const c = await prisma.cliente.findUnique({ where: { comissaoMetaShareToken: token }, select: CLIENTE_COMISSAO_SELECT });
  const config = c ? comissaoConfigOf(c) : null;
  return c && config ? { cliente: c, config } : null;
}

/* ───────────── Ciclos ───────────── */

/** Garante uma linha por ciclo até hoje, atualiza status e fecha (snapshot) os que passaram da carência. */
export async function syncComissaoCiclos(clienteId: string, hoje = todayBRT()) {
  const data = await getClienteComissao(clienteId);
  if (!data?.config) return { ciclos: 0, fechados: 0 };
  const { config } = data;
  const periodos = listCiclos({ inicio: config.inicio, diaCorte: config.diaCorte, hoje });
  const existentes = await prisma.comissaoVendasMetaCiclo.findMany({ where: { clienteId } });
  const byInicio = new Map(existentes.map((c) => [dateToDay(c.dataInicio), c]));
  const validos = new Set(periodos.map((p) => p.dataInicio));
  // Início/dia de corte mudou: descarta ciclos abertos que não existem mais (fechados ficam como histórico).
  const orfaos = existentes.filter((c) => c.status !== "FECHADO" && !validos.has(dateToDay(c.dataInicio)));
  if (orfaos.length) {
    await prisma.comissaoVendasMetaCiclo.deleteMany({ where: { id: { in: orfaos.map((c) => c.id) } } });
  }
  let fechados = 0;

  for (const p of periodos) {
    const status = cicloStatus(p.dataFim, hoje);
    const row = byInicio.get(p.dataInicio);
    if (row?.status === "FECHADO") continue;
    if (status === "FECHADO") {
      const percent = row ? Number(row.comissaoPercent.toString()) : config.percent;
      const report = await buildVendasMetaReport({ clienteId, dataInicio: p.dataInicio, dataFim: p.dataFim, comissaoPercent: percent });
      await prisma.comissaoVendasMetaCiclo.upsert({
        where: { clienteId_dataInicio: { clienteId, dataInicio: dayToDate(p.dataInicio) } },
        create: {
          clienteId,
          dataInicio: dayToDate(p.dataInicio),
          dataFim: dayToDate(p.dataFim),
          comissaoPercent: percent,
          status,
          snapshot: report as unknown as Prisma.InputJsonValue,
          fechadoEm: new Date(),
        },
        update: { status, snapshot: report as unknown as Prisma.InputJsonValue, fechadoEm: new Date() },
      });
      fechados += 1;
      continue;
    }
    await prisma.comissaoVendasMetaCiclo.upsert({
      where: { clienteId_dataInicio: { clienteId, dataInicio: dayToDate(p.dataInicio) } },
      create: {
        clienteId,
        dataInicio: dayToDate(p.dataInicio),
        dataFim: dayToDate(p.dataFim),
        comissaoPercent: config.percent,
        status,
      },
      // Ciclo aberto acompanha o % atual do contrato.
      update: { dataFim: dayToDate(p.dataFim), status, comissaoPercent: config.percent },
    });
  }
  return { ciclos: periodos.length, fechados };
}

export async function syncComissaoCiclosTodosClientes(): Promise<Array<{ clienteId: string; error?: string }>> {
  const clientes = await prisma.cliente.findMany({
    where: { comissaoMetaPercent: { not: null }, comissaoMetaInicio: { not: null } },
    select: { id: true },
  });
  const out: Array<{ clienteId: string; error?: string }> = [];
  for (const { id } of clientes) {
    try {
      await syncComissaoCiclos(id);
      out.push({ clienteId: id });
    } catch (e) {
      out.push({ clienteId: id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

export type CicloResumo = {
  id: string;
  dataInicio: string;
  dataFim: string;
  status: CicloStatus;
  comissaoPercent: number;
  fechadoEm: string | null;
};

export async function listCiclosResumo(clienteId: string): Promise<CicloResumo[]> {
  const rows = await prisma.comissaoVendasMetaCiclo.findMany({
    where: { clienteId },
    orderBy: { dataInicio: "desc" },
    select: { id: true, dataInicio: true, dataFim: true, status: true, comissaoPercent: true, fechadoEm: true },
  });
  return rows.map((r) => ({
    id: r.id,
    dataInicio: dateToDay(r.dataInicio),
    dataFim: dateToDay(r.dataFim),
    status: r.status as CicloStatus,
    comissaoPercent: Number(r.comissaoPercent.toString()),
    fechadoEm: r.fechadoEm?.toISOString() ?? null,
  }));
}

/** Ciclo fechado lê o snapshot; aberto/em apuração é calculado na hora. */
export async function getCicloReport(clienteId: string, cicloId: string) {
  const row = await prisma.comissaoVendasMetaCiclo.findFirst({ where: { id: cicloId, clienteId } });
  if (!row) return null;
  const ciclo: CicloResumo = {
    id: row.id,
    dataInicio: dateToDay(row.dataInicio),
    dataFim: dateToDay(row.dataFim),
    status: row.status as CicloStatus,
    comissaoPercent: Number(row.comissaoPercent.toString()),
    fechadoEm: row.fechadoEm?.toISOString() ?? null,
  };
  const report =
    row.status === "FECHADO" && row.snapshot
      ? (row.snapshot as unknown as VendasMetaReport)
      : await buildVendasMetaReport({
          clienteId,
          dataInicio: ciclo.dataInicio,
          dataFim: ciclo.dataFim,
          comissaoPercent: ciclo.comissaoPercent,
        });
  return { ciclo, report };
}

export function vendasMetaFileName(slug: string, ciclo: { dataInicio: string; dataFim: string }, ext: string, sufixo = "") {
  return `comissao-meta-${slug}-${ciclo.dataInicio}_a_${ciclo.dataFim}${sufixo}.${ext}`;
}

export function csvResponse(csv: string, fileName: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Refaz o snapshot de um ciclo fechado (correção de atribuição ou de status). */
export async function refecharCiclo(clienteId: string, cicloId: string) {
  const row = await prisma.comissaoVendasMetaCiclo.findFirst({ where: { id: cicloId, clienteId } });
  if (!row) return null;
  const dataInicio = dateToDay(row.dataInicio);
  const dataFim = dateToDay(row.dataFim);
  const status = cicloStatus(dataFim, todayBRT());
  if (status !== "FECHADO") return { ciclo: row, refeito: false };
  const report = await buildVendasMetaReport({
    clienteId,
    dataInicio,
    dataFim,
    comissaoPercent: Number(row.comissaoPercent.toString()),
  });
  const ciclo = await prisma.comissaoVendasMetaCiclo.update({
    where: { id: row.id },
    data: { status, snapshot: report as unknown as Prisma.InputJsonValue, fechadoEm: new Date() },
  });
  return { ciclo, refeito: true };
}
