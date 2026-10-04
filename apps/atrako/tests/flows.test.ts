import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { localParts, matchesAnnualDate, nextAllowedTime, nextDayStart, zonedDate } from "../lib/flows/dates";
import { parseBirthDate, parseBirthdayReply } from "../lib/flows/important-dates";
import { verifySvixSignature } from "../lib/integrations/resend/webhooks";
import { warmupDailyCap } from "../lib/integrations/resend/connection";
import { extractCouponCodes } from "../lib/flows/orders-util";
import { emailContentProblems, renderEmail, sanitizeEmailContent } from "../lib/flows/render-email";
import { defaultTheme } from "../lib/flows/theme";
import type { EmailContent, RenderContext } from "../lib/flows/types";
import { pickAttribution, type AttributionCandidate } from "../lib/flows/attribution";

const SP = "America/Sao_Paulo";

test("zonedDate converte hora local de São Paulo para UTC", () => {
  const d = zonedDate(2026, 10, 4, 9, 0, SP);
  assert.equal(d.toISOString(), "2026-10-04T12:00:00.000Z");
  assert.deepEqual(localParts(d, SP), { year: 2026, month: 10, day: 4, hour: 9, minute: 0 });
});

test("nextAllowedTime respeita a janela de envio no fuso", () => {
  const inside = new Date("2026-10-04T15:00:00.000Z"); // 12h local
  assert.equal(nextAllowedTime(inside, SP, 9, 21).getTime(), inside.getTime());

  const early = new Date("2026-10-04T09:00:00.000Z"); // 06h local
  assert.equal(nextAllowedTime(early, SP, 9, 21).toISOString(), "2026-10-04T12:00:00.000Z");

  const late = new Date("2026-10-05T01:30:00.000Z"); // 22h30 local de 04/10
  assert.equal(nextAllowedTime(late, SP, 9, 21).toISOString(), "2026-10-05T12:00:00.000Z");
});

test("nextDayStart vira o dia local, não o dia UTC", () => {
  const lateLocal = new Date("2026-12-31T23:30:00.000Z"); // 20h30 local de 31/12
  assert.equal(nextDayStart(lateLocal, SP, 9).toISOString(), "2027-01-01T12:00:00.000Z");
});

test("aniversário 29/02 cai em 28/02 em ano não bissexto e em 29/02 no bissexto", () => {
  assert.equal(matchesAnnualDate(2, 29, { year: 2027, month: 2, day: 28 }, 0), true);
  assert.equal(matchesAnnualDate(2, 29, { year: 2027, month: 3, day: 1 }, 0), false);
  assert.equal(matchesAnnualDate(2, 29, { year: 2028, month: 2, day: 29 }, 0), true);
  assert.equal(matchesAnnualDate(2, 29, { year: 2028, month: 2, day: 28 }, 0), false);
});

test("matchesAnnualDate com antecedência (D-7) atravessa a virada de ano", () => {
  assert.equal(matchesAnnualDate(1, 3, { year: 2026, month: 12, day: 27 }, -7), true);
  assert.equal(matchesAnnualDate(1, 3, { year: 2026, month: 12, day: 28 }, -7), false);
});

test("parseBirthDate aceita formatos de loja e rejeita datas impossíveis", () => {
  assert.deepEqual(parseBirthDate("1990-08-15"), { month: 8, day: 15, year: 1990 });
  assert.deepEqual(parseBirthDate("15/08/1990"), { month: 8, day: 15, year: 1990 });
  assert.deepEqual(parseBirthDate("15/08"), { month: 8, day: 15, year: null });
  assert.deepEqual(parseBirthDate("29/02"), { month: 2, day: 29, year: null });
  assert.equal(parseBirthDate("31/04/1990"), null);
  assert.equal(parseBirthDate("15/13"), null);
  assert.equal(parseBirthDate(""), null);
});

test("parseBirthdayReply entende respostas livres no WhatsApp", () => {
  assert.equal(parseBirthdayReply("15/08"), "15/08");
  assert.equal(parseBirthdayReply("dia 15 / 8 / 1990"), "15/8/1990");
  assert.equal(parseBirthdayReply("15 de agosto"), "15/8");
  assert.equal(parseBirthdayReply("3 de março de 1985"), "3/3/1985");
  assert.equal(parseBirthdayReply("10 out"), "10/10");
  assert.equal(parseBirthdayReply("obrigado!"), null);
  assert.equal(parseBirthdayReply("quero 2 camisetas"), null);
});

test("verifySvixSignature valida assinatura, rejeita adulteração e replay", () => {
  const secretBytes = Buffer.from("test-secret-0123456789");
  const secret = `whsec_${secretBytes.toString("base64")}`;
  const id = "msg_1";
  const now = Date.UTC(2026, 9, 4, 12, 0, 0);
  const timestamp = String(Math.floor(now / 1000));
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "e1" } });
  const sig = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");

  const base = { secret, id, timestamp, body, now };
  assert.equal(verifySvixSignature({ ...base, signature: `v1,${sig}` }), true);
  assert.equal(verifySvixSignature({ ...base, signature: `v1,bad v1,${sig}` }), true);
  assert.equal(verifySvixSignature({ ...base, signature: `v1,${sig}`, body: body + " " }), false);
  assert.equal(verifySvixSignature({ ...base, signature: `v1,${sig}`, now: now + 10 * 60_000 }), false);
  assert.equal(verifySvixSignature({ ...base, signature: null }), false);
});

test("warmupDailyCap sobe por idade do domínio verificado", () => {
  const now = new Date("2026-10-04T12:00:00.000Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  assert.equal(warmupDailyCap(null, now), 200);
  assert.equal(warmupDailyCap(ago(1), now), 200);
  assert.equal(warmupDailyCap(ago(5), now), 500);
  assert.equal(warmupDailyCap(ago(10), now), 1000);
  assert.equal(warmupDailyCap(ago(30), now), 10000);
  assert.equal(warmupDailyCap(ago(60), now), null);
});

test("extractCouponCodes lê o cupom de cada loja", () => {
  assert.deepEqual(extractCouponCodes("WOOCOMMERCE", { coupon_lines: [{ code: "volta10" }] }), ["VOLTA10"]);
  assert.deepEqual(extractCouponCodes("SHOPIFY", { discount_codes: [{ code: "VOLTA10" }, { code: "volta10" }] }), ["VOLTA10"]);
  assert.deepEqual(extractCouponCodes("NUVEMSHOP", { coupon: [{ code: "NIVER" }] }), ["NIVER"]);
  assert.deepEqual(extractCouponCodes("TRAY", { Order: {}, discount_coupon: "TRAY5" }), ["TRAY5"]);
  assert.deepEqual(extractCouponCodes("WOOCOMMERCE", {}), []);
});

const paidAt = new Date("2026-10-04T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(paidAt.getTime() - h * 3_600_000);
const delivery = (id: string, p: Partial<AttributionCandidate>): AttributionCandidate => ({
  id,
  couponCode: null,
  clickedAt: null,
  openedAt: null,
  deliveredAt: null,
  sentAt: hoursAgo(10),
  ...p,
});

test("pickAttribution: cupom vence clique, clique vence recebida", () => {
  const deliveries = [
    delivery("recent-click", { sentAt: hoursAgo(2), clickedAt: hoursAgo(1) }),
    delivery("coupon", { sentAt: hoursAgo(48), couponCode: "volta10" }),
  ];
  assert.deepEqual(pickAttribution(deliveries, { paidAt, couponCodes: ["VOLTA10"], influenceDays: 3 }), {
    deliveryId: "coupon",
    kind: "ATTRIBUTED",
    via: "coupon",
  });
  assert.deepEqual(pickAttribution(deliveries, { paidAt, couponCodes: [], influenceDays: 3 }), {
    deliveryId: "recent-click",
    kind: "ATTRIBUTED",
    via: "click",
  });
});

test("pickAttribution: sem clique vira influenciada só dentro da janela", () => {
  const recent = [delivery("opened", { sentAt: hoursAgo(20), openedAt: hoursAgo(19) })];
  assert.deepEqual(pickAttribution(recent, { paidAt, couponCodes: [], influenceDays: 3 }), {
    deliveryId: "opened",
    kind: "INFLUENCED",
    via: "received",
  });
  const old = [delivery("old", { sentAt: hoursAgo(24 * 5), deliveredAt: hoursAgo(24 * 5) })];
  assert.equal(pickAttribution(old, { paidAt, couponCodes: [], influenceDays: 3 }), null);
});

test("pickAttribution ignora clique depois do pagamento", () => {
  const deliveries = [delivery("late-click", { sentAt: hoursAgo(5), clickedAt: new Date(paidAt.getTime() + 60_000) })];
  assert.equal(pickAttribution(deliveries, { paidAt, couponCodes: [], influenceDays: 3 })?.kind, "INFLUENCED");
});

function ctx(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    contactName: "Maria Silva",
    storeName: "Loja Teste",
    items: [{ title: "Camiseta", quantity: 2, unitPriceCents: 5990, imageUrl: "https://cdn.test/c.jpg", productUrl: "https://loja.test/c" }],
    totalCents: 11980,
    currency: "BRL",
    primaryUrl: "https://loja.test/checkout",
    recommendations: [],
    unsubscribeUrl: "https://app.test/u/tok",
    trackUrl: (url) => `https://app.test/r/tok?u=${encodeURIComponent(url ?? "")}`,
    ...overrides,
  };
}

const content: EmailContent = sanitizeEmailContent({
  subject: "{{primeiro_nome}}, seu carrinho está te esperando",
  preheader: "Finalize em 1 minuto",
  blocks: [
    { type: "heading", text: "Esqueceu algo?" },
    { type: "text", text: "Oi {{primeiro_nome}}, guardamos seus itens." },
    { type: "items", title: "Seu carrinho" },
    { type: "text", text: "Use **{{cupom}}** e ganhe desconto." },
    { type: "coupon", text: "Seu cupom" },
    { type: "button", label: "Finalizar compra" },
    { type: "script", text: "<script>" },
  ],
});
const theme = defaultTheme({ logoUrl: null, primaryColor: null, storeName: "Loja Teste" });

test("renderEmail interpola variáveis, escapa HTML e inclui descadastro", () => {
  const out = renderEmail({ theme, content, ctx: ctx({ couponCode: "VOLTA10" }) });
  assert.equal(out.subject, "Maria, seu carrinho está te esperando");
  assert.match(out.html, /Oi Maria, guardamos seus itens\./);
  assert.match(out.html, /VOLTA10/);
  assert.match(out.html, /2x Camiseta/);
  assert.match(out.html, /https:\/\/app\.test\/u\/tok/);
  assert.doesNotMatch(out.html, /<script>/);
  assert.match(out.text, /VOLTA10/);
});

test("renderEmail sem cupom omite o bloco de cupom e textos que citam {{cupom}}", () => {
  const out = renderEmail({ theme, content, ctx: ctx({ couponCode: null }) });
  assert.doesNotMatch(out.html, /Seu cupom/);
  assert.doesNotMatch(out.html, /ganhe desconto/);
  assert.match(out.html, /guardamos seus itens/);
});

test("emailContentProblems aponta assunto e corpo vazios", () => {
  assert.deepEqual(emailContentProblems(sanitizeEmailContent({ subject: "", blocks: [] })), ["Sem assunto", "Sem conteúdo"]);
  assert.deepEqual(emailContentProblems(content), []);
});
