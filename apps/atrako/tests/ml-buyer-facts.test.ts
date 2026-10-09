import assert from "node:assert/strict";
import test from "node:test";
import {
  describeMlBuyer,
  formatMlDocument,
  mlShippingLabel,
  parseMlBuyerFacts,
} from "../lib/integrations/mercadolivre/buyer-facts";
import { orderDetails } from "../lib/commerce/order-details";
import { leadSourceLabel } from "../lib/atrako/person";

test("lê apelido, cobrança v2 e endereço do envio do Mercado Livre", () => {
  const facts = parseMlBuyerFacts({
    order: {
      buyer: { nickname: "MARIA.FERRAO", first_name: "Maria", last_name: "Ferrao" },
      payments: [{ status: "approved", payment_type: "bank_transfer", payment_method_id: "pix", installments: 1 }],
    },
    billing: {
      buyer: {
        billing_info: {
          name: "MARIA NAZARE",
          last_name: "FERRAO",
          identification: { type: "CPF", number: "12345678901" },
          address: {
            street_name: "Rua das Flores",
            street_number: "120",
            city_name: "Campinas",
            state: { id: "BR-SP", name: "São Paulo" },
            zip_code: "13010000",
            neighborhood: "Centro",
          },
        },
      },
    },
    shipment: {
      status: "delivered",
      mode: "me2",
      logistic_type: "fulfillment",
      receiver_address: {
        receiver_phone: "19987654321",
        city: { name: "Campinas" },
        state: { id: "BR-SP" },
      },
    },
  });

  assert.equal(facts.nickname, "MARIA.FERRAO");
  assert.equal(facts.name, "MARIA NAZARE FERRAO");
  assert.equal(facts.phone, "19987654321");
  assert.equal(facts.city, "Campinas");
  assert.equal(facts.street, "Rua das Flores, 120");
  assert.equal(formatMlDocument(facts.docType, facts.docNumber), "CPF 123.456.789-01");

  const card = describeMlBuyer({
    facts,
    shippingMode: "me2",
    logisticType: "fulfillment",
    shippingStatus: "delivered",
  });
  assert.equal(card.location, "Campinas/SP");
  assert.equal(card.shipping, "Full · entregue");
  assert.equal(card.address, "Rua das Flores, 120 · Centro · 13010-000");
});

test("lê a cobrança antiga por additional_info", () => {
  const facts = parseMlBuyerFacts({
    billing: {
      billing_info: {
        doc_type: "CNPJ",
        doc_number: "11222333000181",
        additional_info: [
          { type: "BUSINESS_NAME", value: "Loja Exemplo" },
          { type: "CITY_NAME", value: "Curitiba" },
          { type: "STATE_NAME", value: "Paraná" },
        ],
      },
    },
  });
  assert.equal(facts.name, "Loja Exemplo");
  assert.equal(facts.city, "Curitiba");
  assert.equal(facts.state, "Paraná");
  assert.equal(formatMlDocument(facts.docType, facts.docNumber), "CNPJ 11.222.333/0001-81");
  assert.equal(mlShippingLabel("me2", null), "Mercado Envios");
});

test("o pedido do Mercado Livre vira pagamento, envio e cidade no card", () => {
  const details = orderDetails("MERCADO_LIVRE", {
    order: {
      date_created: "2026-10-06T17:03:00.000Z",
      payments: [{ status: "approved", payment_method_id: "visa", payment_type: "credit_card", installments: 3 }],
    },
    billing: {
      buyer: { billing_info: { address: { city_name: "Santos", state: { id: "BR-SP" } } } },
    },
    shippingMode: "me2",
    logisticType: "self_service",
    shippingStatus: "shipped",
  });
  assert.equal(details?.paymentMethod, "cartão");
  assert.equal(details?.installments, 3);
  assert.equal(details?.shipping?.method, "Turbo / Próprio · a caminho");
  assert.equal(details?.location?.city, "Santos");
  assert.equal(details?.location?.state, "SP");
});

test("origem mercadolivre aparece como Mercado Livre", () => {
  assert.equal(leadSourceLabel("mercadolivre"), "Mercado Livre");
  assert.equal(leadSourceLabel("MERCADO_LIVRE"), "Mercado Livre");
});
