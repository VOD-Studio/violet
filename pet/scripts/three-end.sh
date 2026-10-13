#!/bin/sh
# 同一场景在原生 CLI、Node WebAssembly、web target 下的转录必须逐字节一致。
set -e
cd "$(dirname "$0")/.."
cargo build --release -q -p pet-cli
cargo build --release -q -p pet-wasm --target wasm32-unknown-unknown
W=target/wasm32-unknown-unknown/release/pet_wasm.wasm
wasm-bindgen --target nodejs --out-dir target/pkg-node "$W"
wasm-bindgen --target web --out-dir target/pkg-web "$W"
node scenario/run.mjs native > target/out-native.txt
node scenario/run.mjs wasm "$PWD/scenario/node-cjs.mjs" > target/out-node.txt 2>/dev/null
node scenario/run.mjs wasm "$PWD/scenario/web-wasm.mjs" > target/out-web.txt 2>/dev/null
cmp target/out-native.txt target/out-node.txt && cmp target/out-native.txt target/out-web.txt
echo "three-end OK: $(wc -l < target/out-native.txt) lines, sha256 $(shasum -a 256 target/out-native.txt | cut -c1-16)"
