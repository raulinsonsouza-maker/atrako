import assert from "node:assert/strict";
import test from "node:test";
import { FLOW_TRIGGERS, SALES_TRIGGERS } from "../lib/flows/engine";
import { STAY_PLAYBOOKS, flowKeysForPack, playbooksForEdition } from "../lib/flows/playbooks";

const STAY_TRIGGERS = ["stay_unpaid", "stay_confirmed", "stay_checkin", "stay_checkout", "stay_thanks"] as const;

test("a estadia tem cinco gatilhos próprios", () => {
  assert.deepEqual(STAY_PLAYBOOKS.map((p) => p.trigger), [...STAY_TRIGGERS]);
  assert.deepEqual(STAY_PLAYBOOKS.map((p) => p.key), [...STAY_TRIGGERS]);
  for (const trigger of STAY_TRIGGERS) assert.ok(FLOW_TRIGGERS.includes(trigger));
  assert.equal(STAY_PLAYBOOKS.some((p) => p.trigger === "order_unpaid"), false);
  assert.equal(SALES_TRIGGERS.includes("stay_unpaid"), false);
});

test("o e-mail da reserva sem pagamento sai em 8 minutos", () => {
  const unpaid = STAY_PLAYBOOKS.find((p) => p.key === "stay_unpaid");
  const email = unpaid?.steps.find((s) => s.channel === "EMAIL");
  assert.equal(email?.delayMinutes, 8);
});

test("cada mesa enxerga só o pacote do segmento", () => {
  const food = new Set(flowKeysForPack("food"));
  const stay = new Set(flowKeysForPack("stay"));
  for (const key of stay) assert.equal(food.has(key), false);
  assert.deepEqual(playbooksForEdition("food").map((p) => p.key), [...food]);
  assert.deepEqual(playbooksForEdition("stay").map((p) => p.key), [...stay]);
  assert.equal(playbooksForEdition("stay").some((p) => p.key === "cart_abandoned"), false);
});
