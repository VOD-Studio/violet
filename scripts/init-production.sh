#!/usr/bin/env bash
set -euo pipefail

# 从脚本位置确定项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# 检查并初始化 api/.env
if [ ! -f api/.env ]; then
    cp api/.env.example api/.env
    echo "⚠️  已创建 api/.env，请先编辑配置（特别是 POSTGRES_PASSWORD、SUPERADMIN_PASSWORD 等）"
    exit 0
fi

# 检查并初始化 web/.env.production
if [ ! -f web/.env.production ]; then
    cp web/.env.example web/.env.production
    echo "⚠️  已创建 web/.env.production，请先编辑生产环境配置"
    exit 0
fi

# 检查并生成 JWT 密钥对
if [ ! -f secrets/jwt_private_key.pem ] || [ ! -f secrets/jwt_public_key.pem ]; then
    mkdir -p secrets
    echo "🔑 生成 JWT 密钥对..."
    openssl ecparam -genkey -name prime256v1 -noout -out secrets/jwt_private_key.pem
    openssl ec -in secrets/jwt_private_key.pem -pubout -out secrets/jwt_public_key.pem
    chmod 600 secrets/jwt_private_key.pem
    chmod 644 secrets/jwt_public_key.pem
    echo "✅ JWT 密钥已生成: secrets/jwt_private_key.pem, secrets/jwt_public_key.pem"
fi

# 确保上传目录存在
mkdir -p uploads

echo "初始化完成"
echo "下一步："
echo "  docker compose --env-file api/.env -f docker-compose.prod.yml up -d --build"
