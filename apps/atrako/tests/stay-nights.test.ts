import assert from "node:assert/strict";
import test from "node:test";
import {
  eachNight,
  nightsBetween,
  occupiedNights,
  paymentKind,
  quoteStay,
  rangesOverlap,
  stayPaidLead,
} from "../lib/stay/nights";

const base = {
  nightlyCents: 89000,
  cleaningFeeCents: 15000,
  minNights: 2,
  maxNights: 14,
  today: "2026-12-01",
};

test("checkout não ocupa a noite de saída e noites se encostam sem sobrepor", () => {
  assert.equal(nightsBetween("2026-12-10", "2026-12-13"), 3);
  assert.deepEqual(eachNight("2026-12-10", "2026-12-13"), ["2026-12-10", "2026-12-11", "2026-12-12"]);
  assert.equal(rangesOverlap("2026-12-10", "2026-12-13", "2026-12-13", "2026-12-15"), false);
  assert.equal(rangesOverlap("2026-12-10", "2026-12-14", "2026-12-13", "2026-12-15"), true);
});

test("hold vencido libera a noite e bloqueio ocupa o intervalo", () => {
  const occupied = occupiedNights({
    now: new Date("2026-12-01T12:00:00.000Z"),
    reservations: [
      { checkIn: "2026-12-10", checkOut: "2026-12-13", status: "CONFIRMED" },
      {
        checkIn: "2026-12-20",
        checkOut: "2026-12-22",
        status: "PENDING_PAYMENT",
        holdExpiresAt: "2026-11-01T00:00:00.000Z",
      },
      {
        checkIn: "2026-12-18",
        checkOut: "2026-12-19",
        status: "PENDING_PAYMENT",
        holdExpiresAt: "2026-12-01T18:00:00.000Z",
      },
    ],
    blocks: [{ startDate: "2026-12-24", endDate: "2026-12-26" }],
  });
  assert.equal(occupied.has("2026-12-12"), true);
  assert.equal(occupied.has("2026-12-13"), false);
  assert.equal(occupied.has("2026-12-20"), false);
  assert.equal(occupied.has("2026-12-18"), true);
  assert.equal(occupied.has("2026-12-24"), true);
  assert.equal(occupied.has("2026-12-26"), false);
});

test("cotação soma diárias e limpeza e recusa noites ocupadas", () => {
  const open = quoteStay({ ...base, checkIn: "2026-12-02", checkOut: "2026-12-04", occupied: new Set() });
  assert.equal(open.ok, true);
  if (open.ok) assert.equal(open.amountCents, 89000 * 2 + 15000);
  const short = quoteStay({ ...base, checkIn: "2026-12-02", checkOut: "2026-12-03", occupied: new Set() });
  assert.equal(short.ok, false);
  const taken = quoteStay({
    ...base,
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    occupied: new Set(["2026-12-11"]),
  });
  assert.equal(taken.ok, false);
  if (!taken.ok) assert.match(taken.error, /ocupadas/);
});

test("pagamento aprovado fecha o lead como ganho pelo valor da reserva", () => {
  assert.equal(paymentKind("approved"), "paid");
  assert.equal(paymentKind("processed"), "paid");
  assert.equal(paymentKind("refunded"), "refunded");
  const lead = stayPaidLead(178000);
  assert.equal(lead.status, "WON");
  assert.equal(lead.dealValue, 1780);
});
