# 博客项目 Makefile
# 使用: make help

.PHONY: help dev up down restart logs \
        migrate migrate-down migrate-version reset-db db-shell redis-shell \
        api api-build api-test api-lint sqlc wire \
        web web-build web-preview web-lint web-format web-typecheck \
        build docker-build docker-up \
        clean install update \
        status log \
        env setup generate-jwt-keys generate-production-keys \
        check

# 默认目标
help: ## 显示帮助信息
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ==================== 开发环境 ====================

dev: ## 一键启动完整开发环境
	@./dev.sh

up: ## 启动 Docker 服务 (PostgreSQL + Redis)
	@if [ ! -f .env ]; then echo "⚠️  缺少 .env 文件，运行 make env 创建"; exit 1; fi
	docker compose up -d postgres redis
	@echo "等待数据库就绪..."
	@until docker compose exec -T postgres pg_isready -U "$$(grep '^DATABASE_USER=' .env | cut -d= -f2)" -d "$$(grep '^DATABASE_NAME=' .env | cut -d= -f2)" >/dev/null 2>&1; do \
		echo "  等待中..."; sleep 1; \
	done
	@echo "✓ PostgreSQL: localhost:5432"
	@echo "✓ Redis: localhost:6379"

down: ## 停止 Docker 服务
	docker compose down

restart: ## 重启 Docker 服务
	docker compose restart

logs: ## 查看 Docker 日志
	docker compose logs -f

# ==================== 数据库 ====================

migrate: ## 执行数据库迁移 (golang-migrate)
	cd api && go run ./cmd/migrate up

migrate-down: ## 回滚最近一次迁移 (make migrate-down n=3 回滚多次)
	cd api && go run ./cmd/migrate down -n $(or $(n),1)

migrate-version: ## 查看当前迁移版本
	cd api && go run ./cmd/migrate version

reset-db: ## 重置数据库 (回滚全部后重新迁移，⚠️ 清空数据)
	@echo "⚠️  即将清空所有数据，3 秒后开始 (Ctrl+C 取消)..."
	@sleep 3
	cd api && go run ./cmd/migrate goto 0
	cd api && go run ./cmd/migrate up
	@echo "✓ 数据库已重置"

db-shell: ## 进入 PostgreSQL 命令行
	@docker compose exec postgres psql -U "$$(grep '^DATABASE_USER=' .env | cut -d= -f2)" -d "$$(grep '^DATABASE_NAME=' .env | cut -d= -f2)"

redis-shell: ## 进入 Redis 命令行
	@docker compose exec redis sh -c 'if [ -n "$$REDIS_PASSWORD ]; then redis-cli -a "$$REDIS_PASSWORD"; else redis-cli; fi'

# ==================== 后端 ====================

api: ## 启动 Go API 服务
	@if [ ! -f .env ]; then \
		echo "⚠️  未找到 .env 文件，正在创建..."; \
		cp .env.example .env; \
	fi
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

wire: ## 生成 wire 依赖注入代码 (DDD app 层)
	cd api && go run github.com/google/wire/cmd/wire ./internal/app/
	@echo "wire 代码生成完成"

# ==================== 前端 ====================

web: ## 启动前端开发服务器
	cd web && npm run dev

web-build: ## 构建前端生产版本
	cd web && npm run build

web-preview: ## 预览前端构建结果
	cd web && npm run preview

web-lint: ## 前端代码检查 (Biome)
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

env: ## 复制配置文件模板
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ 已创建 .env (请修改 DATABASE_PASSWORD 等敏感配置)"; \
	else \
		echo "ℹ️  .env 已存在"; \
	fi
	@if [ ! -f api/config.yaml ]; then \
		cp api/config.example.yaml api/config.yaml 2>/dev/null || echo "ℹ️  api/config.example.yaml 不存在，跳过"; \
	else \
		echo "ℹ️  api/config.yaml 已存在"; \
	fi

setup: env ## 一键初始化项目（首次使用）
	@echo "🚀 初始化项目..."
	@if [ ! -f api/jwt_private_key.pem ]; then \
		$(MAKE) generate-jwt-keys; \
	fi
	@docker compose up -d postgres redis
	@echo "⏳ 等待数据库启动..."
	@until docker compose exec -T postgres pg_isready -U "$$(grep '^DATABASE_USER=' .env | cut -d= -f2)" -d "$$(grep '^DATABASE_NAME=' .env | cut -d= -f2)" >/dev/null 2>&1; do \
		sleep 1; \
	done
	@$(MAKE) migrate
	@echo "✅ 项目初始化完成！"
	@echo ""
	@echo "下一步："
	@echo "  1. 运行 'make dev' 启动开发服务器"
	@echo "  2. 访问 http://localhost:5173"

generate-jwt-keys: ## 生成 JWT 密钥对 (ES256)
	@echo "🔑 生成 JWT 密钥对..."
	@openssl ecparam -genkey -name prime256v1 -noout -out api/jwt_private_key.pem
	@openssl ec -in api/jwt_private_key.pem -pubout -out api/jwt_public_key.pem
	@chmod 600 api/jwt_private_key.pem
	@chmod 644 api/jwt_public_key.pem
	@echo "✅ JWT 密钥已生成: api/jwt_private_key.pem, api/jwt_public_key.pem"

generate-production-keys: ## 生成生产环境 JWT 密钥对
	@echo "🔑 生成生产环境 JWT 密钥对..."
	@mkdir -p secrets
	@openssl ecparam -genkey -name prime256v1 -noout -out secrets/jwt_private_key.pem
	@openssl ec -in secrets/jwt_private_key.pem -pubout -out secrets/jwt_public_key.pem
	@chmod 600 secrets/jwt_private_key.pem
	@chmod 644 secrets/jwt_public_key.pem
	@echo "✅ 生产环境 JWT 密钥已生成: secrets/jwt_private_key.pem, secrets/jwt_public_key.pem"
	@echo "⚠️  请妥善保管私钥文件，不要提交到版本控制"

check: ## 检查环境依赖
	@echo "检查环境依赖..."
	@command -v go >/dev/null 2>&1 && echo "✓ Go $$(go version | cut -d' ' -f3)" || echo "✗ Go 未安装"
	@command -v node >/dev/null 2>&1 && echo "✓ Node $$(node -v)" || echo "✗ Node 未安装"
	@command -v docker >/dev/null 2>&1 && echo "✓ Docker $$(docker -v | cut -d' ' -f3 | tr -d ',')" || echo "✗ Docker 未安装"
