#!/bin/sh
set -e
cd /app
node <<'NODE'
const fs = require("fs");
const files = [
  "package.json",
  "apps/atrako/package.json",
  "packages/events/package.json",
  "packages/agent/package.json",
  "packages/forms/package.json",
  "packages/social/package.json",
  "packages/db/package.json",
];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  console.log(f, "version=", JSON.stringify(j.version), "name=", j.name);
  if (j.dependencies) {
    for (const [k, v] of Object.entries(j.dependencies)) {
      if (v === "" || v == null) console.log("EMPTY DEP", f, k, v);
    }
  }
}
// scan lock for empty versions
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
function walk(pkgs, path = "") {
  if (!pkgs) return;
  for (const [name, meta] of Object.entries(pkgs)) {
    if (meta && typeof meta === "object") {
      if (meta.version === "" || meta.version == null) {
        console.log("EMPTY LOCK VERSION", path + name, meta);
      }
      if (meta.dependencies) walk(meta.dependencies, path + name + "/");
      if (meta.packages) walk(meta.packages, path);
    }
  }
}
if (lock.packages) {
  for (const [name, meta] of Object.entries(lock.packages)) {
    if (meta && Object.prototype.hasOwnProperty.call(meta, "version") && (meta.version === "" || meta.version == null)) {
      console.log("EMPTY LOCK packages[]", name);
    }
  }
}
NODE
echo "=== npm install ==="
npm install --workspace=@atrako/shell --include-workspace-root --legacy-peer-deps
