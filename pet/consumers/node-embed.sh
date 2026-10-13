#!/bin/sh
# 把 SDK tarball 装进仓库外的"宿主"应用,在真实 pty 中验证嵌入:宿主输入不被抢占,退出后终端状态干净。
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
"$HERE/../packages/pet-sdk/build.sh"
(cd "$HERE/../packages/pet-sdk" && pnpm pack --pack-destination "$WORK" >/dev/null)
mkdir "$WORK/app" && cp "$HERE/node-embed/host.mjs" "$WORK/app/" && cd "$WORK/app"
echo '{"name":"host","private":true,"type":"module"}' > package.json
CLEAN=$(echo "$PATH" | tr ':' '\n' | grep -v cargo | paste -sd: -)
env PATH="$CLEAN" pnpm add -s "$WORK"/violetjs-pet-*.tgz >/dev/null
# 非 TTY:不得输出任何控制码
printf 'hi\nquit\n' | env PATH="$CLEAN" node host.mjs | od -c | grep -q '033' && { echo "FAIL: escape codes on non-TTY"; exit 1; }
env PATH="$CLEAN" python3 "$HERE/node-embed/pty_test.py"
