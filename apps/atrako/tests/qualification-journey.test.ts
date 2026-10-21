import assert from "node:assert/strict";
import { test } from "node:test";
import { matchChoice } from "../lib/qualification/choices";
import { WA_ASK_ORDER } from "../lib/qualification/fields";
import { answerFromRaw } from "../lib/qualification/store";
import {
  QUALIFY_REPLY_IDS,
  handoffCopy,
  numberedPrompt,
  openCopy,
} from "../lib/qualification/messages";
import { journeyConversation, journeyStageOf, leadBrief } from "../lib/qualification/journey";
import { WA_TEMPLATE_LIBRARY, quickReplyPayload } from "../lib/flows/wa-templates";

test("matchChoice entende número, rótulo e texto livre", () => {
  assert.equal(matchChoice("niche", "1")?.code, "NICHE_LAW");
  assert.equal(matchChoice("niche", "advocacia")?.code, "NICHE_LAW");
  assert.equal(matchChoice("niche", "NICHE_SAAS")?.code, "NICHE_SAAS");
  assert.equal(matchChoice("investment_status", "Tenho o valor")?.code, "CAPITAL_AVAILABLE");
  assert.equal(matchChoice("investment_status", "ainda avaliando")?.code, "CAPITAL_EVALUATING");
  assert.equal(matchChoice("best_contact_time", "de manhã")?.code, "MORNING");
  assert.equal(matchChoice("start_timeline", "quanto custa?"), null);
  assert.equal(matchChoice("niche", "9"), null);
});

test("perguntas numeradas e abertura com a marca", () => {
  assert.match(numberedPrompt("niche", 1, 5).body, /^1 de 5 · /);
  assert.equal(numberedPrompt("niche", 1, 1).body.startsWith("1 de"), false);
  const open = openCopy({ name: "Maria Souza", brand: "Regicenter", city: "Curitiba", questions: 5 });
  assert.match(open.body, /Maria/);
  assert.match(open.body, /Regicenter/);
  assert.deepEqual(open.buttons.map((b) => b.id), ["START_QUALIFICATION", "WANT_MEETING"]);
  assert.ok(open.buttons.every((b) => b.title.length <= 20));
  assert.match(handoffCopy("Maria", "MORNING"), /pela manhã/);
  assert.doesNotMatch(handoffCopy("Maria", "depois das 18h"), /de preferência/);
});

test("ids da qualificação não caem no handoff genérico", () => {
  for (const id of ["START_QUALIFICATION", "WANT_MEETING", "NICHE_LAW", "MORNING", "CAPITAL_PARTIAL"]) {
    assert.ok(QUALIFY_REPLY_IDS.has(id), id);
  }
  assert.equal(QUALIFY_REPLY_IDS.has("atk_help"), false);
});

test("ficha da equipe traz prioridade, local e respostas", () => {
  const brief = leadBrief({
    answers: {
      city: answerFromRaw("city", "Curitiba", "lp"),
      state: answerFromRaw("state", "PR", "lp"),
      niche: answerFromRaw("niche", "NICHE_LAW", "whatsapp"),
      investment_status: answerFromRaw("investment_status", "CAPITAL_AVAILABLE", "whatsapp"),
      best_contact_time: answerFromRaw("best_contact_time", "MORNING", "whatsapp"),
    },
    priority: "A",
    reason: "qualified",
  });
  const lines = brief.split("\n");
  assert.equal(lines[0], "Ficha do WhatsApp · Concluiu a qualificação");
  assert.ok(lines.includes("Prioridade: A · quente"));
  assert.ok(lines.includes("Local: Curitiba/PR"));
  assert.ok(lines.includes("Área: Advocacia"));
  assert.ok(lines.includes("Melhor horário: Manhã"));
});

test("estado do lead vira etapa da jornada", () => {
  assert.equal(journeyStageOf("captured"), "entrada");
  assert.equal(journeyStageOf("awaiting_start_choice"), "abertura");
  assert.equal(journeyStageOf("awaiting_niche"), "perguntas");
  assert.equal(journeyStageOf("awaiting_best_time"), "horario");
  assert.equal(journeyStageOf("meeting_requested"), "equipe");
  assert.equal(journeyStageOf("nurture"), "nutricao");
  assert.equal(journeyStageOf("pending"), null);
});

test("conversa de exemplo pula o que veio da LP", () => {
  const items = journeyConversation({ brand: "Regicenter", askKeys: WA_ASK_ORDER, lpKeys: ["city", "state"] });
  const questions = items.filter((i) => i.kind === "received" && i.stage === "perguntas");
  assert.equal(questions.length, 5);
  assert.ok(questions.every((q) => q.kind === "received" && /^\d de 5 · /.test(q.text)));
  assert.equal(items.at(-1)?.stage, "equipe");
});

test("modelos da qualificação: sob demanda e payload pelos botões", () => {
  for (const purpose of ["qualify_open", "qualify_nudge"]) {
    const def = WA_TEMPLATE_LIBRARY.find((d) => d.purpose === purpose);
    assert.ok(def?.onDemand, purpose);
    for (const body of Object.values(def!.body)) {
      assert.doesNotMatch(body, /^\{\{|\}\}$/);
    }
  }
  assert.equal(quickReplyPayload("Começar"), "START_QUALIFICATION");
  assert.equal(quickReplyPayload("Falar com consultor"), "WANT_MEETING");
  assert.equal(quickReplyPayload("Não quero receber"), "atk_optout");
  assert.equal(quickReplyPayload("Tenho dúvida"), "atk_help");
});
