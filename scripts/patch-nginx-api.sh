#!/usr/bin/env bash
set -euo pipefail

# patch-nginx-api.sh
# 为 xun.rua.plus 添加 /api/v1/ 反向代理到 blog-api
# nginx-proxy 通过 docker-gen 自动生成 default.conf，
# 本脚本在每次部署后 patch 配置并 reload nginx。
#
# 用法: ./scripts/patch-nginx-api.sh
#
# 工作原理:
# 1. 确保 nginx-proxy 加入 violet_network（可访问 blog-api）
# 2. 检查 default.conf 是否已包含 API 代理配置
# 3. 若未包含，在 xun.rua.plus HTTPS server block 的 location / 之前插入 API location 块
# 4. 验证配置语法并 reload nginx

NGINX_CONTAINER="nginx-proxy"
CONF_PATH="/etc/nginx/conf.d/default.conf"
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

# 自动检测 docker 或 podman
CONTAINER_CMD=""
if command -v docker >/dev/null 2>&1; then
    CONTAINER_CMD="docker"
elif command -v podman >/dev/null 2>&1; then
    CONTAINER_CMD="podman"
else
    echo "❌ 未找到 docker 或 podman"
    exit 1
fi

echo "🔧 检查 nginx-proxy 与 violet_network 的连接..."

# 确保 nginx-proxy 在 violet_network 上
if ! $CONTAINER_CMD network inspect violet_network 2>/dev/null | grep -q "$NGINX_CONTAINER"; then
    echo "  连接 nginx-proxy 到 violet_network..."
    $CONTAINER_CMD network connect violet_network "$NGINX_CONTAINER" 2>/dev/null || true
    echo "  ✅ 已连接"
else
    echo "  ✅ 已在 violet_network 中"
fi

# 检查博客服务是否在运行
echo "  使用 $CONTAINER_CMD 检查容器..."
if ! $CONTAINER_CMD inspect -f '{{.State.Running}}' blog-api 2>/dev/null | grep -q "true"; then
    echo "⚠️  blog-api 未运行，跳过 nginx patch"
    exit 0
fi

if ! $CONTAINER_CMD inspect -f '{{.State.Running}}' "$NGINX_CONTAINER" 2>/dev/null | grep -q "true"; then
    echo "❌ nginx-proxy 未运行"
    exit 1
fi

echo "📝 检查 nginx 配置是否需要 patch..."

# 下载当前配置
$CONTAINER_CMD exec "$NGINX_CONTAINER" cat "$CONF_PATH" > "$TMPFILE"

# 检查是否已经 patch 过
if grep -q 'proxy_pass http://blog-api' "$TMPFILE"; then
    echo "  ✅ nginx 已包含 API 代理配置"
    $CONTAINER_CMD exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null || true
    exit 0
fi

echo "  正在 patch nginx 配置..."

# 备份
$CONTAINER_CMD exec "$NGINX_CONTAINER" cp "$CONF_PATH" "${CONF_PATH}.bak" 2>/dev/null || true

# 策略：找到 xun.rua.plus HTTPS server block 中 location / { 所在行
# 在其前面插入 API location 块
# 使用 awk：维护状态机，只在正确的 server block 中操作

awk '
BEGIN { in_xun = 0; has_ssl = 0; patched = 0 }

# 重置 server 块状态
/^[[:space:]]*server[[:space:]]*\{/ { in_xun = 0; has_ssl = 0 }

# 进入 xun.rua.plus / xunrua.top server block
/^[[:space:]]*server_name[[:space:]]/ && /(xun\.rua\.plus|xunrua\.top)/ { in_xun = 1; has_ssl = 0 }

# 在 xun block 中检测 SSL
in_xun && /listen 443 ssl/ { has_ssl = 1 }

# 在 xun HTTPS block 中找到 location / { 并在其前面插入
in_xun && has_ssl && !patched && /^[[:space:]]*location[[:space:]]+\/[[:space:]]*\{/ {
    print "    location ^~ /api/v1/ {"
    print "        proxy_pass http://blog-api:9090/api/v1/;"
    print "        proxy_set_header Host $host;"
    print "        proxy_set_header X-Real-IP $remote_addr;"
    print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
    print "        proxy_set_header X-Forwarded-Proto $scheme;"
    print "        proxy_http_version 1.1;"
    print "        proxy_set_header Connection \"\";"
    print "    }"
    print ""
    patched = 1
}

{ print }
' "$TMPFILE" > "${TMPFILE}.new"

# 验证 patch 是否成功
if ! grep -q 'proxy_pass http://blog-api' "${TMPFILE}.new"; then
    echo "❌ Patch 失败：未能插入 API 代理配置"
    rm -f "${TMPFILE}.new"
    exit 1
fi

# 上传 patch 后的配置
$CONTAINER_CMD cp "${TMPFILE}.new" "$NGINX_CONTAINER:$CONF_PATH"
rm -f "${TMPFILE}.new"

# 验证配置语法
echo "  验证 nginx 配置语法..."
if $CONTAINER_CMD exec "$NGINX_CONTAINER" nginx -t 2>&1; then
    echo "  ✅ 配置语法正确"
    $CONTAINER_CMD exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null
    echo "  ✅ nginx 已 reload"
else
    echo "❌ 配置语法错误，回滚到备份..."
    $CONTAINER_CMD exec "$NGINX_CONTAINER" cp "${CONF_PATH}.bak" "$CONF_PATH" 2>/dev/null || true
    $CONTAINER_CMD exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null || true
    exit 1
fi

echo ""
echo "✅ nginx patch 完成"
echo "验证: curl -sk https://xunrua.top/api/v1/announcements"
