# violet

> 全栈博客平台 · Go 1.26 + React 19

[![CI](https://github.com/VOD-Studio/violet/actions/workflows/ci.yml/badge.svg)](https://github.com/VOD-Studio/violet/actions/workflows/ci.yml)
[![Deploy](https://github.com/VOD-Studio/violet/actions/workflows/deploy.yml/badge.svg)](https://github.com/VOD-Studio/violet/actions/workflows/deploy.yml)
[![Release](https://img.shields.io/github/v/release/VOD-Studio/violet)](https://github.com/VOD-Studio/violet/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Website](https://img.shields.io/badge/website-xunrua.top-8A2BE2)](https://xunrua.top)

一个功能完整的现代博客系统：文章与项目管理、SSR 渲染、锚点批注评论、音乐播放、表情系统、细粒度 RBAC 权限、操作日志审计、可运行代码块，并对外暴露 MCP 服务。

在线体验：[https://xunrua.top](https://xunrua.top)

## 功能特性

- **文章创作**：Markdown 富文本（TipTap）、流程图/时序图/饼图等图块、公式、代码高亮（Shiki）、版本管理、草稿/发布/归档状态机
- **图集创作**：以工作稿和公开版本维护视觉作品，支持更新发布、撤回、删除与稳定地址分享
- **阅读体验**：SSR 首屏、目录导航、深色主题、锚点批注 + 评论互动（GIF 表情、图片上传）、音乐播放
- **社区能力**：批注审核工作流、按 IP 哈希匿名的表情反应、公告、项目展示、友链申请与审核、站内通知中心（SSE 实时推送）
- **即时聊天**：登录用户之间的私聊与私有房间、文本/图片消息、消息表情反应、持久化历史、SSE 实时事件、全站实时的未读角标与浏览器 Web Push 通知
- **自定义表情**：登录用户可在评论、推文与聊天中上传、收藏和使用私有表情，管理员可在后台统一管理并强制下架违规内容
- **平台能力**：RBAC 角色权限（内置超管 + 委派超管）、登录态审计、操作日志（事件驱动 append-only）、用户/媒体/订阅管理
- **可运行代码块**：代码沙箱执行（Python/Node/Go/Rust/Bun，复用 yggdrasil runner 镜像）
- **开放接口**：RESTful API + OpenAPI 文档、MCP 服务（写作/评论检索/RSS 抓取，最小权限拆分）
- **工程化**：DDD 四层架构、CQRS、事件驱动审计、release-please 自动发版、CI/CD 全自动部署（含迁移门禁与自动回滚）

## 技术栈

### 后端（`api/`）

| 类别 | 选型 |
|------|------|
| 语言 | Go 1.26 |
| 路由 | chi v5 |
| 数据库 | PostgreSQL 16（GORM 数据访问 + golang-migrate SQL 迁移） |
| 缓存 | Redis 7 |
| 认证 | Opaque session cookie（Redis 后端）+ CSRF double-submit |
| 日志 | zerolog（结构化） |
| 依赖注入 | 手工装配（`internal/app/*_container.go` 模块容器） |
| 架构 | DDD 四层（domain/application/infrastructure/interfaces） |

### 前端（`web/`）

| 类别 | 选型 |
|------|------|
| 框架 | React 19 + TypeScript (strict) |
| 全栈框架 | TanStack Start（SSR） |
| 构建 | Vite 8 |
| 状态 | Zustand + TanStack Query v5 |
| 样式 | Tailwind CSS v4 |
| UI | Radix UI / shadcn 风格 |
| 富文本 | TipTap |
| 检查/格式化 | Biome |

### 基础设施

- Docker Compose（开发 + 生产编排），生产经 nginx-proxy + Let's Encrypt 反代
- CI/CD：GitHub Actions（CI 检查 + release-please 发版 + 自动部署到 rua 服务器）

## 架构概览

```text
violet/
├── api/                    Go 后端服务（DDD 四层）
│   ├── cmd/
│   │   ├── server/         API 服务入口
│   │   ├── migrate/        数据库迁移 CLI
│   │   └── export-openapi/ OpenAPI 导出 CLI
│   ├── internal/
│   │   ├── domain/         领域层（聚合根、值对象、仓储端口、领域事件）
│   │   ├── application/    应用层（用例编排、CQRS command/query）
│   │   ├── infrastructure/ 基础设施层（GORM 实现、Redis、外部 API 适配）
│   │   ├── interfaces/     接口层（HTTP handler、路由、中间件）
│   │   ├── app/            依赖注入容器（手工装配，每模块一个 *_container.go）
│   │   └── middleware/     HTTP 中间件（session/CSRF/限流/审计）
│   ├── migrations/         数据库迁移（golang-migrate）
│   └── config.yaml         入库配置（全量配置文档，敏感值走根 .env）
├── web/                    React 前端应用（TanStack Start）
│   ├── src/
│   │   ├── routes/         文件路由
│   │   ├── features/       业务模块（feature-sliced）
│   │   ├── entities/       实体定义
│   │   ├── widgets/        页面级组合组件
│   │   ├── shared/         通用组件 / API / 工具
│   │   └── test/           测试配置
│   ├── public/             静态资源
│   └── server.mjs          SSR 生产服务器（srvx 桥接）
├── docs/                   项目文档（索引见 docs/README.md）
├── scripts/                工具脚本（Git 钩子、冒烟测试）
├── docker-compose.yml      开发环境编排
└── docker-compose.prod.yml 生产环境编排
```

## 快速开始

### 环境要求

- Go 1.26+
- Node.js 20+ 与 **pnpm**（前端包管理器，禁止 npm/yarn）
- Docker & Docker Compose

### 初始化

```bash
# 1. 复制环境变量模板（务必修改 DATABASE_PASSWORD 等敏感配置）
make env

# 2. 一键初始化（启动数据库、运行迁移）
make setup

# 3. 启动开发环境（前后端并行）
make dev
```

启动后：

- 前端：http://localhost:5173
- 后端 API：http://localhost:9090
- 健康检查：http://localhost:9090/api/health

<details>
<summary>在 Docker 容器内开发（如 coder / code-server / omp）</summary>

容器内无法经 `localhost` 访问宿主机上的数据库容器，需用 `host.docker.internal` 覆盖 host：

```bash
# 1. 复制环境变量模板
make env

# 2. 复制容器开发覆盖配置
cp .env.docker-dev.example .env.docker-dev

# 3. 启动容器内开发环境
make dev-dind
```

前置条件：`docker.sock` 可访问（已加入 `docker` 组）。`host.docker.internal` 由 Docker Desktop 内置；Linux 原生 Docker 需在容器加 `--add-host=host.docker.internal:host-gateway`。

## 生产部署

线上环境为 **xunrua.top**（rua 服务器，SSR 容器 + nginx-proxy 反代 + Let's Encrypt TLS）。日常发版全自动：向 `release/2.0` 推送 `feat`/`fix` 等发版型 commit → release-please 自动开 release PR → 合并即打 tag 并触发自动部署（按侧变更检测、迁移门禁、健康检查与跨组件冒烟，失败自动回滚）。`docs`/`chore`/`ci` 类型不发版。

- [发布手册](docs/deploy/release-runbook.md)：发版流程、回滚、迁移门禁、线上拓扑
- [手动部署手册](docs/deploy/manual-deploy.md)：runner 不可用或紧急发布时兜底
- 本地 Docker 生产模式（无需服务器）：`make deploy-prod-init` 初始化 `.env`，`make deploy-prod` 构建并启动

## 常用命令

```bash
make help           # 查看所有可用命令

# 开发
make dev            # 启动完整开发环境（api + web + postgres + redis）
make dev-dind       # 容器内开发（Docker-in-Docker，DB 经 host.docker.internal）
make up             # 仅启动 PostgreSQL + Redis
make logs           # 查看日志
make check          # 检查环境依赖（Go/Node/Docker）

# 数据库
make migrate        # 执行迁移
make migrate-down n=1  # 回滚一次迁移
make migrate-version   # 查看当前版本
make db-shell       # 进入 psql

# 代码检查与测试
make api-lint       # 后端 golangci-lint
make api-test       # 后端测试
make web-lint       # 前端 biome
make web-typecheck  # TypeScript 类型检查
make web-test       # 前端 Vitest

# 构建
make build          # 构建前后端生产版本
```

## Git 工作流

启用代码检查钩子（首次 clone 后运行）：

```bash
./scripts/install-hooks.sh
```

启用后：

- **pre-commit**：检查 Go 文件 gofmt 格式与前端 biome 检查

提交规范（Conventional Commits，中文 subject）与分支命名详见 [贡献指南](CONTRIBUTING.md)。

## 文档

- [贡献指南](CONTRIBUTING.md)
- [后端说明](api/README.md)
- [前端说明](web/README.md)
- [文档目录](docs/README.md)
- [项目代理规范与开发须知](AGENTS.md)
- [架构决策记录](docs/adr/)

## License

[MIT](LICENSE)
