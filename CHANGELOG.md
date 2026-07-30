# Changelog

本项目所有重要变更记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

v2.0.0 之前手工维护；v2.0.1 起由 [release-please](https://github.com/googleapis/release-please) 从 Conventional Commits 自动维护（见 `.github/workflows/release-please.yml`）。

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

## [2.0.0] - 2026-07-07

2.0 发版线主题：**交互体验升级 + 类型安全路由 + SSR 直出**。
1283 个 commit 沉淀，相对 1.0 是一次架构与功能的大跃迁。

### 重构 — 架构演进

- **SSR 认证架构**: 公开页 SSR 直出，鉴权改 `/auth/session` 只读探活；
  路由中间件从 JWT 切换到 SessionAuth。决策记录见 ADR-0002
- **DDD 四层扩展**: `audit` / `stats` / `user_management` 模块补齐 DDD 四层，
  后端领域模型覆盖度从 9 模块扩到 12 模块
- **路由**: 从 `react-router` v7 迁移到 `@tanstack/react-router`，
  代码生成的类型安全路由树 + `beforeLoad` 守卫 + 类型化 `<Link to>`
- **字段统一**: 用户管理 DTO 的 `avatar` 统一为 `avatar_url`，
  Go 字段 `Avatar` 统一为 `AvatarURL`，前后端契约对齐

### ✨ 新增 — 编辑器与内容

- **文章编辑器**: 基于 Tiptap 的富文本编辑器，含 bubble menu（滚动容器裁剪避免飘出编辑区）、
  lowlight 按需动态注册代码块语法、封面图 Cover 组件、Markdown 导入导出、素材选择器
- **文章管理后台**: 文章列表 + 编辑页（骨架屏 + 数据预填）+ 回收站（恢复与彻底删除）
- **批注与自由评论拆分**: 文章详情页批注与自由评论拆成独立查询，
  顶层评论改 `useInfiniteQuery` 滚动加载

### ✨ 新增 — 评论系统双轨认证

- **双轨模型**: 底部匿名留言板 + 文内批注登录，评论 domain 加双轨认证与匿名配额契约
  （黑洞 + 验证码 + 一篇一次）
- **anchor 维度**: `comments` 表加 anchor 5 列，`FindByPost` 支持 depth 维度过滤，
  `FindReplies` 改造为按 `parent_id` 分页查询
- **读模型**: CommentDTO 增 `is_author` / `reply_to_name` / `replies` / `replies_total`，
  顶层评论带回复预览
- **安全**: `OptionalAuth` 软认证中间件修复登录评论被误判匿名；
  评论反应删除接口要求认证防匿名删除他人反应

### ✨ 新增 — 后台管理

- **DataTable 全家桶**: 封装通用 DataTable + Pagination，支持行展开、CSV 导出、
  列宽拖拽、行点击、复选框批量操作；接入 SearchInput 防抖搜索组件 + 通用防抖 hook
- **服务器监控面板**: 后端 gopsutil 系统指标采集器 + 30s 定时采样 goroutine，
  前端实时指标卡（`useCountUp` + `MetricCard`）+ 历史采样读取
- **操作日志**: audit 模块 DDD 四层 + 前端分页列表与详情弹窗，
  snake_case 序列化 + `user_name` / `resource_name` 补全
- **权限管理**: 权限树形展示 + 增删改查（内置不可删），
  新建/编辑对话框全字段 zod + hook-form
- **站点设置 / 公告 / 标签 / 项目管理**: 全部接入后台 CRUD + 侧边栏导航

### ✨ 新增 — 素材与预览

- **预览组件套件**: 封装 PDF / 文档 / 压缩包 / 代码 / Markdown 预览组件
- **音乐播放器**: 音频预览重构为音乐播放器风格，修复 PDF worker 永久加载
- **头像组**: 博客列表卡片与协同者头像组展示
- **素材管理**: 表格视图迁移到共享 DataTable，支持复选框批量删除

### ✨ 新增 — 部署

- **SSR Dockerfile**: 生产环境 SSR 镜像构建（Node 构建 → SSR 启动）
- **deploy.yml**: GitHub Actions CD 流水线，self-hosted runner 本地构建，
  迁移门禁 + 健康检查 + 失败自动回滚 + GitHub Release
- **一键发版**: `make release*` 命令，commit-and-tag-version 自动生成 CHANGELOG

### 🐛 修复

- 修复 `$RefreshSig$ is not defined`（pnpm hoist 导致 React Fast Refresh preamble 注入失败）
- 修复素材预览多项问题（音视频 / PDF / 图片灯箱）
- 修复 stats / audit / admin / session 存储吞错，统一映射 DomainError

### 详细数据

- 2.0 开发线总 commit: 1283
- 分布: feat ≈ 270, fix ≈ 306, refactor ≈ 135, docs ≈ 53, perf ≈ 4

## [1.0.1] - 2026-06-16

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
