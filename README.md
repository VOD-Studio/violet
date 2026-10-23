# Violet

[![CI](https://github.com/VOD-Studio/violet/actions/workflows/ci.yml/badge.svg)](https://github.com/VOD-Studio/violet/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/VOD-Studio/violet)](https://github.com/VOD-Studio/violet/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

面向个人创作者的开源博客平台：长文、笔记、图集各有其位，读者可以批注、聊天，AI agent 可经 MCP 参与写作。

[在线体验](https://xunrua.top) · [快速开始](#快速开始) · [生产部署](#生产部署) · [文档索引](docs/README.md)

<!-- 界面预览位置：待线上版本更新后，补充 https://xunrua.top 的桌面截图；不使用本地测试数据或占位图片。 -->

## 功能

### 内容

- 文章与系列：TipTap 编辑器，公式、流程图、代码高亮、链接预览、X 推文嵌入，版本管理与发布状态机
- 知识笔记：草稿单向发布，独立笔记流与标签筛选，不进文章流与推文时间线
- 图集：工作稿与公开版本分离，支持更新发布、撤回与稳定地址分享
- 项目路线图：条目分三阶段，支持阻塞/修复/扩展关系；公开画布页，文章可嵌入随项目实时更新的路线图块
- 可运行代码块：Python / Node / Go / Rust / Bun 沙箱执行，结果回流正文

### 社区

- 批注评论：评论可锚定到段落或选中文本，支持 GIF 表情与图片上传，带审核工作流
- 推文与主页：图文推文、免凭据转发 X 内容、个人主页与封面
- 聊天：私聊与私有房间、乐观发送与失败重试、表情反应、@提及、SSE 实时事件、Web Push
- 通知中心：互动提醒实时推送，浏览器与站内同步未读
- 自定义表情：评论、推文与聊天共用，管理员可统一下架违规内容

### AI 与程序接入

- MCP：按权限分域的六个 server（公开读取 / 评论 / 文章读写 / 抓取订阅 / 笔记 / 路线图），见 [MCP 使用指南](docs/guides/mcp-servers.md)
- REST API 与 OpenAPI 文档，个人访问令牌自主管理
- 聊天 Bot：外部程序以独立 token 参与聊天，收发图片、Markdown 回复与命令目录

### 站点管理

- RBAC 权限：内置与委派超管、细粒度角色授权
- 操作审计：事件驱动 append-only 日志
- 系统面板：服务状态、受控 SQL 控制台、流式导出、定时备份与恢复
- 运行策略：限流、日配额、图片编码、上传队列与沙箱资源，版本化保存
- 站点音乐：连接网易云维护展示歌单，公开页经 Kite 播放器播放

## 技术栈

| 部分 | 选型 |
| --- | --- |
| 前端 | React 19、TypeScript、TanStack Start（SSR）、Vite 8、Tailwind CSS v4、`@violet/ui`、TipTap |
| 状态 | TanStack Query v5、Zustand |
| 后端 | Go 1.26、Chi、GORM、golang-migrate |
| 数据 | PostgreSQL 16、Redis 7 |
| 工程工具 | pnpm、Biome、Docker Compose、GitHub Actions、release-please |

后端采用 DDD 四层（domain / application / infrastructure / interfaces）与手工依赖装配，前端按 Feature-Sliced Design 组织。详细说明见 [api/README.md](api/README.md) 与 [web/README.md](web/README.md)。

## 快速开始

### 环境要求

- Go 1.26.10+
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

不想在本机装 Go 和 Node.js 时，可用全容器化开发环境，Go、Node.js、PostgreSQL、Redis 都跑在容器里：

```bash
make docker-dev
```

日志与停止分别用 `make docker-dev-logs`、`make docker-dev-down`。在 coder / code-server 等容器内开发时，数据库需经 `host.docker.internal` 访问，步骤见 `make dev-dind` 说明或 [Makefile](Makefile)。

## 生产部署

仓库提供 [Docker Compose 生产配置](docker-compose.prod.yml)，但它沿用了当前线上实例的部署环境，不能不改配置就当作通用的一键安装包：

- 配置自己的域名、CORS 来源与 HTTPS 反向代理；当前编排依赖外部 `nginx-proxy` 网络。
- 核对数据库密码、`RESOURCE_SIGNING_KEY`、`BOT_TOKEN_KEY` 与管理员配置，敏感值放在根 `.env`，不提交到仓库。
- 按服务器环境调整外呼代理地址和 Docker / Podman socket 挂载。

`make deploy-prod-init` 初始化环境文件；完成上述配置后，`make deploy-prod` 构建镜像、执行迁移并启动服务。线上拓扑、发布与回滚见[发布手册](docs/deploy/release-runbook.md)，服务器配置与手动发布见[部署手册](docs/deploy/manual-deploy.md)。

可选服务需要单独准备：

- [可运行代码块](docs/deploy/manual-deploy.md#代码运行器可运行代码块沙箱执行)：需要容器运行时与对应语言的 runner 镜像。
- [站点音乐](docs/deploy/manual-deploy.md#kite-音乐服务可选)：需要 Kite 服务及凭据配置；播放范围受账号权益和上游接口限制。

## 常用命令

```bash
make help           # 查看所有可用命令

# 开发
make dev            # 启动完整开发环境（api + web + postgres + redis）
make docker-dev     # 全容器化开发环境
make up             # 仅启动 PostgreSQL + Redis
make logs           # 查看日志

# 数据库
make migrate            # 执行迁移
make migrate-down n=1   # 回滚一次迁移
make db-shell           # 进入 psql

# 代码检查与测试
make api-lint       # 后端 golangci-lint
make api-test       # 后端测试
make web-lint       # 前端 biome
make web-typecheck  # TypeScript 类型检查
make web-test       # 前端 Vitest

# 构建
make build          # 构建前后端生产版本
```

## 项目结构

```text
violet/
├── api/                    Go 后端服务（DDD 四层）
│   ├── cmd/                server / migrate / export-openapi 等 CLI 入口
│   ├── internal/
│   │   ├── domain/         领域层（聚合根、值对象、仓储端口、领域事件）
│   │   ├── application/    应用层（用例编排、CQRS command/query）
│   │   ├── infrastructure/ 基础设施层（GORM 实现、Redis、外部 API 适配）
│   │   ├── interfaces/     接口层（HTTP handler、路由）
│   │   ├── app/            依赖注入容器（手工装配，每模块一个 *_container.go）
│   │   └── middleware/     HTTP 中间件（session/CSRF/限流/审计）
│   ├── migrations/         数据库迁移（golang-migrate）
│   └── config.yaml         入库配置（全量配置文档，敏感值走根 .env）
├── web/                    React 前端应用（TanStack Start SSR）
│   ├── packages/           可独立使用的组件包（ui / react-tweet / kanban / inkline）
│   ├── src/
│   │   ├── routes/         文件路由
│   │   ├── features/       业务模块（feature-sliced）
│   │   ├── entities/       跨模块领域实体
│   │   ├── widgets/        页面级组合组件
│   │   └── shared/         站点级通用能力
│   └── server.mjs          SSR 生产服务器
├── docs/                   项目文档（索引见 docs/README.md）
├── scripts/                工具脚本（Git 钩子、部署、冒烟测试）
├── docker-compose.yml      开发基础服务编排
└── docker-compose.prod.yml 生产环境编排
```

## Git 工作流

启用代码检查钩子（首次 clone 后运行）：

```bash
./scripts/install-hooks.sh
```

提交规范（Conventional Commits，中文 subject）与分支命名详见[贡献指南](CONTRIBUTING.md)。

## 独立组件

- [@violet/ui](web/packages/ui/README.md)：React 组件、语义主题与 CSS。
- [@violetjs/react-tweet](web/packages/react-tweet/README.zh-CN.md)：原生 X 推文展示与服务端数据获取。
- [@violetjs/kanban](web/packages/kanban/README.zh-CN.md)：受控看板、画布与关系图。
- [@violetjs/inkline](web/packages/inkline/README.zh-CN.md)：手绘矢量图、SVG / Canvas 渲染与绘制动画。

## 文档

- [文档索引](docs/README.md)：开发指南、部署手册与架构决策。
- [MCP 使用指南](docs/guides/mcp-servers.md)：服务能力、授权边界与客户端配置。
- [编辑器手册](web/src/features/editor/docs/README.md)：写作工具与内容块用法。
- [架构决策记录](docs/adr/)
- [安全政策](SECURITY.md)：安全问题的报告方式。

## License

[MIT](LICENSE)
