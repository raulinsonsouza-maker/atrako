/**
 * Smoke assertions for attribution models (node --experimental-strip-types or tsx).
 * Run: npx tsx lib/symbius/attribution/engine.smoke.ts
 */
import { computeAttribution } from "./engine";
import type { TouchPoint } from "./types";

const meta: TouchPoint = {
  source: "meta",
  medium: "paid_social",
  campaign: "bf",
  timestamp: "2026-08-01T12:00:00Z",
};
const google: TouchPoint = {
  source: "google",
  medium: "cpc",
  campaign: "brand",
  timestamp: "2026-08-20T12:00:00Z",
};
const email: TouchPoint = {
  source: "email",
  medium: "email",
  campaign: "nurture",
  timestamp: "2026-08-25T12:00:00Z",
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const first = computeAttribution({
  model: "first_touch",
  leadSource: meta,
  firstTouch: meta,
  lastTouch: email,
  touches: [meta, google, email],
  value: 300,
});
assert(first.attributed?.source === "meta", "first_touch → meta");

const last = computeAttribution({
  model: "last_touch",
  leadSource: meta,
  firstTouch: meta,
  lastTouch: email,
  touches: [meta, google, email],
  value: 300,
});
assert(last.attributed?.source === "email", "last_touch → email");

const linear = computeAttribution({
  model: "linear",
  leadSource: meta,
  firstTouch: meta,
  lastTouch: email,
  touches: [meta, google, email],
  value: 300,
});
assert(
  linear.linearShares?.length === 3 &&
    Math.abs((linear.linearShares?.[0]?.value ?? 0) - 100) < 0.01,
  "linear shares 100 each",
);

const pos = computeAttribution({
  model: "position_based",
  leadSource: meta,
  firstTouch: meta,
  lastTouch: email,
  touches: [meta, google, email],
  value: 100,
});
assert(
  Math.abs((pos.linearShares?.[0]?.share ?? 0) - 0.4) < 0.001,
  "position first 40%",
);

console.log("attribution smoke OK");
