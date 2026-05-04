#!/bin/bash
# 本地开发启动脚本

set -e

echo "启动开发环境..."

# 检查并创建 .env 文件
if [ ! -f .env ]; then
	echo "⚠️  未找到 .env 文件，正在从 .env.example 创建..."
	cp .env.example .env
	echo "✅ 已创建 .env 文件，请根据需要修改配置"
fi

# 加载环境变量
set -a
source .env
set +a

# 启动 PostgreSQL 和 Redis
docker compose up -d postgres redis

echo "等待数据库就绪..."
sleep 3

# 运行数据库迁移
echo "运行数据库迁移..."
cd api
for f in migrations/*.up.sql; do
  docker compose exec -T postgres psql -U blog -d blog -f - < "$f" 2>/dev/null || true
done
cd ..

echo "数据库迁移完成"

# 启动后端
echo "启动 Go API..."
cd api
go run ./cmd/server &
API_PID=$!
cd ..

# 启动前端
echo "启动前端开发服务器..."
cd web
npm run dev &
WEB_PID=$!
cd ..

echo ""
echo "开发环境已启动:"
echo "  前端: http://localhost:5173"
echo "  API:  http://localhost:8080"
echo "  数据库: localhost:5432"
echo "  Redis: localhost:6379"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待子进程
trap "kill $API_PID $WEB_PID 2>/dev/null; docker compose down" EXIT
wait
