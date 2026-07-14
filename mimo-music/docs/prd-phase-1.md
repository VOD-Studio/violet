# PRD: mimo-music Phase 1

> 状态：待实现
> 关联：[architecture.md](./architecture.md)
> 范围：项目骨架 + 登录 + 核心解析 + 缓存 + Cookie 健康 worker + observability + OpenAPI

## Problem Statement

mimo-blog 目前的音乐功能依赖三个公开第三方解析实例（vkeys / qijieya / injahow），它们随时可能关停，网易云已全面封杀这类公开端点。歌单导入函数是桩代码，只能返回单曲，无法导入完整歌单。前端音乐播放器是空壳，没有真实音频播放。

博主想要一个自定义播放器，能导入网易云歌单、播放平台曲库。但市面上没有现成方案能同时满足：稳定可靠、自定义 UI、博客可集成、且不完全依赖别人维护的公开服务。

## Solution

建一个独立的 Go 服务 mimo-music，自托管网易云解析能力。它封装 chaunsin/netease-cloud-music 库的 weapi 加密实现，对外暴露 HTTP 接口。博主登录自己的网易云账号后，服务拿到 Cookie，就能解析完整歌单、获取播放 URL、歌词、搜索。

这个服务放在 mimo-blog 仓库内，但保持独立 module，不依赖 blog-api 任何代码，未来可整体拆出。Phase 1 做到博客播放器能真正播放网易云歌单。

## User Stories

### 登录

1. 作为博主，我想通过手机号和验证码登录网易云账号，这样服务能拿到我的 Cookie 解析 VIP 歌曲。
2. 作为博主，我想通过二维码登录网易云账号，这样不用在服务端输入手机号。
3. 作为博主，我想让服务发送验证码到我的手机，这样我能完成手机号登录。
4. 作为博主，我想查询当前登录状态，这样我知道 Cookie 是否还有效。
5. 作为博主，我想登出网易云账号，这样能切换账号或清除登录态。
6. 作为系统，我想定期检查 Cookie 健康状态，这样 Cookie 过期时能提前告警而不是等用户请求失败。

### 歌单

7. 作为博客访客，我想获取某个网易云歌单的完整歌曲列表，这样播放器能展示并播放整单。
8. 作为博主，我想通过歌单 ID 拉取歌单详情（标题、封面、创建者、歌曲），这样博客能展示歌单元信息。

### 歌曲

9. 作为博客访客，我想获取某首歌的播放 URL，这样播放器能真正播放音频。
10. 作为博客访客，我想选择音质（标准 / 较高 / 无损），这样能按网络情况权衡。
11. 作为博客访客，我想获取歌曲详情（歌名、歌手、专辑、封面），这样播放器能展示歌曲信息。
12. 作为博客访客，我想获取歌词，这样播放器能同步显示歌词。

### 搜索

13. 作为博客访客，我想按关键词搜索歌曲，这样能找到想听的歌。
14. 作为博客访客，我想限制搜索结果数量，这样不会一次返回太多。

### 可靠性与性能

15. 作为系统，我想缓存歌单详情，这样反复访问同一歌单时不必每次打网易云。
16. 作为系统，我想缓存播放 URL 并设短 TTL，这样 URL 过期前命中缓存但不返回失效链接。
17. 作为系统，我想缓存歌词，这样不必反复拉取稳定内容。
18. 作为系统，我想缓存搜索结果，这样热门关键词不反复打上游。

### 可观测性

19. 作为运维者，我想看到每个请求的访问日志（method / path / status / 耗时），这样能排查问题。
20. 作为运维者，我想看到缓存命中率指标，这样能判断缓存策略是否有效。
21. 作为运维者，我想看到上游错误率指标，这样能发现网易云风控或封禁。
22. 作为运维者，我想在不重启服务的情况下临时调高日志级别，这样排障时能看 Debug 日志。
23. 作为运维者，我想每条日志自动带 trace_id，这样能把一个请求链路上的日志串起来。

### 安全

24. 作为博主，我想 Cookie 和手机号绝不明文出现在日志里，这样日志泄露不会导致账号被盗。
25. 作为运维者，我想日志里的 Cookie 用 hash 形式，这样排障时能判断是不是同一个 Cookie 出的问题。

### 文档

26. 作为接口调用方，我想有一份 OpenAPI 文档，这样知道每个端点的参数和响应格式。
27. 作为接口调用方，我想把 OpenAPI 文档导入 Apifox，这样能在 Apifox 里测试接口。

### 架构

28. 作为 SDK 使用者，我想 import provider/netease 包直接调用网易云能力，这样不必起 HTTP 服务。
29. 作为 SDK 使用者，我想自带 Cache 和 Logger 实现，这样库不强制我装 Redis。
30. 作为维护者，我想 mimo-music 不依赖 blog-api 任何代码，这样未来能整体拆成独立仓库。

## Implementation Decisions

### 架构与分层

- 采用三层结构：`provider/`（核心，平台抽象）+ `service/`（业务编排）+ `internal/`（运行时：server / worker / bootstrap / infra）。
- 核心层（provider / model / errors）零框架依赖，只依赖标准库 + chaunsin + 自定义接口。
- Cache / SessionStore / Logger 接口定义在 provider/ 顶层，运行时层提供 Redis / slog 实现。这是依赖倒置，让 SDK 用户能注入自己的实现。
- handler 和 worker 只调 service，不直接碰 provider。业务逻辑集中在 service 层，HTTP 和 worker 共享，不复制。

### 多平台扩展位

- provider/ 顶层定义 Provider 接口和 Registry（按 platform 路由到实现）。
- Phase 1 只实现 provider/netease，但接口设计成平台无关。
- 加新平台（华为音乐等）只需新增 provider/xxx/，不动 server / service。

### 网易云能力（封装 chaunsin）

- provider/netease 封装 chaunsin/netease-cloud-music v0.5.0 的 weapi 能力。
- converter.go 把 chaunsin 的原始响应结构转成 model 统一类型，不泄漏到上层。
- errors.go 把网易云原始错误（限流、Cookie 失效）映射成统一错误（ErrUpstreamUnavailable / ErrRateLimited / ErrNotFound）。
- provider 用 Option 模式构造：WithCookie / WithCache / WithLogger / WithTimeout。

### 登录态管理

- 登录成功后，Cookie 存入 SessionStore（store/redis/），按 user_id 索引。
- service 调用解析接口前，从 SessionStore 取 Cookie 注入 provider。
- Cookie 并发安全由 store/redis 保证（单线程读改写 + 分布式锁）。

### 缓存策略

- 缓存按数据类型设 TTL：播放 URL 30 分钟（网易 URL 会过期），歌单详情 / 歌词 / 歌曲详情 24 小时，搜索结果 10 分钟。
- cache/noop.go 提供空实现，SDK 模式默认用。
- cache/redis/ 提供生产实现，复用 internal/infra/redis/ 的连接管理。

### 异步任务（Asynq worker）

- worker 是独立进程（cmd/worker/main.go），和服务进程生命周期分离。
- Phase 1 只一个任务：Cookie 健康检查（每 6 小时验证 SessionStore 里的 Cookie 是否有效，失效则记 Warn 日志）。
- worker 和 server 共享 internal/bootstrap/ 的 wire 装配。

### 可观测性

- 日志：slog，生产 JSON / 开发 text（tint），只写 stdout，不落盘。
- trace_id：otel_handler.go 包装 slog.Handler，从 ctx 的 SpanContext 自动注入 trace_id。tracer.go 做 OTel 最小初始化（Phase 1 noop exporter，只为生成 trace_id）。
- 脱敏：redact.go 包装 slog.Handler，cookie / phone / token / password 字段用 hash 或遮蔽。
- 字段规范：fields.go 定义字段名常量（platform / request_id / task_id / cache_hit / upstream_latency_ms / error_code 等）。
- 采样：高频任务日志降级 Debug 或采样。
- 动态等级：slog.LevelVar + SIGHUP 信号，运行时调级。
- 核心层解耦：provider/logger.go 定义 Logger 接口，不绑 slog。
- 指标：Prometheus（缓存命中率 / 上游错误率 / 请求量 / Cookie 健康）。
- 强制 slog.*Context 调用，lint 规则约束。

### 接口文档

- openapi/ 手写组装 OpenAPI 3.0 spec（用 kin-openapi），对齐 mimo-blog 的 openapi 模式。
- cmd/export-openapi/main.go 导出 openapi.json。
- 不用 swag（明确排除）。
- 新建 mimo-music 自己的 Apifox 项目导入。

### 配置

- config/ 模块化：server.go / provider.go / redis.go / worker.go / config.go（聚合）。
- 全字段 godoc 注释。
- 配置加载支持 yaml 文件 + 环境变量覆盖。

### HTTP 接口契约

统一响应信封：`{ "code": 0, "data": {}, "message": "" }`，code=0 表示成功。

Phase 1 端点：
- POST /api/v1/auth/captcha — 发送验证码
- POST /api/v1/auth/login/cellphone — 手机号登录
- GET /api/v1/auth/login/qrcode — 获取二维码
- GET /api/v1/auth/login/qrcode/check — 轮询登录状态
- GET /api/v1/auth/status — 查询登录态
- POST /api/v1/auth/logout — 登出
- GET /api/v1/playlists/:id — 歌单详情（全量歌曲）
- GET /api/v1/songs/:id — 歌曲详情
- GET /api/v1/songs/:id/url — 播放 URL（query: level）
- GET /api/v1/songs/:id/lyric — 歌词
- GET /api/v1/search — 搜索（query: q, limit, type）

### wire 装配

- internal/bootstrap/wire.go 定义 provider set，server 和 worker 各取所需子集。
- 装配 provider（registry + netease client + cache + session）+ service + handler/middleware（server 用）+ tasks/scheduler（worker 用）。

### 与 mimo-blog 的关系

- mimo-music 独立 go.mod（module github.com/VOD-Studio/mimo-music）。
- 严格不 import blog-api 任何包。
- mimo-blog 现有音乐代码 Phase 1 不动，迁移留到 Phase 3。
- 依赖隔离验证：每次提交确保 `grep -r "blog-api" mimo-music/` 为空。

## Testing Decisions

### 测试原则

只测外部行为，不测实现细节。测试不应该在重构时频繁改动。

### 主 seam：service 层

测试在 service 层（provider / store / cache 全部 mock）。理由：
- 业务编排逻辑（缓存策略、错误处理、登录态注入、重试）全在 service 层，这是核心。
- provider 是接口，mock 后测试不依赖真实网易云，稳定可重复。
- handler 太薄（解析请求 → 调 service → 封装响应），测它价值低。

service 层测试覆盖：
- 缓存命中时直接返回，不打 provider。
- 缓存未命中时调 provider，结果写入缓存。
- provider 返回 ErrRateLimited 时 service 的降级行为。
- 登录态过期时 service 的重试或报错行为。

### 辅助 seam：HTTP 集成测试

一个集成测试覆盖：
- 响应信封格式正确。
- 统一错误码到 HTTP status 的映射。
- 访问日志中间件输出了正确字段。
- 脱敏中间件确实遮蔽了敏感字段。

这层 mock service，不碰 provider。

### provider/netease 的测试

provider/netease/converter.go 和 errors.go 是纯函数（结构转换、错误映射），用单元测试覆盖各分支。不测真实网络调用——那是 chaunsin 的责任。

### 先例

参考 mimo-blog 的 api/internal/application/media/service_test.go（如果存在）的 service 层测试写法。

## Out of Scope

以下不在 Phase 1，留到后续 Phase：

- 扩展网易云接口（专辑 / 歌手 / FM / 推荐 / 云盘 / 评论 / 签到）— Phase 2。
- 限流熔断装饰器 — Phase 2。
- Cookie 轮换（多账号）— Phase 2。
- 完整 OTel（真实 exporter / 跨服务传播）— Phase 2 / 3。
- SDK 包 pkg/mimomusic（HTTP client）— Phase 3。
- mimo-blog 迁移（删 vkeys / meting，改调 mimo-music）— Phase 3。
- 华为音乐等其他平台 — Phase X。
- 博客 web 内的项目说明文档 — 后续独立需求。
- 用户收藏 / 最近播放等本地持久化数据 — Phase X。

## Further Notes

### 风险

- 网易云风控：chaunsin 库 README 明确警告风控严格。Phase 1 用真实账号 Cookie（非匿名），限流由 middleware 控制。存在被封 Cookie / IP 的可能，这是所有网易云解析项目的共同风险。
- VIP 歌曲：即使登录，部分 VIP 或版权歌曲仍可能拿不到播放 URL。
- chaunsin 单点依赖：若 chaunsin 停更且网易云改接口，需自己 fork 维护。Phase 2 评估是否抽象 provider 接口支持备选源。

### Apifox 项目

Phase 1 需新建一个 mimo-music 的 Apifox 项目。项目 ID 创建后填入 Makefile 的 music-openapi target。

### 提交策略

遵循 AGENTS.md：前后端分离、公共组件单独提交、重构与功能分离、补迁移单独提交。Phase 1 拆成多个原子 commit，每个可独立 revert。
