#!/usr/bin/env bash
# Build a self-contained package for Azure App Service (Linux, Node).
#
# Why: the remote Oryx build is too slow on small plans (HTTP 504 on B1), and the
# npm workspace symlinks (node_modules/@visualrami/shared -> ../shared) do not survive
# a zip. So we build locally and assemble a flat tree that mirrors the repo layout:
#
#   package.json            start script + runtime deps only
#   node_modules/           express, socket.io, and a real copy of @visualrami/shared
#   server/package.json     keeps "type": "module" for server/dist/*.js
#   server/dist/            compiled server
#   client/dist/            built client (served by the server at ../../client/dist)
#
# Usage: Scripts/build-azure.sh [output-dir]   -> prints the zip path
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/release}"
WORK="$OUT/azure-package"
ZIP="$OUT/visualrami-azure.zip"

cd "$ROOT"
npm run build >/dev/null

rm -rf "$WORK" "$ZIP"
mkdir -p "$WORK/server" "$WORK/client"

cp -R server/dist "$WORK/server/dist"
cp server/package.json "$WORK/server/package.json"
cp -R client/dist "$WORK/client/dist"

# Runtime dependencies of the server only, pinned to the versions resolved in the lockfile.
node - "$ROOT" "$WORK" <<'JS'
const fs = require("node:fs");
const path = require("node:path");
const [root, work] = process.argv.slice(2);
const server = JSON.parse(fs.readFileSync(path.join(root, "server/package.json"), "utf8"));
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const deps = {};
for (const name of Object.keys(server.dependencies)) {
  if (name.startsWith("@visualrami/")) continue;
  const installed = JSON.parse(fs.readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8"));
  deps[name] = installed.version;
}
fs.writeFileSync(
  path.join(work, "package.json"),
  JSON.stringify(
    {
      name: "visualrami-azure",
      version: rootPkg.version,
      private: true,
      engines: { node: ">=20" },
      scripts: { start: "node server/dist/index.js" },
      dependencies: deps,
    },
    null,
    2,
  ) + "\n",
);
console.log("runtime deps:", deps);
JS

( cd "$WORK" && npm install --omit=dev --no-audit --no-fund --ignore-scripts >/dev/null )

# The workspace package is copied AFTER npm install: npm prunes anything it does not know
# about, and @visualrami/shared is deliberately not declared as a dependency (it is not published).
mkdir -p "$WORK/node_modules/@visualrami/shared"
cp shared/package.json "$WORK/node_modules/@visualrami/shared/package.json"
cp -R shared/dist "$WORK/node_modules/@visualrami/shared/dist"
test -f "$WORK/node_modules/@visualrami/shared/dist/index.js" || { echo "shared package missing" >&2; exit 1; }

# Smoke test the package exactly as App Service will run it.
# Output is redirected so the child never holds this script's stdout open.
( cd "$WORK" && exec env PORT=3999 node server/dist/index.js >/dev/null 2>&1 ) &
SMOKE_PID=$!
trap 'kill "$SMOKE_PID" 2>/dev/null || true' EXIT
sleep 1.5
if curl -sf http://127.0.0.1:3999/healthz >/dev/null && curl -sf http://127.0.0.1:3999/ | grep -q VisualRami; then
  echo "package smoke test: OK"
else
  echo "package smoke test: FAILED" >&2
  exit 1
fi
kill "$SMOKE_PID" 2>/dev/null || true
wait "$SMOKE_PID" 2>/dev/null || true

( cd "$WORK" && zip -q -r "$ZIP" . -x "*.DS_Store" )
echo "package: $ZIP ($(du -h "$ZIP" | cut -f1), $(unzip -l "$ZIP" | tail -1 | awk '{print $2}') files)"
