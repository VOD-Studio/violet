#!/usr/bin/env bash
set -euo pipefail

# deploy-prod.sh
# 一键部署到生产环境
#
# 用法:
#   ./scripts/deploy-prod.sh                          # 完整部署到 rua
#   ./scripts/deploy-prod.sh --host xun               # 完整部署到 xun
#   ./scripts/deploy-prod.sh --skip-build              # 跳过本地构建
#   ./scripts/deploy-prod.sh --host xun --patch-only   # 仅 patch nginx 配置
#
# 前置条件:
#   1. 已配置 SSH 免密登录到目标服务器
#   2. 目标服务器上已运行 nginx-proxy + acme-companion

# ==================== 配置 ====================
REMOTE_HOST="rua"
REMOTE_DIR="/root/docker/mimo-blog"
COMPOSE_FILE="docker-compose.prod.yml"
IMAGE_FILE="images.tar.gz"
SKIP_BUILD=false
PATCH_ONLY=false

# ==================== 参数解析 ====================
while [[ $# -gt 0 ]]; do
    case "$1" in
        --host) REMOTE_HOST="$2"; shift 2 ;;
        --host=*) REMOTE_HOST="${1#*=}"; shift ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        --patch-only) PATCH_ONLY=true; shift ;;
        -h|--help)
            echo "用法: $0 [--host <host>] [--skip-build] [--patch-only]"
            echo "  --host <host>  目标服务器（SSH Host，默认: rua）"
            echo "  --skip-build   跳过本地构建，使用已有镜像"
            echo "  --patch-only   仅 patch nginx 配置"
            exit 0
            ;;
        *) echo "未知参数: $1"; exit 1 ;;
    esac
done

# ==================== 工具函数 ====================
info()  { echo -e "\033[36mℹ️  $*\033[0m"; }
ok()    { echo -e "\033[32m✅ $*\033[0m"; }
warn()  { echo -e "\033[33m⚠️  $*\033[0m"; }
err()   { echo -e "\033[31m❌ $*\033[0m"; exit 1; }

# ==================== 仅 patch nginx ====================
if [ "$PATCH_ONLY" = true ]; then
    info "仅 patch nginx 配置..."
    ssh "$REMOTE_HOST" "cd $REMOTE_DIR && bash scripts/patch-nginx-api.sh"
    ok "Nginx patch 完成"
    exit 0
fi

# ==================== 检查环境 ====================
info "检查环境..."

# 检查本地文件
[ -f "$COMPOSE_FILE" ] || err "未找到 $COMPOSE_FILE"
[ -f api/.env ] || err "未找到 api/.env（运行 make deploy-prod-init 初始化）"

# 检查 SSH 连接
ssh "$REMOTE_HOST" "echo ok" >/dev/null 2>&1 || err "无法连接到 $REMOTE_HOST"

# 检查远程目录
ssh "$REMOTE_HOST" "test -d $REMOTE_DIR" || err "远程目录 $REMOTE_DIR 不存在"

ok "环境检查通过"

# ==================== 构建镜像 ====================
if [ "$SKIP_BUILD" = false ]; then
    info "构建 Docker 镜像..."

    # 构建 API 镜像
    info "  构建 blog-api..."
    docker compose --env-file api/.env -f "$COMPOSE_FILE" build api

    # 构建 Web 镜像
    info "  构建 blog-web..."
    docker compose --env-file api/.env -f "$COMPOSE_FILE" build web

    # 保存镜像
    info "  保存镜像到 $IMAGE_FILE..."
    docker save \
        localhost/mimo-blog-api:latest \
        localhost/mimo-blog-web:latest \
        docker.io/library/postgres:16-alpine \
        docker.io/library/redis:7-alpine \
        | gzip > "$IMAGE_FILE"

    ok "镜像构建完成"
else
    info "跳过本地构建"
    [ -f "$IMAGE_FILE" ] || err "未找到 $IMAGE_FILE"
fi

# ==================== 传输到服务器 ====================
info "传输镜像到 $REMOTE_HOST..."
scp "$IMAGE_FILE" "$REMOTE_HOST:$REMOTE_DIR/$IMAGE_FILE"
ok "镜像传输完成"

# ==================== 传输部署脚本 ====================
info "传输部署文件..."
scp scripts/patch-nginx-api.sh "$REMOTE_HOST:$REMOTE_DIR/scripts/patch-nginx-api.sh"
scp docker-compose.prod.yml "$REMOTE_HOST:$REMOTE_DIR/docker-compose.yml"
ok "部署文件传输完成"

# ==================== 远程部署 ====================
info "在服务器上部署..."

ssh "$REMOTE_HOST" bash -s << 'REMOTE_SCRIPT'
set -euo pipefail

cd /root/docker/mimo-blog

echo "📦 导入镜像..."
podman load -i images.tar.gz 2>/dev/null || docker load -i images.tar.gz

echo "🔄 重启服务..."
# 使用 podman-compose 或 docker-compose
if command -v podman-compose >/dev/null 2>&1; then
    COMPOSE_CMD="podman-compose"
else
    COMPOSE_CMD="docker compose"
fi

# 停止旧服务
$COMPOSE_CMD down 2>/dev/null || true

# 启动新服务（使用 .env 文件）
$COMPOSE_CMD --env-file .env up -d

echo "⏳ 等待服务健康..."
for i in $(seq 1 30); do
    if $COMPOSE_CMD ps 2>/dev/null | grep -q "healthy"; then
        break
    fi
    sleep 2
done

# 检查服务状态
echo ""
echo "📊 服务状态:"
$COMPOSE_CMD ps

REMOTE_SCRIPT

ok "服务部署完成"

# ==================== Patch nginx ====================
info "Patch nginx 配置..."
ssh "$REMOTE_HOST" "cd $REMOTE_DIR && bash scripts/patch-nginx-api.sh"

# ==================== 验证 ====================
info "验证部署..."

# 尝试多个可能的域名
for domain in "$REMOTE_HOST.rua.plus" "xunrua.top" "xun.rua.plus"; do
    if ssh "$REMOTE_HOST" "curl -sk \"https://$domain/api/v1/announcements\"" 2>/dev/null | grep -q '"data"'; then
        ok "API 可通过 https://$domain/api/v1/ 访问"
        DEPLOY_DOMAIN="$domain"
        break
    fi
done

if [ -z "${DEPLOY_DOMAIN:-}" ]; then
    warn "API 访问验证失败，请手动检查"
fi

echo ""
ok "🎉 部署完成！"
