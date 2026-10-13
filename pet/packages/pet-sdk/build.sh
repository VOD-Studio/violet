#!/bin/sh
# 构建 SDK 发布产物:wasm-bindgen web target + 显式异步初始化入口。
set -e
cd "$(dirname "$0")"
cargo build --release -q -p pet-wasm --target wasm32-unknown-unknown --manifest-path ../../Cargo.toml
rm -rf dist && mkdir dist
wasm-bindgen --target web --out-dir dist ../../target/wasm32-unknown-unknown/release/pet_wasm.wasm
cp src/index.js dist/index.js
cp src/index.d.ts dist/index.d.ts
cp src/types.d.ts dist/types.d.ts
cp src/terminal.js src/terminal.d.ts dist/
cp ../../../LICENSE LICENSE
