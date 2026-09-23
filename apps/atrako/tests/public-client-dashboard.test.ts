import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicClienteDashboard } from "../lib/publicClienteDashboard";

const baseClient = {
  id: "client-1",
  nome: "Cliente",
  slug: "cliente",
  logoUrl: null,
  ativo: true,
  segmento: "Serviços",
  objetivoMidia: "LEADS",
  socialMediaAtivo: true,
};

test("mixed clients expose the safe Social Media capability without exposing their private panel profile", () => {
  const result = buildPublicClienteDashboard({
    ...baseClient,
    perfilPanel: "hotel",
  });

  assert.equal(result.socialMediaAtivo, true);
  assert.equal(result.perfilPanel, null);
  assert.equal("gestor" in result, false);
  assert.equal("contas" in result, false);
  assert.equal("inPilotAvailable" in result, false);
});

test("social-only clients expose only the public social-only mode indicator", () => {
  const result = buildPublicClienteDashboard({
    ...baseClient,
    perfilPanel: "social-media",
  });

  assert.equal(result.socialMediaAtivo, true);
  assert.equal(result.perfilPanel, "social-media");
});