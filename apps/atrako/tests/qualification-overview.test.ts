import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { qualifyActionBucket } from "../lib/qualification/overview";
import type { LeadQualification } from "../lib/qualification/store";

function q(partial: Partial<LeadQualification>): LeadQualification {
  return {
    playbookId: "franchise_regicenter",
    answers: {},
    priority: null,
    currentState: "pending",
    missing: [],
    cadenceStatus: "idle",
    filledPercent: 0,
    ...partial,
  };
}

describe("qualifyActionBucket", () => {
  it("prioriza reunião e WhatsApp pós-form", () => {
    assert.equal(qualifyActionBucket(q({ currentState: "meeting_requested" })), "meeting");
    assert.equal(qualifyActionBucket(q({ currentState: "human_handoff" })), "meeting");
    assert.equal(
      qualifyActionBucket(q({ currentState: "awaiting_post_form_engagement" })),
      "awaiting_wa",
    );
    assert.equal(qualifyActionBucket(q({ currentState: "awaiting_start_choice" })), "awaiting_wa");
  });

  it("separa conversa, cadência e resto", () => {
    assert.equal(qualifyActionBucket(q({ currentState: "awaiting_niche" })), "in_conversation");
    assert.equal(
      qualifyActionBucket(q({ currentState: "qualified", cadenceStatus: "running" })),
      "cadence",
    );
    assert.equal(qualifyActionBucket(q({ currentState: "qualified" })), "other");
  });
});
