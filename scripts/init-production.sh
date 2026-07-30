#!/usr/bin/env bash
set -euo pipefail

# 从脚本位置确定项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# 生产环境唯一 env 文件:根 .env(compose 插值与 api 容器 env_file 共用)
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  已从 .env.example 创建 .env"
    echo ""
    echo "⚠️  请编辑 .env 后再运行 make deploy-prod，特别是："
    echo "    - DATABASE_PASSWORD（数据库密码）"
    echo "    - CORS_ALLOWED_ORIGINS（真实域名，逗号分隔；prod compose 强制检查）"
    echo "    - SUPERADMIN_PASSWORD（首次部署创建管理员用，之后建议 SUPERADMIN_ENABLED=false）"
    echo "    - RESEND_API_KEY（邮件服务，可选）"
else
    echo "✓ .env 已存在"
fi

echo ""
echo "下一步："
echo "  make deploy-prod"
