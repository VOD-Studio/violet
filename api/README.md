# violet / api

Go 后端服务，为博客平台提供 RESTful API。采用 **DDD 四层架构**（领域驱动设计），支持文章、评论、音乐、表情、项目管理、用户认证与权限等功能。

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Go 1.26 |
| Web 框架 | chi v5 |
| ORM | GORM（仓储实现，表结构由 SQL 迁移管理，无 AutoMigrate） |
| 数据库 | PostgreSQL 16 + golang-migrate（SQL 迁移） |
| 缓存 | Redis 7（session / 验证码 / 限流 / 状态存储） |
| 认证 | Opaque session cookie + CSRF double-submit |
| 依赖注入 | 手工装配（`internal/app/*_container.go` 模块容器，wire 已移除） |
| 邮件 | Resend API |
| 配置 | Viper（YAML + 环境变量） |
| 日志 | zerolog |

## 快速开始

```bash
# 1. 初始化环境（复制根 .env 模板；api/config.yaml 已入库自带注释，无需复制）
make env

# 2. 启动基础设施（PostgreSQL + Redis）并迁移
make up
make migrate

# 3. 启动 API（热重载）
make api
```

或从项目根目录一键初始化：

```bash
make setup   # 复制环境变量、启动数据库、执行迁移
make api     # 启动 API
```

服务默认监听 `:9090`，API 前缀 `/api/v1`。

## 目录结构

```text
api/
├── cmd/
│   ├── server/            # 应用入口（路由注册 + 依赖装配 + 启动）
│   ├── migrate/           # 数据库迁移 CLI
│   └── export-openapi/    # OpenAPI 导出 CLI
├── config/                # 配置加载（Viper）
├── migrations/            # 数据库迁移脚本（golang-migrate）
├── internal/
│   ├── app/               # 依赖注入容器（每个模块一个 *_container.go）
│   ├── domain/            # 领域层：聚合根、值对象、仓储端口、领域服务
│   ├── application/       # 应用层：用例（CQRS：command/query）
│   ├── infrastructure/    # 基础设施层：仓储实现、外部 API 适配器、SessionStore
│   ├── interfaces/http/   # 接口层：HTTP handler + 中间件
│   ├── middleware/        # 全局 HTTP 中间件（Session/CSRF/限流/CORS/审计）
│   ├── job/               # 定时任务（订阅抓取调度、文件清理）
│   ├── migrate/           # 迁移执行器
│   ├── openapi/           # OpenAPI 文档生成
│   └── service/           # 启动期服务（B站表情种子）
└── uploads/               # 文件存储目录（运行时生成）
```

### DDD 四层架构

请求流转：`HTTP Request → [middleware] → interfaces/handler → application/usecase → domain/entity → infrastructure/repo → Database`

| 层 | 职责 | 依赖方向 | 示例 |
|----|------|---------|------|
| **domain** | 业务核心：聚合根、值对象、仓储端口（接口）、领域错误。零外部依赖。 | 无（被其他层依赖） | `User` 聚合根、`UserRepository` 接口 |
| **application** | 用例编排：协调领域对象完成业务流程，不含业务规则。CQRS 拆分 command/query。 | 依赖 domain | `RegisterUserHandler`（注册用例） |
| **infrastructure** | 技术实现：数据库访问（GORM）、外部 API 调用、Redis session 存储等。实现 domain 端口。 | 依赖 domain（实现端口） | `UserRepository` 的 GORM 实现 |
| **interfaces** | 入口适配：HTTP handler、请求/响应 DTO、路由注册。不含业务逻辑。 | 依赖 application | `auth.Handler.Register` |

**核心原则**：依赖只能从外向内（interfaces → application → domain ← infrastructure）。domain 层不依赖任何其他层。

## 认证模型：Opaque Session Cookie

项目已用 **opaque session cookie** 取代 access/refresh JWT：

| cookie | 内容 | HttpOnly | 作用 |
|--------|------|----------|------|
| `violet_session` | 不透明 session id（cryptographically random ≥256-bit） | 是 | 鉴权凭证，后端查 Redis session 鉴权 |
| `violet_csrf` | CSRF token | 否 | double-submit：写请求需回传 `X-CSRF-Token` |
| `violet_uid` | user_id | 否 | 前端直读，减少一次请求 |

### 生命周期

- **滑动续期（idle timeout）**：后端中间件对每个带有效 session 的真实请求延长 Redis expiry，**不轮换 session id、不产生 Set-Cookie**。
- **绝对寿命（max）**：`max <= 0` 表示无上限；`max > 0` 从登录起算强制过期。
- 改密码、重置密码后删除该用户全部 session，强制重登。

### SSR 探活

`/auth/session` 为 SSR 只读端点：读 cookie → 查 Redis → 返回 claims，**不续期、不写 cookie**。这是避免 TanStack Start server function 无法透传 `Set-Cookie` 的根因方案。

## 业务模块

每个模块在四层各有对应目录，命名一致：

| 模块 | domain | application | 功能 |
|------|--------|-------------|------|
| **auth** | user, session | auth/command + auth/query | 注册/登录/登出/探活/邮箱验证/密码重置 |
| **role** | role, permission | role + permission | 角色 CRUD、权限 CRUD、角色-权限分配 |
| **post** | post | post | 文章 CRUD、发布/归档/草稿状态机、浏览计数、版本管理 |
| **comment** | comment | comment | 评论 CRUD、回复、批注、审核（通过/垃圾/删除）、批量操作 |
| **commentreaction** | commentreaction | commentreaction | 评论表情反应（IP 哈希匿名） |
| **friendlink** | friendlink | friendlink | 友链申请、审核、上下架管理 |
| **notification** | notification | notification | 站内通知（SSE 实时推送、未读中心、事件订阅写通知） |
| **api_token** | api_token | api_token | 个人访问令牌 PAT（MCP 授权凭证） |
| **project** | project | project | 项目展示 CRUD |
| **announcement** | announcement | announcement（并入 content） | 公告管理 |
| **emoji** | emoji | media | 表情分组/表情 CRUD、B站表情导入、文件上传 |
| **upload** | upload | media | 分片上传（秒传/断点续传/合并）、文件管理 |
| **media** | upload, music | media | 文件详情/批量删除/缩略图、音乐解析 |
| **music** | music | media | 歌单管理、歌曲 CRUD、网易云解析（kite） |
| **image** | image | image | 图片处理 |
| **tweet** | tweet | tweet | 推文/动态发布 |
| **settings** | settings | settings | 站点配置（key-value） |
| **tag** | tag | tag | 标签 CRUD |
| **github** | github | github | GitHub 贡献日历/仓库数据（GraphQL API） |
| **mcp** | — | mcp | MCP 服务（写作/评论检索/RSS 抓取，按 PAT scope 拆分） |
| **system** | — | system | 系统级设置（site settings） |
| **coderunner** | coderunner | coderunner | 可运行代码块沙箱执行（复用 yggdrasil runner 镜像） |
| **subscription** | subscription, subscription_entry | subscription | RSS 订阅源管理、抓取调度与转载 |
| **audit** | audit | audit | 操作日志记录与查询 |
| **stats** | stats | stats | 仪表盘统计聚合 |
| **useradmin** | useradmin | useradmin | 用户管理（CRUD/角色/状态/批量操作） |
| **releases** | releases | releases | 版本发布（release-please 集成） |

> **注意**：`media` application 层同时服务 emoji/upload/music/media 四个 domain，因为它们共享基础设施（文件存储、音乐解析）。

## 基础设施适配器

`internal/infrastructure/` 下的外部系统集成：

| 目录 | 端口（domain 定义） | 实现 | 说明 |
|------|---------------------|------|------|
| `auth/` | `SessionStore`, `CodeStore` | RedisSessionStore, RedisCodeStore | session 存储、验证码存储 |
| `email/` | `EmailSender` | Sender (Resend) | 验证码/密码重置邮件 |
| `eventbus/` | `EventBus` | Noop / InMemory | 领域事件总线（audit / notification 订阅者消费事件） |
| `github/` | `GitHubProvider` | Adapter | GitHub GraphQL + REST API |
| `music/` | `MusicProvider` | Provider | 网易云解析（kite SDK） |
| `storage/` | `ChunkStorage` | LocalStorage | 分片文件存储、缩略图生成（imaging + ffmpeg） |
| `persistence/gorm/` | 各 `*Repository` | GORM 实现 | 所有数据库访问 |

## 依赖注入

手工装配：每个模块在 `internal/app/` 有一个 `*_container.go`，由根容器（`container.go` / `run.go`）统一构造：

```go
// internal/app/auth_container.go
func NewAuthContainer(db, redis, cfg, emailSender, bus) (*AuthContainer, error) {
    userRepo := gormrepo.NewUserRepository(db)
    sessionStore := infraauth.NewRedisSessionStore(redis)
    // ... 构造各 command/query handler
    return &AuthContainer{AuthHandler: ..., SessionStore: sessionStore}, nil
}
```

> 历史说明：role/permission 模块曾用 google/wire 生成装配代码，为统一 DI 方式已移除（全仓手工装配），go.mod 中的 wire 依赖为待清理残留。

## 如何新增一个模块

以新增 `subscription`（RSS 订阅）模块为例（仓库已有同名模块，可按此模式扩展）：

### 1. domain 层

```text
internal/domain/newsletter/
├── entity.go       # Subscription 聚合根 + 值对象
└── repository.go   # SubscriptionRepository 接口（端口）+ 领域错误
```

```go
// entity.go
package newsletter

type Subscription struct {
    id      shared.ID
    email   string
    active  bool
}

func NewSubscription(id shared.ID, email string) *Subscription {
    return &Subscription{id: id, email: email, active: true}
}

// repository.go
type SubscriptionRepository interface {
    FindByEmail(ctx context.Context, email string) (*Subscription, error)
    Save(ctx context.Context, s *Subscription) error
    Delete(ctx context.Context, id shared.ID) error
}
```

### 2. infrastructure 层

```text
internal/infrastructure/persistence/gorm/
└── newsletter_repo.go     # 实现 SubscriptionRepository 接口
```

GORM PO 模型放在 `persistence/gorm/model/`。

### 3. application 层

```text
internal/application/newsletter/
└── service.go             # 用例（Subscribe/Unsubscribe/List）
```

```go
type Service struct {
    repo domainnewsletter.SubscriptionRepository
}

func (s *Service) Subscribe(ctx context.Context, email string) error {
    // 业务编排：构造聚合根 → 调用 repo 保存
}
```

### 4. interfaces 层

```text
internal/interfaces/http/handler/newsletter/
└── newsletter.go          # HTTP handler + 请求/响应 DTO
```

### 5. 装配与路由

```go
// internal/app/newsletter_container.go
func NewNewsletterContainer(db *gorm.DB) *NewsletterContainer { ... }

// cmd/server/main.go
newsletterContainer := app.NewNewsletterContainer(gormDB)
v1.Route("/newsletter", func(r chi.Router) {
    r.Post("/subscribe", newsletterContainer.Handler.Subscribe)
})
```

### 6. 数据库

表结构由 golang-migrate SQL 迁移管理（无 AutoMigrate）：在 `api/migrations/` 手写递增序号的 `NNN_xxx.{up,down}.sql` 后执行迁移：

```bash
make migrate              # 应用新迁移
make migrate-down n=1     # 回滚最近一次迁移
```

> 已应用到任何环境的迁移文件**禁止原地修改**（改动不会同步进库，产生 schema 漂移），变更一律新增迁移。

## 常用命令

```bash
make api          # 启动 API（热重载，air）
make api-build    # 编译
make api-test     # 运行测试
make api-lint     # golangci-lint 检查（或回退 go vet）
make migrate      # 执行数据库迁移
make migrate-down n=1  # 回滚最近一次迁移
make reset-db     # 重置数据库
make apifox       # 导出 OpenAPI 并导入 Apifox
make help         # 查看所有命令
```

## 配置

配置架构遵循 Grafana 模式：

- **`config.yaml`（入库）**：全部配置键 + 非敏感默认值 + 注释，配置的权威文档，随镜像分发
- **根 `.env`（不入库）**：密钥与敏感值，唯一敏感来源（参考 `.env.example`）
- **优先级**：进程环境变量 > 根 `.env` > `config.yaml` > 代码默认值

启动时 API 会打印每个键的生效值与来源（env / config.yaml / default）。

| 配置项 | 说明 |
|--------|------|
| `database.*` | PostgreSQL 连接（DSN/连接池） |
| `redis.*` | Redis 连接 |
| `cookie.*` | session cookie 域名、Secure、SameSite 等 |
| `session.*` | idle_ttl（滑动续期窗口）、max_ttl（绝对寿命上限） |
| `cors_allowed_origins` | CORS 允许来源 |
| `trusted_proxies` | 受信代理 CIDR（为空时忽略 X-Forwarded-For） |
| `resend_api_key` | Resend 邮件 API Key |
| `superadmin.*` | 初始超级管理员账户 |
| `bilibili_*` | B站表情导入 Cookie |

> 各键上方的行内注释标注对应的 env 覆盖名；敏感值一律走环境变量，不写入 `config.yaml`。

## 测试

```bash
cd api && go test ./...
# 或从根目录
make api-test
```

测试集中在 domain 层（聚合根不变量）和 application 层（用例编排），使用 mock 实现仓储端口。

## 相关文档

- [项目总览](../README.md)
- [项目级代理规范与开发须知](../AGENTS.md)
- [文档目录](../docs/README.md)（PRD / ADR / 指南 / 部署手册）
- [架构决策记录](../docs/adr/)
