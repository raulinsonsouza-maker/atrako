import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyLead } from "../lib/qualification/classify";
import { missingFieldKeys, mergeAnswer, filledPercent } from "../lib/qualification/fields";
import { resolveChoice } from "../lib/qualification/choices";
import { answerFromRaw } from "../lib/qualification/store";
import { sourceMatchesPlaybook, parseQualificationPrefs } from "../lib/qualification/playbook";

test("classifyLead: A com capital + 30 dias", () => {
  assert.equal(
    classifyLead({
      investmentStatus: "available",
      timeline: "within_30_days",
      objective: "owner_operator",
      nicheCode: "NICHE_LAW",
      city: "Curitiba",
    }),
    "A",
  );
});

test("classifyLead: C com exploring ou later", () => {
  assert.equal(
    classifyLead({
      investmentStatus: "available",
      timeline: "within_30_days",
      objective: "exploring",
      nicheCode: "NICHE_LAW",
      city: "Curitiba",
    }),
    "C",
  );
  assert.equal(
    classifyLead({
      investmentStatus: "available",
      timeline: "later",
      objective: "owner_operator",
      city: "SP",
    }),
    "C",
  );
});

test("classifyLead: B com capital e prazo médio", () => {
  assert.equal(
    classifyLead({
      investmentStatus: "available",
      timeline: "within_60_90_days",
      objective: "owner_operator",
      nicheCode: "NICHE_SAAS",
      city: "Florianópolis",
    }),
    "B",
  );
});

test("missingFieldKeys e merge não sobrescreve com vazio", () => {
  const answers = {
    city: answerFromRaw("city", "Curitiba", "lp"),
  };
  assert.deepEqual(missingFieldKeys(answers), [
    "niche",
    "start_timeline",
    "business_objective",
    "main_question",
    "investment_status",
  ]);
  const kept = mergeAnswer(answers, "city", answerFromRaw("city", "", "whatsapp"));
  assert.equal(kept.city?.value, "Curitiba");
  assert.equal(filledPercent(answers), Math.round((1 / 6) * 100));
});

test("resolveChoice por label e código", () => {
  assert.equal(resolveChoice("niche", "Advocacia").code, "NICHE_LAW");
  assert.equal(resolveChoice("investment_status", "CAPITAL_AVAILABLE").label, "Tenho os R$ 27.999");
  assert.equal(resolveChoice("investment_status", "Tenho o valor").code, "CAPITAL_AVAILABLE");
});

test("sourceMatchesPlaybook", () => {
  const prefs = parseQualificationPrefs({
    qualification: { enabled: true, sourceTags: ["franquia"] },
  });
  assert.equal(sourceMatchesPlaybook("franquia:franquia-regicenter-lp", prefs), true);
  assert.equal(sourceMatchesPlaybook("lp:outra", prefs), false);
});
