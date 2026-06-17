# mimo-blog

> 全栈博客平台 · Go 后端 + React 前端

一个功能完整的现代博客系统，支持文章管理、音乐播放、评论互动、Emoji 表情、项目管理、权限控制等。

## 技术栈

### 后端 (`api/`)
| 类别 | 选型 |
|------|------|
| 语言 | Go 1.25 |
| 路由 | chi v5 |
| 数据库 | PostgreSQL 16 + sqlc（P2 迁移至 GORM）+ golang-migrate |
| 缓存 | Redis 7 |
| 认证 | JWT (ES256 非对称签名) |
| 日志 | zerolog (结构化) |
| 依赖注入 | google/wire |
| 架构 | DDD 四层 (domain/application/infrastructure/interfaces)，P1 重构进行中 |

### 前端 (`web/`)
| 类别 | 选型 |
|------|------|
| 框架 | React 19 + TypeScript (strict) |
| 构建 | Vite |
| 状态 | Zustand + TanStack Query v5 |
| 样式 | Tailwind CSS v4 |
| UI | Radix UI / Base UI (shadcn 风格) |
| 表单 | React Hook Form + Zod |
| 富文本 | TipTap |
| 代码检查 | Biome |

### 基础设施
- Docker Compose (开发 + 生产编排)
- Nginx 反向代理

## 架构概览

```
blog-project/
├── api/                    Go 后端服务
│   ├── cmd/
│   │   ├── server/         API 服务入口
│   │   └── migrate/        数据库迁移 CLI
│   ├── internal/
│   │   ├── domain/         领域层 (DDD 聚合、值对象、事件) ← P1 新增
│   │   ├── application/    应用层 (用例编排、CQRS) ← P1 新增
│   │   ├── infrastructure/ 基础设施层 (GORM/事件总线实现) ← P1 新增
│   │   ├── interfaces/     接口层 (HTTP handler/中间件) ← P1 新增
│   │   ├── app/            依赖注入 (wire) ← P1 新增
│   │   ├── handler/        旧分层 HTTP handler (P2 迁移中)
│   │   ├── service/        旧分层业务服务 (P2 迁移中)
│   │   ├── repository/     旧数据层 (P2 迁移中)
│   │   └── middleware/     HTTP 中间件
│   ├── migrations/         数据库迁移 (golang-migrate)
│   └── config/             配置管理 (Viper)
├── web/                    React 前端应用
├── docs/                   项目文档
├── nginx/                  Nginx 配置
├── scripts/                工具脚本 (Git 钩子等)
├── docker-compose.yml      开发环境编排
└── docker-compose.prod.yml 生产环境编排
```

> **重构说明**：项目正在进行 DDD 架构重构（P0-P3 分阶段）。当前新旧代码并存：
> - 新 DDD 结构在 `internal/{domain,application,infrastructure,interfaces}`
> - 旧分层在 `internal/{handler,service,repository}`
> - P2 阶段逐模块迁移，最终旧代码全部删除

## 快速开始

### 环境要求
- Go 1.25+
- Node.js 20+ 与 **pnpm**（前端包管理器，`npm install -g pnpm` 安装）
- Docker & Docker Compose

### 初始化
```bash
# 1. 复制环境变量模板 (务必修改 DATABASE_PASSWORD 等敏感配置)
make env

# 2. 一键初始化 (生成 JWT 密钥、启动数据库、运行迁移)
make setup

# 3. 启动开发环境 (前后端并行)
make dev
```

启动后：
- 前端: http://localhost:5173
- 后端 API: http://localhost:8080
- 健康检查: http://localhost:8080/api/health

## 生产部署

一键部署命令：

```bash
make deploy-prod
```

### 前置条件

- 已安装 Docker 与 Docker Compose
- 首次部署前运行 `make deploy-prod-init`，从模板创建 `api/.env` 和 `web/.env.production`，并生成 JWT 密钥
- 编辑 `api/.env`，确保以下变量已设置：
  - **必填项（会被 compose 和 API 使用）**：`POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_DB`、`SUPERADMIN_PASSWORD`
  - 其他数据库/Redis 配置（如 `DATABASE_HOST`、`DATABASE_PORT` 等）会被 `docker-compose.prod.yml` 自动覆盖为内部 Docker 网络地址，首次部署可保持默认
- **务必修改 `POSTGRES_PASSWORD` 和 `SUPERADMIN_PASSWORD`**，不要使用默认值；首次部署后建议将 `SUPERADMIN_ENABLED` 设为 `false` 或修改 `SUPERADMIN_PASSWORD`
- 确保服务器 **80 端口**空闲

### 架构图

```
http://localhost
       │
       ▼
   ┌───────┐
   │  web  │ (Nginx + React 静态资源)
   └───┬───┘
       │ /api/* /uploads/*
       ▼
   ┌───────┐
   │  api  │ (Go + chi)
   └───┬───┘
       │
   ┌───┴───┐
   ▼       ▼
postgres  redis
```

### 常用命令

```bash
make deploy-prod-init   # 首次初始化（生成环境文件与 JWT 密钥）
make deploy-prod        # 构建并启动生产环境容器
make deploy-prod-down   # 停止生产环境容器
```

### 文件变更摘要

- `docker-compose.prod.yml` 统一部署 PostgreSQL、Redis、API 与前端 Nginx
- JWT 密钥从 `secrets/` 目录挂载到 API 容器

## 常用命令

```bash
make help           # 查看所有可用命令

# 开发
make dev            # 启动完整开发环境
make up             # 仅启动 PostgreSQL + Redis
make logs           # 查看日志

# 数据库
make migrate        # 执行迁移
make migrate-down n=1  # 回滚一次迁移
make migrate-version   # 查看当前版本
make db-shell       # 进入 psql

# 代码检查
make api-lint       # 后端 go vet
make web-lint       # 前端 biome
make web-typecheck  # TypeScript 类型检查

# 代码生成
make wire           # 生成 wire 依赖注入代码
make sqlc           # 生成 sqlc 查询代码

# 构建
make build          # 构建前后端生产版本
```

## Git 工作流

启用提交规范检查（首次 clone 后运行）：
```bash
./scripts/install-hooks.sh
```

启用后：
- **pre-commit**: 检查 Go 文件 gofmt 格式
- **commit-msg**: 强制 [Conventional Commits](https://www.conventionalcommits.org/) 格式

Commit message 格式：
```
<type>(<scope>): <subject>

type:   feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
scope:  可选，如 auth, web, infra
subject: 简短描述
```

## 文档

- [后端文档](api/AGENTS.md)
- [前端文档](web/README.md)
- [贡献指南](CONTRIBUTING.md)

## License

[MIT](LICENSE)
