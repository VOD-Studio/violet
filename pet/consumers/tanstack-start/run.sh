#!/bin/sh
# 在仓库外安装 SDK tarball,构建并以生产模式运行 TanStack Start 应用,断言 SSR 与 hydration。
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)
trap 'kill $SRV 2>/dev/null; rm -rf "$WORK"' EXIT
"$HERE/../../packages/pet-sdk/build.sh"
(cd "$HERE/../../packages/pet-sdk" && pnpm pack --pack-destination "$WORK" >/dev/null)
cp -R "$HERE"/. "$WORK/app" 2>/dev/null || { mkdir "$WORK/app" && cp -R "$HERE"/. "$WORK/app"; }
cd "$WORK/app"
pnpm add -s @tanstack/react-start@^1.168.56 @tanstack/react-router@^1.170.38 react@^19.2.0 react-dom@^19.2.0 vite@^8.0.0 @vitejs/plugin-react@^6.0.1 "$WORK"/violet-pet-sdk-*.tgz
pnpm exec vite build >/dev/null
node serve.mjs >/dev/null 2>&1 & SRV=$!
i=0
until curl -sf localhost:4174/ >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -gt 50 ] && { echo "FAIL: server did not start within 10s"; exit 1; }
  sleep 0.2
done
SSR=$(curl -s localhost:4174/)
echo "$SSR" | grep -q '<p id="probe">not-initialised</p>' || { echo "FAIL: SSR rendered after init"; exit 1; }
echo "$SSR" | grep -q 'pet_wasm' && { echo "FAIL: SSR HTML references wasm"; exit 1; }
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
DOM=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=8000 --dump-dom http://localhost:4174/ 2>/dev/null)
echo "$DOM" | grep -q '<p id="pet">c5e7c006764443ae6dc69000f29bf4aa</p>' || { echo "FAIL: client did not hydrate to expected id"; exit 1; }
echo "PASS: SSR not-initialised, no wasm in SSR HTML, hydrated id matches native"
