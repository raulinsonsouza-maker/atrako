import assert from "node:assert/strict";
import test from "node:test";
import { parseWooOrderSource } from "../lib/commerce-attribution/store-source";
import { matchPurchasesToOrders, type MatchOrder, type MatchUnit } from "../lib/commerce-attribution/match";

const woo = (meta: Record<string, string>) => ({
  meta_data: Object.entries(meta).map(([key, value]) => ({ key: `_wc_order_attribution_${key}`, value })),
});

test("anúncio com template antigo: utm_source={{campaign.id}}, utm_term=adset, utm_content=nome", () => {
  const s = parseWooOrderSource(
    woo({
      source_type: "utm",
      utm_source: "120254095676930404",
      utm_medium: "paid",
      session_entry:
        "https://loja.com/?utm_source=120254095676930404&utm_medium=paid&utm_campaign=24/08 - [SYMBIUS][RAUL][CAMPANHA DE VENDAS]&utm_content=[ANUNCIO_01]&fbclid=x&utm_id=120254095676930404&utm_term=120254095676940404",
    }),
  );
  assert.equal(s?.channel, "meta_ads");
  assert.equal(s?.meta?.campaignId, "120254095676930404");
  assert.equal(s?.meta?.adsetId, "120254095676940404");
  assert.equal(s?.meta?.adName, "[ANUNCIO_01]");
  assert.equal(s?.meta?.campaignName, "24/08 - [SYMBIUS][RAUL][CAMPANHA DE VENDAS]");
  assert.equal(s?.hasFbclid, true);
});

test("padrão Atrako: utm_content={{ad.id}} vira adId", () => {
  const s = parseWooOrderSource(
    woo({
      source_type: "utm",
      session_entry: "https://loja.com/p?utm_source=facebook&utm_medium=paid&utm_id=111111111111&utm_term=222222222222&utm_content=333333333333",
    }),
  );
  assert.equal(s?.channel, "meta_ads");
  assert.equal(s?.meta?.adId, "333333333333");
});

test("url_tags do campaign builder (atk_ad) somado às UTMs estáticas do link", () => {
  const s = parseWooOrderSource(
    woo({
      source_type: "utm",
      utm_source: "meta",
      utm_medium: "paid",
      utm_campaign: "black-friday",
      session_entry:
        "https://loja.com/p?utm_source=meta&utm_medium=paid&utm_campaign=black-friday&utm_id=111111111111&utm_term=222222222222&atk_ad=333333333333&fbclid=x",
    }),
  );
  assert.equal(s?.channel, "meta_ads");
  assert.equal(s?.meta?.campaignId, "111111111111");
  assert.equal(s?.meta?.adsetId, "222222222222");
  assert.equal(s?.meta?.adId, "333333333333");
});

test("link da bio do Instagram (fbclid orgânico) não é anúncio", () => {
  const s = parseWooOrderSource(
    woo({
      source_type: "utm",
      referrer: "https://l.instagram.com/",
      utm_source: "ig",
      utm_medium: "social",
      session_entry: "https://loja.com/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAZ",
    }),
  );
  assert.equal(s?.channel, "instagram");
  assert.equal(s?.meta, null);
});

test("Instagram Shopping, Google orgânico e direto", () => {
  assert.equal(parseWooOrderSource(woo({ source_type: "utm", utm_source: "IGShopping", utm_medium: "Social" }))?.channel, "instagram");
  assert.equal(parseWooOrderSource(woo({ source_type: "organic", utm_source: "google", utm_medium: "organic" }))?.channel, "google_organic");
  assert.equal(parseWooOrderSource(woo({ source_type: "typein", utm_source: "(direct)" }))?.channel, "direct");
  assert.equal(parseWooOrderSource({ meta_data: [] }), null);
});

const order = (id: string, day: string, reais: number, extra: Partial<MatchOrder> = {}): MatchOrder => ({
  id,
  day,
  totalCents: Math.round(reais * 100),
  paid: true,
  ...extra,
});
const unit = (key: string, day: string, purchases: number, reais: number, window: "click" | "view" = "view"): MatchUnit => ({
  key,
  day,
  window,
  purchases,
  valueCents: Math.round(reais * 100),
  campaignId: "c1",
  adId: key,
});

test("casos reais da Sense: 1 e 2 compras por dia batem com o pedido exato", () => {
  const orders = [
    order("12476", "2026-09-22", 304.29),
    order("12478", "2026-09-22", 147.29),
    order("12479", "2026-09-22", 252.97),
    order("12480", "2026-09-22", 153.52),
    order("12486", "2026-09-22", 368.36),
    order("12487", "2026-09-22", 384.58),
    order("12489", "2026-09-22", 143.34),
    order("12490", "2026-09-22", 158.29),
    order("12531", "2026-10-05", 143.79),
    order("12532", "2026-10-05", 143.34),
    order("12533", "2026-10-05", 160.33),
    order("12534", "2026-10-05", 508.34),
  ];
  const { claims, unmatched } = matchPurchasesToOrders(
    [unit("ad08-0922", "2026-09-22", 2, 688.87), unit("ad08-1005", "2026-10-05", 2, 287.13)],
    orders,
  );
  assert.deepEqual(unmatched, []);
  assert.deepEqual([...claims.keys()].sort(), ["12476", "12487", "12531", "12532"]);
  assert.equal(claims.get("12531")?.unit.key, "ad08-1005");
});

test("valor repetido no mesmo dia fica sem par (não chuta)", () => {
  const { claims, unmatched } = matchPurchasesToOrders(
    [unit("a", "2026-10-01", 1, 143.79)],
    [order("1", "2026-10-01", 143.79), order("2", "2026-10-01", 143.79)],
  );
  assert.equal(claims.size, 0);
  assert.equal(unmatched[0]?.reason, "ambiguous");
});

test("UTM do próprio anúncio desempata valores iguais", () => {
  const { claims } = matchPurchasesToOrders(
    [{ ...unit("a", "2026-10-01", 1, 143.79, "click"), adId: "999" }],
    [order("1", "2026-10-01", 143.79), order("2", "2026-10-01", 143.79, { utmAdId: "999" })],
  );
  assert.deepEqual([...claims.keys()], ["2"]);
  assert.equal(claims.get("2")?.utmAgrees, true);
});

test("compra que caiu no dia vizinho é encontrada no segundo passe", () => {
  const { claims } = matchPurchasesToOrders([unit("a", "2026-10-02", 1, 159.15)], [order("x", "2026-10-01", 159.15)]);
  assert.equal(claims.get("x")?.sameDay, false);
});

test("um pedido não é usado por dois anúncios", () => {
  const { claims, unmatched } = matchPurchasesToOrders(
    [unit("a", "2026-10-01", 1, 100), unit("b", "2026-10-01", 1, 100)],
    [order("1", "2026-10-01", 100)],
  );
  assert.equal(claims.size, 1);
  assert.equal(unmatched.length, 1);
});
