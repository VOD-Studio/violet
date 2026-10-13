#!/bin/sh
set -e
cd "$(dirname "$0")/.."
cargo run -q --manifest-path ../../Cargo.toml -p pet-schema > schema/pet.schema.json
node scripts/gen-types.mjs
