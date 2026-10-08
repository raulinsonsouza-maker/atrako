import { prisma } from "@/lib/db";
import { isRevenueOrder } from "@/lib/commerce-attribution/order-status";
import { orderOriginKey, originLabel } from "@/lib/commerce-attribution/store-source";
import { orderDetails } from "@/lib/commerce/order-details";
import { genderFromName } from "@/lib/geo/gender";
import { stateName } from "@/lib/geo/place";

const TZ = "America/Sao_Paulo";

export type TicketSlice = {
  pedidoCents: number | null;
  porClienteCents: number | null;
  primeiraCents: number | null;
  recompraCents: number | null;
  pedidos: number;
  compradores: number;
  receitaCents: number;
};

export type Comportamento = {
  tickets: TicketSlice;
  ticketsAnterior: TicketSlice;
  leitura: string;
  recompra: {
    receitaPrimeiraCents: number;
    receitaRecompraCents: number;
    pedidosPrimeira: number;
    pedidosRecompra: number;
    participacaoRecorrentesPct: number | null;
    pedidosSemContato: number;
    receitaSemContatoCents: number;
  };
  ltv: { medioCents: number | null; compradores: number; receitaCents: number };
  origens: Array<{
    id: string;
    label: string;
    clientes: number;
    receitaCents: number;
    ticketCents: number | null;
    recompraPct: number | null;
  }>;
  topCompradores: Array<{
    id: string;
    nome: string;
    pedidos: number;
    receitaCents: number;
    compras: CompraComprador[];
  }>;
  produtos: Array<{
    id: string;
    nome: string;
    quantidade: number;
    receitaCents: number;
    compradores: number;
    ticketCents: number | null;
    recompras: number;
    imageUrl: string | null;
    productUrl: string | null;
  }>;
  pares: Array<{
    de: string;
    para: string;
    compradores: number;
    deImagem: string | null;
    paraImagem: string | null;
  }>;
  /** Receita nova e de recompra por dia de Brasília. Semana acima de 62 dias; mês acima de 180. */
  serie: Array<{ data: string; totalCents: number; primeiraCents: number; recompraCents: number }>;
  serieAgrupamento: "dia" | "semana" | "mes";
  /** Linhas Seg→Dom, colunas 0–23h, valor = pedidos pagos. */
  heatmap: number[][];
  genero: {
    f: { pedidos: number; receitaCents: number };
    m: { pedidos: number; receitaCents: number };
    u: { pedidos: number; receitaCents: number };
  };
  estados: Array<{
    uf: string;
    nome: string;
    pedidos: number;
    receitaCents: number;
    cidades: Array<{ nome: string; pedidos: number; receitaCents: number }>;
  }>;
};

export type CompraComprador = {
  id: string;
  numero: string;
  em: string;
  cents: number;
  status: string | null;
  pagamento: string | null;
  parcelas: number | null;
  freteCents: number | null;
  freteMetodo: string | null;
  descontoCents: number;
  cupom: string | null;
  itens: Array<{ nome: string; quantidade: number; precoCents: number; imagem: string | null; url: string | null }>;
};

type ItemRow = {
  title: string | null;
  sku: string | null;
  quantity: number | null;
  lineTotalCents: number | null;
  unitPriceCents?: number | null;
  imageUrl?: string | null;
  productUrl?: string | null;
};

function httpUrl(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? "";
  return /^https?:\/\//i.test(raw) ? raw.slice(0, 1000) : null;
}

export type BehaviorOrder = {
  id: string;
  provider: string;
  status: string | null;
  totalCents: number | null;
  externalId?: string;
  shippingCostCents?: number | null;
  rawPayload?: unknown;
  occurredAt: Date | null;
  contactId: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  stateUf: string | null;
  cityName: string | null;
  cityRaw: string | null;
  contactName: string | null;
  contactGender: string | null;
  channel: string | null;
  items: ItemRow[];
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buyerKey(order: Pick<BehaviorOrder, "contactId" | "buyerEmail">): string | null {
  if (order.contactId) return `c:${order.contactId}`;
  const email = order.buyerEmail?.trim().toLowerCase();
  return email ? `e:${email}` : null;
}

function emptyTickets(): TicketSlice {
  return {
    pedidoCents: null,
    porClienteCents: null,
    primeiraCents: null,
    recompraCents: null,
    pedidos: 0,
    compradores: 0,
    receitaCents: 0,
  };
}

function div(num: number, den: number): number | null {
  return den > 0 ? Math.round(num / den) : null;
}

type Tagged = BehaviorOrder & { key: string | null; repeat: boolean; cents: number };

function tagOrders(orders: BehaviorOrder[], seed: Set<string>): { tagged: Tagged[]; seen: Set<string> } {
  const seen = new Set(seed);
  const sorted = [...orders].sort((a, b) => {
    const ta = a.occurredAt?.getTime() ?? 0;
    const tb = b.occurredAt?.getTime() ?? 0;
    return ta - tb || a.id.localeCompare(b.id);
  });
  const tagged: Tagged[] = [];
  for (const order of sorted) {
    const key = buyerKey(order);
    const repeat = Boolean(key && seen.has(key));
    if (key) seen.add(key);
    tagged.push({ ...order, key, repeat, cents: Math.max(0, order.totalCents ?? 0) });
  }
  return { tagged, seen };
}

function ticketsOf(orders: Tagged[]): TicketSlice {
  if (!orders.length) return emptyTickets();
  const buyers = new Set<string>();
  let firstCents = 0;
  let firstN = 0;
  let repeatCents = 0;
  let repeatN = 0;
  let receita = 0;
  for (const order of orders) {
    receita += order.cents;
    if (order.key) buyers.add(order.key);
    if (!order.key) continue;
    if (order.repeat) {
      repeatCents += order.cents;
      repeatN += 1;
    } else {
      firstCents += order.cents;
      firstN += 1;
    }
  }
  return {
    pedidoCents: div(receita, orders.length),
    porClienteCents: div(receita, buyers.size),
    primeiraCents: div(firstCents, firstN),
    recompraCents: div(repeatCents, repeatN),
    pedidos: orders.length,
    compradores: buyers.size,
    receitaCents: receita,
  };
}

function leituraOf(current: TicketSlice, previous: TicketSlice): string {
  if (current.pedidos === 0) return "Sem vendas pagas no período.";
  if (previous.pedidos === 0) return "Não havia vendas pagas no período anterior.";
  const buyersDelta = current.compradores - previous.compradores;
  const ticketNow = current.porClienteCents;
  const ticketBefore = previous.porClienteCents;
  const buyersUp = previous.compradores > 0 && buyersDelta / previous.compradores > 0.02;
  const buyersDown = previous.compradores > 0 && buyersDelta / previous.compradores < -0.02;
  const ticketUp = ticketNow != null && ticketBefore != null && ticketNow > ticketBefore * 1.02;
  const ticketDown = ticketNow != null && ticketBefore != null && ticketNow < ticketBefore * 0.98;
  if (buyersUp && ticketUp) return "Mais clientes, e cada cliente gastou mais.";
  if (buyersUp && ticketDown) return "Mais clientes. Cada cliente gastou menos.";
  if (buyersUp) return "Mais clientes. O gasto por cliente ficou parecido.";
  if (buyersDown && ticketUp) return "Menos clientes, mas cada cliente gastou mais.";
  if (buyersDown && ticketDown) return "Menos clientes e ticket menor.";
  if (buyersDown) return "Menos clientes. O gasto por cliente ficou parecido.";
  if (ticketUp) return "Cada cliente gastou mais.";
  if (ticketDown) return "Cada cliente gastou menos.";
  return "Volume parecido com o período anterior.";
}

function cleanTitle(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function productKey(item: ItemRow): string | null {
  const title = fold(cleanTitle(item.title));
  if (title) return `t:${title}`;
  const sku = item.sku?.trim();
  return sku ? `s:${sku.toLowerCase()}` : null;
}

const WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function brtYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function brtSlot(date: Date): { day: number; hour: number } | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const bag = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const day = WEEKDAY[bag.weekday ?? ""];
  const hour = Number(bag.hour) % 24;
  if (day == null || !Number.isFinite(hour)) return null;
  return { day, hour };
}

export type FiltroComportamento = {
  genero?: "f" | "m" | "u";
  produto?: string;
  dia?: number;
  hora?: number;
  uf?: string;
  cidade?: string;
  pular?: Array<"genero" | "produto" | "horario" | "lugar">;
};

function orderGender(order: Pick<BehaviorOrder, "contactGender" | "contactName" | "buyerName">): "f" | "m" | "u" {
  const gender =
    order.contactGender === "F" || order.contactGender === "M"
      ? order.contactGender
      : genderFromName(order.contactName || order.buyerName);
  return gender === "F" ? "f" : gender === "M" ? "m" : "u";
}

function matchesFiltro(order: Tagged, filtro: FiltroComportamento): boolean {
  const skip = new Set(filtro.pular ?? []);
  if (!skip.has("genero") && filtro.genero && orderGender(order) !== filtro.genero) return false;
  if (!skip.has("produto") && filtro.produto && !order.items.some((item) => productKey(item) === filtro.produto)) return false;
  if (!skip.has("horario") && (filtro.dia != null || filtro.hora != null)) {
    const slot = order.occurredAt ? brtSlot(order.occurredAt) : null;
    if (!slot) return false;
    if (filtro.dia != null && slot.day !== filtro.dia) return false;
    if (filtro.hora != null && slot.hour !== filtro.hora) return false;
  }
  if (!skip.has("lugar")) {
    if (filtro.uf != null && (order.stateUf ?? "") !== filtro.uf) return false;
    if (filtro.cidade && (order.cityName || order.cityRaw || "Sem cidade") !== filtro.cidade) return false;
  }
  return true;
}

export type ComportamentoResposta = Comportamento & {
  facetas?: {
    genero: Comportamento["genero"];
    produtos: Comportamento["produtos"];
    heatmap: number[][];
    estados: Comportamento["estados"];
  };
};

export function aggregateComportamento(
  input: {
    current: BehaviorOrder[];
    previous: BehaviorOrder[];
    priorKeys: Set<string>;
    lifetimeReceitaCents: number;
    lifetimeCompradores: number;
    lifetimePorComprador?: Map<string, number>;
  },
  filtro?: FiltroComportamento,
): Comportamento {
  const prev = tagOrders(input.previous, input.priorKeys);
  const cur = tagOrders(input.current, prev.seen);
  const current = filtro ? cur.tagged.filter((order) => matchesFiltro(order, filtro)) : cur.tagged;
  const previous = filtro ? prev.tagged.filter((order) => matchesFiltro(order, filtro)) : prev.tagged;
  let receita = input.lifetimeReceitaCents;
  let compradores = input.lifetimeCompradores;
  if (filtro && input.lifetimePorComprador) {
    receita = 0;
    compradores = 0;
    const keys = new Set(current.map((order) => order.key).filter((key): key is string => Boolean(key)));
    for (const key of keys) {
      const cents = input.lifetimePorComprador.get(key);
      if (cents == null) continue;
      receita += cents;
      compradores += 1;
    }
  }
  return finishAggregate(current, previous, receita, compradores);
}

function finishAggregate(
  current: Tagged[],
  previous: Tagged[],
  lifetimeReceitaCents: number,
  lifetimeCompradores: number,
): Comportamento {
  const tickets = ticketsOf(current);
  const ticketsAnterior = ticketsOf(previous);

  let receitaPrimeira = 0;
  let receitaRecompra = 0;
  let pedidosPrimeira = 0;
  let pedidosRecompra = 0;
  let pedidosSemContato = 0;
  let receitaSemContato = 0;
  for (const order of current) {
    if (!order.key) {
      pedidosSemContato += 1;
      receitaSemContato += order.cents;
      continue;
    }
    if (order.repeat) {
      receitaRecompra += order.cents;
      pedidosRecompra += 1;
    } else {
      receitaPrimeira += order.cents;
      pedidosPrimeira += 1;
    }
  }
  const receitaIdentificada = receitaPrimeira + receitaRecompra;

  const origins = new Map<
    string,
    { label: string; buyers: Set<string>; receita: number; recompra: number }
  >();
  const buyers = new Map<
    string,
    { nome: string; pedidos: number; receita: number; compras: Comportamento["topCompradores"][number]["compras"] }
  >();
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const genero = {
    f: { pedidos: 0, receitaCents: 0 },
    m: { pedidos: 0, receitaCents: 0 },
    u: { pedidos: 0, receitaCents: 0 },
  };
  const states = new Map<
    string,
    { nome: string; pedidos: number; receita: number; cidades: Map<string, { pedidos: number; receita: number }> }
  >();

  type Prod = {
    nome: string;
    quantidade: number;
    receita: number;
    orders: Set<string>;
    buyers: Map<string, Set<string>>;
  };
  const products = new Map<string, Prod>();
  const byBuyerOrders = new Map<string, Array<{ id: string; keys: Map<string, string> }>>();
  const serieMap = new Map<string, { totalCents: number; primeiraCents: number; recompraCents: number }>();

  for (const order of current) {
    const originId = orderOriginKey(order.provider, order.channel);
    const origin = origins.get(originId) ?? {
      label: originLabel(originId),
      buyers: new Set<string>(),
      receita: 0,
      recompra: 0,
    };
    origin.receita += order.cents;
    if (order.key) origin.buyers.add(order.key);
    if (order.repeat) origin.recompra += order.cents;
    origins.set(originId, origin);

    if (order.key) {
      const nome = (order.contactName || order.buyerName || order.buyerEmail || "Sem nome").trim();
      const row = buyers.get(order.key) ?? { nome, pedidos: 0, receita: 0, compras: [] };
      row.pedidos += 1;
      row.receita += order.cents;
      const detalhes = order.rawPayload ? orderDetails(order.provider, order.rawPayload) : null;
      const itens = order.items.map((item) => {
        const quantidade = Math.max(0, item.quantity ?? 0);
        const linha = Math.max(0, item.lineTotalCents ?? 0);
        const preco = item.unitPriceCents ?? (quantidade > 0 ? Math.round(linha / quantidade) : linha);
        return {
          nome: cleanTitle(item.title) || item.sku?.trim() || "Produto",
          quantidade,
          precoCents: Math.max(0, preco),
          imagem: httpUrl(item.imageUrl),
          url: httpUrl(item.productUrl),
        };
      });
      row.compras.push({
        id: order.id,
        numero: order.externalId?.trim() || order.id.slice(-6),
        em: order.occurredAt?.toISOString() ?? "",
        cents: order.cents,
        status: order.status,
        pagamento: detalhes?.paymentMethod ?? null,
        parcelas: detalhes?.installments ?? null,
        freteCents: detalhes?.shipping?.cents ?? order.shippingCostCents ?? null,
        freteMetodo: detalhes?.shipping?.method ?? null,
        descontoCents: detalhes?.discountCents ?? 0,
        cupom: detalhes?.coupons[0]?.code ?? null,
        itens,
      });
      if (row.nome === "Sem nome" && nome !== "Sem nome") row.nome = nome;
      buyers.set(order.key, row);
    }

    if (order.occurredAt) {
      const slot = brtSlot(order.occurredAt);
      if (slot) heatmap[slot.day][slot.hour] += 1;
      const day = brtYmd(order.occurredAt);
      const bucket = serieMap.get(day) ?? { totalCents: 0, primeiraCents: 0, recompraCents: 0 };
      bucket.totalCents += order.cents;
      if (order.key) {
        if (order.repeat) bucket.recompraCents += order.cents;
        else bucket.primeiraCents += order.cents;
      }
      serieMap.set(day, bucket);
    }

    const gender =
      order.contactGender === "F" || order.contactGender === "M"
        ? order.contactGender
        : genderFromName(order.contactName || order.buyerName);
    const g = gender === "F" ? genero.f : gender === "M" ? genero.m : genero.u;
    g.pedidos += 1;
    g.receitaCents += order.cents;

    const uf = order.stateUf ?? "";
    const state = states.get(uf) ?? { nome: uf ? stateName(uf) : "Sem local", pedidos: 0, receita: 0, cidades: new Map() };
    state.pedidos += 1;
    state.receita += order.cents;
    const city = order.cityName || order.cityRaw || "Sem cidade";
    const cityRow = state.cidades.get(city) ?? { pedidos: 0, receita: 0 };
    cityRow.pedidos += 1;
    cityRow.receita += order.cents;
    state.cidades.set(city, cityRow);
    states.set(uf, state);

    const keys = new Map<string, string>();
    for (const item of order.items) {
      const key = productKey(item);
      if (!key) continue;
      const nome = cleanTitle(item.title) || item.sku?.trim() || "Produto";
      const prod = products.get(key) ?? {
        nome,
        quantidade: 0,
        receita: 0,
        orders: new Set<string>(),
        buyers: new Map<string, Set<string>>(),
        imageUrl: null as string | null,
        productUrl: null as string | null,
      };
      prod.imageUrl = prod.imageUrl ?? httpUrl(item.imageUrl);
      prod.productUrl = prod.productUrl ?? httpUrl(item.productUrl);
      prod.quantidade += Math.max(0, item.quantity ?? 0);
      prod.receita += Math.max(0, item.lineTotalCents ?? 0);
      prod.orders.add(order.id);
      if (order.key) {
        const seen = prod.buyers.get(order.key) ?? new Set<string>();
        seen.add(order.id);
        prod.buyers.set(order.key, seen);
      }
      products.set(key, prod);
      keys.set(key, prod.nome);
    }
    if (order.key && keys.size) {
      const list = byBuyerOrders.get(order.key) ?? [];
      list.push({ id: order.id, keys });
      byBuyerOrders.set(order.key, list);
    }
  }

  const pairBuyers = new Map<
    string,
    { de: string; para: string; deImagem: string | null; paraImagem: string | null; buyers: Set<string> }
  >();
  for (const [buyer, list] of byBuyerOrders) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        for (const [fromKey, fromName] of list[i].keys) {
          for (const [toKey, toName] of list[j].keys) {
            if (fromKey === toKey) continue;
            const id = `${fromKey}\t${toKey}`;
            const pair = pairBuyers.get(id) ?? {
              de: fromName,
              para: toName,
              deImagem: products.get(fromKey)?.imageUrl ?? null,
              paraImagem: products.get(toKey)?.imageUrl ?? null,
              buyers: new Set<string>(),
            };
            pair.buyers.add(buyer);
            pairBuyers.set(id, pair);
          }
        }
      }
    }
  }

  return {
    tickets,
    ticketsAnterior,
    leitura: leituraOf(tickets, ticketsAnterior),
    recompra: {
      receitaPrimeiraCents: receitaPrimeira,
      receitaRecompraCents: receitaRecompra,
      pedidosPrimeira,
      pedidosRecompra,
      participacaoRecorrentesPct:
        receitaIdentificada > 0 ? Math.round((receitaRecompra / receitaIdentificada) * 1000) / 10 : null,
      pedidosSemContato,
      receitaSemContatoCents: receitaSemContato,
    },
    ltv: {
      medioCents: div(lifetimeReceitaCents, lifetimeCompradores),
      compradores: lifetimeCompradores,
      receitaCents: lifetimeReceitaCents,
    },
    origens: [...origins.entries()]
      .map(([id, row]) => ({
        id,
        label: row.label,
        clientes: row.buyers.size,
        receitaCents: row.receita,
        ticketCents: div(row.receita, row.buyers.size),
        recompraPct: row.receita > 0 ? Math.round((row.recompra / row.receita) * 1000) / 10 : null,
      }))
      .sort((a, b) => b.receitaCents - a.receitaCents),
    topCompradores: [...buyers.entries()]
      .sort((a, b) => b[1].receita - a[1].receita || b[1].pedidos - a[1].pedidos)
      .slice(0, 10)
      .map(([id, row]) => ({
        id,
        nome: row.nome,
        pedidos: row.pedidos,
        receitaCents: row.receita,
        compras: [...row.compras].sort((a, b) => b.em.localeCompare(a.em)),
      })),
    produtos: [...products.entries()]
      .map(([id, row]) => ({
        id,
        nome: row.nome,
        quantidade: row.quantidade,
        receitaCents: row.receita,
        compradores: row.buyers.size,
        ticketCents: div(row.receita, row.orders.size),
        recompras: [...row.buyers.values()].filter((orders) => orders.size > 1).length,
        imageUrl: row.imageUrl,
        productUrl: row.productUrl,
      }))
      .sort((a, b) => b.receitaCents - a.receitaCents || b.quantidade - a.quantidade)
      .slice(0, 10),
    pares: [...pairBuyers.values()]
      .map((row) => ({
        de: row.de,
        para: row.para,
        compradores: row.buyers.size,
        deImagem: row.deImagem,
        paraImagem: row.paraImagem,
      }))
      .filter((row) => row.compradores >= 2)
      .sort((a, b) => b.compradores - a.compradores)
      .slice(0, 6),
    serie: [...serieMap.entries()]
      .map(([data, row]) => ({ data, ...row }))
      .sort((a, b) => a.data.localeCompare(b.data)),
    serieAgrupamento: "dia",
    heatmap,
    genero,
    estados: [...states.entries()]
      .map(([uf, row]) => ({
        uf,
        nome: row.nome,
        pedidos: row.pedidos,
        receitaCents: row.receita,
        cidades: [...row.cidades.entries()]
          .map(([nome, city]) => ({ nome, pedidos: city.pedidos, receitaCents: city.receita }))
          .sort((a, b) => b.receitaCents - a.receitaCents)
          .slice(0, 8),
      }))
      .sort((a, b) => {
        if (!a.uf) return 1;
        if (!b.uf) return -1;
        return b.receitaCents - a.receitaCents;
      }),
  };
}

function tzOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(v.year),
    Number(v.month) - 1,
    Number(v.day),
    Number(v.hour) % 24,
    Number(v.minute),
    Number(v.second),
  );
  return asUtc - instant;
}

function zonedBoundary(y: number, m: number, d: number, end: boolean): Date {
  const probe = Date.UTC(y, m - 1, d, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0);
  let utc = probe;
  for (let i = 0; i < 2; i++) utc = probe - tzOffsetMs(utc);
  return new Date(utc + (end ? 999 : 0));
}

function parseYmd(value: string | null): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function todayYmd(): { y: number; m: number; d: number } {
  const text = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
  const [y, m, d] = text.split("-").map(Number);
  return { y, m, d };
}

function shiftDays(part: { y: number; m: number; d: number }, days: number) {
  const date = new Date(Date.UTC(part.y, part.m - 1, part.d));
  date.setUTCDate(date.getUTCDate() + days);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function ymdKey(part: { y: number; m: number; d: number }) {
  return `${part.y}-${String(part.m).padStart(2, "0")}-${String(part.d).padStart(2, "0")}`;
}

function weekKey(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function monthKey(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}

/** Preenche o recorte. Até 62 dias fica no dia; até 180, na semana; o ano, no mês. */
export function densifySerie(
  sparse: Comportamento["serie"],
  start: Date,
  end: Date,
): Pick<Comportamento, "serie" | "serieAgrupamento"> {
  const first = parseYmd(brtYmd(start));
  const lastKey = brtYmd(end);
  if (!first) return { serie: sparse, serieAgrupamento: "dia" };
  const days: string[] = [];
  let cursor = first;
  for (let i = 0; i < 400; i++) {
    const key = ymdKey(cursor);
    days.push(key);
    if (key >= lastKey) break;
    cursor = shiftDays(cursor, 1);
  }
  const agrupamento: Comportamento["serieAgrupamento"] = days.length > 180 ? "mes" : days.length > 62 ? "semana" : "dia";
  const bucketKey = agrupamento === "mes" ? monthKey : agrupamento === "semana" ? weekKey : (day: string) => day;
  const known = new Map(sparse.map((row) => [row.data, row]));
  const buckets = new Map<string, { data: string; totalCents: number; primeiraCents: number; recompraCents: number }>();
  for (const day of days) {
    const key = bucketKey(day);
    const row = buckets.get(key) ?? { data: key, totalCents: 0, primeiraCents: 0, recompraCents: 0 };
    const src = known.get(day);
    if (src) {
      row.totalCents += src.totalCents;
      row.primeiraCents += src.primeiraCents;
      row.recompraCents += src.recompraCents;
    }
    buckets.set(key, row);
  }
  return { serie: [...buckets.values()], serieAgrupamento: agrupamento };
}

function daySpan(start: { y: number; m: number; d: number }, end: { y: number; m: number; d: number }) {
  const a = Date.UTC(start.y, start.m - 1, start.d);
  const b = Date.UTC(end.y, end.m - 1, end.d);
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Recorte do filtro da Geral, em dias de Brasília. */
export function comportamentoRange(params: { dataInicio: string | null; dataFim: string | null; periodo: string | null }) {
  let start = parseYmd(params.dataInicio);
  let end = parseYmd(params.dataFim);
  if (!start || !end || Date.UTC(start.y, start.m - 1, start.d) > Date.UTC(end.y, end.m - 1, end.d)) {
    const dias = Math.min(365, Math.max(1, parseInt(params.periodo ?? "30", 10) || 30));
    end = todayYmd();
    start = shiftDays(end, -(dias - 1));
  }
  const span = daySpan(start, end);
  const prevEnd = shiftDays(start, -1);
  const prevStart = shiftDays(prevEnd, -(span - 1));
  return {
    start: zonedBoundary(start.y, start.m, start.d, false),
    end: zonedBoundary(end.y, end.m, end.d, true),
    previousStart: zonedBoundary(prevStart.y, prevStart.m, prevStart.d, false),
    previousEnd: zonedBoundary(prevEnd.y, prevEnd.m, prevEnd.d, true),
  };
}

const orderSelect = {
  id: true,
  provider: true,
  externalId: true,
  status: true,
  totalCents: true,
  shippingCostCents: true,
  rawPayload: true,
  occurredAt: true,
  contactId: true,
  buyerName: true,
  buyerEmail: true,
  stateUf: true,
  cityName: true,
  cityRaw: true,
  contact: { select: { name: true, gender: true } },
  source: { select: { channel: true } },
  items: { select: { title: true, sku: true, quantity: true, unitPriceCents: true, lineTotalCents: true, imageUrl: true, productUrl: true } },
} as const;

type Loaded = {
  id: string;
  provider: string;
  externalId: string;
  status: string | null;
  totalCents: number | null;
  shippingCostCents: number | null;
  rawPayload: unknown;
  occurredAt: Date | null;
  contactId: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  stateUf: string | null;
  cityName: string | null;
  cityRaw: string | null;
  contact: { name: string; gender: string | null } | null;
  source: { channel: string } | null;
  items: ItemRow[];
};

function toBehavior(row: Loaded): BehaviorOrder | null {
  if (!isRevenueOrder(row.status)) return null;
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.externalId,
    status: row.status,
    totalCents: row.totalCents,
    shippingCostCents: row.shippingCostCents,
    rawPayload: row.rawPayload,
    occurredAt: row.occurredAt,
    contactId: row.contactId,
    buyerName: row.buyerName,
    buyerEmail: row.buyerEmail,
    stateUf: row.stateUf,
    cityName: row.cityName,
    cityRaw: row.cityRaw,
    contactName: row.contact?.name ?? null,
    contactGender: row.contact?.gender ?? null,
    channel: row.source?.channel ?? null,
    items: row.items,
  };
}

function filtroAtivo(filtro?: FiltroComportamento) {
  if (!filtro) return false;
  return Boolean(filtro.genero || filtro.produto || filtro.dia != null || filtro.hora != null || filtro.uf != null || filtro.cidade);
}

export async function getComportamento(
  clienteId: string,
  range: { start: Date; end: Date; previousStart: Date; previousEnd: Date },
  filtro?: FiltroComportamento,
): Promise<ComportamentoResposta> {
  const [windowRows, priorRows, lifetimeRows] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where: { clienteId, occurredAt: { gte: range.previousStart, lte: range.end } },
      select: orderSelect,
    }),
    prisma.marketplaceOrder.findMany({
      where: { clienteId, occurredAt: { lt: range.previousStart } },
      select: { contactId: true, buyerEmail: true, status: true },
    }),
    prisma.marketplaceOrder.findMany({
      where: { clienteId },
      select: { contactId: true, buyerEmail: true, status: true, totalCents: true },
    }),
  ]);

  const paid = windowRows.map(toBehavior).filter((row): row is BehaviorOrder => row != null);
  const current = paid.filter((row) => row.occurredAt != null && row.occurredAt >= range.start && row.occurredAt <= range.end);
  const previous = paid.filter(
    (row) => row.occurredAt != null && row.occurredAt >= range.previousStart && row.occurredAt <= range.previousEnd,
  );

  const priorKeys = new Set<string>();
  for (const row of priorRows) {
    if (!isRevenueOrder(row.status)) continue;
    const key = buyerKey(row);
    if (key) priorKeys.add(key);
  }

  const lifetimePorComprador = new Map<string, number>();
  for (const row of lifetimeRows) {
    if (!isRevenueOrder(row.status)) continue;
    const key = buyerKey(row);
    if (!key) continue;
    lifetimePorComprador.set(key, (lifetimePorComprador.get(key) ?? 0) + Math.max(0, row.totalCents ?? 0));
  }
  let lifetimeReceita = 0;
  for (const cents of lifetimePorComprador.values()) lifetimeReceita += cents;

  const base = {
    current,
    previous,
    priorKeys,
    lifetimeReceitaCents: lifetimeReceita,
    lifetimeCompradores: lifetimePorComprador.size,
    lifetimePorComprador,
  };
  const result = aggregateComportamento(base, filtroAtivo(filtro) ? filtro : undefined);
  const resposta: ComportamentoResposta = { ...result, ...densifySerie(result.serie, range.start, range.end) };
  if (!filtroAtivo(filtro) || !filtro) return resposta;
  const faceta = (pular: NonNullable<FiltroComportamento["pular"]>[number]) =>
    aggregateComportamento(base, { ...filtro, pular: [pular] });
  resposta.facetas = {
    genero: faceta("genero").genero,
    produtos: faceta("produto").produtos,
    heatmap: faceta("horario").heatmap,
    estados: faceta("lugar").estados,
  };
  return resposta;
}
