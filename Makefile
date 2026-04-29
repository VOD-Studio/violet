# 博客项目 Makefile
# 使用: make help

.PHONY: help dev up down build migrate seed test lint clean

# 默认目标
help: ## 显示帮助信息
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ==================== 开发环境 ====================

dev: ## 一键启动完整开发环境
	@./dev.sh

up: ## 启动 Docker 服务 (PostgreSQL + Redis)
	docker compose up -d
	@echo "等待数据库就绪..."
	@sleep 3
	@echo "PostgreSQL: localhost:5432"
	@echo "Redis: localhost:6379"

down: ## 停止 Docker 服务
	docker compose down

restart: ## 重启 Docker 服务
	docker compose restart

logs: ## 查看 Docker 日志
	docker compose logs -f

# ==================== 数据库 ====================

migrate: ## 运行数据库迁移
	@echo "运行数据库迁移..."
	@for f in api/migrations/*.up.sql; do \
		echo "执行: $$f"; \
		docker compose exec -T postgres psql -U blog -d blog -f - < "$$f" 2>/dev/null || true; \
	done
	@echo "迁移完成"

migrate-down: ## 回滚数据库迁移
	@echo "回滚数据库迁移..."
	@for f in api/migrations/*.down.sql; do \
		echo "执行: $$f"; \
		docker compose exec -T postgres psql -U blog -d blog -f - < "$$f" 2>/dev/null || true; \
	done
	@echo "回滚完成"

reset-db: ## 重置数据库 (清空所有数据)
	@echo "重置数据库..."
	@for f in api/migrations/*.down.sql; do \
		docker compose exec -T postgres psql -U blog -d blog -f - < "$$f" 2>/dev/null || true; \
	done
	@for f in api/migrations/*.up.sql; do \
		docker compose exec -T postgres psql -U blog -d blog -f - < "$$f" 2>/dev/null || true; \
	done
	@echo "数据库已重置"

db-shell: ## 进入 PostgreSQL 命令行
	docker compose exec postgres psql -U blog -d blog

redis-shell: ## 进入 Redis 命令行
	docker compose exec redis redis-cli

# ==================== 后端 ====================

api: ## 启动 Go API 服务
	cd api && go run ./cmd/server

api-build: ## 编译 Go API
	cd api && go build -o bin/server ./cmd/server
	@echo "编译完成: api/bin/server"

api-test: ## 运行后端测试
	cd api && go test ./... -v

api-lint: ## 后端代码检查
	cd api && go vet ./...

sqlc: ## 生成 sqlc 代码
	cd api && sqlc generate
	@echo "sqlc 代码生成完成"

# ==================== 前端 ====================

web: ## 启动前端开发服务器
	cd web && npm run dev

web-build: ## 构建前端生产版本
	cd web && npm run build

web-preview: ## 预览前端构建结果
	cd web && npm run preview

web-lint: ## 前端代码检查
	cd web && npx biome check .

web-format: ## 前端代码格式化
	cd web && npx biome format --write .

web-typecheck: ## TypeScript 类型检查
	cd web && npx tsc --noEmit

# ==================== 构建 ====================

build: api-build web-build ## 构建前后端生产版本
	@echo "构建完成"

docker-build: ## 构建 Docker 镜像
	docker compose build

docker-up: ## Docker 生产模式启动
	docker compose -f docker-compose.yml up -d --build

# ==================== 工具 ====================

clean: ## 清理构建产物
	rm -rf api/bin
	rm -rf web/dist
	rm -rf web/node_modules/.vite
	@echo "清理完成"

install: ## 安装所有依赖
	cd api && go mod download
	cd web && npm install
	@echo "依赖安装完成"

update: ## 更新所有依赖
	cd api && go get -u ./... && go mod tidy
	cd web && npm update
	@echo "依赖更新完成"

# ==================== Git ====================

status: ## 查看 Git 状态
	git status

log: ## 查看最近提交
	git log --oneline -10

# ==================== 环境 ====================

env: ## 复制环境变量模板
	@test -f .env || (cp .env.example .env && echo "已创建 .env") || echo ".env 已存在"

check: ## 检查环境依赖
	@echo "检查环境依赖..."
	@command -v go >/dev/null 2>&1 && echo "✓ Go $$(go version | cut -d' ' -f3)" || echo "✗ Go 未安装"
	@command -v node >/dev/null 2>&1 && echo "✓ Node $$(node -v)" || echo "✗ Node 未安装"
	@command -v docker >/dev/null 2>&1 && echo "✓ Docker $$(docker -v | cut -d' ' -f3 | tr -d ',')" || echo "✗ Docker 未安装"
	@command -v psql >/dev/null 2>&1 && echo "✓ PostgreSQL 客户端" || echo "✗ psql 未安装"
	@command -v redis-cli >/dev/null 2>&1 && echo "✓ Redis 客户端" || echo "✗ redis-cli 未安装"
