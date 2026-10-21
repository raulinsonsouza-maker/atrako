import assert from "node:assert/strict";
import test from "node:test";
import { FLOW_TRIGGERS, SALES_TRIGGERS } from "../lib/flows/engine";
import { FRANCHISE_NURTURE } from "../lib/flows/playbooks-franchise";
import { flowKeysForPack, playbookByKey } from "../lib/flows/playbooks";
import { emailContentProblems } from "../lib/flows/render-email";
import { parseLeadEmails } from "../lib/notifications/lead-team-email";

const DAY = 24 * 60;

test("nutrição da franquia: 7 dias seguidos e depois a cada 3 até o D30", () => {
  const days = FRANCHISE_NURTURE.steps.map((s) => (s.delayMinutes < DAY ? 0 : s.delayMinutes / DAY));
  assert.deepEqual(days, [0, 1, 2, 3, 4, 5, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
  assert.equal(FRANCHISE_NURTURE.steps[0].delayMinutes, 30);
  for (const s of FRANCHISE_NURTURE.steps) {
    assert.equal(s.channel, "EMAIL");
    const content = s.email!("proximo");
    assert.deepEqual(emailContentProblems(content), [], s.copyKey);
    assert.ok(content.blocks.some((b) => b.type === "button"), s.copyKey);
  }
  assert.equal(new Set(FRANCHISE_NURTURE.steps.map((s) => s.copyKey)).size, 15);
});

test("gatilho da franquia é de venda e aparece no pacote inside sales", () => {
  assert.ok(FLOW_TRIGGERS.includes("franchise_nurture"));
  assert.ok(SALES_TRIGGERS.includes("franchise_nurture"));
  assert.ok(flowKeysForPack("inside_sales")?.includes("franchise_nurture"));
  assert.equal(playbookByKey("franchise_nurture")?.trigger, "franchise_nurture");
});

test("destinatários do aviso de lead: válidos, sem duplicata, minúsculos", () => {
  assert.deepEqual(
    parseLeadEmails({ leadEmails: ["Contato@Regicenter.com", "contato@regicenter.com", "x", 3, "raul@symbius.com.br"] }),
    ["contato@regicenter.com", "raul@symbius.com.br"],
  );
  assert.deepEqual(parseLeadEmails({}), []);
});
