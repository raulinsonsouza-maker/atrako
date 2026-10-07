import assert from "node:assert/strict";
import test from "node:test";
import { buildAtrakoSystemPrompt } from "@atrako/agent";
import { DRAFT_TOOLS, lpSalesPage, normalizeFormArgs, normalizeLpArgs } from "../lib/atrako-agent/actions";
import {
  describeWorkspaceContext,
  periodPresetFromText,
  resolvePeriod,
  type AtrakoWorkspaceContext,
} from "../lib/atrako-agent/context";
import {
  EngineError,
  runAtrakoEngine,
  type ChatClient,
  type EngineCandidate,
  type EngineEvent,
} from "../lib/atrako-agent/engine";
import { classifyLlmFailure, type LlmFailure } from "../lib/atrako-agent/failover";
import { evaluateRateLimit } from "../lib/atrako-agent/limits";
import { describeLlmError, maskApiKey, orderChain, type LlmCandidate } from "../lib/atrako-agent/llm";
import { PLATFORM_LLM_APPS, findAiProvider, interleave, parseModelList } from "../lib/atrako-agent/providers";
import { compactJson, createPiiVault, maskEmail, maskPhone, protectUserText, revealToken } from "../lib/atrako-agent/safety";
import {
  READ_TOOLS,
  relaxSchema,
  runTool,
  toOpenAITools,
  toolsForWorkspace,
  type AtrakoTool,
  type ToolResult,
} from "../lib/atrako-agent/tools";

const ctx: AtrakoWorkspaceContext = {
  clienteId: "ws_1",
  nome: "Churrascaria Fogo",
  segmento: "Restaurante",
  objetivoMidia: "VENDAS",
  orcamentoMidiaGoogleMensal: null,
  orcamentoMidiaMetaMensal: 3000,
  timezone: "America/Sao_Paulo",
  currency: "BRL",
  locale: "pt-BR",
  today: new Date(2026, 9, 7),
  commercial: { produtoServico: "Rodízio de carnes" } as AtrakoWorkspaceContext["commercial"],
  coverage: {
    metaAds: true,
    googleAds: false,
    analytics: false,
    crmExternal: false,
    crmNative: true,
    contacts: true,
    commerce: true,
    marketplace: false,
    abandonedCarts: false,
    agenda: false,
    whatsapp: false,
    messaging: false,
    finance: false,
    instagram: false,
    forms: false,
    pages: false,
  },
  modules: [],
  actor: { kind: "member", key: "member:m1", name: "Ana", role: "OWNER", canManage: true },
};

// ---------------------------------------------------------------- safety

test("protectUserText troca e-mail/telefone por tokens e remove CPF/cartão", () => {
  const vault = createPiiVault();
  const { text, redacted } = protectUserText(
    "Ache joao.silva@Gmail.com ou (11) 98765-4321. CPF 123.456.789-09, cartão 4111 1111 1111 1111. Vendi 1500 em 2026.",
    vault,
  );
  assert.equal(redacted, true);
  assert.ok(!text.includes("joao.silva"));
  assert.ok(!text.includes("98765"));
  assert.ok(!text.includes("123.456.789-09"));
  assert.ok(!text.includes("4111"));
  assert.match(text, /\[contato#1\]/);
  assert.match(text, /\[contato#2\]/);
  assert.match(text, /\[documento removido\]/);
  assert.match(text, /\[cartão removido\]/);
  // números de negócio não são PII
  assert.match(text, /Vendi 1500 em 2026/);
  assert.equal(revealToken("[contato#1]", vault), "joao.silva@gmail.com");
  assert.equal(revealToken("[contato#2]", vault), "11987654321");
});

test("protectUserText reaproveita o token do mesmo contato e não marca texto limpo", () => {
  const vault = createPiiVault();
  const a = protectUserText("ana@x.com e ANA@x.com", vault);
  assert.equal(a.text, "[contato#1] e [contato#1]");
  const clean = protectUserText("Como estou nos últimos 30 dias?", vault);
  assert.deepEqual(clean, { text: "Como estou nos últimos 30 dias?", redacted: false });
  assert.equal(revealToken("[contato#9]", vault), "[contato#9]");
  assert.equal(revealToken("[contato#1]", undefined), "[contato#1]");
});

test("máscaras de contato e chave de API nunca devolvem o valor inteiro", () => {
  assert.equal(maskEmail("joana@loja.com"), "jo•••@loja.com");
  assert.equal(maskPhone("+55 11 98765-4321"), "•••4321");
  assert.equal(maskEmail(null), null);
  const hint = maskApiKey("sk-proj-abcdefghijklmnop1234");
  assert.ok(hint.startsWith("sk-"));
  assert.ok(hint.endsWith("1234"));
  assert.ok(!hint.includes("abcdefghijklmnop"));
  assert.equal(maskApiKey("short"), "••••");
});

test("preset NVIDIA: URL fixa https, modelos testados e chave nvapi- mascarada", () => {
  const nvidia = findAiProvider("nvidia");
  assert.ok(nvidia);
  assert.equal(nvidia.baseUrl, "https://integrate.api.nvidia.com/v1");
  assert.equal(nvidia.models[0]?.value, "nvidia/nemotron-3-super-120b-a12b");
  const hint = maskApiKey("nvapi-FAKEFAKEFAKEFAKEFAKEFAKE-abcd");
  assert.equal(hint, "nvapi-…abcd");
});

test("describeLlmError explica modelo descontinuado (404/410)", () => {
  const retired = "Este modelo foi descontinuado ou não está liberado na sua conta. Escolha outro modelo.";
  assert.equal(describeLlmError({ status: 410 }), retired);
  assert.equal(describeLlmError({ status: 404 }), retired);
  assert.equal(describeLlmError({ status: 429 }), "Limite de uso ou créditos esgotados na sua conta de IA.");
});

test("compactJson arredonda decimais e trunca payloads grandes", () => {
  assert.equal(compactJson({ roas: 3.14159 }), '{"roas":3.14}');
  const big = compactJson({ rows: "x".repeat(500) }, 100);
  assert.equal(big.length < 200, true);
  assert.match(big, /truncado/);
});

test("evaluateRateLimit bloqueia por minuto e por dia", () => {
  const limits = { perMinute: 3, perDay: 10 };
  assert.deepEqual(evaluateRateLimit({ lastMinute: 2, lastDay: 9 }, limits), { ok: true });
  const minute = evaluateRateLimit({ lastMinute: 3, lastDay: 3 }, limits);
  assert.equal(minute.ok, false);
  assert.equal(!minute.ok && minute.retryAfterSec, 60);
  const day = evaluateRateLimit({ lastMinute: 0, lastDay: 10 }, limits);
  assert.equal(!day.ok && day.retryAfterSec, 3600);
});

// ---------------------------------------------------------------- períodos

test("periodPresetFromText entende pt-BR livre", () => {
  assert.equal(periodPresetFromText("últimos 7 dias"), "ultimos_7_dias");
  assert.equal(periodPresetFromText("essa semana"), "ultimos_7_dias");
  assert.equal(periodPresetFromText("mês passado"), "mes_anterior");
  assert.equal(periodPresetFromText("este mês"), "mes_atual");
  assert.equal(periodPresetFromText("ultimos_90_dias"), "ultimos_90_dias");
  assert.equal(periodPresetFromText("Hoje"), "hoje");
  assert.equal(periodPresetFromText("qualquer coisa"), null);
  assert.equal(periodPresetFromText(42), null);
});

test("resolvePeriod calcula janelas inclusivas e o período anterior", () => {
  const today = new Date(2026, 9, 7);
  const p30 = resolvePeriod(null, today);
  assert.equal(p30.preset, "ultimos_30_dias");
  assert.equal(p30.startLabel, "2026-09-08");
  assert.equal(p30.endLabel, "2026-10-07");
  assert.equal(p30.previousEndLabel, "2026-09-07");

  const prev = resolvePeriod({ periodo: "mes_anterior" }, today);
  assert.equal(prev.startLabel, "2026-09-01");
  assert.equal(prev.endLabel, "2026-09-30");
  assert.equal(prev.previousStartLabel, "2026-08-01");

  const custom = resolvePeriod({ inicio: "2026-10-01", fim: "2026-12-31" }, today);
  assert.equal(custom.preset, "personalizado");
  assert.equal(custom.endLabel, "2026-10-07", "fim futuro é cortado em hoje");
  assert.equal(custom.end.getHours(), 23);
});

// ---------------------------------------------------------------- ações DRAFT

test("normalizeLpArgs limpa entrada da LLM e lpSalesPage monta as seções", () => {
  const a = normalizeLpArgs({
    nome: "  Oferta  ",
    objetivo: "hack",
    titulo: "",
    beneficios: ["A", "", 3, "B"],
    provas: [{ texto: "Ótimo", autor: null }, { texto: "" }],
    faq: [{ pergunta: "P?", resposta: "R" }, { pergunta: "sem resposta" }],
    preco_reais: "89.9",
    tipo_produto: "service",
  });
  assert.equal(a.objetivo, "sales");
  assert.equal(a.titulo, "Oferta");
  assert.deepEqual(a.beneficios, ["A", "B"]);
  assert.equal(a.provas.length, 1);
  assert.equal(a.faq.length, 1);
  assert.equal(a.precoCents, 8990);
  assert.equal(a.tipoProduto, "SERVICE");
  assert.equal(a.cta, "Quero comprar");
  const page = lpSalesPage(a);
  assert.deepEqual(
    page.sections.map((s) => s.type),
    ["hero", "benefits", "social_proof", "checkout", "faq", "cta"],
  );
  const leads = lpSalesPage(normalizeLpArgs({ objetivo: "leads", titulo: "X" }));
  assert.ok(leads.sections.some((s) => s.type === "form"));
  assert.equal(leads.goal, "leads");
});

test("normalizeFormArgs garante nome + contato e ids únicos", () => {
  const f = normalizeFormArgs({
    campos: [
      { rotulo: "Cidade", tipo: "text" },
      { rotulo: "Cidade", tipo: "text" },
      { rotulo: "Plano", tipo: "choice", opcoes: ["Só um"] },
      { rotulo: "Hack", tipo: "script" },
    ],
  });
  assert.equal(f.campos[0].label, "Nome");
  assert.ok(f.campos.some((c) => c.type === "phone"));
  const ids = f.campos.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(f.campos.find((c) => c.label === "Plano")?.type, "text", "choice com < 2 opções vira texto");
  assert.equal(f.campos.find((c) => c.label === "Hack")?.type, "text");
  assert.equal(f.nome, "Formulário");
});

test("ferramentas DRAFT só propõem — devolvem pendingAction sem gravar", async () => {
  const lp = DRAFT_TOOLS.find((t) => t.name === "criar_lp_rascunho")!;
  const res = await runTool(lp, { nome: "Rodízio", objetivo: "sales", titulo: "Rodízio por R$ 89", preco_reais: 89 }, { ctx });
  assert.equal(lp.risk, "DRAFT");
  assert.ok(res.pendingAction);
  assert.equal(res.pendingAction?.tool, "criar_lp_rascunho");
  assert.match(res.pendingAction?.summary ?? "", /Rodízio/);
});

// ---------------------------------------------------------------- catálogo

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
};

function strictProblems(schema: JsonSchema, path: string): string[] {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const out: string[] = [];
  if (types.includes("object")) {
    if (schema.additionalProperties !== false) out.push(`${path}: additionalProperties precisa ser false`);
    const props = Object.keys(schema.properties ?? {});
    const required = new Set(schema.required ?? []);
    for (const p of props) if (!required.has(p)) out.push(`${path}.${p}: fora de required`);
    for (const [k, v] of Object.entries(schema.properties ?? {})) out.push(...strictProblems(v, `${path}.${k}`));
  }
  if (types.includes("array") && schema.items) out.push(...strictProblems(schema.items, `${path}[]`));
  return out;
}

test("todas as ferramentas têm schema compatível com OpenAI strict e nomes únicos", () => {
  const all = [...READ_TOOLS, ...DRAFT_TOOLS];
  const names = all.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const t of all) {
    assert.match(t.name, /^[a-z_]{3,64}$/);
    assert.ok(t.step.length > 3, `${t.name} sem rótulo de passo`);
    assert.deepEqual(strictProblems(t.parameters as JsonSchema, t.name), []);
    assert.ok(!("clienteId" in ((t.parameters as JsonSchema).properties ?? {})), `${t.name} aceita clienteId do modelo`);
  }
  const openai = toOpenAITools(all, true);
  assert.ok(openai.every((t) => t.function.strict === true));
  assert.ok(toOpenAITools(all, false).every((t) => !("strict" in t.function)));
});

test("toolsForWorkspace respeita módulos desligados", () => {
  const withCrmOnly = toolsForWorkspace({ ...ctx, modules: ["crm"] }, DRAFT_TOOLS).map((t) => t.name);
  assert.ok(withCrmOnly.includes("crm_pipeline"));
  assert.ok(!withCrmOnly.includes("financeiro_resumo"));
  assert.ok(!withCrmOnly.includes("criar_formulario_rascunho"));
  assert.ok(withCrmOnly.includes("visao_geral_negocio"), "ferramentas sem módulo ficam sempre");
});

test("runTool nunca repassa clienteId/workspaceId vindos do modelo", async () => {
  let seen: Record<string, unknown> = {};
  const tool = fakeTool("espiao", async (args, rt) => {
    seen = { ...args, scope: rt.ctx.clienteId };
    return okResult("espiao");
  });
  await runTool(tool, '{"clienteId":"outro","workspaceId":"outro","periodo":"hoje"}', { ctx });
  assert.deepEqual(seen, { periodo: "hoje", scope: "ws_1" });
});

test("system prompt leva persona, mapa de dados e o contexto do workspace", () => {
  const prompt = buildAtrakoSystemPrompt({ workspace: "Negócio: Churrascaria Fogo" });
  assert.match(prompt, /Atrako/);
  assert.match(prompt, /Churrascaria Fogo/);
  assert.ok(prompt.length > 1500);
  for (const screen of ["Leads (/crm)", "Atendimento (/whatsapp)", "Loja (/commerce)", "Caixa (/finance)", "Configuração → Integrações (/config/conexoes)"]) {
    assert.ok(prompt.includes(screen), `tela real no prompt: ${screen}`);
  }
  assert.doesNotMatch(prompt, /Config → Integrações|LP \+ Checkout|Insights \(\/insights\)/);
  assert.match(prompt, /nunca escreva 'coverage'/);
  assert.match(prompt, /criar_landing_page/);
  assert.match(prompt, /Publicar só quando o usuário pedir explicitamente/);
  assert.match(prompt, /Nunca invente depoimentos/);
  assert.doesNotMatch(prompt, /Criar rascunho/);
});

test("contexto separa checkout Atrako de lojas/marketplaces", () => {
  const text = describeWorkspaceContext(ctx);
  assert.match(text, /Checkout Atrako \(pedidos\)/);
  assert.match(text, /Lojas e marketplaces/);
  assert.doesNotMatch(text, /Loja\/checkout/);
});

// ---------------------------------------------------------------- motor (LLM mockado)

type Chunk = {
  choices: Array<{ index: number; delta: Record<string, unknown>; finish_reason?: string | null }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};
type Turn = Chunk[] | ((params: Record<string, unknown>) => Chunk[]);

const text = (...parts: string[]): Chunk[] => parts.map((p) => ({ choices: [{ index: 0, delta: { content: p } }] }));
const call = (name: string, args: unknown, id = `call_${name}`, index = 0): Chunk[] => {
  const json = JSON.stringify(args);
  const half = Math.ceil(json.length / 2);
  return [
    { choices: [{ index: 0, delta: { tool_calls: [{ index, id, type: "function", function: { name, arguments: "" } }] } }] },
    { choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: json.slice(0, half) } }] } }] },
    { choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: json.slice(half) } }] } }] },
  ];
};

function mockClient(turns: Turn[]) {
  const requests: Array<Record<string, unknown>> = [];
  const client = {
    chat: {
      completions: {
        create: async (params: Record<string, unknown>) => {
          requests.push(structuredClone(params));
          const turn = turns[Math.min(requests.length - 1, turns.length - 1)];
          const chunks = typeof turn === "function" ? turn(params) : turn;
          return (async function* () {
            for (const c of chunks) yield c;
          })();
        },
      },
    },
  } as unknown as ChatClient;
  return { client, requests };
}

function okResult(tool: string, data: unknown = { receita: 1000 }): ToolResult {
  return { data, coverage: "available", source: { tool, label: `Fonte ${tool}` } };
}

function fakeTool(name: string, run: AtrakoTool["run"], extra: Partial<AtrakoTool> = {}): AtrakoTool {
  return {
    name,
    step: `Consultando ${name}`,
    description: name,
    parameters: { type: "object", additionalProperties: false, required: [], properties: {} },
    risk: "READ",
    run,
    ...extra,
  };
}

const llm = { provider: "custom" as const, model: "mock-model" };

function single(client: ChatClient, cfg: Omit<EngineCandidate, "key"> = llm) {
  return { candidates: [{ key: `test:${cfg.model}`, ...cfg }], makeClient: () => client };
}

test("golden: pergunta → ferramenta certa → resposta com fontes e eventos em ordem", async () => {
  const calls: Array<{ args: Record<string, unknown>; scope: string }> = [];
  const vendas = fakeTool("vendas_visao_geral", async (args, rt) => {
    calls.push({ args, scope: rt.ctx.clienteId });
    return okResult("vendas_visao_geral", { receita: 12345.678 });
  });
  const { client, requests } = mockClient([
    call("vendas_visao_geral", { periodo: "ultimos_7_dias", clienteId: "invasor" }),
    text("**Receita** ", "de R$ 12.345,68."),
  ]);
  const events: EngineEvent[] = [];
  const res = await runAtrakoEngine({
    ...single(client),
    ctx,
    tools: [vendas],
    history: [{ role: "assistant", content: "Olá!" }],
    question: "Quanto vendi na semana?",
    onEvent: (e) => events.push(e),
  });

  assert.equal(res.answer, "**Receita** de R$ 12.345,68.");
  assert.equal(res.rounds, 2);
  assert.deepEqual(calls, [{ args: { periodo: "ultimos_7_dias" }, scope: "ws_1" }]);
  assert.deepEqual(res.steps.map((s) => [s.tool, s.source, s.coverage]), [
    ["vendas_visao_geral", "Fonte vendas_visao_geral", "available"],
  ]);
  assert.equal(res.sources.length, 1);
  assert.deepEqual(
    events.map((e) => e.type),
    ["step", "step_done", "token", "token"],
  );

  const first = requests[0] as { messages: Array<{ role: string; content: string }>; tools: unknown[]; tool_choice: string };
  assert.equal(first.messages[0].role, "system");
  assert.match(first.messages[0].content, /Churrascaria Fogo/);
  assert.deepEqual(first.messages.slice(1).map((m) => m.role), ["assistant", "user"]);
  assert.equal(first.tool_choice, "auto");
  const second = requests[1] as { messages: Array<{ role: string; content: string; tool_call_id?: string }> };
  const toolMsg = second.messages.at(-1)!;
  assert.equal(toolMsg.role, "tool");
  assert.equal(toolMsg.tool_call_id, "call_vendas_visao_geral");
  assert.match(toolMsg.content, /"receita":12345.68/);
  assert.ok(res.usage.total > 0, "estima tokens quando o provedor não reporta");
});

test("texto parcial antes de tool_calls é descartado na UI", async () => {
  const { client } = mockClient([
    [...text("Deixa eu ver…"), ...call("visao", {})],
    text("Pronto."),
  ]);
  const events: EngineEvent[] = [];
  const res = await runAtrakoEngine({
    ...single(client),
    ctx,
    tools: [fakeTool("visao", async () => okResult("visao"))],
    history: [],
    question: "Como estou?",
    onEvent: (e) => events.push(e),
  });
  assert.equal(res.answer, "Pronto.");
  assert.deepEqual(events.map((e) => e.type), ["token", "discard", "step", "step_done", "token"]);
});

test("limite de rodadas força resposta final sem ferramentas", async () => {
  let runs = 0;
  const { client, requests } = mockClient([
    (params) => (params.tool_choice === "none" ? text("Resumo final.") : call("loop", {})),
  ]);
  const res = await runAtrakoEngine({
    ...single(client),
    ctx,
    tools: [fakeTool("loop", async () => (runs++, okResult("loop")))],
    history: [],
    question: "?",
    maxRounds: 2,
  });
  assert.equal(res.answer, "Resumo final.");
  assert.equal(requests.length, 3);
  assert.equal(runs, 1, "chamada idêntica repetida reaproveita o resultado");
  assert.equal((requests[2] as { tool_choice: string }).tool_choice, "none");
});

test("falha de ferramenta e ferramenta desconhecida não derrubam a resposta", async () => {
  const { client, requests } = mockClient([
    [...call("quebrada", {}, "c1", 0), ...call("inventada", {}, "c2", 1)],
    text("Consegui parte dos dados."),
  ]);
  const res = await runAtrakoEngine({
    ...single(client),
    ctx,
    tools: [
      fakeTool("quebrada", async () => {
        throw new Error("db fora");
      }),
    ],
    history: [],
    question: "?",
  });
  assert.equal(res.answer, "Consegui parte dos dados.");
  assert.deepEqual(res.steps.map((s) => [s.tool, s.coverage]), [["quebrada", "error"]]);
  const toolMsgs = (requests[1] as { messages: Array<{ role: string; content: string }> }).messages.filter(
    (m) => m.role === "tool",
  );
  assert.equal(toolMsgs.length, 2);
  assert.ok(toolMsgs.every((m) => m.content.includes("erro")));
  assert.ok(!toolMsgs.some((m) => m.content.includes("db fora")), "detalhe interno não vaza para a LLM");
});

test("ação DRAFT vira pendingAction e o modelo é avisado para não dizer que já criou", async () => {
  const lp = DRAFT_TOOLS.find((t) => t.name === "criar_lp_rascunho")!;
  const { client, requests } = mockClient([
    call("criar_lp_rascunho", { nome: "Oferta", objetivo: "leads", titulo: "Ganhe 10%" }),
    [],
  ]);
  const events: EngineEvent[] = [];
  const res = await runAtrakoEngine({
    ...single(client),
    ctx,
    tools: [lp],
    history: [],
    question: "Cria uma LP",
    onEvent: (e) => events.push(e),
  });
  assert.equal(res.pendingAction?.tool, "criar_lp_rascunho");
  assert.ok(events.some((e) => e.type === "action"));
  assert.match(res.answer, /confirme/);
  const toolMsg = (requests[1] as { messages: Array<{ role: string; content: string }> }).messages.at(-1)!;
  assert.match(toolMsg.content, /Nada foi criado ainda/);
  assert.match(toolMsg.content, /Criar rascunho/);
});

test("mesma ferramenta com os mesmos argumentos roda uma vez só na pergunta", async () => {
  let runs = 0;
  const { client, requests } = mockClient([
    [...call("vendas", { periodo: "mes_atual" }, "c1", 0), ...call("vendas", { periodo: "mes_atual" }, "c2", 1)],
    call("vendas", { periodo: "mes_atual", extra: null }, "c3"),
    text("Feito."),
  ]);
  const events: EngineEvent[] = [];
  const res = await runAtrakoEngine({
    ...single(client),
    ctx,
    tools: [fakeTool("vendas", async () => (runs++, okResult("vendas")))],
    history: [],
    question: "?",
    onEvent: (e) => events.push(e),
  });
  assert.equal(res.answer, "Feito.");
  assert.equal(runs, 1);
  assert.equal(res.steps.length, 1);
  assert.equal(events.filter((e) => e.type === "step").length, 1);
  const toolMsgs = (requests[2] as { messages: Array<{ role: string; tool_call_id?: string }> }).messages.filter(
    (m) => m.role === "tool",
  );
  assert.deepEqual(toolMsgs.map((m) => m.tool_call_id), ["c1", "c2", "c3"], "todo tool_call recebe resposta");
});

test("ferramenta oncePerTurn não cria de novo na mesma resposta e recebe o texto do usuário", async () => {
  let runs = 0;
  let seen: string | undefined;
  const { client, requests } = mockClient([
    call("criar", { nome: "A" }, "c1"),
    call("criar", { nome: "B" }, "c2"),
    text("Criei."),
  ]);
  const res = await runAtrakoEngine({
    ...single(client),
    ctx,
    tools: [
      fakeTool(
        "criar",
        async (_args, rt) => {
          runs++;
          seen = rt.userText;
          return okResult("criar", { id: "p1" });
        },
        { oncePerTurn: true },
      ),
    ],
    history: [{ role: "user", content: "antes" }, { role: "assistant", content: "ok" }],
    question: "cria a página",
  });
  assert.equal(res.answer, "Criei.");
  assert.equal(runs, 1);
  assert.equal(seen, "antes\ncria a página");
  const last = (requests[2] as { messages: Array<{ role: string; content: string }> }).messages.filter((m) => m.role === "tool").at(-1);
  assert.match(last?.content ?? "", /já foi executada/);
  assert.match(last?.content ?? "", /p1/);
});

test("provedor openai usa strict + include_usage; modelos gpt-5/o* sem temperature", async () => {
  const { client, requests } = mockClient([text("ok")]);
  await runAtrakoEngine({
    ...single(client, { provider: "openai", model: "gpt-5-mini" }),
    ctx,
    tools: [fakeTool("visao", async () => okResult("visao"))],
    history: [],
    question: "oi",
  });
  const req = requests[0] as {
    tools: Array<{ function: { strict?: boolean } }>;
    stream_options?: unknown;
    temperature?: number;
  };
  assert.equal(req.tools[0].function.strict, true);
  assert.deepEqual(req.stream_options, { include_usage: true });
  assert.equal("temperature" in req, false);

  const other = mockClient([text("ok")]);
  await runAtrakoEngine({
    ...single(other.client, { provider: "openrouter", model: "anthropic/claude-sonnet-4" }),
    ctx,
    tools: [fakeTool("visao", async () => okResult("visao"))],
    history: [],
    question: "oi",
  });
  const req2 = other.requests[0] as typeof req;
  assert.equal(req2.tools[0].function.strict, undefined);
  assert.equal(req2.temperature, 0.3);
});

test("timeout vira EngineError('timeout')", async () => {
  const client = {
    chat: {
      completions: {
        create: (_params: unknown, opts: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts.signal.addEventListener("abort", () => reject(new Error("aborted by signal")));
          }),
      },
    },
  } as unknown as ChatClient;
  await assert.rejects(
    runAtrakoEngine({ ...single(client), ctx, tools: [], history: [], question: "?", timeoutMs: 20 }),
    (err: unknown) => err instanceof EngineError && err.code === "timeout",
  );
});

/* ── Cadeia de modelos / failover ── */

function apiError(status: number, message = "", headers: Record<string, string> = {}) {
  return Object.assign(new Error(message || `HTTP ${status}`), { status, headers });
}

function failingClient(error: unknown, afterChunks: unknown[] = []) {
  let calls = 0;
  const client = {
    chat: {
      completions: {
        create: async () => {
          calls++;
          if (!afterChunks.length) throw error;
          return (async function* () {
            for (const c of afterChunks) yield c;
            throw error;
          })();
        },
      },
    },
  } as unknown as ChatClient;
  return { client, calls: () => calls };
}

function chain(...clients: ChatClient[]) {
  const candidates = clients.map((_, i) => ({ key: `platform:custom:m${i}`, provider: "custom" as const, model: `m${i}` }));
  const failures: Array<{ key: string; failure: LlmFailure }> = [];
  return {
    candidates,
    makeClient: (c: EngineCandidate) => clients[candidates.findIndex((x) => x.key === c.key)],
    onFailover: (c: EngineCandidate, failure: LlmFailure) => failures.push({ key: c.key, failure }),
    failures,
  };
}

test("classifyLlmFailure: limite diário, por minuto, créditos, chave, descontinuado, instável", () => {
  const now = Date.UTC(2026, 9, 7, 18, 0, 0);
  const daily = classifyLlmFailure(apiError(429, "Rate limit exceeded: free-models-per-day"), now);
  assert.equal(daily.reason, "limite diário");
  assert.equal(daily.cooldownMs, 6 * 3600_000, "até a meia-noite UTC");

  const resetAt = now + 2 * 3600_000;
  const withHeader = classifyLlmFailure(
    apiError(429, "Rate limit exceeded: free-models-per-day", { "x-ratelimit-reset": String(resetAt) }),
    now,
  );
  assert.equal(withHeader.cooldownMs, 2 * 3600_000, "respeita X-RateLimit-Reset (ms)");

  const headersObj = new Headers({ "x-ratelimit-reset": String(Math.floor((now + 30_000) / 1000)) });
  const minute = classifyLlmFailure(Object.assign(new Error("Too Many Requests"), { status: 429, headers: headersObj }), now);
  assert.equal(minute.reason, "limite por minuto");
  assert.equal(minute.cooldownMs, 30_000, "reset em segundos via Headers");

  assert.equal(classifyLlmFailure(apiError(429, "upstream rate limited"), now).cooldownMs, 60_000);
  assert.equal(classifyLlmFailure(apiError(402), now).cooldownMs, 3600_000);
  assert.equal(classifyLlmFailure(apiError(401), now).cooldownMs, 6 * 3600_000);
  assert.equal(classifyLlmFailure(apiError(403), now).reason, "chave recusada");
  assert.equal(classifyLlmFailure(apiError(410), now).cooldownMs, 24 * 3600_000);
  assert.equal(classifyLlmFailure(apiError(400), now).cooldownMs, 10 * 60_000);
  assert.equal(classifyLlmFailure(apiError(503), now).cooldownMs, 2 * 60_000);
  assert.equal(classifyLlmFailure(new Error("fetch failed"), now).reason, "sem resposta");
});

test("failover: 1º modelo dá 429 antes do streaming → 2º responde sem discard", async () => {
  const bad = failingClient(apiError(429, "free-models-per-day"));
  const good = mockClient([text("Resposta do reserva.")]);
  const c = chain(bad.client, good.client);
  const events: EngineEvent[] = [];
  const res = await runAtrakoEngine({ ...c, ctx, tools: [], history: [], question: "?", onEvent: (e) => events.push(e) });
  assert.equal(res.answer, "Resposta do reserva.");
  assert.equal(res.model, "m1");
  assert.ok(!events.some((e) => e.type === "discard"));
  assert.deepEqual(c.failures.map((f) => [f.key, f.failure.reason]), [["platform:custom:m0", "limite diário"]]);
});

test("failover: falha no meio do streaming gera discard e o próximo responde", async () => {
  const flaky = failingClient(apiError(502), text("Comecei a resp"));
  const good = mockClient([text("Resposta completa.")]);
  const c = chain(flaky.client, good.client);
  const events: EngineEvent[] = [];
  const res = await runAtrakoEngine({ ...c, ctx, tools: [], history: [], question: "?", onEvent: (e) => events.push(e) });
  assert.equal(res.answer, "Resposta completa.");
  assert.deepEqual(events.map((e) => e.type), ["token", "discard", "token"]);
  assert.equal(c.failures[0].failure.reason, "instável (502)");
});

test("failover: candidato fica fixo entre rodadas e só desce se falhar", async () => {
  const a = mockClient([call("visao", {}), text("Pronto pelo A.")]);
  const b = mockClient([text("B")]);
  const c = chain(a.client, b.client);
  const res = await runAtrakoEngine({
    ...c,
    ctx,
    tools: [fakeTool("visao", async () => okResult("visao"))],
    history: [],
    question: "?",
  });
  assert.equal(res.answer, "Pronto pelo A.");
  assert.equal(a.requests.length, 2);
  assert.equal(b.requests.length, 0);

  let aCalls = 0;
  const aThenFail = {
    chat: {
      completions: {
        create: async () => {
          aCalls++;
          if (aCalls > 1) throw apiError(429, "per-day");
          return (async function* () {
            for (const ch of call("visao", {})) yield ch;
          })();
        },
      },
    },
  } as unknown as ChatClient;
  const b2 = mockClient([text("Terminei pelo B.")]);
  const c2 = chain(aThenFail, b2.client);
  const res2 = await runAtrakoEngine({
    ...c2,
    ctx,
    tools: [fakeTool("visao", async () => okResult("visao"))],
    history: [],
    question: "?",
  });
  assert.equal(res2.answer, "Terminei pelo B.");
  assert.equal(res2.model, "m1");
  const lastMsgs = (b2.requests[0] as { messages: Array<{ role: string }> }).messages;
  assert.equal(lastMsgs.at(-1)?.role, "tool", "o reserva continua com o resultado da ferramenta");
});

test("failover: modelo travado sem 1º chunk passa a vez", async () => {
  const hung = {
    chat: {
      completions: {
        create: (_p: unknown, opts: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => opts.signal.addEventListener("abort", () => reject(new Error("aborted")))),
      },
    },
  } as unknown as ChatClient;
  const good = mockClient([text("ok")]);
  const c = chain(hung, good.client);
  const res = await runAtrakoEngine({ ...c, ctx, tools: [], history: [], question: "?", firstChunkTimeoutMs: 20 });
  assert.equal(res.answer, "ok");
  assert.equal(c.failures[0].failure.reason, "sem resposta");
});

test("failover: todos falhando → EngineError('exhausted') com a última causa", async () => {
  const c = chain(failingClient(apiError(429, "per-day")).client, failingClient(apiError(401)).client);
  await assert.rejects(
    runAtrakoEngine({ ...c, ctx, tools: [], history: [], question: "?" }),
    (err: unknown) =>
      err instanceof EngineError &&
      err.code === "exhausted" &&
      (err.cause as { status?: number }).status === 401 &&
      /muita demanda/.test(err.message),
  );
  assert.equal(c.failures.length, 2);
  await assert.rejects(
    runAtrakoEngine({ candidates: [], makeClient: () => mockClient([]).client, ctx, tools: [], history: [], question: "?" }),
    (err: unknown) => err instanceof EngineError && err.code === "exhausted",
  );
});

test("cadeia: IA do cliente primeiro, plataforma intercalada, modelos em descanso fora", () => {
  const cand = (key: string, source: "workspace" | "platform"): LlmCandidate => ({
    key,
    source,
    provider: "custom",
    model: key,
    apiKey: "k",
    baseUrl: null,
  });
  const platform = interleave([
    [cand("platform:openrouter:a", "platform"), cand("platform:openrouter:b", "platform")],
    [cand("platform:nvidia:x", "platform")],
  ]);
  assert.deepEqual(platform.map((c) => c.key), ["platform:openrouter:a", "platform:nvidia:x", "platform:openrouter:b"]);

  const cooldowns = new Map([["platform:nvidia:x", { until: new Date(Date.now() + 60_000), status: 429, reason: "x" }]]);
  const ordered = orderChain(cand("ws:1:gpt", "workspace"), platform, cooldowns);
  assert.deepEqual(ordered.map((c) => c.key), ["ws:1:gpt", "platform:openrouter:a", "platform:openrouter:b"]);
  assert.deepEqual(orderChain(null, platform, new Map()).map((c) => c.source), ["platform", "platform", "platform"]);

  assert.deepEqual(parseModelList(" a \n\nb\r\na ", ["z"]), ["a", "b"]);
  assert.deepEqual(parseModelList("", ["z"]), ["z"]);
  const [or, nv] = PLATFORM_LLM_APPS;
  assert.deepEqual(
    interleave([[...or.defaultModels], [...nv.defaultModels]]).slice(0, 2),
    ["nvidia/nemotron-3-super-120b-a12b:free", "nvidia/nemotron-3-super-120b-a12b"],
  );
});

test("cadeia: os 6 provedores da plataforma entram intercalados em pé de igualdade", () => {
  assert.deepEqual(
    PLATFORM_LLM_APPS.map((a) => a.provider),
    ["openrouter", "nvidia", "kilo", "ollama", "groq", "cohere"],
  );
  const firstRound = interleave(PLATFORM_LLM_APPS.map((a) => a.defaultModels.map((m) => `${a.provider}:${m}`))).slice(0, 6);
  assert.deepEqual(firstRound, [
    "openrouter:nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia:nvidia/nemotron-3-super-120b-a12b",
    "kilo:nvidia/nemotron-3-ultra-550b-a55b:free",
    "ollama:gpt-oss:120b",
    "groq:openai/gpt-oss-120b",
    "cohere:command-a-plus-05-2026",
  ]);
  const kilo = PLATFORM_LLM_APPS.find((a) => a.app === "AI_KILO");
  assert.equal(kilo?.defaultModels.at(-1), "kilo-auto/free", "roteador automático do Kilo fica por último");
  for (const a of PLATFORM_LLM_APPS) {
    const def = findAiProvider(a.provider);
    assert.ok(def?.baseUrl?.startsWith("https://"), `${a.provider} sem URL https`);
  }
});

test("presets Kilo, Ollama, Groq e Cohere e máscara gsk_", () => {
  assert.equal(findAiProvider("kilo")?.baseUrl, "https://api.kilo.ai/api/gateway");
  assert.equal(findAiProvider("ollama")?.baseUrl, "https://ollama.com/v1");
  assert.equal(findAiProvider("groq")?.baseUrl, "https://api.groq.com/openai/v1");
  assert.equal(findAiProvider("cohere")?.baseUrl, "https://api.cohere.ai/compatibility/v1");
  assert.equal(maskApiKey("gsk_FAKEFAKEFAKEFAKEFAKEFAKEabcd"), "gsk_…abcd");
});

test("classifyLlmFailure: 413, retry exato e cota mensal", () => {
  const now = Date.UTC(2026, 9, 7, 18, 0, 0);
  const tooLarge = classifyLlmFailure(apiError(413, "Request too large for model"), now);
  assert.deepEqual([tooLarge.status, tooLarge.cooldownMs, tooLarge.reason], [413, 3600_000, "pedido grande demais"]);

  const groq = classifyLlmFailure(
    apiError(429, "Rate limit reached on tokens per minute (TPM): Limit 8000. Please try again in 5.79s."),
    now,
  );
  assert.equal(groq.cooldownMs, 5_790);
  assert.equal(groq.reason, "limite por minuto");
  assert.equal(classifyLlmFailure(apiError(429, "try again in 1m26.4s. requests per day"), now).cooldownMs, 86_400);
  assert.equal(classifyLlmFailure(apiError(429, "try again in 1m26.4s. requests per day"), now).reason, "limite diário");
  assert.equal(classifyLlmFailure(apiError(429, "Please try again in 120ms"), now).cooldownMs, 5_000, "mínimo de 5 s");
  assert.equal(classifyLlmFailure(apiError(429, "Please try again in 3h"), now).cooldownMs, 3600_000, "máximo de 1 h");

  const ollama = classifyLlmFailure(
    Object.assign(new Error("too many concurrent requests"), { status: 429, headers: new Headers({ "retry-after": "15" }) }),
    now,
  );
  assert.equal(ollama.cooldownMs, 15_000);
  assert.equal(classifyLlmFailure(apiError(429, "Retry after 10 seconds."), now).cooldownMs, 10_000);

  const monthly = classifyLlmFailure(apiError(429, "You are using a Trial key, which is limited to 1000 API calls / month."), now);
  assert.deepEqual([monthly.cooldownMs, monthly.reason], [24 * 3600_000, "cota mensal esgotada"]);
});

test("schema relaxado fora do strict: campos nullable saem de required", () => {
  const schema = {
    type: "object",
    properties: {
      periodo: { type: ["string", "null"], enum: ["hoje", null] },
      inicio: { type: ["string", "null"] },
      busca: { type: "string" },
    },
    required: ["periodo", "inicio", "busca"],
    additionalProperties: false,
  };
  assert.deepEqual(relaxSchema(schema).required, ["busca"]);
  assert.deepEqual(schema.required, ["periodo", "inicio", "busca"], "não muta o original");

  const all = [...READ_TOOLS, ...DRAFT_TOOLS];
  const strict = toOpenAITools(all, true);
  assert.deepEqual(
    strict.map((t) => t.function.parameters),
    all.map((t) => t.parameters),
    "strict continua com o schema completo",
  );
  const vendas = toOpenAITools(all, false).find((t) => t.function.name === "vendas_visao_geral");
  assert.deepEqual((vendas?.function.parameters as { required?: string[] }).required ?? [], []);
});

test("runTool troca 'None', 'null' e '' por null", async () => {
  let seen: Record<string, unknown> = {};
  const tool = fakeTool("limpa", async (args) => {
    seen = args;
    return okResult("limpa");
  });
  await runTool(tool, '{"periodo":"ultimos_7_dias","inicio":"None","fim":"","busca":" null ","n":0}', { ctx });
  assert.deepEqual(seen, { periodo: "ultimos_7_dias", inicio: null, fim: null, busca: null, n: 0 });
});
