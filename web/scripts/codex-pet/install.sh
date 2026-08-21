#!/usr/bin/env bash
# 堇喵 Codex 桌宠一键导出+安装(issue #248)
# 用法: web/scripts/codex-pet/install.sh [--uninstall]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PET_ID="jin-miao"
CODEX_PETS="${CODEX_HOME:-$HOME/.codex}/pets"
TARGET="$CODEX_PETS/$PET_ID"

if [[ "${1:-}" == "--uninstall" ]]; then
	rm -rf "$TARGET"
	echo "已卸载 $TARGET"
	exit 0
fi

# 前置:dev server(引擎源经 Vite 转译)
if ! curl -sf -o /dev/null http://localhost:5173/; then
	echo "错误: dev server 未运行(先 make docker-dev)" >&2
	exit 1
fi

echo "[1/2] 导出 spritesheet..."
(cd "$SCRIPT_DIR" && bun export-spritesheet.mjs)

echo "[2/2] 安装到 $TARGET ..."
mkdir -p "$TARGET"
cp "$SCRIPT_DIR/dist/spritesheet.webp" "$SCRIPT_DIR/dist/pet.json" "$TARGET/"
echo "完成。Codex → Settings → Pets 选择 堇喵 (Jin-Miao)。卸载: $0 --uninstall"
