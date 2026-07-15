# mimo-music 架构设计

> 状态：已定稿，待实现
> 日期：2026-07-15（重写，取代 2026-07-14 版的多平台 + 手写 HTTP 架构）
> 范围：完整项目架构，面向网易云全量 357 接口实现与跨语言复用

## 0. 本次重写的根因

上一版架构（2026-07-14）按「网易云解析代理 + 博客音乐后端 + Go SDK 库」三个身份设计，基于手写 HTTP + 多平台抽象 + Go import 复用。它支撑了 Phase 1-3 的 15 个核心接口。

但当目标升级为「全量 357 接口 + Rust 等跨语言可复用 + 未来可能 CLI」时，旧架构暴露三个根本问题：

- **多平台抽象是空转成本**：`Provider` 平台接口 + `Registry` + `converter` + 统一 `model` 让每个接口都要先写一遍平台无关契约再写网易云实现，而当前零个第二平台。
- **Go import 复用跨不了语言**：Go SDK 库（`pkg/mimomusic/`）只有 Go 能用，Rust 等语言无法复用。
- **手写 HTTP 层无法支撑全量**：357 接口逐个手写 handler/router/openapi 是 357 倍样板，不可持续。

本次重写围绕两个根决策重建架构，下面的章节全部基于它们。

## 1. 项目定位

mimo-music 是用 Go 实现的网易云音乐能力服务。

它对标已归档的 NeteaseCloudMusicApi（Node 版），全量实现网易云全部 357 个接口，并在其之上补齐：

- **统一强类型契约**：以 Protobuf 为唯一真相，gRPC 与 REST 双暴露。
- **跨语言复用**：Rust/Go/Python 等语言通过 protoc 生成的强类型 client 接入，无需手写 HTTP。
- **共享执行引擎**：加密、cookie 池、重试、熔断、缓存、可观测性集中在一处，357 接口共享。

它是一个**通用、独立**的网易云协议服务，不为任何特定项目服务（原有「博客音乐后端」身份已剥离，消费方各自对接）。

### 两个身份

| 身份 | 诉求 |
|---|---|
| 网易云协议服务 | 自托管 gRPC + REST 服务，全量实现网易云 357 接口 |
| 跨语言能力底座 | proto 为唯一契约，Rust/Go/Python 等生成强类型 client；未来可能扩展 CLI |

## 2. 根决策

### 2.1 跨语言契约：Protobuf + grpc-gateway（ADR-1）

proto 是契约的唯一真相。一次定义，protoc 同时产出：

```
.proto (唯一契约真相)
  ├── protoc-gen-go + protoc-gen-go-grpc   → Go 服务实现 + gRPC server
  ├── protoc-gen-grpc-gateway              → 同一份 proto 自动生成 REST 端点
  ├── prost / tonic (Rust) 等各语言         → 强类型 client
  ├── protoc-gen-openapiv2                 → OpenAPI spec（curl/Postman/各语言 codegen）
  └── protoc-gen-netease（自研）           → 网易云接口元数据声明 + 映射空壳
```

- **gRPC 给跨语言强类型 client**：Rust 的 tonic/prost 生态成熟，这是业界跨语言最原生的方案，优于 OpenAPI codegen。
- **gateway 自动派生 REST**：curl/Postman/前端直连均可，不牺牲可调试性。
- **单一真相**：proto 是契约，不存在 gRPC 与 REST 两套文档对不上的问题。
- **网易云加密对调用方透明**：weapi/eapi 加密封在服务内部，Rust 等调用方只发普通 gRPC/REST。

### 2.2 专注网易云，砍多平台抽象（ADR-2）

砍掉 `Provider` 平台无关接口、`Registry`、`converter`（netease→统一 model）、统一 `model/` DTO。proto 直接对网易云语义建模，不做中间转换层。

保留三处零成本可扩展口子，承诺「加平台 = 新增，不改动」：

1. **proto package 用平台命名空间**：`netease.music.v1`。将来加华为是 `huawei.music.v1` 并列。
2. **Go 实现层按平台分包**：`internal/netease/`。将来加华为是 `internal/huawei/` 并列。
3. **第二平台走新增 gRPC service**：`proto/huawei/` + `internal/huawei/` + 新 service，不动 netease 任何代码。

这三处口子现在几乎零成本，真来第二平台时是「新增」而非「大改」。不预先做多平台接口（speculative generality）。

## 3. 全量实现机制：引擎 + 声明 + 领域模型层

357 个接口分三种重活，必须分清楚谁可复用、谁只写一次：

### 3.1 共享执行引擎（写一次，357 接口复用）

处理所有接口共享的脏活：

- 加密（weapi/eapi）
- HTTP 调用与 transport
- cookie 池选取（SessionStore）
- 重试 / 熔断
- 指标埋点 / trace 传播

引擎拆成子包，每个职责一个文件，可独立测试。**不做单文件巨型 engine.go**（不可测、不可维护）。

### 3.2 领域模型层（~25-30 个实体，每个写一次，全局复用）

网易云 357 种响应由收敛的领域实体组合而成：`Song`/`Artist`/`Album`/`Playlist`/`User`/`Comment`/`MV`/`Video`/`DJRadio`/`DJProgram`/`Toplist`/`Event` 等。

每个实体定义一组「网易云原始 JSON 的 struct 镜像 + map 到 proto 的函数」，写一次后全局复用。例如 `MapSong` 被歌曲详情、每日推荐、歌单曲目、专辑曲目、歌手热门、相似歌曲、搜索(单曲)等几十个接口复用。

这是「该复用的复用」在架构上的落点，把看似 357 次的映射塌缩为 ~30 次领域映射 + 接口级组装。

### 3.3 每接口声明（每接口一份，不重复样板）

每个接口拥有一等公民的完整处理：

1. 强类型 proto 契约（请求 message + 响应 message）
2. 登录态判定（匿名 / 需登录 / 需特定 cookie 池）
3. 网易云 endpoint 元数据（path / method / 加密方式）
4. 入参映射（proto 请求 → 网易云加密前的 query/body）
5. 响应组装（网易云 JSON → proto 响应，**调领域模型层的 map 函数组装**）
6. 缓存策略（是否缓存 / key 模板 / TTL）
7. 错误映射（网易云错误码 → 统一错误）

其中 1/4/5 是每个接口不可省的专属工作（强类型契约的兑现）；2/3/6/7 由 protoc-gen-netease 从 proto custom option 生成元数据声明，消除样板。

### 3.4 protoc-gen-netease 的能力边界

**能生成**（元数据 + 骨架）：endpoint path、HTTP method、加密方式、登录态要求、缓存策略、映射函数空壳签名（带 TODO）、批量校验（防止漏接口/漏签名）。

**不能生成**（每接口专属的人脑工作）：proto message 建模、入参映射逻辑、响应映射逻辑。

它让你不漏接口、不忘签名、能批量校验，但不替你写映射。响应映射走领域模型层复用，不是从零写。

## 4. 完整目录结构

```
mimo-music/
├── proto/                               唯一契约真相（源码资产，非运行时依赖）
│   └── netease/music/v1/                平台命名空间：netease.music.v1
│       ├── song.proto                   每领域一个 proto，含 service + message
│       ├── playlist.proto
│       ├── auth.proto
│       ├── user.proto
│       ├── search.proto
│       ├── album.proto
│       ├── artist.proto
│       ├── recommend.proto
│       ├── fm.proto
│       ├── comment.proto
│       ├── mv.proto
│       ├── video.proto
│       ├── dj.proto                     电台 / DJ
│       ├── toplist.proto                排行榜
│       ├── clouddisk.proto              云盘
│       ├── signin.proto                 签到 / 云贝
│       ├── event.proto                  动态 / 通知 / 私信
│       ├── musician.proto               音乐人 / VIP
│       ├── podcast.proto                播客 / 助眠 / DIFM / 小众
│       └── common/                      跨领域共享 message（分页、错误码枚举等）
│
├── gen/                                 protoc 生成产物（不手改，随发版发布）
│   ├── go/                              Go stub + message（internal 的唯一依赖）
│   ├── rust/                            prost / tonic（供 Rust client）
│   └── openapi/                         gateway 派生的 OpenAPI（curl/Postman/各语言 codegen）
│
├── cmd/
│   ├── server/                          gRPC server + gateway mux 双 server 入口
│   ├── worker/                          cookie 健康检查 / URL 刷新 / 缓存预热
│   └── protoc-gen-netease/              自研 protoc 插件：生成元数据声明 + 映射空壳
│
├── internal/                            服务专用（便利层与外部不触碰）
│   │
│   ├── netease/                         网易云引擎 + 全量接口声明（核心层）
│   │   ├── engine/                      共享执行引擎（拆子包，不单文件）
│   │   │   ├── engine.go                Engine 聚合体（持有 client/crypto/session/retry）
│   │   │   ├── transport.go             HTTP transport（连接、超时、keepalive）
│   │   │   ├── crypto.go                weapi/eapi 加密（从旧 provider/netease/crypto.go 迁入）
│   │   │   ├── retry.go                 重试策略
│   │   │   ├── breaker.go               熔断
│   │   │   ├── selector.go              cookie 池选取
│   │   │   └── metrics.go               指标埋点
│   │   ├── session/                     SessionStore：cookie 池管理（一等公民）
│   │   │   └── session.go               GetAvailable / ReportSuccess / ReportFailure
│   │   ├── errors.go                    网易云错误码 → 统一错误映射
│   │   ├── model/                       领域映射层（~25-30 实体，每个写一次全局复用）
│   │   │   ├── song.go                  raw.Song struct + MapSong() + MapSongs()
│   │   │   ├── artist.go                raw.Artist + MapArtist()
│   │   │   ├── album.go
│   │   │   ├── playlist.go
│   │   │   ├── user.go
│   │   │   ├── comment.go
│   │   │   ├── mv.go
│   │   │   ├── video.go
│   │   │   ├── dj.go
│   │   │   ├── toplist.go
│   │   │   ├── event.go
│   │   │   └── ...
│   │   └── endpoint/                    每接口声明（按领域拆目录，防单文件膨胀）
│   │       ├── song/                    detail.go / url.go / lyric.go / ...
│   │       ├── playlist/                detail.go / create.go / subscribe.go / ...
│   │       ├── auth/                    login.go / captcha.go / qrcode.go / ...
│   │       ├── user/                    account.go / detail.go / follows.go / ...
│   │       ├── search/                  search.go / suggest.go / hot.go / ...
│   │       └── ...（20 个能力域各一目录）
│   │
│   ├── service/                         grpc service impl：薄路由层，无业务逻辑
│   │   ├── song.go                      每个 method：proto req → endpoint 声明 → engine → proto resp
│   │   ├── playlist.go
│   │   ├── auth.go
│   │   └── ...（20 个领域 service 各一文件，对应 proto 的领域 service）
│   │
│   ├── server/                          gRPC + gateway 接入层
│   │   ├── grpc.go                      gRPC server 装配
│   │   ├── gateway.go                   grpc-gateway mux 装配（自动派生 REST）
│   │   └── interceptor/                 gRPC 横切关注点（切面，不进 netease 层）
│   │       ├── cache.go                 缓存拦截器（cache 策略在此，不散落到各接口）
│   │       ├── auth.go                  登录态校验
│   │       ├── rate.go                  限流
│   │       ├── log.go                   访问日志
│   │       ├── trace.go                 OTel trace 注入
│   │       └── recovery.go              panic 恢复
│   │
│   ├── cache/                           Cache 接口 + 实现
│   │   ├── cache.go                     Cache 接口（依赖倒置）
│   │   ├── noop.go                      空实现
│   │   └── redis/                       Redis 实现
│   │
│   ├── store/                           SessionStore 实现
│   │   └── redis/
│   │
│   ├── bootstrap/                       wire 装配（server / worker 复用）
│   │   ├── wire.go
│   │   └── wire_gen.go
│   │
│   └── infra/                           共享基础设施
│       └── redis/                       共享 Redis 客户端（cache / store 复用连接）
│
├── observability/                       不变
│   ├── logger.go                        slog 初始化 + JSON/text + 动态等级（LevelVar）
│   ├── otel_handler.go                  trace_id 自动注入 slog handler
│   ├── redact.go                        敏感字段脱敏（cookie / phone / token）
│   ├── fields.go                        字段名常量（OTel semantic conventions 风格）
│   ├── sampling.go                      高频日志采样
│   └── tracer.go                        OTel 初始化
│
├── config/                              模块化配置（不变）
│   └── config.go                        聚合（server / redis / worker / netease）
│
├── errors/                              统一错误模型（不变）
│   └── errors.go                        ErrUpstreamUnavailable / ErrRateLimited / ErrNotFound
│
└── pkg/                                 公开包
    └── mimomusic/                       薄便利层：gRPC 连接管理 + 配置 sugar
        ├── client.go                    NewClient(addr, opts...) 建连 + 连接池 + keepalive
        ├── options.go                   WithTimeout / WithLogger / WithDialOption
        └── health.go                    连接健康检查、优雅关闭
```

### 关键纪律

- **`internal/` 依赖 `gen/go`，不依赖 `proto/`**：proto 是源码资产，生成 stub 才是运行时依赖。
- **proto service 按领域拆，不做 357-method 巨型 service**：约 20 个领域 service（`SongService`/`PlaylistService`/...），每个含该领域的几个到几十个 RPC。
- **endpoint 按领域拆目录**：`endpoint/song/detail.go`，非 `api/song.go`，防止单文件膨胀到几千行。
- **cache 走 interceptor，不进 netease 层**：缓存策略集中在 `server/interceptor/cache.go`，不散落到各 endpoint。
- **领域实体 message 放 proto，全局复用**：`Song`/`Artist` 等定义一次，所有引用它的接口共用。

## 5. 四个特有复杂度及应对

### 5.1 上游不可靠

网易云会风控、限流、改接口、返回空。

应对：
- `errors/` 定义统一错误，区分上游不可用、限流、无数据。
- `engine/breaker.go` 熔断、`engine/retry.go` 重试，不侵入各 endpoint。
- `internal/netease/errors.go` 做网易云错误码到统一错误的映射。
- interceptor 限流保护上游。

### 5.2 数据时效性

播放 URL 会过期，Cookie 会失效，歌单会更新。

应对：
- `server/interceptor/cache.go` 按数据类型设 TTL（URL 短 TTL、歌单长 TTL），声明在各 endpoint 元数据。
- worker 定时刷新热门 URL、Cookie 健康检查。

### 5.3 登录态共享

多请求共用一套 Cookie，并发访问，Cookie 会过期。

应对：
- `internal/netease/session/` 是一等公民，SessionStore 接口含 `GetAvailable(ctx, api)` / `ReportSuccess(sessionID)` / `ReportFailure(sessionID, err)`。
- 后期支持权重、健康度、限流、风控。
- worker 定时健康检查 Cookie。

### 5.4 全量接口的工程规模

357 接口的真正风险不是写不完，是写崩（样板爆炸 + 契约漂移）。

应对：
- proto 单一真相 + protoc-gen-netease 消除样板。
- 领域模型层复用把映射塌缩到 ~30 次。
- 每接口声明按领域拆目录，可批量校验。

## 6. SessionStore 契约

```go
// internal/netease/session/session.go

// SessionStore 管理 cookie 池，是一等公民。
type SessionStore interface {
    // GetAvailable 按 api 选取一个可用 session。
    GetAvailable(ctx context.Context, api string) (*Session, error)

    // ReportSuccess 上报某 session 调用成功（用于健康度统计）。
    ReportSuccess(sessionID string)

    // ReportFailure 上报某 session 调用失败（用于风控/降权）。
    ReportFailure(sessionID string, err error)
}
```

不止 `GetCookie`：后期一定需要权重、健康度、限流、风控，接口现在就留好。

## 7. 薄便利层 pkg/mimomusic

只做 gRPC 连接管理 + 配置 sugar，**绝不镜像接口签名**（边界立死，防止长回独立契约）。

| 做的 | 不做的 |
|---|---|
| `NewClient(addr, opts...)` 建连、连接池、keepalive | 任何接口方法签名 |
| dial 配置（超时 / TLS / retry policy） | DTO / 类型镜像 |
| 装配 `gen/go` 生成的各 service client | 业务逻辑 |
| 便捷 opts（`WithTimeout` / `WithLogger`） | 缓存 / 重试（在 interceptor / engine） |
| 连接健康检查、优雅关闭 | |

调用方拿到的是 `gen/go` 原生 client：

```go
c, _ := mimomusic.NewClient("localhost:3721", mimomusic.WithTimeout(5*time.Second))
resp, _ := c.Song().GetSongDetail(ctx, &gen.GetSongDetailRequest{Ids: []int64{347230}})
//         ^ gen/go 原生方法，pkg/mimomusic 不碰签名
```

## 8. 推进顺序

地基先行，再按领域铺开。每个领域第一步是建领域实体，再批量接接口。

| 阶段 | 范围 |
|---|---|
| 地基 | proto 基础设施（buf + protoc-gen-netease + gateway 脚手架）+ engine + session + crypto + 领域模型层首批 5 实体（Song/Artist/Album/Playlist/User）+ 迁移已实现 15 接口到新架构 |
| Phase 4 | 搜索扩展 + 歌单管理 + 用户模块 + 歌手扩展（复用已建实体 + 补歌单写操作） |
| Phase 5 | 专辑扩展 + 推荐扩展 + 排行榜 + MV/视频（新建 MV/Video/Toplist 实体） |
| Phase 6 | 评论 + 收藏/关注 + FM/电台扩展（新建 Comment/DJ 实体） |
| Phase 7 | 签到/云贝 + 云盘 + 动态/私信 + 音乐人（新建 Event/CloudDisk 实体） |
| Phase 8 | 播客/助眠/DIFM/小众 |

完整 357 接口清单与状态见 [全功能蓝图](../prd/mimo-music-netease-full-api-roadmap.md)。

## 9. 技术选型

| 项 | 依据 |
|---|---|
| Protobuf + grpc-go | 唯一契约真相，跨语言强类型 |
| grpc-gateway / protoc-gen-openapiv2 | 一份 proto 双产出 gRPC + REST |
| buf | proto 工程化管理（lint / breaking 检测 / 生成编排） |
| prost / tonic | Rust 强类型 client（核心跨语言诉求） |
| protoc-gen-netease（自研） | 网易云接口元数据声明 + 映射空壳生成 |
| Go 标准库 crypto/aes + crypto/rsa | 自实现网易云 weapi/eapi 加密，零第三方音乐库依赖 |
| go-redis | cache / store 共用，经 infra/redis 统一连接管理 |
| Asynq | worker 异步（Cookie 健康检查、URL 刷新） |
| Prometheus client_golang | 上游不可靠需持续观测 |
| OpenTelemetry SDK | 链路追踪，日志 trace_id 自动注入 |
| slog | 标准库结构化日志 |
| wire | server + worker 共享 bootstrap 装配 |
| tint | 开发环境彩色文本 handler |

## 10. 日志设计（沿用 2026 主流）

结构化 + 可关联 + 可脱敏 + 零文件落盘。详细规范沿用上一版第 6 节，要点：

- **基线**：slog，生产 JSON / 开发 text（tint），生产只写 stdout，日志采集交 sidecar。
- **上下文传播**：`otel_handler.go` 从 ctx 的 SpanContext 提取 trace_id / span_id 注入每条日志。统一用 `slog.InfoContext(ctx, ...)`，contextcheck linter 强制。
- **敏感字段脱敏**：`redact.go` 遍历 attrs 替换 cookie / phone / token。完全遮蔽或可关联不可逆（sha256 前 8 位）。
- **核心层解耦**：`engine/` 依赖极简 Logger 接口，不绑 slog。
- **采样**：高频后台任务（url_refresh / cache_warm）head-based 采样或降级 Debug。
- **动态日志等级**：LevelVar 支持运行时修改，SIGHUP 触发，不重启排障。

字段命名常量（OTel semantic conventions 风格）：`platform`、`user_id`（脱敏）、`request_id`、`task_id`、`trace_id`、`upstream_latency_ms`、`cache_hit`、`error_code`。

## 11. 代码规范

- **godoc 注释全覆盖**：每个导出符号（含结构体字段）都要有注释。沿用 mimo-blog 既有规范。
- **proto 注释是契约注释**：写在 proto 里，生成时带过去；Go 实现层注释不重复契约字段含义，只注释实现逻辑。避免双份注释漂移。
- **文风遵循 humanizer-zh**：去 AI 腔。
- **强制 `slog.*Context` 调用**（带 ctx），contextcheck linter 强制。
- **提交遵循 AGENTS.md**：Conventional Commits + 中文 + 原子性。
- **文档不出现「参考 xxxx」**：设计自包含，决策过程留 ADR。
- **lint**：golangci-lint + buf lint，与 mimo-blog 一致。

## 12. 被取代的旧产物

本次重写后删除或重构：

| 旧产物 | 处置 |
|---|---|
| `provider/provider.go` 平台接口 | 删（ADR-2） |
| `provider/registry.go` | 删 |
| `provider/converter.go` | 删 |
| `model/` 统一 DTO | 删（proto 接管） |
| `internal/server/handler` + `router.go` 手写 HTTP 层 | 删（gateway 生成） |
| `openapi/` + `openapi.json` 手写 | 删（从 proto 生成） |
| `service/` 厚编排层 | 重构为 `internal/service/` 薄路由 + `internal/server/interceptor/` 切面 |
| `pkg/mimomusic/` 手写 client 库 | 降级为薄便利层（只做连接管理，不镜像签名） |
| `provider/netease/crypto.go` | 迁入 `internal/netease/engine/crypto.go` |
