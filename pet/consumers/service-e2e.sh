#!/bin/sh
# 端到端：真实二进制、真实 HTTP、SQLite（以及设置了 PET_TEST_PG_URL 时的 Postgres）。
set -e
cd "$(dirname "$0")/.."
cargo build -q -p pet-service -p pet-wasm --target-dir target 2>/dev/null || cargo build -q -p pet-service
[ -f target/pkg-node/pet_wasm.js ] || ./scripts/three-end.sh >/dev/null
DIR=$(mktemp -d); trap 'rm -rf "$DIR"' EXIT
node consumers/service-e2e.mjs target/debug/pet-service "$DIR/e2e.db"
if [ -n "$PET_TEST_PG_URL" ]; then
  node consumers/service-e2e.mjs target/debug/pet-service "$PET_TEST_PG_URL"
fi
