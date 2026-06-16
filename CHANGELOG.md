# Changelog

本项目所有重要变更记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased] / 2.0.0-dev

2.0 开发线启动，主题：**交互体验升级 + 类型安全路由**。
详见 [`docs/2.0-roadmap.md`](./docs/2.0-roadmap.md)。

### 新增（计划中）
- **组件库**: 接入 [ReactBits](https://reactbits.dev/) 动效组件库（免费版 copy-paste 模式，
  落地到 `src/components/reactbits/`），首批用于首页/项目页视觉强化
- **路由**: 从 `react-router` v7 迁移到 [`@tanstack/react-router`](https://tanstack.com/router)
  （代码生成的类型安全路由树 + `beforeLoad` 守卫 + 类型化 `<Link to>`）

### 变更
- 前端版本号 `web/package.json` → `2.0.0-dev`
- 新建 `release/2.0` 开发分支，main 保持 1.x 稳定线

### 待办（从 1.0 遗留）
- P2.7 旧代码彻底删除（sqlc generated + 旧 handler/service/repository）
- P3.2 OpenAPI 文档自动生成
- P3.3 Prometheus 监控指标
- P3.5 i18n 国际化

## [1.0.1] - 2026-06-16

### 修复
- **web**: 修复 `$RefreshSig$ is not defined` (pnpm hoist 导致 React Fast Refresh
  preamble 注入失败) — [9dc66ae](https://example/9dc66ae)
- **web**: 降级 `@vitejs/plugin-react` v6→v5，适配 Fast Refresh preamble — [0753132](https://example/0753132)
- **web**: 降级 Vite v8→v7（v8 为前沿版本，plugin-react 未完全适配），
  彻底解决 `$RefreshSig# Changelog

本项目所有重要变更记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

 问题 — [c751227](https://example/c751227)

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

#### P3 企业级完善
- **CI/CD**: GitHub Actions 流水线（后端 Go + 前端 TS 并行检查）
- **Docker**: 前端多阶段 Dockerfile（Node 构建 → Nginx 托管）+ gzip 压缩 + 静态资源缓存
- **文档**: P2 迁移状态文档 + CHANGELOG

### 测试
- 后端: `go test ./internal/...` (62 测试)
- 前端: `pnpm test` (16 Vitest 测试)
- 类型检查: `pnpm typecheck` (strict 模式零错误)
