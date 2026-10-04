// `server-only` is resolved by Next's bundler; plain Node tests need an empty module.
const Module = require("module");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return __filename;
  return original.call(this, request, ...rest);
};
