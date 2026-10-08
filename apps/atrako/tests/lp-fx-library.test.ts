import assert from "node:assert/strict";
import test from "node:test";
import { creditsToTrack, mapUnsplashPhoto, pickStockImages, usedStockImages, withUtm, type StockImage } from "../lib/atrako-agent/images-core";
import { lpFxPromptSection, LP_FX_IDS } from "../lib/criar/lp-fx/catalog";
import { assessLpBrief } from "../lib/criar/lp-brief";
import { anonymizeSection, cssForSection, splitSections } from "../lib/criar/lp-library/extract";
import { rankSections, type LibraryCandidate } from "../lib/criar/lp-library/rank";
import { sectionScore } from "../lib/criar/lp-library/score";
import { buildSalesPageV3, sanitizeLpHtml, validateLpV3 } from "../lib/criar/lp-html";

const photo = (over: Partial<StockImage> & Pick<StockImage, "id" | "author">): StockImage => ({
  url: `https://images.unsplash.com/${over.id}?ixid=1`,
  alt: "Clínica",
  width: 1600,
  height: 900,
  color: "#abc",
  authorUrl: "https://unsplash.com/@ana",
  photoUrl: "https://unsplash.com/photos/x",
  downloadLocation: "https://api.unsplash.com/photos/x/download",
  ...over,
});

test("pickStockImages prioriza paisagem e não repete fotógrafo", () => {
  const images = [
    photo({ id: "a", author: "Ana", width: 800, height: 1200 }),
    photo({ id: "b", author: "Bia", width: 1600, height: 900 }),
    photo({ id: "c", author: "Ana", width: 1600, height: 900 }),
    photo({ id: "d", author: "Caio", width: 1000, height: 1000 }),
  ];
  const picked = pickStockImages(images, 6);
  assert.equal(picked[0]?.id, "b");
  assert.deepEqual(picked.map((img) => img.author), ["Bia", "Ana", "Caio"]);
});

test("usedStockImages acha a foto no HTML e no CSS pela URL sem query", () => {
  const images = [photo({ id: "hero", author: "Ana" }), photo({ id: "fora", author: "Lia" })];
  const used = usedStockImages(`<img src="${images[0].url}"> .x{background:url(${images[0].url.split("?")[0]})}`, images);
  assert.deepEqual(used.map((img) => img.id), ["hero"]);
  assert.equal(used[0]?.tracked, false);
});

test("creditsToTrack dispara o download uma vez", () => {
  const base = {
    id: "1",
    url: "https://images.unsplash.com/a",
    alt: "a",
    author: "Ana",
    authorUrl: "https://unsplash.com/@ana",
    photoUrl: "https://unsplash.com/photos/a",
    downloadLocation: "https://api.unsplash.com/photos/a/download",
    tracked: false,
  };
  assert.equal(creditsToTrack([base]).length, 1);
  assert.equal(creditsToTrack([{ ...base, tracked: true }]).length, 0);
  assert.equal(withUtm("https://unsplash.com/@ana").includes("utm_source=atrako"), true);
});

test("mapUnsplashPhoto recusa URL que não é https", () => {
  assert.equal(mapUnsplashPhoto({ id: "1", urls: { raw: "http://images.unsplash.com/a" } }), null);
  const mapped = mapUnsplashPhoto({
    id: "1",
    urls: { raw: "https://images.unsplash.com/photo" },
    user: { name: "Ana Souza", links: { html: "https://unsplash.com/@ana" } },
    links: { html: "https://unsplash.com/photos/1", download_location: "https://api.unsplash.com/photos/1/download" },
    alt_description: "Sala",
  });
  assert.equal(mapped?.author, "Ana Souza");
  assert.match(mapped?.url ?? "", /w=1600/);
});

test("sanitizeLpHtml remove data-fx desconhecido e mantém o do catálogo", () => {
  const out = sanitizeLpHtml(`<h1 data-fx="text-rotate" data-words="a|b">Oi</h1><p data-fx="explodir">x</p>`);
  assert.match(out, /data-fx="text-rotate"/);
  assert.equal(LP_FX_IDS.has("explodir"), false);
  assert.doesNotMatch(out, /explodir/);
});

test("validateLpV3 limita fundo animado e efeito de texto no título", () => {
  const html = `<section class="sec-hero fx-aurora fx-grid-bg" data-section="hero"><h1 data-fx="text-rotate" data-fx="scramble">Promessa</h1><p>${"Texto suficiente da página para passar do mínimo de conteúdo. ".repeat(12)}</p></section><section class="sec-form" data-section="form" id="form"><atrako-form></atrako-form></section>`;
  const css = `:root{--a:#000}${".s{padding:96px}".repeat(20)}@media (max-width:640px){.s{padding:0}}`;
  const codes = validateLpV3(
    buildSalesPageV3({ goal: "leads", html, css, formId: "f", brief: "b" }),
    { needsForm: true, needsCheckout: false },
  ).map((i) => i.code);
  assert.ok(codes.includes("fx_background"), codes.join(","));
});

test("o prompt de efeitos sai do catálogo", () => {
  const text = lpFxPromptSection();
  assert.match(text, /text-rotate/);
  assert.match(text, /fx-aurora/);
  assert.match(text, /3 a 5 efeitos/);
});

test("anonimização não vaza nome, contato, imagem nem a cor da marca", () => {
  const html = `<section class="sec-hero" data-section="hero"><h1>Clínica Aurora</h1><p>Ligue (11) 98888-7777 ou ana@clinica.com</p><img src="https://images.unsplash.com/photo" alt="sala"></section>`;
  const css = ".sec-hero{color:#0b3d91;background:#fff}.sec-dor{color:red}";
  const [section] = splitSections(html, css);
  assert.ok(section);
  const clean = anonymizeSection(section, { brandName: "Clínica Aurora", accent: "#0b3d91" });
  assert.doesNotMatch(clean.html, /Aurora|98888|ana@clinica|images\.unsplash/);
  assert.match(clean.html, /\{\{headline\}\}/);
  assert.match(clean.html, /\{\{img:secao\}\}/);
  assert.match(clean.css, /var\(--primary\)/);
  assert.doesNotMatch(clean.css, /#0b3d91|sec-dor/);
});

test("css da seção respeita @media", () => {
  const css = ".sec-hero h1{color:red}@media (max-width:640px){.sec-hero{padding:0}.sec-dor{padding:1}}";
  const hero = cssForSection(css, "hero");
  assert.match(hero, /@media \(max-width:640px\)/);
  assert.match(hero, /\.sec-hero\{padding:0\}/);
  assert.doesNotMatch(hero, /sec-dor/);
});

test("ranking não entrega candidata de outro workspace", () => {
  const row = (over: Partial<LibraryCandidate>): LibraryCandidate => ({
    id: "s1",
    kind: "hero",
    goal: "leads",
    html: "<section>x</section>",
    css: "",
    tags: ["odontologia"],
    score: 1,
    status: "candidate",
    sourceClienteId: "ws-a",
    ...over,
  });
  const query = { clienteId: "ws-b", goal: "leads" as const, segmento: "odontologia" };
  assert.equal(rankSections([row({})], query).length, 0);
  const approved = rankSections([row({ id: "ok", status: "approved", sourceClienteId: "ws-a" })], query);
  assert.equal(approved.length, 1);
  const own = rankSections(
    [row({ id: "own", sourceClienteId: "ws-b", score: 1 }), row({ id: "glob", status: "approved", sourceClienteId: "ws-a", score: 9, kind: "hero" })],
    { ...query, clienteId: "ws-b" },
  );
  assert.equal(own.length, 1);
  assert.equal(own[0]?.id, "glob");
});

test("nota sobe com aprovação e uso", () => {
  const base = { published: true, issueCount: 0, edits: 0, conversionRate: null, uses: 0, approved: false };
  assert.ok(sectionScore({ ...base, approved: true }) > sectionScore(base));
  assert.ok(sectionScore({ ...base, uses: 8 }) > sectionScore(base));
});

const briefCheio = {
  briefing: "Curso de fotografia de celular, ao vivo, no sábado.",
  publico: "quem quer vender foto pelo celular",
  estilo: "clara e simples",
  cta: "Quero participar",
  goal: "leads" as const,
  precoReais: null,
  temProduto: false,
};

test("a página não sai enquanto falta o que a pessoa quer", () => {
  const vazio = assessLpBrief({ ...briefCheio, briefing: "curso", publico: "", estilo: "", cta: "", lastUserMessage: "cria uma página" });
  assert.equal(vazio.ok, false);
  if (!vazio.ok) {
    assert.match(vazio.falar, /Para quem/);
    assert.match(vazio.falar, /visual/);
    assert.doesNotMatch(vazio.falar, /briefing|CTA|hero/);
  }
  const plano = assessLpBrief({ ...briefCheio, lastUserMessage: "é um curso de fotografia para quem quer vender pelo celular, visual claro, botão Quero participar" });
  assert.equal(plano.ok, false);
  if (!plano.ok) assert.match(plano.falar, /Posso montar assim/);
  const ok = assessLpBrief({ ...briefCheio, lastUserMessage: "pode montar" });
  assert.equal(ok.ok, true);
  const venda = assessLpBrief({ ...briefCheio, goal: "sales", lastUserMessage: "sim" });
  assert.equal(venda.ok, false);
  if (!venda.ok) assert.match(venda.falar, /preço/);
});
