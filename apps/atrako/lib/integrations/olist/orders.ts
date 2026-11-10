/**
 * Pedidos Olist ERP (normalizados a partir da API v2 Token).
 */

import { olistV2Post, resolveOlistCredentials, olistV3Fetch } from "./client";

export type OlistOrderItem = {
  externalItemId: string | null;
  title: string;
  quantity: number;
  unitPriceCents: number;
  sku: string | null;
};

export type OlistOrder = {
  id: string;
  numero: string | null;
  numeroEcommerce: string | null;
  status: string;
  totalCents: number;
  currency: string;
  occurredAt: Date | null;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  stateUf: string | null;
  cityRaw: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  shippingStatus: string | null;
  items: OlistOrderItem[];
  raw: Record<string, unknown>;
};

type V2ListResponse = {
  retorno?: {
    status?: string;
    pagina?: string;
    numero_paginas?: string | number;
    pedidos?: Array<{ pedido?: Record<string, unknown> }>;
    erros?: unknown;
  };
};

type V2DetailResponse = {
  retorno?: {
    status?: string;
    pedido?: Record<string, unknown>;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function parseBrDate(value: unknown): Date | null {
  const raw = asString(value);
  if (!raw) return null;
  // dd/mm/yyyy
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function moneyToCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  const raw = asString(value);
  if (!raw) return 0;
  // API v2 usa ponto decimal (204.55). Se tiver vírgula, trata como pt-BR.
  if (raw.includes(",")) {
    const n = Number(raw.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  const plain = Number(raw);
  return Number.isFinite(plain) ? Math.round(plain * 100) : 0;
}

/** Normaliza situação Olist → status estável (compatível com isRevenueOrder). */
export function normalizeOlistSituacao(raw: unknown): string {
  const s = (asString(raw) ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (!s) return "unknown";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("dados incompletos") || s === "8") return "pending";
  if (s === "aberta" || s === "aberto" || s === "0") return "pending";
  if (s.includes("devoluc")) return "refunded";
  if (s.includes("nao entregue") || s.includes("não entregue") || s === "9") return "cancelled";
  if (s.includes("entregue") || s === "6") return "entregue";
  if (s.includes("enviad") || s === "5") return "enviada";
  if (s.includes("pronto") || s === "7") return "pronto_envio";
  if (s.includes("faturad") || s === "1") return "faturada";
  if (s.includes("preparando") || s === "4") return "preparando_envio";
  if (s.includes("aprovad") || s === "3") return "aprovada";
  return s.replace(/\s+/g, "_").slice(0, 40);
}

function formatBrDay(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function extractItems(pedido: Record<string, unknown>): OlistOrderItem[] {
  const rawItems = Array.isArray(pedido.itens) ? pedido.itens : [];
  const out: OlistOrderItem[] = [];
  for (const row of rawItems) {
    const wrap = asRecord(row);
    const item = asRecord(wrap?.item) ?? wrap;
    if (!item) continue;
    const qty = Number(item.quantidade ?? 1) || 1;
    const unit = moneyToCents(item.valor_unitario);
    out.push({
      externalItemId: asString(item.id_produto),
      title: (asString(item.descricao) ?? "Item").slice(0, 300),
      quantity: Math.max(1, Math.round(qty)),
      unitPriceCents: unit,
      sku: asString(item.codigo)?.slice(0, 120) ?? null,
    });
  }
  return out;
}

function normalizeV2Pedido(pedido: Record<string, unknown>): OlistOrder {
  const cliente = asRecord(pedido.cliente) ?? {};
  const ecommerce = asRecord(pedido.ecommerce) ?? {};
  const numeroEcommerce =
    asString(ecommerce.numeroPedidoEcommerce) ??
    asString(pedido.numero_ecommerce) ??
    asString(pedido.numero_ordem_compra);

  const phone = asString(cliente.fone) ?? asString(cliente.celular) ?? null;
  const status = normalizeOlistSituacao(pedido.situacao);

  return {
    id: asString(pedido.id) ?? "",
    numero: asString(pedido.numero),
    numeroEcommerce,
    status,
    totalCents: moneyToCents(pedido.total_pedido ?? pedido.valor),
    currency: "BRL",
    occurredAt: parseBrDate(pedido.data_pedido),
    buyerName: asString(cliente.nome) ?? asString(pedido.nome),
    buyerEmail: asString(cliente.email),
    buyerPhone: phone,
    stateUf: asString(cliente.uf)?.slice(0, 2)?.toUpperCase() ?? null,
    cityRaw: asString(cliente.cidade),
    trackingCode: asString(pedido.codigo_rastreamento),
    trackingUrl: asString(pedido.url_rastreamento),
    shippingStatus: status,
    items: extractItems(pedido),
    raw: pedido,
  };
}

export async function listOlistOrders(
  workspaceId: string,
  options?: { dataInicial?: Date; dataFinal?: Date; maxPages?: number },
): Promise<{ orders: OlistOrder[]; pages: number }> {
  const resolved = await resolveOlistCredentials(workspaceId);
  if (!resolved) throw new Error("Olist ERP não conectado");

  const maxPages = Math.max(1, options?.maxPages ?? 20);
  const dataInicial = options?.dataInicial ? formatBrDay(options.dataInicial) : undefined;
  const dataFinal = options?.dataFinal ? formatBrDay(options.dataFinal) : undefined;

  if (resolved.apiVersion === "v3") {
    // v3: listagem; detalhe sob demanda no sync
    const collected: OlistOrder[] = [];
    let offset = 0;
    let pages = 0;
    const limit = 100;
    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (dataInicial) params.set("dataInicial", dataInicial);
      if (dataFinal) params.set("dataFinal", dataFinal);
      const json = await olistV3Fetch<{
        itens?: Array<Record<string, unknown>>;
        paginacao?: { total?: number };
      }>(workspaceId, `/pedidos?${params}`);
      pages++;
      const itens = Array.isArray(json.itens) ? json.itens : [];
      if (!itens.length) break;
      for (const row of itens) {
        const id = asString(row.id);
        if (!id) continue;
        collected.push({
          id,
          numero: asString(row.numeroPedido),
          numeroEcommerce: asString(asRecord(row.ecommerce)?.numeroPedidoEcommerce),
          status: normalizeOlistSituacao(row.situacao),
          totalCents: moneyToCents(row.valor),
          currency: "BRL",
          occurredAt: parseBrDate(row.dataCriacao) ?? (asString(row.dataCriacao) ? new Date(String(row.dataCriacao)) : null),
          buyerName: asString(asRecord(row.cliente)?.nome),
          buyerEmail: asString(asRecord(row.cliente)?.email),
          buyerPhone: asString(asRecord(row.cliente)?.telefone) ?? asString(asRecord(row.cliente)?.celular),
          stateUf: asString(asRecord(asRecord(row.cliente)?.endereco)?.uf)?.slice(0, 2)?.toUpperCase() ?? null,
          cityRaw: asString(asRecord(asRecord(row.cliente)?.endereco)?.municipio),
          trackingCode: asString(asRecord(row.transportador)?.codigoRastreamento),
          trackingUrl: asString(asRecord(row.transportador)?.urlRastreamento),
          shippingStatus: normalizeOlistSituacao(row.situacao),
          items: [],
          raw: row,
        });
      }
      if (itens.length < limit) break;
      offset += limit;
    }
    return { orders: collected, pages };
  }

  const collected: OlistOrder[] = [];
  let pages = 0;
  let totalPages = 1;
  for (let pagina = 1; pagina <= maxPages && pagina <= totalPages; pagina++) {
    const json = await olistV2Post<V2ListResponse>(workspaceId, "pedidos.pesquisa", {
      pagina,
      dataInicial,
      dataFinal,
    });
    pages++;
    const retorno = json.retorno;
    if ((retorno?.status ?? "").toUpperCase() !== "OK") {
      throw new Error(`Olist pesquisa pedidos: ${JSON.stringify(retorno?.erros ?? retorno?.status)}`);
    }
    totalPages = Math.max(1, Number(retorno?.numero_paginas ?? 1) || 1);
    const rows = Array.isArray(retorno?.pedidos) ? retorno!.pedidos! : [];
    if (!rows.length) break;
    for (const wrap of rows) {
      const pedido = asRecord(wrap.pedido) ?? asRecord(wrap);
      if (!pedido || !asString(pedido.id)) continue;
      // lista resumida — detalhe no getOlistOrder
      collected.push(normalizeV2Pedido(pedido));
    }
  }

  return { orders: collected, pages };
}

export async function getOlistOrder(workspaceId: string, orderId: string | number): Promise<OlistOrder> {
  const resolved = await resolveOlistCredentials(workspaceId);
  if (!resolved) throw new Error("Olist ERP não conectado");

  if (resolved.apiVersion === "v3") {
    const row = await olistV3Fetch<Record<string, unknown>>(workspaceId, `/pedidos/${orderId}`);
    const id = asString(row.id) ?? String(orderId);
    return {
      id,
      numero: asString(row.numeroPedido),
      numeroEcommerce: asString(asRecord(row.ecommerce)?.numeroPedidoEcommerce),
      status: normalizeOlistSituacao(row.situacao),
      totalCents: moneyToCents(row.valor),
      currency: "BRL",
      occurredAt: parseBrDate(row.dataCriacao) ?? (asString(row.dataCriacao) ? new Date(String(row.dataCriacao)) : null),
      buyerName: asString(asRecord(row.cliente)?.nome),
      buyerEmail: asString(asRecord(row.cliente)?.email),
      buyerPhone: asString(asRecord(row.cliente)?.telefone) ?? asString(asRecord(row.cliente)?.celular),
      stateUf: asString(asRecord(asRecord(row.cliente)?.endereco)?.uf)?.slice(0, 2)?.toUpperCase() ?? null,
      cityRaw: asString(asRecord(asRecord(row.cliente)?.endereco)?.municipio),
      trackingCode: asString(asRecord(row.transportador)?.codigoRastreamento),
      trackingUrl: asString(asRecord(row.transportador)?.urlRastreamento),
      shippingStatus: normalizeOlistSituacao(row.situacao),
      items: [],
      raw: row,
    };
  }

  const json = await olistV2Post<V2DetailResponse>(workspaceId, "pedido.obter", { id: String(orderId) });
  const pedido = asRecord(json.retorno?.pedido);
  if (!pedido) throw new Error(`Pedido Olist ${orderId} não encontrado`);
  return normalizeV2Pedido(pedido);
}
