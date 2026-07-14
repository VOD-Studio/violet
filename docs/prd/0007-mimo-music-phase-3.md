# PRD: mimo-music Phase 3

> 状态：待实现
> 关联：[Phase 1 PRD](./0005-mimo-music-phase-1.md)、[Phase 2 PRD](./0006-mimo-music-phase-2.md)、[架构 spec](../adr/mimo-music-architecture.md)
> 范围：SDK 封装 + OTel 跨服务追踪 + mimo-blog 迁移

## Problem Statement

Phase 2 让 mimo-music 做到了生产可用：Redis 持久化、Cookie 真正生效、Prometheus 可观测、限流熔断保护、专辑歌手推荐 FM 等扩展接口齐全。但 mimo-blog 仍然依赖三个第三方公开解析实例（vkeys / qijieya / injahow）——这些端点随时可能关停，网易云也持续封杀。

Phase 3 要完成闭环：让 mimo-blog 的音乐功能真正切到自托管的 mimo-music，删掉第三方依赖。同时补齐 SDK 包（pkg/mimomusic）让 mimo-music 可作为库被复用，并接入 OTel 真实 exporter 让 trace 跨 mimo-blog → mimo-music 传播。

## Solution

Phase 3 分三步：

1. **SDK 封装**：建 `pkg/mimomusic/` HTTP client 包，封装 mimo-music 全量端点，让外部调用方不必手写 HTTP。
2. **OTel 跨服务传播**：mimo-music 从 noop exporter 切到真实 exporter（OTLP），mimo-blog 调用时注入 trace context，日志和 trace 跨服务串联。
3. **mimo-blog 迁移**：用 pkg/mimomusic 替换 `api/internal/infrastructure/music/provider.go` 里的 vkeys/meting 调用，删掉第三方依赖，接入配置项。

## User Stories

### SDK 封装

1. 作为调用方，我想 import pkg/mimomusic 直接调用 mimo-music 全量端点，这样不必手写 HTTP client。
2. 作为调用方，我想 SDK 自带重试和错误映射，这样网络抖动时不用自己处理。
3. 作为调用方，我想 SDK 的类型与 HTTP 响应一致，这样不用维护两份 DTO。
4. 作为调用方，我想 SDK 支持 context 传入，这样能控制超时和取消。

### OTel 跨服务追踪

5. 作为运维者，我想 mimo-music 接入真实 OTLP exporter，这样 trace 能发送到 Tempo / Jaeger。
6. 作为运维者，我想 mimo-blog 调用 mimo-music 时注入 W3C trace context，这样一个请求的完整链路在 trace UI 中可见。
7. 作为运维者，我想 trace 和日志通过 trace_id 串联，这样从一条日志能跳到对应 trace。

### mimo-blog 迁移

8. 作为博客访客，我想歌单解析走自托管 mimo-music，这样不受第三方服务关停影响。
9. 作为博客访客，我想搜索 / 歌词 / 歌曲详情走 mimo-music，这样解析结果一致且可控。
10. 作为博主，我想 mimo-blog 配置中指定 mimo-music 地址，这样部署时灵活切换。
11. 作为维护者，我想删掉 vkeys / meting 依赖代码，这样不再维护第三方 URL 列表。

## Implementation Decisions

### SDK 包（pkg/mimomusic）

- `pkg/mimomusic/client.go`：HTTP client，构造时传入 base URL + Option（WithHTTPClient / WithTimeout / WithRetry）。
- 按能力分文件：`playlist.go` / `song.go` / `search.go` / `album.go` / `artist.go` / `auth.go` / `recommend.go` / `fm.go`。
- 每个 endpoint 一个方法，返回 model 包的 DTO（与 HTTP 响应结构一致），错误映射到 client 层的哨兵错误。
- 自带指数退避重试（复用 provider 包的 IsRetryable 逻辑或独立实现）。
- 所有方法接收 ctx，支持超时和取消。
- `pkg/mimomusic/errors.go`：HTTP 响应的统一信封错误码 → Go error 映射。

### OTel 跨服务传播

- `observability/tracer.go` 从 noop exporter 切到 OTLP exporter（gRPC / HTTP 双选，配置控制）。
- config 增加 OTel 配置项（exporter 地址 / service name / sampling ratio）。
- mimo-blog 侧：HTTP client 调用 mimo-music 时用 otelhttp.NewTransport 注入 W3C traceparent 头。
- mimo-music 侧：HTTP server 加 otelhttp middleware，从 traceparent 头提取 context。
- worker 的 Asynq 任务也加 trace context 传播。

### mimo-blog 迁移

- 新增 `api/internal/infrastructure/music/mimo_music_provider.go`，实现 `domain/music.MusicProvider` 接口，内部用 pkg/mimomusic client 调用 mimo-music。
- 替换 `api/internal/app/media_container.go` 中的 provider 构造：从 `inframusic.NewProvider()` 改为 `inframusic.NewMimoMusicProvider(cfg)`。
- `api/config.yaml` 增加 `music.mimo_music_url` 配置项。
- 删除 `api/internal/infrastructure/music/provider.go`（vkeys / meting 实现）及相关测试。
- ParseEmbedURL 的 QQ 音乐（tencent）平台：mimo-music Phase 3 仍不支持 tencent，EmbedInfo 解析逻辑中 QQ 音乐走降级（返回 unsupported 错误或保留旧逻辑作 fallback）。
- 迁移后验证：歌单解析、搜索、歌词、歌曲详情全量回归。

### 配置

- mimo-music config 增加 OTel 段：exporter 类型（none / otlp-grpc / otlp-http）、endpoint、service name、sample ratio。
- mimo-blog config 增加 music 段：mimo_music_url（默认 http://localhost:3721）。

### wire 装配

- mimo-music bootstrap 增加 OTel exporter provider。
- mimo-blog media_container 注入 pkg/mimomusic client（带 OTel transport）。

## Testing Decisions

- SDK 包：用 httptest.Server mock mimo-music HTTP 响应，覆盖成功 / 错误码 / 重试 / 超时。
- OTel：用 in-memory exporter（otel/sdk/trace/tracetest）验证 span 生成和 context 传播。
- mimo-blog 迁移：MusicProvider 接口测试不变（mock provider），切换实现后回归全部 service 层测试。
- 迁移集成测试：启动 mimo-music + mimo-blog，验证端到端歌单解析链路。

## Out of Scope

- 华为音乐等其他平台 — Phase X。
- 评论、签到、云盘等网易云社交功能 — 视需求。
- mimo-blog 前端播放器完善（实际音频播放）— 独立需求，非 Phase 3 范围。
- mimo-blog admin 音乐管理界面 — 独立需求。
- QQ 音乐（tencent）平台支持 — mimo-music 不在 Phase 3 支持。

## Further Notes

### 风险

- QQ 音乐降级：mimo-blog 现有 EmbedInfo 解析支持 tencent 平台，迁移后 mimo-music 不支持。需明确降级策略（报错 or 保留旧 fallback），避免静默失败。
- 网易云风控不变：mimo-music 自托管后仍受网易云风控约束，Cookie 轮换和限流熔断是关键防线（Phase 2 已建）。
- OTel 基础设施依赖：真实 exporter 需要部署 Tempo / Jaeger / Collector。本地开发可用 noop，生产需运维配合。

### 迁移验证清单

- 歌单 ID 解析：网易云公开歌单能拉取完整歌曲列表。
- 搜索：关键词搜索返回正确结果。
- 歌词：歌曲 LRC 歌词完整获取。
- 歌曲详情：ID 查询返回正确元数据。
- 播放 URL：带登录态的歌曲能拿到播放直链。
- trace 串联：mimo-blog → mimo-music 的请求在 trace UI 中是一条完整链路。

### 拆分预估

Phase 3 拆成约 6-7 个垂直切片：

1. SDK 包 pkg/mimomusic 骨架 + client 构造 + 错误映射
2. SDK 包各能力方法（playlist / song / search / album / artist）
3. SDK 包登录态能力（auth / recommend / fm）
4. OTel 真实 exporter 接入 + config
5. OTel 跨服务 trace context 传播（server middleware + HTTP transport）
6. mimo-blog mimo_music_provider 适配器实现 + 配置项
7. mimo-blog 迁移切换 + 删除 vkeys/meting + 回归验证
