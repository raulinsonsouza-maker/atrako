import assert from "node:assert/strict";
import test from "node:test";
import { campaignLeadSource } from "../lib/flows/campaigns";
import { leadSourceLabel } from "../lib/atrako/person";
import {
  attendanceCanQuote,
  attendanceIsOn,
  describeAttendance,
  isWithinAttendanceHours,
  parseAttendance,
} from "../lib/attendance/profile";

test("campanha de WhatsApp vira origem de card, sem estourar o campo", () => {
  const source = campaignLeadSource("Dia das Mães 2027", null, "cmp_123");
  assert.equal(source, "campaign:dia-das-maes-2027");
  assert.ok(source.length <= 80);
  assert.equal(leadSourceLabel(source), "Campanha WhatsApp");
});

test("ficha desligada não atende e não cita preço", () => {
  const off = parseAttendance({ mode: "sell", waEnabled: false, offerKind: "fixed", fixedAmount: 150 });
  assert.equal(attendanceIsOn(off), false);
  assert.equal(off.fixedAmount, 150);
  const qualify = parseAttendance({ mode: "qualify", waEnabled: true, offerKind: "fixed", fixedAmount: 90, conditions: "R$ 90" });
  assert.equal(qualify.offerKind, "none");
  assert.equal(qualify.fixedAmount, null);
  assert.equal(attendanceCanQuote(qualify), false);
});

test("fora do horário a ficha recusa o início da conversa", () => {
  const profile = parseAttendance({
    hourPreset: "weekdays",
    hourStart: "09:00",
    hourEnd: "18:00",
  });
  const saturday = new Date("2026-10-10T15:00:00-03:00");
  const mondayMorning = new Date("2026-10-12T10:00:00-03:00");
  const mondayNight = new Date("2026-10-12T20:00:00-03:00");
  assert.equal(isWithinAttendanceHours(profile, "America/Sao_Paulo", saturday), false);
  assert.equal(isWithinAttendanceHours(profile, "America/Sao_Paulo", mondayMorning), true);
  assert.equal(isWithinAttendanceHours(profile, "America/Sao_Paulo", mondayNight), false);
  assert.match(describeAttendance(parseAttendance({ about: "Escola de inglês", mode: "qualify", waEnabled: true })), /Escola de inglês/);
});
