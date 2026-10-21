import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyLead } from "../lib/qualification/classify";
import { matchChoice } from "../lib/qualification/choices";
import type { QualifyAnswers, QualifyFieldKey } from "../lib/qualification/fields";
import { answerFromRaw, snapshotFromAnswers } from "../lib/qualification/store";
import { parseQualificationPrefs } from "../lib/qualification/playbook";
import {
  DEFAULT_SCRIPT,
  applyBlock,
  askKeysOf,
  classifyWithRules,
  customizedBlocks,
  openingMessage,
  questionMessage,
  renderText,
  resetBlock,
  resolveScript,
  scriptConversation,
  templateBody,
  templateTextProblem,
} from "../lib/qualification/script";

function answers(map: Partial<Record<QualifyFieldKey, string>>): QualifyAnswers {
  const out: QualifyAnswers = {};
  for (const [k, v] of Object.entries(map) as [QualifyFieldKey, string][]) out[k] = answerFromRaw(k, v, "whatsapp");
  return out;
}

test("padrão: sem progresso e nada personalizado", () => {
  const script = resolveScript(undefined);
  assert.equal(script.showProgress, false);
  assert.deepEqual(customizedBlocks(undefined), []);
  const msg = questionMessage(script, "niche", 2, 5, { nome: "Maria" });
  assert.doesNotMatch(msg.body, /de 5/);
  assert.match(questionMessage({ ...script, showProgress: true }, "niche", 2, 5, {}).body, /^2 de 5 · /);
});

test("personalização mescla com o padrão e restaurar apaga só o bloco", () => {
  let o = applyBlock(undefined, "opening", { text: "Olá {nome}, tudo bem? Aqui é da {empresa}." });
  o = applyBlock(o, "question:niche", { enabled: false });
  o = applyBlock(o, "questions", { showProgress: true });
  const script = resolveScript(o);
  assert.match(script.opening.text, /tudo bem/);
  assert.equal(script.questions.find((q) => q.key === "niche")?.enabled, false);
  assert.equal(script.showProgress, true);
  assert.deepEqual(customizedBlocks(o).sort(), ["opening", "question:niche", "questions"].sort());
  assert.equal(script.handoff.text, DEFAULT_SCRIPT.handoff.text);

  const back = resetBlock(o, "opening");
  assert.equal(resolveScript(back).opening.text, DEFAULT_SCRIPT.opening.text);
  assert.ok(customizedBlocks(back).includes("question:niche"));
});

test("salvar igual ao padrão não marca como personalizado", () => {
  const o = applyBlock(undefined, "handoff", { text: DEFAULT_SCRIPT.handoff.text });
  assert.deepEqual(customizedBlocks(o), []);
});

test("pergunta desligada não é feita", () => {
  const o = applyBlock(undefined, "question:main_question", { enabled: false });
  const prefs = parseQualificationPrefs({ qualification: { enabled: true, script: o } });
  assert.equal(prefs.askKeys.includes("main_question"), false);
  assert.deepEqual(askKeysOf(prefs.script), prefs.askKeys);
  const items = scriptConversation(prefs.script, { brand: "Regicenter", lpKeys: ["city"] });
  assert.equal(items.some((i) => i.block === "question:main_question"), false);
  assert.equal(items.some((i) => i.block === "question:city"), false);
});

test("ordem personalizada vale para as perguntas", () => {
  const o = applyBlock(undefined, "questions", { questionOrder: ["investment_status", "niche"] });
  const keys = resolveScript(o).questions.map((q) => q.key);
  assert.equal(keys[0], "investment_status");
  assert.equal(keys[1], "niche");
  assert.equal(keys.length, DEFAULT_SCRIPT.questions.length);
});

test("variáveis viram nome, empresa, cidade e horário", () => {
  assert.equal(renderText("Oi {nome}, aqui é da {empresa} em {cidade}.", { nome: "Maria Souza", empresa: "Regicenter", cidade: "Curitiba" }), "Oi Maria, aqui é da Regicenter em Curitiba.");
  assert.equal(renderText("Oi, {nome}!", {}), "Oi!");
  assert.match(renderText("Falo com você {horario}.", { horario: "MORNING" }), /pela manhã/);
  assert.match(renderText("Falo com você {horario}.", {}), /em breve/);
  assert.equal(templateBody("Oi {nome}, cadastro na {empresa}."), "Oi {{first_name}}, cadastro na {{store_name}}.");
  assert.equal(templateTextProblem("Oi {nome}, tudo bem?"), null);
  assert.ok(templateTextProblem("Oi {nome}, de {cidade}?"));
  assert.ok(templateTextProblem("{nome}, tudo bem?"));
});

test("abertura: botões fixos e texto do roteiro", () => {
  const msg = openingMessage(DEFAULT_SCRIPT, { nome: "Maria", empresa: "Regicenter" }, 5);
  assert.match(msg.body, /Maria/);
  assert.match(msg.body, /Regicenter/);
  assert.deepEqual(msg.buttons?.map((b) => b.id), ["START_QUALIFICATION", "WANT_MEETING"]);
});

test("opções editadas: botões ou lista e matchChoice com códigos novos", () => {
  const o = applyBlock(undefined, "question:business_objective", {
    options: [
      { code: "OWNER_OPERATOR", label: "Operar" },
      { code: "", label: "Investir" },
    ],
  });
  const q = resolveScript(o).questions.find((x) => x.key === "business_objective")!;
  assert.equal(q.options[1]?.code, "OPT_INVESTIR");
  const msg = questionMessage(resolveScript(o), "business_objective", 1, 1, {});
  assert.equal(msg.buttons?.length, 2);
  assert.equal(matchChoice("business_objective", "investir", q.options)?.code, "OPT_INVESTIR");
  assert.equal(matchChoice("business_objective", "2", q.options)?.code, "OPT_INVESTIR");
  const niche = questionMessage(DEFAULT_SCRIPT, "niche", 1, 1, {});
  assert.equal(niche.list?.rows.length, 6);
});

test("regras padrão repetem a classificação atual (sem o ajuste por área/cidade)", () => {
  const cases: Partial<Record<QualifyFieldKey, string>>[] = [
    { investment_status: "CAPITAL_AVAILABLE", start_timeline: "START_30D", business_objective: "OWNER_OPERATOR", niche: "NICHE_LAW", city: "Curitiba" },
    { investment_status: "CAPITAL_AVAILABLE", start_timeline: "START_60_90D", business_objective: "BUILD_TEAM", city: "Curitiba" },
    { investment_status: "CAPITAL_PARTIAL", start_timeline: "START_30D", business_objective: "OWNER_OPERATOR", city: "Curitiba" },
    { investment_status: "CAPITAL_EVALUATING", start_timeline: "START_30D", business_objective: "OWNER_OPERATOR", city: "Curitiba" },
    { investment_status: "CAPITAL_AVAILABLE", start_timeline: "START_LATER", business_objective: "OWNER_OPERATOR", city: "Curitiba" },
    { investment_status: "CAPITAL_AVAILABLE", start_timeline: "START_30D", business_objective: "EXPLORING", city: "Curitiba" },
    { start_timeline: "START_30D", business_objective: "OWNER_OPERATOR" },
  ];
  for (const c of cases) {
    const a = answers(c);
    assert.equal(classifyWithRules(a, DEFAULT_SCRIPT.rules), classifyLead(snapshotFromAnswers(a)), JSON.stringify(c));
  }
  // Diferença assumida: área "Outro" sem cidade era B; agora fica A pelas regras.
  const other = answers({ investment_status: "CAPITAL_AVAILABLE", start_timeline: "START_30D", business_objective: "OWNER_OPERATOR", niche: "NICHE_OTHER" });
  assert.equal(classifyLead(snapshotFromAnswers(other)), "B");
  assert.equal(classifyWithRules(other, DEFAULT_SCRIPT.rules), "A");
});

test("condição de pergunta desligada não conta na regra", () => {
  const a = answers({ investment_status: "CAPITAL_AVAILABLE", start_timeline: "START_30D" });
  assert.equal(classifyWithRules(a, DEFAULT_SCRIPT.rules), "C");
  const active = askKeysOf(DEFAULT_SCRIPT).filter((k) => k !== "business_objective");
  assert.equal(classifyWithRules(a, DEFAULT_SCRIPT.rules, active), "A");
});

test("prazos dos toques ficam em ordem crescente", () => {
  const o = applyBlock(applyBlock(undefined, "followUp:reask", { afterHours: 12 }), "followUp:nudge", { afterHours: 24 });
  const hours = resolveScript(o).followUps.map((f) => f.afterHours);
  assert.ok(hours[0]! < hours[1]! && hours[1]! < hours[2]!);
  const bad = applyBlock(undefined, "followUp:reask", { afterHours: 999 });
  assert.equal(resolveScript(bad).followUps[0]?.afterHours, 2);
});
