# 博客项目 Makefile
# 使用: make help

.PHONY: help dev up down restart logs \
        migrate migrate-down migrate-version reset-db db-shell redis-shell \
        api api-build api-test api-lint sqlc wire \
        web web-build web-preview web-lint web-format web-typecheck \
        build docker-build docker-up \
        deploy-prod-init deploy-prod deploy-prod-down \
        deploy-remote deploy-remote-skip-build deploy-remote-patch \
        deploy-ci rollback \
        release release-patch release-minor release-major \
        clean install update \
        status log \
        env setup \
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
	cd api && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/server ./cmd/server
	@echo "编译完成: api/bin/server"

api-test: ## 运行后端测试
	cd api && go test ./... -v

api-lint: ## 后端代码检查 (golangci-lint 优先，不可用则回退 go vet)
	@cd api && if command -v golangci-lint >/dev/null 2>&1; then \
		echo "运行 golangci-lint..."; \
		golangci-lint run ./...; \
	else \
		echo "⚠️  golangci-lint 未安装，回退到 go vet (建议: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest)"; \
		go vet ./...; \
	fi

sqlc: ## 生成 sqlc 代码
	cd api && sqlc generate
	@echo "sqlc 代码生成完成"

wire: ## 生成 wire 依赖注入代码 (DDD app 层)
	cd api && go run github.com/google/wire/cmd/wire ./internal/app/
	@echo "wire 代码生成完成"

apifox: ## 生成 OpenAPI 文档并导入到 Apifox
	@echo "生成并上传 OpenAPI 文档到 Apifox..."
	cd api && go run ./cmd/export-openapi/main.go && apifox import --project 8484856 --format openapi --file ./openapi.json
	@echo "Apifox 更新完成"

# ==================== 前端 ====================

web: ## 启动前端开发服务器
	cd web && pnpm dev

web-build: ## 构建前端生产版本
	cd web && pnpm build

web-preview: ## 预览前端构建结果
	cd web && pnpm preview

web-lint: ## 前端代码检查 (Biome)
	cd web && npx biome check .

web-format: ## 前端格式化与 lint 自动修复（biome check --write，与 web-lint 配对）
	cd web && npx biome check --write .

web-typecheck: ## TypeScript 类型检查
	cd web && pnpm typecheck

web-test: ## 运行前端单元测试 (Vitest)
	cd web && pnpm test

# ==================== mimo-music（音乐解析服务） ====================

# 仓库根目录的绝对路径(按 Makefile 自身位置识别,与开发者 clone 位置无关)。
MIMO_ROOT := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))

music: ## 启动 mimo-music 音乐服务
	cd mimo-music && go run ./cmd/server

music-worker: ## 启动 mimo-music worker（Cookie 健康检查等异步任务）
	cd mimo-music && go run ./cmd/worker

music-build: ## 编译 mimo-music
	cd mimo-music && go build -o ./bin/server ./cmd/server
	@echo "编译完成: mimo-music/bin/server"

musicctl-install: ## 安装/更新 musicctl 到 ~/go/bin(代码变更后重跑一次即可)
	cd mimo-music && go install ./cmd/musicctl/
	@echo "已安装: $$(go env GOPATH)/bin/musicctl"

musicctl-uninstall: ## 卸载全局 musicctl
	rm -f $$(go env GOPATH)/bin/musicctl
	@echo "已卸载"

musicctl-alias: ## 写入 musicctl-dev alias 到 ~/.zshrc(仓库路径自动识别,已存在则跳过)
	@if grep -q "alias musicctl-dev=" ~/.zshrc 2>/dev/null; then \
		echo "alias musicctl-dev 已存在,跳过"; \
	else \
		echo "alias musicctl-dev='go run -C $(MIMO_ROOT)/mimo-music ./cmd/musicctl'" >> ~/.zshrc; \
		echo "已写入 ~/.zshrc,执行 source ~/.zshrc 生效"; \
	fi

music-test: ## 运行 mimo-music 测试
	cd mimo-music && go test ./...

music-lint: ## mimo-music 代码检查
	cd mimo-music && golangci-lint run ./... 2>/dev/null || go vet ./...

music-openapi: ## 生成 mimo-music OpenAPI 文档
	cd mimo-music && go run ./cmd/export-openapi/
	@echo "OpenAPI spec 已导出到 mimo-music/openapi.json"

music-apifox: ## 生成 mimo-music OpenAPI 文档并导入到 Apifox
	@echo "生成并导入 mimo-music OpenAPI 文档到 Apifox..."
	cd mimo-music && go run ./cmd/export-openapi/ && apifox import --project __PROJECT_ID__ --format openapi --file ./openapi.json
	@echo "mimo-music Apifox 更新完成"

# ==================== 构建 ====================

build: api-build web-build ## 构建前后端生产版本
	@echo "构建完成"

docker-build: ## 构建 Docker 镜像
	docker compose build

docker-up: ## Docker 生产模式启动
	docker compose -f docker-compose.yml up -d --build

deploy-prod-init: ## 生产环境首次初始化（从模板生成 .env）
	@./scripts/init-production.sh

deploy-prod: deploy-prod-init ## 构建并启动生产环境容器
	@docker compose --env-file api/.env -f docker-compose.prod.yml up -d --build

deploy-prod-build: ## 只构建生产环境镜像，不运行容器
	@docker compose --env-file api/.env -f docker-compose.prod.yml build

deploy-prod-down: ## 停止生产环境容器
	@docker compose --env-file api/.env -f docker-compose.prod.yml down

deploy-prod-ps: ## 查看生产环境容器状态
	@docker compose --env-file api/.env -f docker-compose.prod.yml ps

deploy-prod-logs: ## 查看生产环境容器日志
	@docker compose --env-file api/.env -f docker-compose.prod.yml logs -f

# ==================== 远程部署 (rua) ====================

deploy-remote: ## 完整部署到 rua 服务器（构建 + 传输 + 启动 + nginx patch）
	@./scripts/deploy-prod.sh

deploy-remote-skip-build: ## 部署到 rua（跳过构建，使用已有镜像）
	@./scripts/deploy-prod.sh --skip-build

deploy-remote-patch: ## 仅 patch rua 上的 nginx 配置
	@./scripts/deploy-prod.sh --patch-only

# ==================== CI/CD 触发 (gh CLI) ====================

deploy-ci: ## 手动触发 deploy 工作流部署最新代码，需 gh CLI 已登录
	@command -v gh >/dev/null 2>&1 || { echo "✗ 需安装并登录 gh CLI"; exit 1; }
	gh workflow run deploy.yml
	@echo "✅ 已触发 deploy 工作流，查看: gh run list --workflow=deploy.yml"

rollback: ## 回滚到历史版本，用法: make rollback v=v2.0.0
	@if [ -z "$(v)" ]; then echo "用法: make rollback v=v2.0.0"; exit 1; fi
	@command -v gh >/dev/null 2>&1 || { echo "✗ 需安装并登录 gh CLI"; exit 1; }
	gh workflow run deploy.yml -f version=$(v) -f skip_build=true
	@echo "✅ 已触发回滚到 $(v)，查看: gh run list --workflow=deploy.yml"

# ==================== 发版 (tag → 触发部署) ====================

release: ## 发版，显式指定版本: make release v=v2.0.1
	@if [ -z "$(v)" ]; then echo "用法: make release v=v2.0.1 或 make release-patch/minor/major"; exit 1; fi
	@./scripts/release.sh --version "$(v)"

release-patch: ## 发补丁版，从最近 tag 自动 +1: make release-patch
	@./scripts/release.sh --bump patch

release-minor: ## 发次版本，从最近 tag 自动 +1: make release-minor
	@./scripts/release.sh --bump minor

release-major: ## 发主版本，从最近 tag 自动 +1: make release-major
	@./scripts/release.sh --bump major

# ==================== 工具 ====================

clean: ## 清理构建产物
	rm -rf api/bin
	rm -rf web/dist
	rm -rf web/node_modules/.vite
	@echo "清理完成"

install: ## 安装所有依赖 (后端 go mod download + 前端 pnpm install)
	cd api && go mod download
	cd web && pnpm install
	@echo "依赖安装完成"

update: ## 更新所有依赖
	cd api && go get -u ./... && go mod tidy
	cd web && pnpm update
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

check: ## 检查环境依赖
	@echo "检查环境依赖..."
	@command -v go >/dev/null 2>&1 && echo "✓ Go $$(go version | cut -d' ' -f3)" || echo "✗ Go 未安装"
	@command -v node >/dev/null 2>&1 && echo "✓ Node $$(node -v)" || echo "✗ Node 未安装"
	@command -v docker >/dev/null 2>&1 && echo "✓ Docker $$(docker -v | cut -d' ' -f3 | tr -d ',')" || echo "✗ Docker 未安装"
