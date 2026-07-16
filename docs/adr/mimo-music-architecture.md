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
- 缓存（命中跳过真实调用）

引擎拆成子包，每个职责一个文件，可独立测试。**不做单文件巨型 engine.go**（不可测、不可维护）。

engine 对外只暴露一个深方法 `RawDo`——不碰 proto 类型，只收元数据 + 网易云参数，返回原始 JSON。一个方法背后藏全部脏活。deletion test：删掉它，这些复杂度散落到 357 个调用点。

```go
// internal/netease/engine/engine.go

// RawDo 是 engine 唯一对外方法：一个深接口，背后藏加密/HTTP/cookie选取/重试/熔断/指标。
// 不碰 proto 类型，只接收元数据 + 网易云参数，返回原始 JSON。
func (e *Engine) RawDo(ctx context.Context, meta Meta, params map[string]any) (json.RawMessage, error)

// Meta 是网易云 endpoint 的执行元数据。
type Meta struct {
    Path   string        // 网易云 path
    Method string
    Crypto CryptoMethod  // weapi / eapi / linuxapi / none
    Auth   AuthRequirement
}
```

由于 Go「方法不能带类型参数」，engine 另提供一个顶层泛型函数 `Execute`，串起 `MapRequest → RawDo → MapResponse`，并把 cache 集中在这一处（policy 在 endpoint 上、Resp 是具体类型参数，全程类型安全、零 reflection、零注册表）：

```go
// internal/netease/engine/execute.go

// Execute 串起缓存检查 → MapRequest → RawDo → MapResponse → 缓存回填。
// 缓存命中时跳过 RawDo，但 gRPC 链上的 auth/rate/trace/recovery 照常执行
// （它们在 interceptor，Execute 在 service 方法里被调用，时序在拦截器之后）。
func Execute[Req, Resp any](e *Engine, ctx context.Context, ep *Endpoint[Req, Resp], req Req) (Resp, error) {
    // 1. 缓存命中直接返回（policy 在 ep 上，Resp 是具体类型，零 reflection）
    if ep.Cache != nil {
        if hit, ok := e.cache.Get(ctx, ep.Cache.Key(req)); ok {
            var resp Resp
            if err := proto.Unmarshal(hit, &resp); err == nil { return resp, nil }
        }
    }
    // 2. 真实调用：MapRequest → RawDo → MapResponse
    params, err := ep.MapRequest(req)
    if err != nil { var z Resp; return z, err }
    raw, err := e.RawDo(ctx, ep.Meta, params)
    if err != nil { var z Resp; return z, err }
    resp, err := ep.MapResponse(raw)
    if err != nil { return resp, err }
    // 3. 回填缓存
    if ep.Cache != nil {
        if data, err := proto.Marshal(&resp); err == nil {
            e.cache.Set(ctx, ep.Cache.Key(req), data, ep.Cache.TTL)
        }
    }
    return resp, nil
}
```

cache 放在 `Execute` 而非 interceptor 的理由：cache 是唯一的「per-endpoint policy 驱动 + 类型相关序列化」横切关注点，和均匀的 auth/rate/log/trace/recovery 本质不同。policy 和具体 Resp 类型都在 `Execute` 手边，无需注册表查 `FullMethod → CachePolicy`、无需 reflection 反序列化，也消灭了「缓存命中漏鉴权」的拦截器顺序 footgun（auth/rate/trace 在更外层 interceptor，先于 service 执行）。

### 3.2 领域模型层（~25-30 个实体，每个写一次，全局复用）

网易云 357 种响应由收敛的领域实体组合而成：`Song`/`Artist`/`Album`/`Playlist`/`User`/`Comment`/`MV`/`Video`/`DJRadio`/`DJProgram`/`Toplist`/`Event` 等。

每个实体定义一组「网易云原始 JSON 的 struct 镜像 + map 到 proto 的函数」，写一次后全局复用。例如 `MapSong` 被歌曲详情、每日推荐、歌单曲目、专辑曲目、歌手热门、相似歌曲、搜索(单曲)等几十个接口复用。

这是「该复用的复用」在架构上的落点，把看似 357 次的映射塌缩为 ~30 次领域映射 + 接口级组装。

**列表/浏览接口统一用完整实体，禁用列表专用精简 DTO**：一个领域实体 = 一个 proto message，列表/详情/所有 rpc 共用同一类型，不为列表场景建 `XxxSummary`/`XxxListItem`。列表接口里上游没返回的字段留 proto3 零值，调用方要详情明确调详情接口。详见 [ADR: 列表响应统一实体](./mimo-music-list-response-single-entity.md)。

### 3.3 每接口声明（每接口一份，不重复样板）

每个接口拥有一等公民的完整处理，集中在一个 `Endpoint` 声明里：

```go
// internal/netease/endpoint/song/detail.go

// Endpoint 是声明：数据 + 两个映射函数，不是活跃服务。
type Endpoint[Req, Resp any] struct {
    Meta        Meta                    // 网易云 path/method/crypto/auth
    Cache       *CachePolicy            // nil = 不缓存
    NewResp     func() Resp             // 构造响应实例（缓存反序列化用，零 reflection）
    MapRequest  func(Req) (map[string]any, error)
    MapResponse func(Req, json.RawMessage) (Resp, error) // 接收请求，可按 req 字段分支
}

// CachePolicy 声明缓存策略。endpoint 只声明，不执行（执行在 Execute）。
type CachePolicy struct {
    Key func(req any) string  // 从请求算 cache key
    TTL time.Duration
}

// 每接口一个包级 var，是它的完整声明。
var Detail = engine.Endpoint[pb.GetSongDetailRequest, pb.GetSongDetailResponse]{
    Meta: engine.Meta{
        Path:   "/api/v3/song/detail",
        Method: "POST",
        Crypto: engine.CryptoWeAPI,
        Auth:   engine.AuthOptional,
    },
    Cache: nil, // 歌曲详情缓存收益低
    MapRequest: func(req *pb.GetSongDetailRequest) (map[string]any, error) {
        // proto 请求 → 网易云加密前 query/body
    },
    MapResponse: func(raw json.RawMessage) (*pb.GetSongDetailResponse, error) {
        // 网易云 JSON → proto 响应，调 model.MapSongs 组装
    },
}
```

每个接口拥有的完整处理集合：强类型 proto 契约、登录态判定（`Meta.Auth`）、网易云 endpoint 元数据、入参映射、响应组装（调领域模型层 map 函数）、缓存策略、错误映射（在 `MapResponse` 内调 `errors.go`）。

其中 proto 契约建模、入参映射、响应组装是每个接口不可省的专属工作（强类型契约的兑现）；元数据是结构字段，无样板。

### 3.4 protoc-gen-netease：后置，不进地基阶段

自研 protoc 插件（生成元数据声明 + 映射空壳 + 批量校验）**不进地基阶段**。

理由：

- 元数据用 Go 声明（`Endpoint` struct + 包级 `var`）就能表达，自研插件要吃下 proto custom option 学习成本、插件调试成本、buf 集成成本，前期投入大。
- 真正省时间的是批量校验（防漏接口/漏签名）和元数据一致性，这部分可用一个 `go test` 或 lint 脚本做到，不必上插件。
- 现在自研是投机——proto custom option 设计错了，357 接口元数据全得返工。

策略：地基阶段手写 `Endpoint` 声明，把 engine/领域模型层/15 接口迁移做扎实。手写到 50-80 个接口、样板真的痛了，且已知哪些样板值得生成，再上 codegen。届时把 `cmd/protoc-gen-netease/` 加入目录树。

它能生成的（未来）：元数据声明骨架、映射函数空壳签名（带 TODO）、批量校验。不能生成的（永远）：proto message 建模、入参映射逻辑、响应映射逻辑。

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
│   └── worker/                          cookie 健康检查 / URL 刷新 / 缓存预热
│   （cmd/protoc-gen-netease/ 后置：手写到 50-80 接口样板痛了再加，见 3.4）
│
├── internal/                            服务专用（便利层与外部不触碰）
│   │
│   ├── netease/                         网易云引擎 + 全量接口声明（核心层）
│   │   ├── engine/                      共享执行引擎（拆子包，不单文件）
│   │   │   ├── engine.go                Engine 聚合体：RawDo 深方法（持有 client/crypto/session/retry/cache）
│   │   │   ├── execute.go               Execute 泛型函数：缓存检查 → MapRequest → RawDo → MapResponse → 回填
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
│   │   └── interceptor/                 gRPC 横切关注点（均匀切面）
│   │       ├── auth.go                  登录态校验
│   │       ├── rate.go                  限流
│   │       ├── log.go                   访问日志
│   │       ├── trace.go                 OTel trace 注入
│   │       └── recovery.go              panic 恢复
│   │                                    （cache 不在 interceptor，集中在 engine.Execute，见 3.1）
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
- **cache 集中在 `engine.Execute`，endpoint 只声明 `CachePolicy`**：cache 是唯一的 per-endpoint policy 驱动 + 类型相关序列化横切关注点，和均匀的 auth/rate/log/trace/recovery 本质不同，不进 interceptor。声明在 endpoint（`ep.Cache`），执行在 `Execute`，全程类型安全零 reflection。
- **service 每个方法体恒为一行 `return engine.Execute(...)`**：无分支、无 error 包装、无日志。编排全在 engine + endpoint。service 是 gRPC server interface 的 adapter 边界（删掉它，endpoint 声明包会被 server interface 绑架，映射逻辑无法脱离 gRPC 形状单独测）。此约束可 lint/review 机械校验，是防止 service 滑回厚编排层的护栏。
- **领域实体 message 放 proto，全局复用**：`Song`/`Artist` 等定义一次，所有引用它的接口共用。

## 4.5 接缝签名：engine ↔ endpoint ↔ service 数据流

四个核心接缝的具体签名和调用时序，实现时不得偏离。

### service 层签名（恒一行）

service 的每个方法实现生成的 gRPC `XxxServiceServer` interface，方法体恒为一行：

```go
// internal/service/song.go

func (s *songServer) GetSongDetail(ctx context.Context, req *pb.GetSongDetailRequest) (*pb.GetSongDetailResponse, error) {
    return engine.Execute(s.engine, ctx, songendpoint.Detail, req)
}
```

service 持有 `*engine.Engine`，不持有 cache/endpoint/任何编排状态。它存在的唯一理由：实现 gRPC server interface。删掉它把 server impl 塞进 endpoint 包，endpoint 声明包会被 `SongServiceServer` interface 绑架，映射逻辑无法脱离 gRPC 形状单独测。所以 service 是 gRPC server interface 这个 seam 上的 adapter，不是 pass-through。

### 完整调用时序（含 cache）

```
gRPC call（携带 ctx、cookie 元数据）
  ↓
interceptor: recovery → trace → log → rate → auth   ← 均匀横切，每个接口都过
  ↓
service.GetSongDetail(ctx, req)                       ← 恒一行
  ↓
engine.Execute(engine, ctx, songendpoint.Detail, req) ← 顶层泛型函数
  ├─ 1. ep.Cache != nil？查 cache.Get(key)
  │     命中 → proto.Unmarshal(hit, ep.NewResp()) → 返回（RawDo 跳过，endpoint 不执行）
  │     未命中 ↓
  ├─ 2. ep.MapRequest(req) → params
  ├─ 3. engine.RawDo(ctx, ep.Meta, params)
  │     ├─ session.GetAvailable(ctx, ep.Meta.Auth) → cookie
  │     ├─ crypto(ep.Meta.Crypto, params) → 加密请求体
  │     ├─ transport.HTTP(ep.Meta.Path, encrypted) → 网易云原始 JSON
  │     └─ retry / breaker / metrics（命中/失败按 policy）
  ├─ 4. ep.MapResponse(req, raw) → resp（调 model.MapSong 等组装，可按 req 分支）
  └─ 5. ep.Cache != nil？proto.Marshal(resp) → cache.Set(key, data, TTL)
  ↓
return resp
```

**interceptor 顺序的硬约束**：auth 必须在「能触达 `Execute`（含 cache 检查）的任何代码」之前。因为 cache 命中会跳过后续，若 auth 排在 cache 之后，缓存命中会漏掉登录态校验。当前 cache 在 `Execute` 内（service 方法体里），而 auth 在 interceptor（外层），时序天然正确。若将来把任何检查放进 `Execute`，必须同步保证它在 auth 之后。

### cache 命中的类型安全

cache 在 `Execute` 而非 interceptor：`ep.Cache`（policy）和 `Resp`（具体类型参数）都在手边。命中时用 endpoint 声明的 `ep.NewResp` 工厂构造实例，再 `proto.Unmarshal(hit, resp)`，零 reflection（`NewResp` 形如 `func() *pb.X { return &pb.X{} }`）。若改放 interceptor，需额外造 `FullMethod → CachePolicy` 注册表 + reflection 反序列化，并引入拦截器顺序 footgun。cache 是唯一的 per-endpoint policy 驱动 + 类型相关序列化横切关注点，和均匀的 auth/rate/log/trace/recovery 本质不同。

### 第三条执行路径：cookie override

除 `Execute`（走 session 池选取 cookie + 缓存）外，还有两类接口走 cookie override 路径，service 调 `engine.RawDoWithCookieAndInput` 或 service 包的 `executeWithCookie` 辅助：

- **登录类**（auth）：创建新 session 的源头，不查 session 池，捕获 `Set-Cookie` 上报给 SessionStore。
- **写操作 / 特定登录态查询**（playlist 写操作、artist Subscribe、user Account）：cookie 是调用方持有的特定登录态（如某 admin 操作某歌单），不是 session 池轮换的匿名/登录池 cookie。不走缓存（写操作即时生效、Account 查特定账号）。

### cookie 传递机制：凭证出域

cookie 是「转发给上游网易云的凭证」，不是 mimo-music 自身的认证。凭证走 gRPC metadata，不进 proto 字段：

```
gRPC metadata "x-netease-cookie"（REST 经 gateway 传 "Grpc-Metadata-X-Netease-Cookie" header）
  ↓ cookie interceptor（grpc.ChainUnaryInterceptor 第一环）
engine.WithCookie(ctx, cookie)  ← 注入 context
  ↓
engine.RawDoWithCookieAndInput 从 context 取 cookie（CookieFromContext）
  ↓
transport.setCommonHeaders → HTTP Cookie header → 网易云上游
```

cookie context key 归 engine 包（`WithCookie`/`CookieFromContext`），interceptor 是注入方，engine 是消费方，两者解耦——engine 不依赖 server 包。proto request message 不含 cookie 字段，凭证出域保持业务模型干净。`Authorization` metadata key 留给未来 mimo-music 自身鉴权。

cookie override 路径的 endpoint 仍声明 Meta + MapRequest + MapResponse（与 Execute 路径同构），只是 `Cache=nil`、service 走 `executeWithCookie(eng, ctx, ep, req)`（cookie 在 ctx，对 service 透明）。

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
- `engine.Execute` 按 endpoint 声明的 `CachePolicy` 设 TTL（URL 短 TTL、歌单长 TTL），命中跳过真实调用。
- worker 定时刷新热门 URL、Cookie 健康检查。

### 5.3 登录态共享

多请求共用一套 Cookie，并发访问，Cookie 会过期。

应对：
- `internal/netease/session/` 是一等公民。`AuthRequirement` enum 取代字符串参数，避免 leaky interface。登录类接口（captcha/login/qrcode）是创建新 session 的源头，不走 `GetAvailable`。
- 后期支持权重、健康度、限流、风控。
- worker 定时健康检查 Cookie。

### 5.4 全量接口的工程规模

357 接口的真正风险不是写不完，是写崩（样板爆炸 + 契约漂移）。

应对：
- proto 单一真相 + protoc-gen-netease 消除样板。
- 领域模型层复用把映射塌缩到 ~30 次。
- 每接口声明按领域拆目录，可批量校验。

## 6. SessionStore 契约

网易云风控按账号/Cookie 维度，不按接口维度——所以 `GetAvailable` 的参数是 `AuthRequirement` enum 而非字符串，避免 leaky interface。登录类接口（captcha/login/qrcode）是创建新 session 的源头，不走 `GetAvailable`，单独路径。

```go
// internal/netease/session/session.go

// AuthRequirement 表达这次调用需要哪种登录态，驱动 cookie 池选取。
type AuthRequirement int
const (
    AuthAnonymous  AuthRequirement = iota  // 共享匿名 cookie 池
    AuthLoggedIn                           // 已登录 cookie 池（含健康度/权重选取）
)

// SessionStore 管理 cookie 池，是一等公民。
type SessionStore interface {
    // GetAvailable 按登录态需求选取一个可用 session。
    GetAvailable(ctx context.Context, req AuthRequirement) (*Session, error)

    // ReportSuccess 上报某 session 调用成功（用于健康度统计）。
    ReportSuccess(sessionID string)

    // ReportFailure 上报某 session 调用失败（用于风控/降权）。
    ReportFailure(sessionID string, err error)
}
```

`Meta.Auth` 用同一个 `AuthRequirement` 类型，engine 内部 `session.GetAvailable(ctx, meta.Auth)`，类型链自洽。不止 `GetCookie`：后期一定需要权重、健康度、限流、风控，接口现在就留好。

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
- **model 层 raw struct 字段必须注释**：`internal/netease/model/` 的 raw struct 是网易云原始 JSON 镜像，字段名保留网易云缩写（如 `ar`=歌手、`al`=专辑、`dt`=时长、`fee`=付费类型），不注释则不可读。每个字段必须有行尾注释说明含义。即便字段是私有（小写），也要注释——这是可读性要求，不是 godoc 导出要求。
- **proto 注释是契约注释**：写在 proto 里，生成时带过去；Go 实现层注释不重复契约字段含义，只注释实现逻辑。避免双份注释漂移。
- **文风遵循 humanizer-zh**：去 AI 腔。
- **强制 `slog.*Context` 调用**（带 ctx），contextcheck linter 强制。
- **提交遵循 AGENTS.md**：Conventional Commits + 中文 + 原子性，scope 指向最内层模块（如 `feat(search):`，不用 `feat(mimo-music):` 冗余前缀）。
- **文档不出现「参考 xxxx」**：设计自包含，决策过程留 ADR。
- **lint**：golangci-lint + buf lint，与 mimo-blog 一致。
- **测试规范**：见 `docs/guides/go-testing-guide.md`（table-driven + `t.Run` 子测试 + `t.Parallel` + testify）。endpoint 的 `MapRequest`/`MapResponse` 必须有纯函数测试，用网易云 JSON fixture 覆盖各分支。

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
