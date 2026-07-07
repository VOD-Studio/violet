#!/usr/bin/env bash
set -euo pipefail

# sync-client.sh
# 把 blog-web 容器内的 dist/client/ 同步到 nginx-proxy 共享目录，
# 让 nginx 直接服务静态资源（/assets/*、manifest.json、favicon 等）。
#
# 何时运行：每次重新部署 blog-web（重建容器）之后必须执行一次，
# 否则 nginx 服务的还是旧版本静态资源（hash 不匹配会 404）。
#
# 前置条件：
#   1. nginx-proxy 容器已挂载 ./blog-client:/var/www/blog-client:ro
#   2. vhost.d/xunrua.top 已配置静态资源 location（见部署文档「静态资源部署」）
#
# 用法：
#   ./scripts/sync-client.sh              # 默认远程主机 xunrua.top
#   ./scripts/sync-client.sh --host rua   # 指定其他 SSH host

REMOTE_HOST="xunrua.top"
SHARED_DIR="/root/docker/nginx-proxy/blog-client"
WEB_CONTAINER="blog-web"
CLIENT_PATH="/app/dist/client"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --host) REMOTE_HOST="$2"; shift 2 ;;
        -h|--help)
            echo "用法: $0 [--host <ssh-host>]"
            echo "  把 blog-web 容器的 dist/client 同步到 nginx-proxy 共享目录"
            exit 0
            ;;
        *) echo "未知参数: $1"; exit 1 ;;
    esac
done

info() { echo -e "\033[36mℹ️  $*\033[0m"; }
ok()   { echo -e "\033[32m✅ $*\033[0m"; }
err()  { echo -e "\033[31m❌ $*\033[0m"; exit 1; }

info "检查 $REMOTE_HOST 上 $WEB_CONTAINER 容器..."
ssh "$REMOTE_HOST" "podman inspect -f '{{.State.Running}}' $WEB_CONTAINER 2>/dev/null" | grep -q true \
    || err "$WEB_CONTAINER 未运行，请先部署 web"

info "清空共享目录 $SHARED_DIR ..."
ssh "$REMOTE_HOST" "rm -rf $SHARED_DIR/* && mkdir -p $SHARED_DIR"

info "从 $WEB_CONTAINER:$CLIENT_PATH 复制到 $SHARED_DIR ..."
ssh "$REMOTE_HOST" "podman cp $WEB_CONTAINER:$CLIENT_PATH/. $SHARED_DIR/"

info "同步结果："
ssh "$REMOTE_HOST" "ls $SHARED_DIR | head -10; echo \"... 共 \$(ls $SHARED_DIR | wc -l) 个条目\""

ok "静态资源同步完成"
echo ""
info "验证："
echo "  curl -sk -o /dev/null -w '%{http_code}' https://xunrua.top/manifest.json   # 应为 200"
echo "  curl -sk https://xunrua.top/ | grep -oE '/assets/styles-[^\"]+\\.css'       # 取一个 asset 名"
