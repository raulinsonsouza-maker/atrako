import assert from "node:assert/strict";
import test from "node:test";
import type { FormField } from "@atrako/forms";
import { artifactSummary, historyNote, type Artifact } from "../lib/atrako-agent/artifacts";
import { chartsFor } from "../lib/atrako-agent/charts";
import { ageLabel, cartItems } from "../lib/atrako-agent/crm-cards";
import { orderForDesign, parseDesignOutput } from "../lib/atrako-agent/designer";
import type { LlmCandidate } from "../lib/atrako-agent/llm";
import { assertPublicUrl, readPage, tavilySearch } from "../lib/atrako-agent/web";
import { sampleAnswers, validateFormAnswers } from "../lib/criar/form-test";
import {
  buildSalesPageV3,
  extractBodyAndStyles,
  renderSlots,
  sanitizeFonts,
  sanitizeLpHtml,
  sanitizeTheme,
  scopeCss,
  scopeSelector,
  unsupportedClaims,
  validateLpV3,
} from "../lib/criar/lp-html";
import { isLpSalesPageV3 } from "../lib/criar/lp-v3";
import { PREVIEW_TTL_MS, createPreviewToken, verifyPreviewToken } from "../lib/criar/preview-token";

// ── LP v3: sanitização ──

test("sanitizeLpHtml remove script, eventos, iframe, form e javascript:", () => {
  const out = sanitizeLpHtml(`
    <section onclick="alert(1)"><h1>Oi</h1>
      <script>alert(1)</script>
      <iframe src="https://evil.example"></iframe>
      <form action="https://evil.example"><input name="x"></form>
      <a href="javascript:alert(1)">x</a>
      <img src="https://cdn.example/a.png" onerror="alert(1)" alt="a">
    </section>`);
  assert.doesNotMatch(out, /<script|onclick|onerror|<iframe|<form|<input|javascript:/i);
  assert.match(out, /<h1>Oi<\/h1>/);
  assert.match(out, /<img src="https:\/\/cdn\.example\/a\.png" alt="a" \/>/);
});

test("sanitizeLpHtml mantém marcadores, força button type e rel em _blank", () => {
  const out = sanitizeLpHtml(
    `<section id="form"><atrako-form data-x="1"></atrako-form><button type="submit">Ir</button><a href="https://x.com" target="_top">x</a></section>`,
  );
  assert.match(out, /<atrako-form><\/atrako-form>/);
  assert.match(out, /<button type="button">Ir<\/button>/);
  assert.match(out, /target="_blank"/);
  assert.match(out, /rel="noopener noreferrer"/);
});

test("sanitizeLpHtml limpa style inline perigoso e url não-https", () => {
  const out = sanitizeLpHtml(
    `<div style="width: expression(alert(1))">a</div><div style="background:url(http://x.com/a.png);color:red">b</div><div style="background:url('https://cdn.x/a.png')">c</div>`,
  );
  assert.doesNotMatch(out, /expression/);
  assert.match(out, /background:none;color:red/);
  assert.match(out, /url\('https:\/\/cdn\.x\/a\.png'\)|url\(&#x27;https/);
});

test("extractBodyAndStyles aceita documento inteiro e separa <style>", () => {
  const { html, css } = extractBodyAndStyles(
    "```html\n<!doctype html><html><head><title>x</title><style>h1{color:red}</style></head><body><h1>Oi</h1></body></html>\n```",
  );
  assert.equal(html, "<h1>Oi</h1>");
  assert.match(css, /h1\{color:red\}/);
});

// ── LP v3: escopo de CSS ──

test("scopeSelector prefixa, mapeia html/body/:root e preserva pseudo-elemento", () => {
  const s = ".atrako-lp-v3";
  assert.equal(scopeSelector("body"), s);
  assert.equal(scopeSelector(":root"), s);
  assert.equal(scopeSelector("html body"), s);
  assert.equal(scopeSelector("body.dark"), `${s}.dark`);
  assert.equal(scopeSelector("body h1"), `${s} h1`);
  assert.equal(scopeSelector("h1"), `${s} h1:not(.atrako-slot, .atrako-slot *)`);
  assert.equal(scopeSelector(".btn::before"), `${s} .btn:not(.atrako-slot, .atrako-slot *)::before`);
  assert.equal(scopeSelector("*"), `${s} *:not(.atrako-slot, .atrako-slot *)`);
});

test("scopeCss: @media recursivo, @import fora, keyframes intactos, declarações perigosas fora", () => {
  const css = scopeCss(`
    @import url("https://evil.example/x.css");
    :root{--a:#000}
    h1, .lead{color:var(--a);behavior:url(x.htc)}
    @media (max-width: 640px){ .hero{padding:0} }
    @keyframes fade{from{opacity:0}to{opacity:1}}
    .x{background:url(javascript:alert(1))}
  `);
  assert.doesNotMatch(css, /@import|behavior|javascript/);
  assert.match(css, /\.atrako-lp-v3\{--a:#000\}/);
  assert.match(css, /\.atrako-lp-v3 h1:not\(\.atrako-slot, \.atrako-slot \*\),\.atrako-lp-v3 \.lead:not\(\.atrako-slot, \.atrako-slot \*\)\{color:var\(--a\)/);
  assert.match(css, /@media \(max-width: 640px\)\{\.atrako-lp-v3 \.hero:not\(\.atrako-slot, \.atrako-slot \*\)\{padding:0\}/);
  assert.match(css, /@keyframes fade\{from\{opacity:0\}to\{opacity:1\}\}/);
});

// ── LP v3: fontes, tema, marcadores, montagem ──

test("sanitizeFonts só aceita famílias simples (sem injeção na URL)", () => {
  assert.deepEqual(sanitizeFonts(["Inter:wght@400;600;700", "Playfair Display", 'x"><script>', "a&family=b", 3]), [
    "Inter:wght@400;600;700",
    "Playfair Display",
  ]);
});

test("sanitizeTheme escolhe cor de texto do botão pelo contraste", () => {
  assert.deepEqual(sanitizeTheme({ accent: "#ffd60a", surface: "dark" }), { accent: "#ffd60a", accentInk: "#1d1d1f", surface: "dark" });
  assert.equal(sanitizeTheme({ accent: "#0b3d91" })?.accentInk, "#ffffff");
  assert.equal(sanitizeTheme({ accent: "red" }), undefined);
});

test("renderSlots usa só o primeiro marcador e cria âncora quando falta", () => {
  const out = renderSlots("<atrako-form></atrako-form><p>x</p><atrako-form></atrako-form><atrako-checkout></atrako-checkout>");
  assert.equal((out.match(/data-atrako-slot="form"/g) ?? []).length, 1);
  assert.match(out, /data-atrako-slot="form" id="form"/);
  assert.match(out, /data-atrako-slot="checkout" id="checkout"/);
  const withAnchor = renderSlots('<section id="form"><atrako-form></atrako-form></section>');
  assert.doesNotMatch(withAnchor, /data-atrako-slot="form" id="form"/);
});

const GOOD_HTML = `<header><a href="#form">Quero</a></header><main><section class="sec-hero hero" data-section="hero"><h1>Agenda cheia em 30 dias</h1><p>${"Texto real da página com argumentos concretos. ".repeat(12)}</p></section><section id="form" class="sec-form" data-section="form"><h2>Fale com a gente</h2><atrako-form></atrako-form></section></main>`;
const GOOD_CSS = `:root{--accent:#0b3d91}${".s{padding:96px 24px;font-size:clamp(18px,2vw,22px);line-height:1.5}".repeat(10)}@media (max-width:640px){.s{padding:48px 16px}}`;

test("buildSalesPageV3 sanitiza, escopa e guarda o CSS original para edição", () => {
  const page = buildSalesPageV3({
    goal: "leads",
    html: `<style>h1{color:red}</style>${GOOD_HTML}<script>x</script>`,
    css: GOOD_CSS,
    fonts: ["Inter:wght@400;600"],
    theme: { accent: "#0b3d91" },
    formId: "form_1",
    brief: "b",
  });
  assert.ok(isLpSalesPageV3(page));
  assert.doesNotMatch(page.html, /<script|<style/);
  assert.match(page.css, /\.atrako-lp-v3 h1:not\(\.atrako-slot, \.atrako-slot \*\)\{color:red\}/);
  assert.match(page.cssSource ?? "", /^h1\{color:red\}/);
  assert.doesNotMatch(page.cssSource ?? "", /atrako-lp-v3/);
  assert.equal(page.formId, "form_1");
  assert.deepEqual(validateLpV3(page, { needsForm: true, needsCheckout: false }), []);
});

test("validateLpV3 aponta página rala, sem h1, sem marcador e sem responsivo", () => {
  const page = buildSalesPageV3({ goal: "sales", html: "<section><h2>Oi</h2><img src='https://x.com/a.png'></section>", brief: "b" });
  const codes = validateLpV3(page, { needsForm: false, needsCheckout: true }).map((i) => i.code);
  for (const code of ["thin", "h1", "checkout_slot", "img_alt", "css_thin", "responsive"]) {
    assert.ok(codes.includes(code), `esperava ${code} em ${codes.join(",")}`);
  }
});

test("validateLpV3 pega depoimento placeholder, contato inventado e container no <section>", () => {
  const page = buildSalesPageV3({
    goal: "leads",
    html: GOOD_HTML.replace(
      "</main>",
      '<section class="container sec-dor" data-section="dor"><blockquote>"Placeholder de depoimento"</blockquote><cite>Cliente Satisfeito</cite><p>(41) 99999-9999</p></section></main>',
    ),
    css: GOOD_CSS,
    brief: "b",
  });
  const codes = validateLpV3(page, { needsForm: true, needsCheckout: false }).map((i) => i.code);
  assert.deepEqual(codes, ["placeholder", "section_container"]);
});

test("unsupportedClaims barra garantia, bônus, instrutor e números que o usuário não informou", () => {
  const html =
    "<section><h2>Garantia de 7 dias</h2><h3>BÔNUS INCLUSOS</h3><h2>Instrutor</h2><p>Mais de 2.000 empreendedores já aprenderam.</p></section>";
  const codes = unsupportedClaims(html, "Workshop de fotografia de celular, R$ 97, sábado ao vivo").map((i) => i.code);
  assert.deepEqual(codes, ["claim_guarantee", "claim_bonus", "claim_person", "claim_number"]);
  assert.deepEqual(
    unsupportedClaims(html, "Tem garantia de 7 dias, bônus de presets, a instrutora é a Ana e já formou 2.000 empreendedores"),
    [],
  );
  const offer = "<ul><li>Acesso ao live + gravação (30 dias)</li><li>Material de apoio em PDF</li></ul>";
  assert.deepEqual(unsupportedClaims(offer, "Workshop ao vivo, R$ 97").map((i) => i.code), ["claim_access", "claim_material"]);
  assert.deepEqual(unsupportedClaims(offer, "Ao vivo, com gravação por 30 dias e apostila em PDF"), []);
});

test("validateLpV3 pede hero em <section> quando o h1 está num <header>", () => {
  const body = "<p>" + "Texto da página com conteúdo de verdade. ".repeat(20) + "</p><atrako-form></atrako-form>";
  const css = ".x{color:red}".repeat(60) + "@media (max-width:640px){.x{color:blue}}";
  const codes = (html: string) =>
    validateLpV3(buildSalesPageV3({ goal: "leads", html, css, fonts: [], formId: "f1", checkoutProductId: null, brief: "b", references: [], generatedBy: "t" }), {
      needsForm: true,
      needsCheckout: false,
    }).map((i) => i.code);
  assert.ok(codes(`<header class="hero"><h1>Promessa</h1></header>${body}`).includes("hero_header"));
  assert.ok(!codes(`<header><nav>Marca</nav></header><section class="hero"><h1>Promessa</h1></section>${body}`).includes("hero_header"));
});

// ── CRM: cartão do cliente ──

test("cartItems normaliza itens do carrinho e só aceita imagem https", () => {
  const items = cartItems([
    { title: "Tênis Run", quantity: 2, unitPriceCents: 19990, imageUrl: "https://cdn.loja.com/t.jpg" },
    { name: "Meia", quantity: "0", imageUrl: "javascript:alert(1)" },
    null,
    "lixo",
  ]);
  assert.deepEqual(items, [
    { title: "Tênis Run", quantity: 2, unitPriceCents: 19990, imageUrl: "https://cdn.loja.com/t.jpg" },
    { title: "Meia", quantity: 1, unitPriceCents: null, imageUrl: null },
  ]);
  assert.deepEqual(cartItems(undefined), []);
});

test("ageLabel conta dias corridos", () => {
  const now = new Date("2026-10-07T18:00:00Z");
  assert.equal(ageLabel(new Date("2026-10-07T10:00:00Z"), now), "hoje");
  assert.equal(ageLabel(new Date("2026-10-06T12:00:00Z"), now), "ontem");
  assert.equal(ageLabel(new Date("2026-10-01T12:00:00Z"), now), "há 6 dias");
});

test("cartão do cliente: resumo não carrega contato e o histórico guarda o contactId", () => {
  const card: Artifact = {
    kind: "contact_card",
    id: "contact_1",
    contactId: "ct_1",
    leadId: "ld_1",
    name: "Maria Souza",
    email: "maria@exemplo.com.br",
    phone: "11999998888",
    location: "Curitiba/PR",
    stage: "Carrinho abandonado",
    source: "shopify",
    dealValue: null,
    createdAt: "2026-10-01T12:00:00Z",
    activityAt: "2026-10-06T12:00:00Z",
    customer: null,
    cart: {
      status: "OPEN",
      store: "Shopify",
      totalCents: 39980,
      abandonedAt: "2026-10-06T12:00:00Z",
      notifiedAt: null,
      recoveredAt: null,
      items: [],
      recoveryUrl: null,
    },
  };
  const summary = artifactSummary(card);
  assert.match(summary, /Maria Souza/);
  assert.match(summary, /itens do carrinho/);
  assert.doesNotMatch(summary, /maria@|9999/);
  assert.match(historyNote([card]), /contactId=ct_1/);
});

// ── token de prévia ──

test("token de prévia: ida e volta, adulteração, expiração e tipo", () => {
  const now = Date.now();
  const token = createPreviewToken({ kind: "lp", id: "prod_1", clienteId: "ws_1" }, now);
  assert.deepEqual(verifyPreviewToken(token, "lp", now), { k: "lp", id: "prod_1", ws: "ws_1", exp: now + PREVIEW_TTL_MS });
  assert.equal(verifyPreviewToken(token, "form", now), null, "tipo errado");
  assert.equal(verifyPreviewToken(token, "lp", now + PREVIEW_TTL_MS + 1), null, "expirado");
  const [body, mac] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ k: "lp", id: "prod_2", ws: "ws_1", exp: now + 1e9 })).toString("base64url");
  assert.equal(verifyPreviewToken(`${forged}.${mac}`, "lp", now), null, "corpo trocado");
  assert.equal(verifyPreviewToken(`${body}.x${mac.slice(1)}`, "lp", now), null, "assinatura trocada");
  assert.equal(verifyPreviewToken("lixo", "lp", now), null);
  assert.equal(verifyPreviewToken(undefined), null);
});

// ── modo teste do formulário ──

const FIELDS: FormField[] = [
  { id: "nome", type: "text", label: "Nome", required: true },
  { id: "email", type: "email", label: "E-mail", required: true },
  { id: "tel", type: "phone", label: "WhatsApp", required: true },
  { id: "plano", type: "choice", label: "Plano", required: true, options: ["Básico", "Pro"] },
  { id: "quando", type: "date", label: "Quando", required: false },
  { id: "lgpd", type: "consent", label: "Aceito", required: true },
];

test("validateFormAnswers aponta cada erro com o rótulo do campo", () => {
  const r = validateFormAnswers(FIELDS, [
    { fieldId: "email", value: "maria@" },
    { fieldId: "tel", value: "1234" },
    { fieldId: "plano", value: "Ouro" },
    { fieldId: "quando", value: "amanhã" },
  ]);
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.errors.map((e) => `${e.fieldId}:${e.message}`),
    [
      "nome:Campo obrigatório.",
      "email:E-mail inválido.",
      "tel:Telefone precisa de DDD + número.",
      "plano:Opção inexistente.",
      "quando:Data no formato DD/MM.",
      "lgpd:Precisa aceitar.",
    ],
  );
});

test("sampleAnswers gera respostas que passam na validação", () => {
  const answers = sampleAnswers(FIELDS);
  const r = validateFormAnswers(FIELDS, answers);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.values.nome, "Maria Teste");
  assert.equal(r.values.plano, "Básico");
});

// ── gráficos ──

test("chartsFor monta funil do CRM e ignora a etapa de perdidos", () => {
  const [c] = chartsFor("crm_pipeline", {
    etapas: [
      { etapa: "Novo", papel: "entry", leads: 40 },
      { etapa: "Qualificado", papel: "middle", leads: 12 },
      { etapa: "Perdido", papel: "lost", leads: 9 },
    ],
  });
  assert.equal(c.chart, "funnel");
  assert.deepEqual(c.data, [
    { etapa: "Novo", leads: 40 },
    { etapa: "Qualificado", leads: 12 },
  ]);
});

test("chartsFor: receita por origem vira rosca; mídia diária vira linha; sem dado não há gráfico", () => {
  const [donut] = chartsFor("vendas_visao_geral", {
    atual: { receita: 900, porOrigem: [{ label: "Shopify", receita: 600 }, { label: "Checkout", receita: 300 }, { label: "X", receita: 0 }] },
  });
  assert.equal(donut.chart, "donut");
  assert.equal(donut.data.length, 2);

  const [line] = chartsFor("midia_visao_geral", {
    granularity: "day",
    current: { daily: [{ day: "2026-10-01", investimento: 10 }, { day: "2026-10-02", investimento: 20 }] },
  });
  assert.equal(line.chart, "line");
  assert.deepEqual(line.data[0], { dia: "01/10", investimento: 10 });

  assert.deepEqual(chartsFor("vendas_visao_geral", { atual: { receita: 0 }, anterior: { receita: 0 } }), []);
  assert.deepEqual(chartsFor("ferramenta_desconhecida", { a: 1 }), []);
  assert.deepEqual(chartsFor("crm_pipeline", null), []);
});

test("chartsFor: comportamento mostra gênero e, sem nome, os produtos", () => {
  const [donut] = chartsFor("comportamento_compra", {
    genero: {
      mulheres: { receita: 640 },
      homens: { receita: 200 },
      naoIdentificado: { receita: 90 },
    },
  });
  assert.equal(donut.chart, "donut");
  assert.equal(donut.title, "Receita por gênero");
  assert.equal(donut.data.length, 3);

  const [bar] = chartsFor("comportamento_compra", {
    genero: { mulheres: { receita: 0 }, homens: { receita: 0 }, naoIdentificado: { receita: 40 } },
    produtos: [{ nome: "Kefir", receita: 40 }],
  });
  assert.equal(bar.chart, "bar");
  assert.deepEqual(bar.data, [{ nome: "Kefir", receita: 40 }]);
});

// ── web ──

test("assertPublicUrl bloqueia endereços internos, portas e esquemas", async () => {
  for (const url of [
    "http://localhost/",
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://169.254.169.254/latest/meta-data",
    "http://192.168.1.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:a9fe:a9fe]/",
    "http://[::7f00:1]/",
    "http://intranet/",
    "http://db.internal/",
    "ftp://example.com/",
    "https://example.com:8443/",
    "https://user:pass@example.com/",
    "nada",
  ]) {
    await assert.rejects(assertPublicUrl(url), Error, url);
  }
  assert.equal((await assertPublicUrl("https://93.184.216.34/x")).hostname, "93.184.216.34");
});

test("tavilySearch envia a chave e normaliza resultados", async (t) => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({
        answer: " Resumo ",
        results: [
          { title: " Ref ", url: "https://ref.example/a", content: "trecho   longo", score: 0.876 },
          { title: "ruim", url: "javascript:alert(1)", content: "x" },
        ],
        images: ["https://img.example/a.png", "http://inseguro/a.png"],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  const found = await tavilySearch("landing page clínica", { apiKey: "tvly-FAKE-test-key", images: true });
  assert.equal(calls[0].url, "https://api.tavily.com/search");
  assert.equal((calls[0].init?.headers as Record<string, string>).authorization, "Bearer tvly-FAKE-test-key");
  assert.deepEqual(found, {
    answer: "Resumo",
    results: [{ title: "Ref", url: "https://ref.example/a", snippet: "trecho longo", score: 0.88 }],
    images: ["https://img.example/a.png"],
  });
});

test("readPage não segue redirecionamento para endereço interno", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string | URL) => {
    const u = String(url);
    if (u.startsWith("https://r.jina.ai/")) return new Response("indisponível", { status: 503 });
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } });
  });
  await assert.rejects(readPage("https://93.184.216.34/"), /interno/);
});

test("readPage usa o Jina Reader e corta o texto", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    new Response(`Title: Página Exemplo\nURL Source: https://93.184.216.34/\nMarkdown Content:\n# Oi\n${"a".repeat(20_000)}`, { status: 200 }),
  );
  const page = await readPage("https://93.184.216.34/");
  assert.equal(page.via, "jina");
  assert.equal(page.title, "Página Exemplo");
  assert.ok(page.text.startsWith("# Oi"));
  assert.equal(page.truncated, true);
  assert.equal(page.text.length, 12_000);
});

// ── designer ──

test("parseDesignOutput lê os blocos delimitados", () => {
  const out = parseDesignOutput(`===NOTAS===
Conceito editorial.
===FONTES===
- "Fraunces:wght@400;600"
Inter:wght@400;600
Terceira:wght@400
===TEMA===
accent=#0B3D91
surface=dark
===CSS===
\`\`\`css
h1{color:red}
\`\`\`
===HTML===
<section><h1>Oi</h1><atrako-form></atrako-form></section>
===FIM===`);
  assert.ok(out);
  assert.equal(out.notes, "Conceito editorial.");
  assert.deepEqual(out.fonts, ["Fraunces:wght@400;600", "Inter:wght@400;600"]);
  assert.deepEqual(out.theme, { accent: "#0B3D91", surface: "dark" });
  assert.equal(out.css, "h1{color:red}");
  assert.equal(out.html, "<section><h1>Oi</h1><atrako-form></atrako-form></section>");
});

test("parseDesignOutput aceita cercas markdown e recusa texto sem HTML", () => {
  const out = parseDesignOutput("Aqui está:\n```html\n<main><h1>Oi</h1></main>\n```\n```css\nh1{margin:0}\n```");
  assert.equal(out?.html, "<main><h1>Oi</h1></main>");
  assert.equal(out?.css, "h1{margin:0}");
  assert.equal(parseDesignOutput("Desculpe, não posso ajudar."), null);
});

test("orderForDesign: chave do workspace primeiro, depois modelos maiores, resto na ordem", () => {
  const c = (model: string, source: "platform" | "workspace" = "platform") =>
    ({ key: model, provider: "openrouter", model, apiKey: "FAKE", baseUrl: "https://x", source }) as unknown as LlmCandidate;
  const ordered = orderForDesign([
    c("meta-llama/llama-3.3-70b"),
    c("command-a-03-2025"),
    c("openai/gpt-oss-120b:free"),
    c("my-model", "workspace"),
    c("qwen3"),
  ]).map((x) => x.model);
  assert.deepEqual(ordered, ["my-model", "openai/gpt-oss-120b:free", "command-a-03-2025", "meta-llama/llama-3.3-70b", "qwen3"]);
});

// ── artefatos ──

test("historyNote lembra ids de páginas e formulários; resumo não leva dados", () => {
  const artifacts: Artifact[] = [
    {
      kind: "lp_preview",
      id: "a1",
      productId: "prod_1",
      name: "Clínica Sorriso",
      status: "DRAFT",
      previewUrl: "/p/x?preview=t",
      publicUrl: "https://atrako.com.br/p/x",
      editPath: "/criar/paginas/prod_1",
      formId: "form_1",
      hasCheckout: false,
    },
    { kind: "resource_created", id: "a2", resource: "landing_page", resourceId: "prod_1", name: "Clínica Sorriso", status: "DRAFT" },
    { kind: "resource_created", id: "a3", resource: "form", resourceId: "form_1", name: "Avaliação", status: "DRAFT" },
    { kind: "chart", id: "a4", chart: "bar", title: "Receita", unit: "currency", xKey: "x", series: [], data: [{ x: "a", v: 999 }] },
  ];
  assert.equal(
    historyNote(artifacts),
    '\n\n[Recursos nesta resposta: landing page "Clínica Sorriso" id=prod_1 status=DRAFT; formulário "Avaliação" id=form_1 status=DRAFT]',
  );
  assert.equal(historyNote([]), "");
  assert.doesNotMatch(artifactSummary(artifacts[3]), /999/);
  assert.match(artifactSummary(artifacts[0]), /rascunho/);
});
