#!/usr/bin/env bash
# 安装 Git 钩子到 .git/hooks/
#
# 用法: ./scripts/install-hooks.sh
#
# 将 scripts/hooks/ 下的钩子脚本符号链接（或复制）到 .git/hooks/，
# 使其可执行。首次 clone 仓库后运行一次即可。
#
# 设计理由：不依赖 husky（避免根目录 npm 环境问题），纯 shell 实现，
# 钩子内容纳入版本控制，团队成员运行此脚本即可启用。

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_SRC="$SCRIPT_DIR/hooks"
HOOKS_DST="$REPO_ROOT/.git/hooks"

echo "安装 Git 钩子到 $HOOKS_DST ..."

# 遍历源钩子，逐个安装
for hook_src in "$HOOKS_SRC"/*; do
	[ -f "$hook_src" ] || continue
	hook_name=$(basename "$hook_src")
	hook_dst="$HOOKS_DST/$hook_name"

	# 备份已存在的非符号链接钩子
	if [ -f "$hook_dst" ] && [ ! -L "$hook_dst" ]; then
		mv "$hook_dst" "$hook_dst.backup.$(date +%s)"
		echo "  已备份原有 $hook_name"
	fi

	# 创建符号链接（保持钩子可被版本控制更新）
	ln -sf "$hook_src" "$hook_dst"
	chmod +x "$hook_src"
	echo "  ✓ 已安装 $hook_name"
done

echo ""
echo "✅ Git 钩子安装完成"
echo "   pre-commit: 对暂存的 Go/TS 文件做格式与类型检查"
echo "   commit-msg: 校验 Conventional Commits 格式"
