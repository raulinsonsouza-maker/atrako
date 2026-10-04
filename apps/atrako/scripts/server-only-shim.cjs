// "server-only" vem embutido no Next; fora dele (tsx) vira no-op.
const Module = require("module");

const original = Module._resolveFilename;
Module._resolveFilename = function resolveServerOnly(request, ...rest) {
  if (request === "server-only") return __filename;
  return original.call(this, request, ...rest);
};
