#!/bin/sh
# schema 与类型声明必须与 Rust 类型同源:重新生成后不得与已有文件有差异;真实转录必须通过 schema 校验;类型测试必须编译。
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp schema/pet.schema.json "$TMP/schema.json"
cp src/types.d.ts "$TMP/types.d.ts"
./scripts/gen.sh
cmp -s schema/pet.schema.json "$TMP/schema.json" || { echo "FAIL: schema/pet.schema.json is stale; run scripts/gen.sh"; exit 1; }
cmp -s src/types.d.ts "$TMP/types.d.ts" || { echo "FAIL: src/types.d.ts is stale; run scripts/gen.sh"; exit 1; }
node scripts/validate-transcript.mjs
pnpm exec tsc -p tsconfig.typetest.json
echo "types OK: positive and negative type tests"
