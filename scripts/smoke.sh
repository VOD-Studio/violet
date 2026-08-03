#!/usr/bin/env bash
# 跨组件冒烟：验证线上 web 与 api 的联通与渲染。
# 版本无关：只校验「端点可用 + SSR 渲染出页面」，不校验具体业务字段，
# 避免脚本随发版漂移。部署流程（deploy-api job）在任意目录执行均可——
# compose 文件用绝对路径，不依赖调用方 cwd。
set -euo pipefail

COMPOSE=(docker compose -f /root/docker/violet/docker-compose.prod.yml -f /root/docker/violet/docker-compose.ci.yml)

# 1. api 健康端点
for i in $(seq 1 15); do
  if "${COMPOSE[@]}" exec -T api wget -qO- http://localhost:9090/api/health 2>/dev/null | grep -q '"status":"ok"'; then
    echo "冒烟 [1/3] api 健康检查通过（第 ${i} 次尝试）"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "::error::冒烟失败: api 健康检查未在超时内通过"
    exit 1
  fi
  sleep 6
done

# 2. 公开业务端点（前台文章列表）返回 JSON
for i in $(seq 1 10); do
  BODY=$("${COMPOSE[@]}" exec -T api wget -qO- http://localhost:9090/api/v1/posts/ 2>/dev/null || true)
  if printf '%s' "$BODY" | grep -qE '^[\[{]'; then
    echo "冒烟 [2/3] 公开 posts 端点返回 JSON（第 ${i} 次尝试）"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "::error::冒烟失败: /api/v1/posts/ 未返回 JSON"
    exit 1
  fi
  sleep 6
done

# 3. web SSR 渲染（首页出 <title> 即视为可渲染）
for i in $(seq 1 15); do
  if "${COMPOSE[@]}" exec -T web wget -qO- http://127.0.0.1:3000/ 2>/dev/null | grep -q '<title>'; then
    echo "冒烟 [3/3] web SSR 渲染通过（第 ${i} 次尝试）"
    exit 0
  fi
  if [ "$i" -eq 15 ]; then
    echo "::error::冒烟失败: web SSR 渲染异常，疑似 api 契约不兼容"
    exit 1
  fi
  sleep 6
done
