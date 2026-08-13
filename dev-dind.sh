#!/bin/bash
# 容器内开发启动脚本（Docker-in-Docker）
#
# 适用场景：在 Docker 容器内开发（如 coder / code-server / OMP）。
# 与 dev.sh 的差异：数据库容器跑在宿主机上，经 host.docker.internal 访问，
# 而非容器自己的 localhost。
#
# 前置条件：
#   - docker.sock 可访问（已加入 docker 组或 chgrp 修复）
#   - 已执行 cp .env.example .env（含密码等基础配置）
#   - 已执行 cp .env.docker-dev.example .env.docker-dev（host 覆盖）

set -e

echo "启动容器内开发环境..."

# 确保基础配置存在
if [ ! -f .env ]; then
  echo "⚠️  未找到 .env，从 .env.example 创建..."
  cp .env.example .env
  echo "✅ 已创建 .env (请修改 DATABASE_PASSWORD 等敏感配置)"
fi

# 加载容器开发覆盖配置（host.docker.internal 等）
# 以进程环境变量注入，优先级高于 .env，config.Load 读取时自动覆盖 localhost
if [ -f .env.docker-dev ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.docker-dev
  set +a
  echo "✓ 已加载 .env.docker-dev 覆盖 (DATABASE_HOST=${DATABASE_HOST})"
else
  echo "ℹ️  未找到 .env.docker-dev，使用 .env 默认配置（localhost）"
fi

# 从根 .env 提取数据库连接参数（仅供 pg_isready）
DATABASE_USER=$(grep '^DATABASE_USER=' .env | cut -d= -f2-)
DATABASE_NAME=$(grep '^DATABASE_NAME=' .env | cut -d= -f2-)

# 启动 PostgreSQL 和 Redis（容器跑在宿主机 Docker 上，端口绑定到宿主 loopback）
docker compose up -d postgres redis

# 等待数据库就绪（经 host.docker.internal 连宿主 loopback）
echo "等待数据库就绪..."
MAX_WAIT=30
WAITED=0
until docker compose exec -T postgres pg_isready -U "${DATABASE_USER}" -d "${DATABASE_NAME}" >/dev/null 2>&1; do
  WAITED=$((WAITED + 1))
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "❌ 数据库 ${MAX_WAIT}s 内未就绪，请检查 docker compose logs postgres"
    exit 1
  fi
  sleep 1
done
echo "✓ 数据库已就绪 (等待 ${WAITED}s)"

# 启动后端（启动时会自动执行数据库迁移；host 已由环境变量覆盖）
echo "启动 Go API (支持热更新)..."
cd api
if command -v air >/dev/null 2>&1; then
  air &
else
  go run github.com/air-verse/air@latest &
fi
API_PID=$!
cd ..

# 启动前端
echo "启动前端开发服务器..."
cd web
pnpm dev &
WEB_PID=$!
cd ..

echo ""
echo "容器内开发环境已启动:"
echo "  前端: http://localhost:5173"
echo "  API:  http://localhost:9090"
echo "  数据库: ${DATABASE_HOST:-localhost}:5432"
echo "  Redis: ${REDIS_HOST:-localhost}:6379"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待子进程，退出时清理
trap "kill $API_PID $WEB_PID 2>/dev/null; echo '已停止服务'" EXIT
wait
