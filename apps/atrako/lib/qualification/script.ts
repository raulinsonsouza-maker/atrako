/**
 * Roteiro da qualificação no WhatsApp: padrão pronto + o que o operador personalizou.
 * Personalização fica em messagingPrefs.qualification.script (só as chaves alteradas).
 * Puro — usado pelo motor, pela cadência, pela API e pela tela de Mensagens.
 */

import { CHOICE_MAP, REGICENTER_FRANCHISE_INVESTMENT, type ChoiceOpt } from "./choices";
import { FIELD_DEFS, WA_ASK_ORDER, type QualifyAnswers, type QualifyFieldKey } from "./fields";
import type { Priority } from "./classify";
import { QUALIFY_REPLY, firstName } from "./messages";

export type ScriptQuestion = {
  key: QualifyFieldKey;
  /** Nome curto (CRM). */
  label: string;
  text: string;
  enabled: boolean;
  /** Vazio = resposta livre (cidade). */
  options: ChoiceOpt[];
};

export const FOLLOW_UP_IDS = ["reask", "nudge", "team"] as const;
export type FollowUpId = (typeof FOLLOW_UP_IDS)[number];

export type ScriptFollowUp = {
  id: FollowUpId;
  afterHours: number;
  text: string;
  enabled: boolean;
};

/** Condições por pergunta (códigos aceitos). Vazio/ausente = qualquer resposta. */
export type PriorityRule = Partial<Record<QualifyFieldKey, string[]>>;
export type QualifyRules = { A: PriorityRule; B: PriorityRule };

export type QualifyScript = {
  opening: { text: string };
  questions: ScriptQuestion[];
  showProgress: boolean;
  bestTime: { enabled: boolean; text: string };
  handoff: { text: string };
  nurture: { text: string; buttonLabel: string };
  followUps: ScriptFollowUp[];
  rules: QualifyRules;
};

export type ScriptOverrides = {
  opening?: { text?: string };
  questionOrder?: QualifyFieldKey[];
  showProgress?: boolean;
  questions?: Partial<Record<QualifyFieldKey, { text?: string; enabled?: boolean; options?: ChoiceOpt[] }>>;
  bestTime?: { text?: string; enabled?: boolean };
  handoff?: { text?: string };
  nurture?: { text?: string; buttonLabel?: string };
  followUps?: Partial<Record<FollowUpId, { afterHours?: number; text?: string; enabled?: boolean }>>;
  rules?: QualifyRules;
};

export type ScriptBlockId =
  | "opening"
  | "questions"
  | `question:${QualifyFieldKey}`
  | "bestTime"
  | "handoff"
  | "nurture"
  | `followUp:${FollowUpId}`
  | "rules";

export const SCRIPT_VARIABLES = [
  { key: "nome", label: "Nome" },
  { key: "empresa", label: "Empresa" },
  { key: "cidade", label: "Cidade" },
] as const;

/** Variáveis aceitas em textos que viram modelo da Meta. */
export const TEMPLATE_VARIABLES = ["nome", "empresa"] as const;

export const TEXT_MAX = 900;
const BUTTON_MAX = 20;
const ROW_MAX = 24;

const NOT_EXPLORING = ["OWNER_OPERATOR", "ADDITIONAL_INCOME", "BUILD_TEAM"];

const QUESTION_TEXT: Partial<Record<QualifyFieldKey, string>> = {
  city: "Em qual cidade você quer atuar?",
  niche: "Em qual área você atua hoje?",
  start_timeline: "Se fizer sentido, quando você quer começar?",
  business_objective: "Qual o seu principal objetivo com a franquia?",
  main_question: "O que você mais quer entender na conversa com o consultor?",
  investment_status: `O investimento inicial é ${REGICENTER_FRANCHISE_INVESTMENT}. Qual é o seu momento?`,
};

const QUESTION_OPTIONS: Partial<Record<QualifyFieldKey, ChoiceOpt[]>> = {
  investment_status: [
    { code: "CAPITAL_AVAILABLE", label: "Tenho o valor" },
    { code: "CAPITAL_PARTIAL", label: "Tenho parte" },
    { code: "CAPITAL_EVALUATING", label: "Ainda avaliando" },
  ],
};

export const DEFAULT_SCRIPT: QualifyScript = {
  opening: {
    text: "Oi {nome}, recebemos seu cadastro na {empresa}. São perguntas rápidas para te conectar ao consultor certo. Podemos começar?",
  },
  questions: WA_ASK_ORDER.map((key) => ({
    key,
    label: FIELD_DEFS.find((d) => d.key === key)?.crmLabel ?? key,
    text: QUESTION_TEXT[key] ?? "Pode me contar um pouco mais?",
    enabled: true,
    options: QUESTION_OPTIONS[key] ?? (key === "city" ? [] : [...(CHOICE_MAP[key] ?? [])]),
  })),
  showProgress: false,
  bestTime: { enabled: true, text: "Ótimo, {nome}! Qual o melhor horário para o consultor te chamar?" },
  handoff: {
    text: "Combinado, {nome}! Um consultor vai falar com você por aqui {horario}. Se quiser adiantar, já pode mandar sua dúvida.",
  },
  nurture: {
    text: "Obrigado, {nome}! Vou te mandar por e-mail um material completo para ver com calma. Quando quiser falar com um consultor, é só tocar abaixo.",
    buttonLabel: "Quero conversar",
  },
  followUps: [
    { id: "reask", afterHours: 2, text: "Ainda estou por aqui, {nome}.", enabled: true },
    {
      id: "nudge",
      afterHours: 24,
      text: "Oi {nome}, seu cadastro na {empresa} ficou pela metade. Leva menos de 1 minuto para terminar e falar com um consultor.",
      enabled: true,
    },
    { id: "team", afterHours: 72, text: "Avisar a equipe para um toque manual", enabled: true },
  ],
  rules: {
    A: { investment_status: ["CAPITAL_AVAILABLE"], start_timeline: ["START_30D"], business_objective: NOT_EXPLORING },
    B: {
      investment_status: ["CAPITAL_AVAILABLE"],
      start_timeline: ["START_30D", "START_60_90D"],
      business_objective: NOT_EXPLORING,
    },
  },
};

/** Prazos oferecidos por toque (horas). */
export const FOLLOW_UP_DELAYS: Record<FollowUpId, number[]> = {
  reask: [1, 2, 4, 6, 12],
  nudge: [24, 48, 72],
  team: [48, 72, 120, 168],
};

export const FOLLOW_UP_LABEL: Record<FollowUpId, { title: string; channel: "whatsapp" | "template" | "team" }> = {
  reask: { title: "Repete a pergunta pendente", channel: "whatsapp" },
  nudge: { title: "Lembrete para continuar", channel: "template" },
  team: { title: "Avisa a equipe", channel: "team" },
};

// --------------------------------------------------------------------------- sanitização

function rec(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function cleanText(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, TEXT_MAX);
  return t || undefined;
}

function cleanLabel(raw: unknown, max = ROW_MAX): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.replace(/\s+/g, " ").trim().slice(0, max);
  return t || undefined;
}

function slugCode(label: string) {
  const s = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);
  return `OPT_${s || "X"}`;
}

export function sanitizeOptions(raw: unknown): ChoiceOpt[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ChoiceOpt[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const r = rec(item);
    const label = cleanLabel(r.label);
    if (!label) continue;
    let code = typeof r.code === "string" && /^[A-Z0-9_]{2,40}$/.test(r.code) ? r.code : slugCode(label);
    while (seen.has(code)) code = `${code}_2`.slice(0, 40);
    seen.add(code);
    out.push({ code, label });
    if (out.length >= 10) break;
  }
  return out.length >= 2 ? out : undefined;
}

function sanitizeRule(raw: unknown): PriorityRule {
  const r = rec(raw);
  const out: PriorityRule = {};
  for (const key of WA_ASK_ORDER) {
    const codes = r[key];
    if (!Array.isArray(codes)) continue;
    const list = codes.filter((c): c is string => typeof c === "string" && /^[A-Z0-9_]{2,40}$/.test(c));
    if (list.length) out[key] = [...new Set(list)];
  }
  return out;
}

const isKey = (k: unknown): k is QualifyFieldKey => typeof k === "string" && (WA_ASK_ORDER as string[]).includes(k);

export function sanitizeOverrides(raw: unknown): ScriptOverrides {
  const r = rec(raw);
  const out: ScriptOverrides = {};
  const opening = cleanText(rec(r.opening).text);
  if (opening) out.opening = { text: opening };
  if (Array.isArray(r.questionOrder)) {
    const order = [...new Set(r.questionOrder.filter(isKey))];
    if (order.length) out.questionOrder = order;
  }
  if (typeof r.showProgress === "boolean") out.showProgress = r.showProgress;
  const qs = rec(r.questions);
  const questions: NonNullable<ScriptOverrides["questions"]> = {};
  for (const key of WA_ASK_ORDER) {
    const q = rec(qs[key]);
    const item: { text?: string; enabled?: boolean; options?: ChoiceOpt[] } = {};
    const text = cleanText(q.text);
    if (text) item.text = text;
    if (typeof q.enabled === "boolean") item.enabled = q.enabled;
    const options = key === "city" ? undefined : sanitizeOptions(q.options);
    if (options) item.options = options;
    if (Object.keys(item).length) questions[key] = item;
  }
  if (Object.keys(questions).length) out.questions = questions;
  const bt = rec(r.bestTime);
  const bestTime: NonNullable<ScriptOverrides["bestTime"]> = {};
  if (cleanText(bt.text)) bestTime.text = cleanText(bt.text);
  if (typeof bt.enabled === "boolean") bestTime.enabled = bt.enabled;
  if (Object.keys(bestTime).length) out.bestTime = bestTime;
  const handoff = cleanText(rec(r.handoff).text);
  if (handoff) out.handoff = { text: handoff };
  const nu = rec(r.nurture);
  const nurture: NonNullable<ScriptOverrides["nurture"]> = {};
  if (cleanText(nu.text)) nurture.text = cleanText(nu.text);
  if (cleanLabel(nu.buttonLabel, BUTTON_MAX)) nurture.buttonLabel = cleanLabel(nu.buttonLabel, BUTTON_MAX);
  if (Object.keys(nurture).length) out.nurture = nurture;
  const fu = rec(r.followUps);
  const followUps: NonNullable<ScriptOverrides["followUps"]> = {};
  for (const id of FOLLOW_UP_IDS) {
    const f = rec(fu[id]);
    const item: { afterHours?: number; text?: string; enabled?: boolean } = {};
    const hours = Number(f.afterHours);
    if (FOLLOW_UP_DELAYS[id].includes(hours)) item.afterHours = hours;
    if (id !== "team" && cleanText(f.text)) item.text = cleanText(f.text);
    if (typeof f.enabled === "boolean") item.enabled = f.enabled;
    if (Object.keys(item).length) followUps[id] = item;
  }
  if (Object.keys(followUps).length) out.followUps = followUps;
  if (r.rules && typeof r.rules === "object") {
    const rules = rec(r.rules);
    out.rules = { A: sanitizeRule(rules.A), B: sanitizeRule(rules.B) };
  }
  return out;
}

// --------------------------------------------------------------------------- resolução

export function resolveScript(raw: unknown): QualifyScript {
  const o = sanitizeOverrides(raw);
  const base = DEFAULT_SCRIPT;
  const order = o.questionOrder
    ? [...o.questionOrder, ...WA_ASK_ORDER.filter((k) => !o.questionOrder!.includes(k))]
    : WA_ASK_ORDER;
  const questions = order.map((key) => {
    const def = base.questions.find((q) => q.key === key)!;
    const ov = o.questions?.[key] ?? {};
    return { ...def, text: ov.text ?? def.text, enabled: ov.enabled ?? def.enabled, options: ov.options ?? def.options };
  });
  let floor = 0;
  const followUps = base.followUps.map((f) => {
    const ov = o.followUps?.[f.id] ?? {};
    const hours = Math.max(ov.afterHours ?? f.afterHours, floor + 1);
    floor = hours;
    return { ...f, afterHours: hours, text: ov.text ?? f.text, enabled: ov.enabled ?? f.enabled };
  });
  return {
    opening: { text: o.opening?.text ?? base.opening.text },
    questions,
    showProgress: o.showProgress ?? base.showProgress,
    bestTime: { ...base.bestTime, ...o.bestTime },
    handoff: { ...base.handoff, ...o.handoff },
    nurture: { ...base.nurture, ...o.nurture },
    followUps,
    rules: o.rules ?? base.rules,
  };
}

/** Blocos com algo diferente do padrão. */
export function customizedBlocks(raw: unknown): ScriptBlockId[] {
  const o = sanitizeOverrides(raw);
  const out: ScriptBlockId[] = [];
  if (o.opening) out.push("opening");
  if (o.questionOrder || o.showProgress !== undefined) out.push("questions");
  for (const key of Object.keys(o.questions ?? {}) as QualifyFieldKey[]) out.push(`question:${key}`);
  if (o.bestTime) out.push("bestTime");
  if (o.handoff) out.push("handoff");
  if (o.nurture) out.push("nurture");
  for (const id of Object.keys(o.followUps ?? {}) as FollowUpId[]) out.push(`followUp:${id}`);
  if (o.rules) out.push("rules");
  return out;
}

/** Aplica a edição de um bloco (patch parcial) sobre o que já foi personalizado. */
export function applyBlock(raw: unknown, block: ScriptBlockId, patch: unknown): ScriptOverrides {
  const o = sanitizeOverrides(raw);
  const p = rec(patch);
  const next: Record<string, unknown> = { ...o };
  if (block === "questions") {
    if ("questionOrder" in p) next.questionOrder = p.questionOrder;
    if ("showProgress" in p) next.showProgress = p.showProgress;
  } else if (block.startsWith("question:")) {
    const key = block.slice("question:".length);
    next.questions = { ...(o.questions ?? {}), [key]: { ...(o.questions?.[key as QualifyFieldKey] ?? {}), ...p } };
  } else if (block.startsWith("followUp:")) {
    const id = block.slice("followUp:".length);
    next.followUps = { ...(o.followUps ?? {}), [id]: { ...(o.followUps?.[id as FollowUpId] ?? {}), ...p } };
  } else if (block === "rules") {
    next.rules = p;
  } else {
    next[block] = { ...rec(o[block as keyof ScriptOverrides]), ...p };
  }
  return pruneDefaults(sanitizeOverrides(next));
}

export function resetBlock(raw: unknown, block: ScriptBlockId): ScriptOverrides {
  const o = { ...sanitizeOverrides(raw) };
  if (block === "questions") {
    delete o.questionOrder;
    delete o.showProgress;
  } else if (block.startsWith("question:")) {
    const questions = { ...(o.questions ?? {}) };
    delete questions[block.slice("question:".length) as QualifyFieldKey];
    o.questions = Object.keys(questions).length ? questions : undefined;
  } else if (block.startsWith("followUp:")) {
    const followUps = { ...(o.followUps ?? {}) };
    delete followUps[block.slice("followUp:".length) as FollowUpId];
    o.followUps = Object.keys(followUps).length ? followUps : undefined;
  } else {
    delete o[block as keyof ScriptOverrides];
  }
  return sanitizeOverrides(o);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Tira do salvo o que voltou a ser igual ao padrão. */
function pruneDefaults(o: ScriptOverrides): ScriptOverrides {
  const d = DEFAULT_SCRIPT;
  const out: ScriptOverrides = { ...o };
  if (out.opening?.text === d.opening.text) delete out.opening;
  if (out.showProgress === d.showProgress) delete out.showProgress;
  if (out.questionOrder && same(out.questionOrder, WA_ASK_ORDER)) delete out.questionOrder;
  if (out.questions) {
    const qs = { ...out.questions };
    for (const key of Object.keys(qs) as QualifyFieldKey[]) {
      const def = d.questions.find((q) => q.key === key)!;
      const item = { ...qs[key] };
      if (item.text === def.text) delete item.text;
      if (item.enabled === def.enabled) delete item.enabled;
      if (item.options && same(item.options, def.options)) delete item.options;
      if (Object.keys(item).length) qs[key] = item;
      else delete qs[key];
    }
    out.questions = Object.keys(qs).length ? qs : undefined;
  }
  for (const k of ["bestTime", "handoff", "nurture"] as const) {
    const item = { ...(out[k] ?? {}) } as Record<string, unknown>;
    const def = d[k] as Record<string, unknown>;
    for (const f of Object.keys(item)) if (item[f] === def[f]) delete item[f];
    (out as Record<string, unknown>)[k] = Object.keys(item).length ? item : undefined;
  }
  if (out.followUps) {
    const fu = { ...out.followUps };
    for (const id of Object.keys(fu) as FollowUpId[]) {
      const def = d.followUps.find((f) => f.id === id)!;
      const item = { ...fu[id] };
      if (item.afterHours === def.afterHours) delete item.afterHours;
      if (item.text === def.text) delete item.text;
      if (item.enabled === def.enabled) delete item.enabled;
      if (Object.keys(item).length) fu[id] = item;
      else delete fu[id];
    }
    out.followUps = Object.keys(fu).length ? fu : undefined;
  }
  if (out.rules && same(out.rules, d.rules)) delete out.rules;
  return JSON.parse(JSON.stringify(out)) as ScriptOverrides;
}

// --------------------------------------------------------------------------- mensagens

export type ScriptVars = {
  nome?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  /** Código MORNING/AFTERNOON/EVENING ou texto livre. */
  horario?: string | null;
};

export type ScriptMessage = {
  body: string;
  buttons?: { id: string; title: string }[];
  list?: { buttonText: string; rows: { id: string; title: string }[] };
};

const TIME_PHRASE: Record<string, string> = { MORNING: "pela manhã", AFTERNOON: "à tarde", EVENING: "à noite" };

export function renderText(text: string, vars: ScriptVars): string {
  const nome = vars.nome ? firstName(vars.nome) : "";
  const horario = vars.horario ? TIME_PHRASE[vars.horario] ?? "em breve" : "em breve";
  return text
    .replace(/\{nome\}/g, nome)
    .replace(/\{empresa\}/g, vars.empresa?.trim() || "nossa empresa")
    .replace(/\{cidade\}/g, vars.cidade?.trim() || "")
    .replace(/\{horario\}/g, horario)
    .replace(/[ \t]+([,.!?])/g, "$1")
    .replace(/,\s*([!?.])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function choiceMessage(body: string, options: ChoiceOpt[]): ScriptMessage {
  if (!options.length) return { body };
  if (options.length <= 3 && options.every((o) => o.label.length <= BUTTON_MAX)) {
    return { body, buttons: options.map((o) => ({ id: o.code, title: o.label })) };
  }
  return {
    body,
    list: { buttonText: "Ver opções", rows: options.slice(0, 10).map((o) => ({ id: o.code, title: o.label.slice(0, ROW_MAX) })) },
  };
}

export function enabledQuestions(script: QualifyScript) {
  return script.questions.filter((q) => q.enabled);
}

export function askKeysOf(script: QualifyScript): QualifyFieldKey[] {
  return enabledQuestions(script).map((q) => q.key);
}

export function questionOf(script: QualifyScript, key: QualifyFieldKey) {
  return script.questions.find((q) => q.key === key) ?? DEFAULT_SCRIPT.questions.find((q) => q.key === key) ?? null;
}

export function openingMessage(script: QualifyScript, vars: ScriptVars, questions: number): ScriptMessage {
  if (questions <= 0) {
    return {
      body: renderText("Oi {nome}, recebemos seu cadastro na {empresa}. Quer falar agora com um consultor?", vars),
      buttons: [{ id: QUALIFY_REPLY.meeting, title: "Falar com consultor" }],
    };
  }
  return {
    body: renderText(script.opening.text, vars),
    buttons: [
      { id: QUALIFY_REPLY.start, title: "Começar" },
      { id: QUALIFY_REPLY.meeting, title: "Falar com consultor" },
    ],
  };
}

export function questionMessage(
  script: QualifyScript,
  key: QualifyFieldKey,
  index: number,
  total: number,
  vars: ScriptVars,
  prefix?: string,
): ScriptMessage {
  const q = questionOf(script, key);
  const progress = script.showProgress && total > 1 ? `${index} de ${total} · ` : "";
  const lead = prefix ? `${renderText(prefix, vars)} ` : "";
  return choiceMessage(`${lead}${progress}${renderText(q?.text ?? "", vars)}`, q?.options ?? []);
}

export function bestTimeMessage(script: QualifyScript, vars: ScriptVars): ScriptMessage {
  return choiceMessage(renderText(script.bestTime.text, vars), CHOICE_MAP.best_contact_time ?? []);
}

export function handoffMessage(script: QualifyScript, vars: ScriptVars): ScriptMessage {
  return { body: renderText(script.handoff.text, vars) };
}

export function nurtureMessage(script: QualifyScript, vars: ScriptVars): ScriptMessage {
  return {
    body: renderText(script.nurture.text, vars),
    buttons: [{ id: QUALIFY_REPLY.meeting, title: script.nurture.buttonLabel }],
  };
}

export function followUpOf(script: QualifyScript, id: FollowUpId) {
  return script.followUps.find((f) => f.id === id)!;
}

/** {nome}/{empresa} → variáveis nomeadas do modelo da Meta. */
export function templateBody(text: string) {
  return text.replace(/\{nome\}/g, "{{first_name}}").replace(/\{empresa\}/g, "{{store_name}}");
}

/** Problema que impede o texto de virar modelo da Meta (ou null). */
export function templateTextProblem(text: string): string | null {
  const vars = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const bad = vars.find((v) => !(TEMPLATE_VARIABLES as readonly string[]).includes(v));
  if (bad) return `Neste texto só dá para usar {nome} e {empresa}.`;
  if (/^\s*\{/.test(text) || /\}\s*[.!?]?\s*$/.test(text)) return "O texto não pode começar nem terminar com uma variável.";
  return null;
}

// --------------------------------------------------------------------------- classificação

function codeOf(answers: QualifyAnswers, key: QualifyFieldKey) {
  return answers[key]?.code || answers[key]?.value || "";
}

function ruleMatches(rule: PriorityRule, answers: QualifyAnswers, activeKeys?: QualifyFieldKey[]) {
  const entries = Object.entries(rule).filter(
    ([key, codes]) => codes && codes.length && (!activeKeys || activeKeys.includes(key as QualifyFieldKey)),
  );
  if (!entries.length) return false;
  return entries.every(([key, codes]) => codes!.includes(codeOf(answers, key as QualifyFieldKey)));
}

/** A se bater todas as condições de A; senão B; senão C. Condições de perguntas desligadas não contam. */
export function classifyWithRules(answers: QualifyAnswers, rules: QualifyRules, activeKeys?: QualifyFieldKey[]): Priority {
  if (ruleMatches(rules.A, answers, activeKeys)) return "A";
  if (ruleMatches(rules.B, answers, activeKeys)) return "B";
  return "C";
}

// --------------------------------------------------------------------------- prévia

export type ScriptPreviewItem =
  | { kind: "system"; id: string; block: ScriptBlockId; text: string }
  | { kind: "received"; id: string; block: ScriptBlockId; text: string; buttons: string[]; list?: string; template?: boolean }
  | { kind: "sent"; id: string; block: ScriptBlockId; text: string };

const SAMPLE_VARS: ScriptVars = { nome: "Maria Souza", cidade: "Curitiba" };

function received(id: string, block: ScriptBlockId, m: ScriptMessage, template?: boolean): ScriptPreviewItem {
  return {
    kind: "received",
    id,
    block,
    text: m.body,
    buttons: m.buttons?.map((b) => b.title) ?? [],
    list: m.list?.buttonText,
    template,
  };
}

/** Conversa de exemplo de um lead quente com o roteiro atual (perguntas que a LP já respondeu ficam de fora). */
export function scriptConversation(script: QualifyScript, input: { brand: string; lpKeys: QualifyFieldKey[] }) {
  const vars = { ...SAMPLE_VARS, empresa: input.brand };
  const questions = enabledQuestions(script).filter((q) => !input.lpKeys.includes(q.key));
  const items: ScriptPreviewItem[] = [];
  items.push(received("opening", "opening", openingMessage(script, vars, questions.length), true));
  items.push({ kind: "sent", id: "opening-r", block: "opening", text: "Começar" });
  questions.forEach((q, i) => {
    const block = `question:${q.key}` as const;
    items.push(received(block, block, questionMessage(script, q.key, i + 1, questions.length, vars)));
    items.push({ kind: "sent", id: `${block}-r`, block, text: q.options[0]?.label ?? "Curitiba" });
  });
  items.push({ kind: "system", id: "classified", block: "rules", text: "Classificada como A · quente" });
  if (script.bestTime.enabled) {
    items.push(received("bestTime", "bestTime", bestTimeMessage(script, vars)));
    items.push({ kind: "sent", id: "bestTime-r", block: "bestTime", text: "Manhã" });
  }
  items.push(received("handoff", "handoff", handoffMessage(script, { ...vars, horario: "MORNING" })));
  items.push({ kind: "system", id: "handoff-s", block: "handoff", text: "Consultor assume com a ficha" });
  return items;
}

/** Desvio de quem fica em C. */
export function nurturePreview(script: QualifyScript, brand: string): ScriptPreviewItem[] {
  return [
    { kind: "system", id: "nurture-s", block: "nurture", text: "Classificada como C · em avaliação" },
    received("nurture", "nurture", nurtureMessage(script, { ...SAMPLE_VARS, empresa: brand })),
  ];
}

/** Toques de quem para de responder. */
export function followUpPreview(script: QualifyScript, brand: string, lpKeys: QualifyFieldKey[]): ScriptPreviewItem[] {
  const vars = { ...SAMPLE_VARS, empresa: brand };
  const first = enabledQuestions(script).find((q) => !lpKeys.includes(q.key));
  const items: ScriptPreviewItem[] = [];
  if (first) {
    items.push(received("fu-q", `question:${first.key}`, questionMessage(script, first.key, 1, 1, vars)));
  }
  for (const f of script.followUps) {
    if (!f.enabled) continue;
    const block = `followUp:${f.id}` as const;
    const when = f.afterHours < 24 ? `${f.afterHours} h sem resposta` : `${Math.round(f.afterHours / 24)} dia${f.afterHours >= 48 ? "s" : ""} sem resposta`;
    items.push({ kind: "system", id: `${block}-s`, block, text: when });
    if (f.id === "reask" && first) {
      items.push(received(block, block, questionMessage(script, first.key, 1, 1, vars, f.text)));
    } else if (f.id === "nudge") {
      items.push(
        received(
          block,
          block,
          {
            body: renderText(f.text, vars),
            buttons: [
              { id: QUALIFY_REPLY.start, title: "Continuar" },
              { id: QUALIFY_REPLY.meeting, title: "Falar com consultor" },
            ],
          },
          true,
        ),
      );
    } else if (f.id === "team") {
      items.push({ kind: "system", id: block, block, text: "A equipe recebe um aviso para chamar o lead" });
    }
  }
  return items;
}
