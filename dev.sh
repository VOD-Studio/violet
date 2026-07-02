#!/bin/bash
# 本地开发启动脚本
# 启动 PostgreSQL + Redis 容器，运行数据库迁移，再并行启动前后端
# 数据库迁移由 API 服务启动时自动执行（见 internal/migrate）

set -e

echo "启动开发环境..."

# 检查并创建 .env 文件
if [ ! -f .env ]; then
  echo "⚠️  未找到 .env 文件，正在从 .env.example 创建..."
  cp .env.example .env
  echo "✅ 已创建 .env 文件，请根据需要修改配置（特别是 DATABASE_PASSWORD）"
fi

# 加载环境变量
set -a
source .env
set +a

# 启动 PostgreSQL 和 Redis
docker compose up -d postgres redis

# 等待数据库就绪（轮询替代脆弱的 sleep）
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

# 启动后端（启动时会自动执行数据库迁移）
echo "启动 Go API..."
cd api
go run ./cmd/server &
API_PID=$!
cd ..

# 启动前端
echo "启动前端开发服务器..."
cd web
pnpm dev &
WEB_PID=$!
cd ..

echo ""
echo "开发环境已启动:"
echo "  前端: http://localhost:5173"
echo "  API:  http://localhost:9090"
echo "  数据库: localhost:5432"
echo "  Redis: localhost:6379"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待子进程，退出时清理
trap "kill $API_PID $WEB_PID 2>/dev/null; echo '已停止服务'" EXIT
wait
