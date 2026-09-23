/**
 * Smoke: opt-out keyword regex + attribution models.
 * Run: npx tsx lib/symbius/attribution/engine.smoke.ts && npx tsx lib/symbius/optOut.smoke.ts
 */

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const OPT_OUT = /^(parar|stop|sair|cancelar|unsubscribe)$/i;

assert(OPT_OUT.test("parar"), "parar");
assert(OPT_OUT.test("STOP"), "STOP");
assert(OPT_OUT.test("Sair"), "Sair");
assert(!OPT_OUT.test("parar agora"), "não parcial");
assert(!OPT_OUT.test("oi"), "oi");

console.log("opt-out smoke OK");
