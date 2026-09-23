import assert from "node:assert/strict";
import test from "node:test";
import {
  analystClarificationForQuestion,
  appendClientAnalystMemory,
  buildClientAnalystMemory,
  buildConversationSummary,
  isBroadAccountQuestion,
  redactQuestionPII,
} from "../lib/analyst/openaiAgent";

test("conversation memory retains structured scope alongside recent language", () => {
  const intent = redactQuestionPII("Compare o ROAS das campanhas Meta").intent;
  const summary = buildConversationSummary([
    { role: "USER", content: "Compare o ROAS das campanhas Meta", intent },
    { role: "ASSISTANT", content: "A campanha teve ROAS 4,2 no período." },
  ]);

  assert.match(summary, /Compare o ROAS/);
  assert.match(summary, /escopo:/);
  assert.match(summary, /ROAS 4,2/);
});

test("materially ambiguous campaign result asks for clarification", () => {
  const intent = redactQuestionPII("Qual campanha teve o melhor resultado?").intent;
  assert.equal(
    analystClarificationForQuestion("Qual campanha teve o melhor resultado?", intent),
    "Você quer comparar compras da Meta, conversões do Google Ads ou outra métrica?",
  );
});

test("literal question is not replaced when no clarification is needed", () => {
  const question = "Qual campanha Meta vendeu mais?";
  const intent = redactQuestionPII(question).intent;
  assert.equal(analystClarificationForQuestion(question, intent), null);
});

test("long conversations retain entities and follow-up references", () => {
  const messages = Array.from({ length: 14 }, (_, index) => ({
    role: index % 2 === 0 ? "USER" as const : "ASSISTANT" as const,
    content: index === 3 ? "A segunda campanha foi Hotel Setembro." : `turno ${index}`,
  }));
  const summary = buildConversationSummary(messages, "Período em análise: setembro de 2026.");
  assert.match(summary, /Hotel Setembro/);
  assert.match(summary, /setembro de 2026/);

  const followUp = redactQuestionPII("E essa campanha no mesmo período?").intent;
  assert.equal(followUp.continuity, true);
  assert.ok(followUp.references.includes("retome a campanha citada anteriormente"));
  assert.ok(followUp.references.includes("mantenha o período anterior"));
});

test("direct identifiers are blocked before persistence or model use", () => {
  assert.equal(redactQuestionPII("Veja o lead test@example.com").unsafe, true);
  assert.equal(redactQuestionPII("Consulte o CPF 123.456.789-01").unsafe, true);
  assert.equal(redactQuestionPII("Analise o telefone (11) 99999-8888").unsafe, true);
});

test("institutional client memory retains strategy without direct identifiers", () => {
  const memory = buildClientAnalystMemory([
    { role: "USER", content: "A estratégia anterior priorizou aquisição." },
    { role: "ASSISTANT", content: "Manter ROAS 4,2 como baseline. Contato: test@example.com." },
  ], ["Decisão anterior: proteger campanhas de aquisição."]);
  assert.match(memory, /aquisição/);
  assert.match(memory, /ROAS 4,2/);
  assert.doesNotMatch(memory, /test@example\.com/);
});

test("institutional memory appends only the protected analyst answer", () => {
  const memory = appendClientAnalystMemory(
    "Estratégia anterior: proteger aquisição.",
    "Nova leitura: manter ROAS 4,2. Email test@example.com.",
  );
  assert.match(memory, /proteger aquisição/);
  assert.match(memory, /ROAS 4,2/);
  assert.doesNotMatch(memory, /test@example\.com/);
});

test("broad account questions are identified independently of prior channel context", () => {
  assert.equal(isBroadAccountQuestion("Como a conta está indo esse mês?"), true);
  assert.equal(isBroadAccountQuestion("Me dê uma visão geral da conta"), true);
  assert.equal(isBroadAccountQuestion("E no Google?"), false);
});