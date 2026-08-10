#!/bin/bash
# 混合开发：后端套件（PostgreSQL + Redis + API）容器化运行，前端本地 Vite。
#
# 适用场景：本地无 Go 工具链但需前端 HMR 快速调试——后端依赖容器化保证环境
# 一致，前端本地跑获得秒级 HMR 与断点调试能力。前端 proxy 默认指向
# localhost:9090（api 容器映射端口），无需额外配置。
#
# 停止：Ctrl+C 仅退出前端进程，后端容器保持运行（-d 起的）；彻底停止用
# make docker-dev-down。后端改代码需热重载时另开 make docker-dev-watch。

set -e

echo "启动混合开发环境（后端容器 + 本地前端）..."

# 检查并创建 .env
if [ ! -f .env ]; then
  echo "⚠️  未找到 .env 文件，正在从 .env.example 创建..."
  cp .env.example .env
  echo "✅ 已创建 .env，请按需修改（特别是 DATABASE_PASSWORD）"
fi

# 启动后端套件（postgres + redis + api），--wait 阻塞至全部 healthcheck 通过
echo "启动后端套件（PostgreSQL + Redis + API），等待健康检查..."
docker compose -f docker-compose.dev.yml up -d --build --wait postgres redis api

echo ""
echo "后端套件已就绪:"
echo "  API:       http://localhost:9090"
echo "  PostgreSQL: localhost:5432"
echo "  Redis:     localhost:6379"
echo ""
echo "启动前端开发服务器（本地 Vite HMR）..."
echo "按 Ctrl+C 停止前端（后端容器保持运行）"
echo ""

# 前台运行前端，Ctrl+C 直接传递给它
cd web
pnpm dev
