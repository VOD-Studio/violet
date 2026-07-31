# Changelog

本项目所有重要变更记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

v2.0.0 之前手工维护；v2.0.1 起由 [release-please](https://github.com/googleapis/release-please) 从 Conventional Commits 自动维护（见 `.github/workflows/release-please.yml`）。

## [2.0.5](https://github.com/VOD-Studio/violet/compare/v2.0.4...v2.0.5) (2026-07-31)


### 👷 CI

* **release-please:** 升级 action v4→v5(Node 24 运行时) ([#5](https://github.com/VOD-Studio/violet/issues/5)) ([fa5a5c6](https://github.com/VOD-Studio/violet/commit/fa5a5c6c53482421fa1a64f4144f28bd3b50607b))

## [2.0.4](https://github.com/VOD-Studio/violet/compare/v2.0.3...v2.0.4) (2026-07-30)


### 🐛 修复

* **media:** 补注册 admin 组批量删除路由修复 405 ([#3](https://github.com/VOD-Studio/violet/issues/3)) ([f5eff6f](https://github.com/VOD-Studio/violet/commit/f5eff6fa2413c87c8f8c67fd8a57f24e972e6ad1))

## [2.0.3](https://github.com/VOD-Studio/violet/compare/v2.0.2...v2.0.3) (2026-07-30)


### 📝 文档

* **changelog:** 重写 v2.0.0 段落 ([f378a4d](https://github.com/VOD-Studio/violet/commit/f378a4dfaeff0ea3ab8dec72decee2a204dac8b6))


### 👷 CI

* 升级 setup-node v4→v7 与 pnpm/action-setup v4→v6 消除 Node 20 警告 ([54540df](https://github.com/VOD-Studio/violet/commit/54540dfbafe9c9d025fffa45d10b31222cdf5559))
* 清理旧发版系统残留 + 修复 CHANGELOG 配置 + nginx reload ([96e0099](https://github.com/VOD-Studio/violet/commit/96e00991fd8f984ed90b34f31629074185629568))

## [Unreleased]

> 未发版的改动。push 发版型 commit（feat/fix 等）到 `release/2.0` 后，release-please 自动开 release PR，合并即发版。

## [2.0.2](https://github.com/VOD-Studio/violet/compare/v2.0.1...v2.0.2) - 2026-07-30

### 🐛 修复

- **ci:** release-please 改用 manifest 配置文件(v4 不再支持内联参数) ([e8218cf](https://github.com/VOD-Studio/violet/commit/e8218cf6075d557f870219850f4d0ea41a75b69a))
- **ci:** release-please 用 PAT 绕过组织 GITHUB_TOKEN 创建 PR 限制 ([2ce1386](https://github.com/VOD-Studio/violet/commit/2ce1386843c7122320651562226c43116837f6f4))

## [2.0.1] - 2026-07-30

CI/CD 基础设施修复版本。rebrand（mimo-blog → violet）后遗留的部署链路不一致问题集中修复，并正式接入 release-please 自动发版与 self-hosted runner 自动部署。

### 🐛 修复

- **CI 镜像名统一**：deploy.yml 与 docker-compose.ci.yml 的镜像名从 `blog-api` 统一为 `violet-api`，与 docker-compose.prod.yml 对齐（rebrand 时漏改 CI 路径导致手动/CI 部署镜像名不一致）
- **网络名规范化**：`blog_network` → `violet_network`（mimo-blog 迁移残留），同步 patch-nginx-api.sh 与部署文档
- **CORS 启动门禁**：docker-compose.prod.yml 新增 `CORS_ALLOWED_ORIGINS` 强制检查（compose `:?` 语法）与 `COOKIE_SECURE=true` 生产安全基线

### ♻️ 重构

- **配置架构收敛**：配置链收敛为 `env > .env > config.yaml > 默认值` 单链，部署目录收敛到根 `.env` 单一来源（api/.env 废弃），config.yaml 入库随镜像分发
- **环境变量架构**：根 `.env.example` 成为唯一模板，启动时 tabwriter 对齐打印 50 项配置来源

### 👷 CI

- **release-please 自动发版**：push release/2.0 自动开 release PR（含 CHANGELOG 段落），合并即打 tag 触发部署；PAT 绕过组织 GITHUB_TOKEN 创建 PR 限制
- **deploy.yml 扩展**：支持 api+web 原子部署，新增 web 镜像构建 + sync-client 静态资源同步 + web 健康检查；`component` 输入支持单组件回滚（api/web/both）
- **self-hosted runner**：接入 GitHub Actions self-hosted runner（标签 `rua`，root 身份），本地 podman-docker 兼容层让 CI 用标准 docker 命令
- **actions/checkout v4 → v7**：消除 Node 20 弃用警告
- 废弃本地 `scripts/release.sh` + `make release*` + commit-and-tag-version 依赖，发版统一走 release-please

## [2.0.0] - 2026-07-30

violet（原 mimo-blog）仓库迁移到 VOD-Studio 后的首个正式 release，沉淀了从项目脚手架到完整博客平台的全部开发成果（2093 个 commit）。这是一个全栈博客平台的成型版本。

### ✨ 新增 — 核心平台

- **文章系统**: 基于 Tiptap 的富文本编辑器（bubble menu、代码块高亮、封面图、Markdown 导入导出）、文章 CRUD、回收站、草稿与发布流程
- **评论双轨制**: 底部匿名留言板 + 文内批注，双轨认证与匿名配额（黑洞 + 验证码）
- **用户与权限**: 角色 + 权限树管理、超级管理员、OAuth 登录（Google / GitHub）、PAT 个人访问令牌
- **素材管理**: 媒体库（分片上传、视频封面截取、PDF/音频/图片预览）、素材选择器

### ✨ 新增 — 后台管理

- **管理控制台**: DataTable 全家桶（分页、批量操作、CSV 导出）、服务器监控面板、操作日志（audit）、站点设置、公告、标签、项目管理
- **侧边栏导航**: 品牌区、菜单分组、激活指示条、收起模式

### ✨ 新增 — 高级功能

- **MCP 集成**: 文章/评论检索 tool、匿名公开只读 server（violet-reader）、客户端接入面板与配置生成
- **RSS 订阅**: 订阅源管理、定时抓取调度器、Feed 解析与去重
- **图块与流程图**: Mermaid 流程图渲染、可运行代码块沙箱执行（python/node/go/rust/bun）
- **SEO 与发现**: sitemap、canonical URL、OpenGraph meta、转载来源标记

### ♻️ 重构 — 架构演进

- **认证架构**: opaque session（Redis 后端）+ CSRF double-submit，公开页 SSR 直出
- **路由**: 迁移到 `@tanstack/react-router`，类型安全路由树 + `beforeLoad` 守卫
- **后端 DDD**: 按领域划分四层（domain/application/infrastructure/interfaces），wire 依赖注入
- **SSR**: TanStack Start + Vite，`server.mjs` 桥接 node:http，nginx 直接服务静态资源

### 👷 部署

- 生产 docker-compose（postgres + redis + api + web SSR），nginx-proxy 反代 + Let's Encrypt
- self-hosted runner 本地构建，podman-docker 兼容层

## [1.0.1] - 2026-06-16

> 此 tag 在仓库迁移时丢失，内容为迁移前的早期版本。详见迁移前的历史仓库。

### 修复
- **web**: 修复 `$RefreshSig$ is not defined` (pnpm hoist 导致 React Fast Refresh
  preamble 注入失败) — [9dc66ae](https://example/9dc66ae)
- **web**: 降级 `@vitejs/plugin-react` v6→v5，适配 Fast Refresh preamble — [0753132](https://example/0753132)
- **web**: 降级 Vite v8→v7（v8 为前沿版本，plugin-react 未完全适配），
  彻底解决 `$RefreshSig$ is not defined` 问题 — [c751227](https://example/c751227)

> 补丁版本，不含功能变更。

## [1.0.0] - 2026-06-16

### 重构 — DDD 架构迁移（P0-P3）

#### P0 致命修复与安全加固
- **安全**: 移除 docker-compose 与 .env.example 中的硬编码数据库凭据 `super@123`，
  改为 `${VAR:?msg}` 必填校验
- **基础设施**: 修复 Makefile 死引用 `load-config.sh`；新增 `cmd/migrate` 迁移 CLI；
  数据库连接池配置（MaxOpenConns/MaxIdleConns/ConnMaxLifetime）
- **可观测性**: 新增 RequestID 中间件，日志带 `request_id` 字段打通链路追踪
- **前端**: 开启 TypeScript strict 模式；修复 `adminLoader` 重定向失效；
  修正 Redux→Zustand 文档失真

#### P1 DDD 架构奠基
- **领域层**: `internal/domain/` 四层骨架（shared 基类 + user/role/permission 聚合），
  AggregateRoot/DomainEvent/DomainError/ID/Timestamps 完整基础设施
- **应用层**: `internal/application/` CQRS command/query 用例 + EventBus/UnitOfWork 端口
- **基础设施层**: `internal/infrastructure/` GORM repository + 进程内事件总线
- **接口层**: `internal/interfaces/` HTTP handler + 统一错误翻译中间件
- **依赖注入**: 引入 google/wire 编译期代码生成
- **前端**: 路由 React.lazy 懒加载 + ErrorBoundary + env 集中化
- **工程化**: .editorconfig + .golangci.yml + LICENSE(MIT) + README + CONTRIBUTING +
  纯 shell Git 钩子（pre-commit gofmt）
- **包管理**: 迁移到 pnpm，修复 npm workspace 探测 bug

#### P2 全业务模块 DDD 迁移
- **9 个模块**全部迁移到 DDD 四层架构:
  - user/auth: JWT(ES256) + Redis(refresh token/验证码) + 9 CQRS 用例
  - role/permission: RBAC 权限系统 + 33 预定义权限常量
  - post: 文章状态机(draft/published/archived) + slug 唯一性 + 标签关联
  - comment: 物化路径嵌套(depth≤4) + JSONB 图片 + emoji 反应
  - announcement/project: 简化 DDD(CRUD 合一)
  - emoji/music/upload: 完整 domain + GORM repository
- **全 GORM AutoMigrate**: model struct 即 schema，废弃 sqlc 手写 SQL
- **测试**: 26 domain 单测 + 20 集成测 + 16 application mock 测 + 16 前端单测
- **影子路由**: DDD 路由通过 `/ddd/` 前缀与旧路由并存运行
