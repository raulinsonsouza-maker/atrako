/**
 * Concilia compras reportadas pelo Meta (anúncio × dia × janela, com valor) com pedidos da loja.
 * O Pixel envia o valor exato do pedido: N compras somando X num dia ↔ o único conjunto de N pedidos
 * daquele dia que soma X. Ambíguo (mais de um conjunto possível) fica sem par — nunca chuta.
 */

export type MatchOrder = {
  id: string;
  day: string;
  totalCents: number;
  paid: boolean;
  /** Campanha/anúncio Meta gravados nas UTMs do pedido, se houver. */
  utmCampaignId?: string | null;
  utmAdId?: string | null;
};

export type MatchUnit = {
  key: string;
  day: string;
  window: "click" | "view";
  purchases: number;
  valueCents: number;
  campaignId: string;
  adId: string;
};

export type MatchResult = {
  /** orderId → unidade que o explicou */
  claims: Map<string, { unit: MatchUnit; sameDay: boolean; utmAgrees: boolean }>;
  unmatched: Array<{ unit: MatchUnit; reason: "no_candidates" | "ambiguous" | "too_many" }>;
};

const MAX_COMBINATIONS = 50_000;

function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function binomial(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Todos os subconjuntos de tamanho k com soma = target (± tolerância), com corte de busca. */
function subsetsWithSum(items: MatchOrder[], k: number, target: number, tolerance: number): MatchOrder[][] {
  const sorted = [...items].sort((a, b) => a.totalCents - b.totalCents);
  const out: MatchOrder[][] = [];
  const pick: MatchOrder[] = [];
  const walk = (start: number, remaining: number, sum: number) => {
    if (out.length > 2) return;
    if (remaining === 0) {
      if (Math.abs(sum - target) <= tolerance) out.push([...pick]);
      return;
    }
    for (let i = start; i <= sorted.length - remaining; i++) {
      const next = sum + sorted[i].totalCents;
      if (next - target > tolerance) break;
      pick.push(sorted[i]);
      walk(i + 1, remaining - 1, next);
      pick.pop();
    }
  };
  walk(0, k, 0);
  return out;
}

function utmAgrees(o: MatchOrder, u: MatchUnit) {
  return Boolean((o.utmAdId && o.utmAdId === u.adId) || (o.utmCampaignId && o.utmCampaignId === u.campaignId));
}

export function matchPurchasesToOrders(units: MatchUnit[], orders: MatchOrder[]): MatchResult {
  const claims: MatchResult["claims"] = new Map();
  const pending = [...units].sort((a, b) => a.purchases - b.purchases || a.day.localeCompare(b.day));
  const unmatched = new Map<string, MatchResult["unmatched"][number]>();

  const tryUnit = (u: MatchUnit, days: string[], sameDay: boolean): "ok" | MatchResult["unmatched"][number]["reason"] => {
    const pool = orders.filter((o) => days.includes(o.day) && !claims.has(o.id) && o.totalCents > 0);
    if (pool.length < u.purchases) return "no_candidates";
    if (binomial(pool.length, u.purchases) > MAX_COMBINATIONS) return "too_many";
    const tolerance = Math.max(2, u.purchases);
    let found = subsetsWithSum(pool, u.purchases, u.valueCents, tolerance);
    if (found.length > 1) {
      // Desempate só com evidência: UTM do próprio anúncio/campanha, depois pedidos pagos.
      const byUtm = found.filter((s) => s.some((o) => utmAgrees(o, u)));
      if (byUtm.length === 1) found = byUtm;
      else {
        const allPaid = found.filter((s) => s.every((o) => o.paid));
        if (allPaid.length === 1) found = allPaid;
      }
    }
    if (found.length === 0) return "no_candidates";
    if (found.length > 1) return "ambiguous";
    for (const o of found[0]) claims.set(o.id, { unit: u, sameDay, utmAgrees: utmAgrees(o, u) });
    return "ok";
  };

  for (const u of pending) {
    const r = tryUnit(u, [u.day], true);
    if (r !== "ok") unmatched.set(u.key, { unit: u, reason: r });
  }
  // Fuso/virada de dia: a compra pode cair no dia vizinho do pedido.
  for (const [key, miss] of [...unmatched]) {
    if (miss.reason === "ambiguous") continue;
    const u = miss.unit;
    const r = tryUnit(u, [shiftDay(u.day, -1), shiftDay(u.day, 1)], false);
    if (r === "ok") unmatched.delete(key);
    else if (r === "ambiguous") unmatched.set(key, { unit: u, reason: r });
  }

  return { claims, unmatched: [...unmatched.values()] };
}
