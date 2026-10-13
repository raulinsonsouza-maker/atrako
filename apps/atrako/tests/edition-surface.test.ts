import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  editionAllowsConnector,
  editionAllowsDashboardChannel,
  editionLedgerSources,
  modulesForEdition,
} from "../lib/modules/editions";

describe("superfície por edição", () => {
  it("inside sales esconde loja, marketplace e instagram", () => {
    const next = modulesForEdition("inside_sales", { social: true, commerce: true, food: true });
    assert.equal(next.social, false);
    assert.equal(next.commerce, false);
    assert.equal(next.food, false);
    assert.equal(next.forms, true);
    assert.equal(next.whatsapp, true);
    assert.equal(editionAllowsDashboardChannel("inside_sales", "marketplaces"), false);
    assert.equal(editionAllowsDashboardChannel("inside_sales", "ecommerce"), false);
    assert.equal(editionAllowsDashboardChannel("inside_sales", "linkedin"), true);
    assert.equal(editionAllowsConnector("inside_sales", "SHOPIFY"), false);
    assert.equal(editionAllowsConnector("inside_sales", "WOOCOMMERCE"), false);
    assert.equal(editionAllowsConnector("inside_sales", "META_ADS"), true);
    assert.equal(editionAllowsConnector("inside_sales", "WHATSAPP"), true);
    assert.deepEqual(editionLedgerSources("inside_sales"), ["manual", "crm", "whatsapp", "forms"]);
  });

  it("aluguel por temporada liga hospedagem e esconde a agenda de horários", () => {
    const next = modulesForEdition("stay", { agenda: true, food: true, commerce: true });
    assert.equal(next.hospedagem, true);
    assert.equal(next.agenda, false);
    assert.equal(next.food, false);
    assert.equal(next.commerce, false);
    assert.equal(next.whatsapp, true);
    assert.equal(editionAllowsConnector("stay", "MERCADO_PAGO"), true);
    assert.equal(editionAllowsConnector("stay", "WHATSAPP"), true);
    assert.equal(editionAllowsConnector("stay", "RESEND"), true);
    assert.equal(editionAllowsConnector("stay", "SHOPIFY"), false);
    assert.equal(editionAllowsDashboardChannel("stay", "ecommerce"), false);
    assert.deepEqual(editionLedgerSources("stay"), ["manual", "stay", "crm", "whatsapp"]);
  });

  it("food esconde e-commerce e mantém pagamento e WhatsApp", () => {
    assert.equal(editionAllowsDashboardChannel("food", "ecommerce"), false);
    assert.equal(editionAllowsDashboardChannel("food", "marketplaces"), false);
    assert.equal(editionAllowsDashboardChannel("food", "linkedin"), false);
    assert.equal(editionAllowsDashboardChannel("food", "meta"), true);
    assert.equal(editionAllowsConnector("food", "SHOPIFY"), false);
    assert.equal(editionAllowsConnector("food", "MERCADO_LIVRE"), false);
    assert.equal(editionAllowsConnector("food", "MERCADO_PAGO"), true);
    assert.equal(editionAllowsConnector("food", "WHATSAPP"), true);
    assert.equal(editionAllowsConnector("ecommerce", "SHOPIFY"), true);
    assert.equal(editionAllowsDashboardChannel("custom", "marketplaces"), true);
  });
});
