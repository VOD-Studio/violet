#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'MESSAGE'
独立静态资源同步入口已停用。
请通过 Deploy 或 scripts/deploy-prod.sh 执行完整部署事务；事务会提前准备资源并保留旧 hash 文件。
参见 docs/deploy/release-runbook.md。
MESSAGE
exit 1
