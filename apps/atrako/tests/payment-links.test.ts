import assert from "node:assert/strict";
import test from "node:test";
import {
  capInstallmentOptions,
  isValidInstallmentChoice,
  paymentLinkExpiry,
  paymentLinkUrl,
  paymentLinkViewStatus,
  validatePaymentLinkInput,
} from "../lib/crm/payment-link-rules";

test("link de pagamento: valida valor, parcelas e descrição", () => {
  assert.deepEqual(validatePaymentLinkInput({ amountCents: 490000, maxInstallments: 10, description: "  Taxa de adesão  " }), {
    ok: true,
    value: { amountCents: 490000, maxInstallments: 10, description: "Taxa de adesão" },
  });
  assert.equal(validatePaymentLinkInput({ amountCents: 50, maxInstallments: 1, description: "Taxa" }).ok, false);
  assert.equal(validatePaymentLinkInput({ amountCents: 1000, maxInstallments: 13, description: "Taxa" }).ok, false);
  assert.equal(validatePaymentLinkInput({ amountCents: 1000, maxInstallments: 0, description: "Taxa" }).ok, false);
  assert.equal(validatePaymentLinkInput({ amountCents: 1000, maxInstallments: 2, description: "x" }).ok, false);
  assert.equal(validatePaymentLinkInput({ amountCents: "abc", maxInstallments: 2, description: "Taxa" }).ok, false);
});

test("parcelas do cartão nunca passam do máximo negociado", () => {
  const options = Array.from({ length: 12 }, (_, i) => ({ installments: i + 1 }));
  assert.deepEqual(
    capInstallmentOptions(options, 3).map((o) => o.installments),
    [1, 2, 3],
  );
  assert.equal(isValidInstallmentChoice(3, 3), true);
  assert.equal(isValidInstallmentChoice(4, 3), false);
  assert.equal(isValidInstallmentChoice(0, 12), false);
  assert.equal(isValidInstallmentChoice(2.5, 12), false);
  assert.equal(isValidInstallmentChoice(13, 20), false);
});

test("link pendente vencido aparece como expirado; pago continua pago", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const past = new Date("2026-10-20T12:00:00Z");
  const future = paymentLinkExpiry(now);
  assert.equal(future.getTime() - now.getTime(), 7 * 86_400_000);
  assert.equal(paymentLinkViewStatus({ status: "PENDING", expiresAt: past }, now), "EXPIRED");
  assert.equal(paymentLinkViewStatus({ status: "PENDING", expiresAt: future }, now), "PENDING");
  assert.equal(paymentLinkViewStatus({ status: "PAID", expiresAt: past }, now), "PAID");
});

test("URL do link usa o domínio do cliente em produção e .localhost em dev", () => {
  assert.equal(
    paymentLinkUrl({ token: "abc", lpHost: "lp.regicenter.com", origin: "https://atrako.com.br", production: true }),
    "https://lp.regicenter.com/pagar/abc",
  );
  assert.equal(
    paymentLinkUrl({ token: "abc", lpHost: "lp.regicenter.com", origin: "http://localhost:5000", production: false }),
    "http://lp.regicenter.localhost:5000/pagar/abc",
  );
  assert.equal(
    paymentLinkUrl({ token: "abc", lpHost: null, origin: "https://atrako.com.br", production: true }),
    "https://atrako.com.br/pagar/abc",
  );
});
