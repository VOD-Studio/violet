# mimo-music 架构设计

> 状态：已定稿，待实现
> 日期：2026-07-14
> 范围：完整项目架构，Phase 1 为首个实现阶段

## 1. 项目定位

mimo-music 是用 Go 实现的多平台音乐能力服务。

它对标已归档的 NeteaseCloudMusicApi（Node 版），但在其之上补齐三样东西：

- **多平台抽象**：以 Provider 接口屏蔽网易云、华为音乐等平台差异。
- **HTTP 服务 + 异步 worker**：可靠地对外暴露能力，含缓存、容错、可观测性。
- **SDK / 库模式**：核心能力可脱离 HTTP 被 import 复用。

它同时是 mimo-blog 的音乐后端数据源。

### 三个共存身份

| 身份 | 诉求 |
|---|---|
| 网易云解析代理 | 对标 NeteaseCloudMusicApi 全功能 |
| SDK / 库 | 核心 import 可用，零 HTTP 依赖 |
| 博客音乐后端 | 给 mimo-blog 播放器提供歌单、歌曲数据 |

## 2. 核心设计原则

### 2.1 依赖单向（铁律）

```
cmd → bootstrap → service → provider(接口) ← provider/netease(实现)
                       ↓            ↑
                       ├── cache (实现 provider.Cache)
                       ├── store  (实现 provider.SessionStore)
                       └── model, errors
```

- handler 和 worker 只认 service，不直接碰 provider。
- service 认 provider 接口，不认具体实现。
- provider 接口零副作用，不依赖任何人。
- 把 `provider/` + `model/` + `errors/` 拎出来即可独立成库。

### 2.2 核心层零框架依赖

`provider/` 不 import HTTP 框架、Redis、Asynq、配置库。它只依赖标准库 + chaunsin + 自定义接口（Cache / SessionStore / Logger）。SDK 用户自带实现，服务端注入 Redis / slog 实现。

### 2.3 接口倒置

核心层声明需求（定义 Cache / SessionStore / Logger 接口），运行时层提供实现。这是依赖倒置原则的应用。接口定义统一放在 `provider/` 顶层，所有平台实现共享同一套契约。

### 2.4 每个目录一句话说清职责

见第 3 节目录树注释。没有一个目录需要读内部才能理解。

## 3. 完整目录结构

```
mimo-music/
├── cmd/
│   ├── server/main.go              HTTP 服务入口
│   ├── worker/main.go              Asynq worker 入口
│   └── export-openapi/main.go      导出 OpenAPI spec
│
├── provider/                       核心层：平台抽象（纯，零副作用）
│   ├── provider.go                 Provider 接口（平台无关）
│   ├── registry.go                 Registry：按 platform 路由到实现
│   ├── cache.go                    Cache 接口（依赖倒置）
│   ├── session.go                  SessionStore 接口
│   ├── logger.go                   Logger 接口（核心层不绑 slog）
│   ├── options.go                  Option 模式（WithCache/WithLogger/WithTimeout）
│   ├── decorator.go                容错装饰器（重试 / 熔断）
│   └── netease/                    网易云实现
│       ├── client.go               封装 chaunsin
│       ├── auth.go                 登录 / 验证码 / 二维码
│       ├── playlist.go             歌单解析（全量歌曲）
│       ├── song.go                 详情 / URL / 歌词
│       ├── search.go
│       ├── converter.go            netease 原始 → model 统一
│       ├── errors.go               原始错误 → model error 映射
│       └── log_fields.go           允许打日志的字段白名单（配合脱敏）
│
├── service/                        业务编排层
│   ├── auth.go                     登录编排（调 provider + session store）
│   ├── playlist.go                 歌单编排（缓存策略 + 调 provider）
│   ├── song.go                     歌曲编排（URL 缓存 + 调 provider）
│   └── search.go                   搜索编排
│
├── model/                          统一 DTO（纯数据结构）
│   ├── song.go
│   ├── playlist.go
│   ├── lyrics.go
│   ├── session.go
│   └── search.go
│
├── errors/                         统一错误模型
│   └── errors.go                   ErrUpstreamUnavailable / ErrRateLimited / ErrNotFound
│
├── cache/                          Cache 接口实现
│   ├── noop.go                     空实现（SDK 模式默认）
│   └── redis/                      Redis 实现
│
├── store/                          SessionStore 接口实现
│   └── redis/
│
├── repository/                     预留：未来本地持久化（收藏 / 最近播放）
│   └── .gitkeep
│
├── internal/                       服务专用（SDK 不触碰）
│   ├── server/
│   │   ├── router.go
│   │   ├── handler/                薄层：解析请求 → 调 service → 封装响应
│   │   ├── middleware/             限流 / 日志 / CORS / recovery
│   │   └── response/               统一信封 {code, data, message}
│   ├── worker/
│   │   ├── tasks/                  cookie_health / url_refresh / cache_warm
│   │   └── scheduler.go
│   ├── bootstrap/                  共享 wire 装配（server / worker 复用）
│   │   ├── wire.go
│   │   └── wire_gen.go
│   └── infra/
│       └── redis/                  共享 Redis 客户端（cache / store 复用连接管理）
│
├── observability/
│   ├── logger.go                   slog 初始化 + JSON/text 切换 + 动态等级（LevelVar）
│   ├── otel_handler.go             trace_id / span_id 自动注入 slog handler
│   ├── redact.go                   敏感字段脱敏 handler（cookie / phone / token / password）
│   ├── fields.go                   统一字段名常量（OTel semantic conventions 风格）
│   ├── sampling.go                 高频日志采样 handler
│   └── tracer.go                   OTel 初始化（Phase 1 noop exporter，Phase 3 真实）
│
├── openapi/                        手写 OpenAPI 3.0 spec（不用 swag）
│   ├── openapi.go
│   └── paths/
│
├── config/                         模块化配置
│   ├── server.go
│   ├── provider.go
│   ├── redis.go
│   ├── worker.go
│   └── config.go                   聚合
│
└── pkg/                            公开 SDK（Phase 3）
    └── mimomusic/
```

## 4. 四个特有复杂度及应对

mimo-music 区别于通用 CRUD 服务的特有复杂度，架构重点应对。

### 4.1 上游不可靠

网易云会风控、限流、改接口、返回空。

应对：
- `errors/` 定义统一错误，区分上游不可用、限流、无数据。
- `provider/decorator.go` 容错装饰器（重试 / 熔断），不侵入各 provider 实现。
- `provider/netease/errors.go` 做原始错误到统一错误的映射。
- middleware 限流保护上游。

### 4.2 数据时效性

播放 URL 会过期，Cookie 会失效，歌单会更新。

应对：
- 缓存带 TTL 语义，按数据类型区分（URL 短 TTL、歌单长 TTL）。
- worker 定时刷新热门歌曲 URL、Cookie 健康检查。

### 4.3 登录态共享

多请求共用一套 Cookie，并发访问，Cookie 会过期。

应对：
- `provider/session.go` 定义 SessionStore 接口。
- `store/redis/` 实现并发安全的 session 管理。
- worker 定时健康检查 Cookie。

### 4.4 多平台差异

网易云、华为音乐 API 形态完全不同，对外要统一。

应对：
- `provider/provider.go` 定义平台无关接口。
- `provider/registry.go` 按 platform 路由到实现。
- `provider/netease/converter.go` 各平台原始结构转统一 model。
- 加新平台只需新增 `provider/xxx/`，不动 server / service。

## 5. 技术选型

| 项 | 依据 |
|---|---|
| chaunsin/netease-cloud-music v0.5.0 | 网易云 weapi 加密，MIT，2026-07 仍维护 |
| chi | 与 mimo-blog 一致 |
| go-redis | cache / store / Asynq 共用，经 infra/redis 统一连接管理 |
| Asynq | worker 异步（Cookie 健康检查、URL 刷新是音乐服务刚需） |
| Prometheus client_golang | 上游不可靠需持续观测 |
| slog | 标准库结构化日志（详见第 6 节） |
| OpenTelemetry SDK | Phase 1 最小初始化供日志 trace_id，Phase 3 完整 |
| wire | server + worker 共享 bootstrap 装配 |
| OpenAPI 3.0 手写 | 对齐 mimo-blog，不用 swag |
| tint | 开发环境彩色文本 handler |

## 6. 日志设计（2026 主流）

核心思路：结构化 + 可关联 + 可脱敏 + 零文件落盘。

### 6.1 基线

slog 标准库，生产 JSON / 开发 text（tint 彩色），env 切换。**生产只写 stdout，永不落盘**。日志采集交给 sidecar（Fluent Bit / Vector）转发到 Loki / ClickHouse。这是 12-Factor App 原则，K8s 场景下唯一正解。

### 6.2 上下文传播：OTel 桥接 trace_id 自动注入

日志和链路追踪不各玩各的。`otel_handler.go` 包装 slog.Handler，从 ctx 的 SpanContext 提取 trace_id / span_id 自动注入每条日志。在 Loki / Grafana 里可以从一条日志直接跳到对应 trace 瀑布图。

provider / server / worker 统一用 `slog.InfoContext(ctx, ...)` 而非 `slog.Info(...)`，强制带 ctx。这条写入 lint 规则，用 contextcheck linter 强制。

### 6.3 敏感字段脱敏

项目涉及 Cookie、手机号、登录态，绝不能明文进日志。`redact.go` 包装 slog.Handler，遍历 attrs 替换敏感字段。两种策略：

- 完全遮蔽：`cookie=***`
- 可关联不可逆：`cookie_hash=sha256(cookie)[:8]`（排障时判断是否同一 cookie，不泄露内容）

`provider/netease/log_fields.go` 定义允许打日志的字段白名单。

### 6.4 字段命名规范

`fields.go` 定义常量，OTel semantic conventions 风格，避免拼写不一致：

| 字段 | 说明 |
|---|---|
| platform | netease / huawei |
| user_id | 脱敏后标识 |
| request_id | HTTP 请求级，中间件生成 |
| task_id | worker 任务级 |
| trace_id | OTel 自动注入 |
| upstream_latency_ms | 调用上游耗时 |
| cache_hit | true / false |
| error_code | 对应 errors/ 的统一错误码 |

### 6.5 中间件统一访问日志

`server/middleware/logging.go` 统一打 HTTP 访问日志（method / path / status / duration_ms / request_id），不让每个 handler 自己写。worker/tasks 同理自动打 task 日志（task_id / duration_ms / 成功失败）。

### 6.6 采样

高频后台任务（url_refresh / cache_warm）用 head-based 采样（前 N 条全记，之后按比例），或降级到 Debug，生产默认 Info 起。

### 6.7 动态日志等级

slog.LevelVar 支持运行时修改。通过 admin 接口或 SIGHUP 信号，临时把 provider/netease 相关日志调到 Debug 排障，不重启进程。

### 6.8 核心层解耦

`provider/logger.go` 定义极简 Logger 接口（Info / Debug / Warn / Error + With），核心层依赖接口不绑 slog。运行时层注入 slog adapter。SDK 用户可传自己的 logger 或 noop。

## 7. Provider 接口契约

```go
// provider/provider.go

// Provider 是所有音乐平台实现的统一接口。
type Provider interface {
    // Platform 返回平台标识（netease / huawei）。
    Platform() string

    // Auth 返回该平台的登录能力。
    Auth() Auth

    // Playlist 返回歌单能力。
    Playlist() Playlist

    // Song 返回歌曲能力。
    Song() Song

    // Search 返回搜索能力。
    Search() Search
}

// Registry 按平台标识路由到具体 Provider 实现。
type Registry interface {
    Get(platform string) (Provider, error)
    Register(p Provider) error
}
```

各能力接口（Auth / Playlist / Song / Search）在 Phase 1 实现时细化，返回 `model/` 统一类型。

## 8. SDK 切分验证

把 `provider/` + `model/` + `errors/` 拎出来：

- 依赖：标准库 + chaunsin + 自定义接口。
- 用户自带 Cache / SessionStore / Logger 实现（或 noop）。
- 零改动可独立成库。

SDK 使用示例（Phase 3 完成 `pkg/mimomusic/` 后）：

```go
import "github.com/VOD-Studio/mimo-music/provider/netease"

c, _ := netease.New(
    netease.WithCookie(myCookie),
    netease.WithCache(myCache),
    netease.WithLogger(myLogger),
)
pl, err := c.Playlist(ctx, "123456")
```

## 9. Phase 划分

每个 Phase 在完整架构上填内容，不改架构。

| Phase | 范围 |
|---|---|
| 1 | 项目骨架 + 登录 + 核心解析（歌单 / 歌曲 / URL / 歌词 / 搜索）+ 缓存 + Cookie 健康 worker + observability 全套（含 OTel 最小初始化）+ OpenAPI + wire 装配 |
| 2 | 扩展网易云接口（专辑 / 歌手 / FM / 推荐 / 云盘）+ 限流熔断装饰器 + 完整 metrics + Cookie 轮换 + OTel 真实 exporter |
| 3 | SDK（pkg/mimomusic）+ OTel 跨服务传播 + mimo-blog 迁移 |
| X | 华为音乐等新平台 |

## 10. 与 mimo-blog 的关系

- mimo-music 在 mimo-blog 仓库内（`mimo-music/` 目录），独立 go.mod。
- 严格不 import blog-api 任何包（未来可拆出的前提）。
- mimo-blog 现有音乐代码（domain/music、infrastructure/music、handler/media）暂留不动。
- Phase 3 迁移：mimo-blog 改调 mimo-music，删 vkeys / meting 依赖。
- 接口文档：mimo-music 自己的 Apifox 项目（Phase 1 创建）。

## 11. 代码规范

- godoc 注释全覆盖，每个导出符号（含结构体字段）都要有注释。
- 注释和文档文风遵循 humanizer-zh（去 AI 腔）。
- 强制 slog.*Context 调用（带 ctx），lint 规则强制。
- 提交遵循 AGENTS.md 的 Conventional Commits + 中文 + 原子性。
- lint: golangci-lint（与 mimo-blog 一致）。
