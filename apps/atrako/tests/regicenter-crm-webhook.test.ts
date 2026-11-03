import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRegicenterCrmPayload,
  isFreshFranchiseLead,
  postRegicenterCrmLead,
  type RegicenterCrmLeadInput,
} from "../lib/qualification/regicenter-crm-webhook";

const now = new Date("2026-11-02T12:00:00.000Z");

function lead(overrides: Partial<RegicenterCrmLeadInput> = {}): RegicenterCrmLeadInput {
  return {
    id: "lead_1",
    source: "franquia:franquia-regicenter-qualify",
    createdAt: now,
    updatedAt: now,
    name: "Ana",
    phone: "11999990000",
    email: "ana@example.com",
    flat: {
      city: "Campinas",
      state: "SP",
      investment_status: "CAPITAL_AVAILABLE",
    },
    attribution: {
      utm_source: "meta",
      utm_medium: "cpc",
      utm_campaign: "franquia",
    },
    ...overrides,
  };
}

test("payload da qualificação usa o rótulo do investimento", () => {
  assert.deepEqual(buildRegicenterCrmPayload(lead()), {
    id: "lead_1",
    name: "Ana",
    phone: "11999990000",
    whatsapp: "11999990000",
    email: "ana@example.com",
    city: "Campinas",
    state: "SP",
    investment: "Tenho os R$ 27.900,00",
    origem: "franquia:franquia-regicenter-qualify",
    utm_source: "meta",
    utm_medium: "cpc",
    utm_campaign: "franquia",
  });
});

test("LP sem investimento manda o campo nulo", () => {
  const payload = buildRegicenterCrmPayload(
    lead({
      source: "franquia:franquia-regicenter-lp",
      flat: { city: "Curitiba", state: "PR" },
      attribution: {},
    }),
  );
  assert.equal(payload.investment, null);
  assert.equal(payload.city, "Curitiba");
  assert.equal(payload.utm_source, null);
  assert.equal(payload.origem, "franquia:franquia-regicenter-lp");
});

test("só lead novo da franquia dispara", () => {
  assert.equal(isFreshFranchiseLead(lead()), true);
  assert.equal(
    isFreshFranchiseLead(lead({ source: "meta_lead" })),
    false,
  );
  assert.equal(
    isFreshFranchiseLead(
      lead({ updatedAt: new Date(now.getTime() + 60_000) }),
    ),
    false,
  );
});

test("POST sai só para card novo quando a URL existe", async () => {
  const bodies: string[] = [];
  const fetchImpl = async (_url: string, init: RequestInit) => {
    bodies.push(String(init.body));
    return new Response("ok", { status: 200 });
  };

  assert.equal(await postRegicenterCrmLead(lead(), { url: null, fetchImpl }), "skipped");
  assert.equal(bodies.length, 0);

  assert.equal(
    await postRegicenterCrmLead(lead({ source: "form" }), {
      url: "https://crm.example/lead",
      fetchImpl,
    }),
    "skipped",
  );
  assert.equal(
    await postRegicenterCrmLead(lead({ updatedAt: new Date(now.getTime() + 60_000) }), {
      url: "https://crm.example/lead",
      fetchImpl,
    }),
    "skipped",
  );
  assert.equal(bodies.length, 0);

  assert.equal(
    await postRegicenterCrmLead(lead(), { url: "https://crm.example/lead", fetchImpl }),
    "sent",
  );
  assert.equal(bodies.length, 1);
  assert.equal(JSON.parse(bodies[0]!).id, "lead_1");
  assert.equal(JSON.parse(bodies[0]!).investment, "Tenho os R$ 27.900,00");
});

test("sem a variável de ambiente não chama a rede", async () => {
  const previous = process.env.REGICENTER_LEAD_WEBHOOK_URL;
  delete process.env.REGICENTER_LEAD_WEBHOOK_URL;
  let called = 0;
  try {
    const result = await postRegicenterCrmLead(lead(), {
      fetchImpl: async () => {
        called += 1;
        return new Response("ok", { status: 200 });
      },
    });
    assert.equal(result, "skipped");
    assert.equal(called, 0);
  } finally {
    if (previous === undefined) delete process.env.REGICENTER_LEAD_WEBHOOK_URL;
    else process.env.REGICENTER_LEAD_WEBHOOK_URL = previous;
  }
});
