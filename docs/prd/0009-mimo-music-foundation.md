# PRD: mimo-music 地基阶段（Foundation）

> 状态：✅ 已完成（5 个 issue 全部落地，见下方进度表）
> 关联：[架构 ADR](../adr/mimo-music-architecture.md)、[全功能蓝图](./mimo-music-netease-full-api-roadmap.md)、[Phase 4 PRD](./0008-mimo-music-phase-4.md)
> 范围：把 mimo-music 从旧四层架构（provider/handler/手写 HTTP）迁移到新架构（proto 契约 + engine + endpoint 声明 + grpc-gateway），并迁移已实现的 15 个核心接口

## Problem Statement

Phase 1-3 在旧四层架构（`provider/provider.go` 平台接口 + `provider/netease/` 实现 + `service/` 编排 + `internal/server/handler` 手写 HTTP）上实现了 15 个网易云核心接口。架构 ADR（2026-07-15 重写）已决定整体迁移到新架构：

- Protobuf + grpc-gateway 为唯一契约（gRPC + REST 双暴露）
- 砍掉多平台抽象（Provider/Registry/converter/统一 model）
- 共享执行引擎（engine）+ 领域模型层（model 复用）+ 每接口声明（endpoint）
- cache 集中在 engine.Execute

这套新架构现在只有 ADR 里的签名设计，没有任何代码。地基阶段的任务是：**搭起新架构的骨架，把 15 个已实现接口迁移过去，让 Phase 4 起的扩展有一个可用的地基。**

地基阶段不新增任何网易云接口——15 个接口的功能在 Phase 1-3 已实现，这里只做架构迁移。

## Solution

地基阶段分五个子工程，有严格依赖顺序：

### 1. proto 基础设施（buf + grpc-gateway 脚手架）

从零搭建 proto 工程化：

- `proto/netease/music/v1/` 目录 + buf 配置（`buf.yaml` + `buf.gen.yaml`）
- 8 个领域 proto 文件（song/auth/playlist/search/album/artist/recommend/fm），每个含领域 service + message
- `make proto` 目标：buf generate 一键产出 Go stub（`gen/go/`）+ Rust stub（`gen/rust/`）+ OpenAPI（`gen/openapi/`）
- grpc-gateway 装配：gRPC server + gateway mux 双 server

proto message 复用约定：领域实体（Song/Artist/Album/Playlist/User）定义一次，所有引用它的 rpc 共用。

### 2. engine 核心（crypto/client/errors 迁移 + RawDo/Execute）

把 `provider/netease/` 的脏活迁移到 `internal/netease/engine/`，并实现 ADR 第 3.1 节的签名：

- `crypto.go`：整文件迁移（weapi/eapi 加密，纯标准库，零改造）
- `transport.go`：从 `client.go` 提炼 HTTP transport（weapiPost/postJSON/apiGet + cookie 注入 + extractCookies）
- `errors.go`：网易云错误码映射迁移
- `engine.go`：`Engine` 聚合体 + `RawDo(ctx, meta, params) (json.RawMessage, error)` 深方法
- `execute.go`：`Execute[Req,Resp]` 泛型函数（cache 检查 → MapRequest → RawDo → MapResponse → 回填）
- `retry.go` / `breaker.go`：从 `provider/decorator.go` 的 RetryProvider 迁移并拆分
- `selector.go` / `metrics.go`：cookie 选取 + 指标埋点

### 3. session + cache 基础设施

接口定位统一（现状散落在 provider 包和 service 包）：

- `internal/netease/session/`：`SessionStore` 接口（ADR 第 6 节签名：GetAvailable/ReportSuccess/ReportFailure + AuthRequirement enum）。从现有 `session_rotator.go` 的 round-robin 逻辑 + `store/redis/` 实现迁移。
- `internal/cache/`：`Cache` 接口（Get/Set/Delete），消除现有 provider/cache.go 与 cache/noop.go 的重复定义。
- 实现：redis + noop 迁移。

### 4. 领域模型层首批 5 实体

`internal/netease/model/`：从现有 `provider/netease/converter.go` + `model/` 提炼，建首批 5 实体的 raw struct + map 函数：

- `song.go`：`raw.Song` + `MapSong` + `MapSongs`（从 converter.go 的 toModelSong + joinArtists 合并提炼）
- `artist.go`：`raw.Artist` + `MapArtist` + `MapArtists`（新增，现状嵌在 Song 里）
- `album.go`：`raw.Album` + `MapAlbum`（新增）
- `playlist.go`：`raw.Playlist` + `MapPlaylist`（从 model/playlist.go 迁移，去 Platform 字段）
- `user.go`：`raw.User` + `MapUser`（新增）

消除现有 model/ 与 provider.*Result 的双套类型——统一为 proto message + model 层 raw struct + map 函数。

### 5. 迁移 15 接口（endpoint 声明 + grpc service）

在 1-4 的地基上，把 15 个接口迁移到新架构。每个接口：

- proto 已在步骤 1 定义 rpc + message
- `internal/netease/endpoint/<域>/<接口>.go`：一个 `Endpoint` 声明（Meta + CachePolicy + MapRequest + MapResponse）
- `internal/service/<域>.go`：grpc impl，恒一行 `return engine.Execute(...)`
- CachePolicy 沿用现有 TTL（见下表）

### 迁移后删除旧产物

ADR 第 12 节列的旧产物在本阶段全部删除：

- `provider/`（provider.go/registry.go/converter.go/decorator.go/options.go + netease/）
- `internal/server/`（router/handler/response/middleware）
- `openapi/` + `cmd/export-openapi/`
- `service/`（旧厚编排层，被 internal/service/ 薄路由取代）
- 旧 `model/`（被 internal/netease/model/ 取代）

## 迁移的 15 接口缓存策略（沿用现有）

| 接口 | cache key | TTL |
|---|---|---|
| 歌单详情 | `playlist:detail:{id}` | 24h |
| 歌曲详情 | `song:detail:{id}` | 24h |
| 歌曲 URL | `song:url:{id}:{level}` | 30min |
| 歌词 | `song:lyric:{id}` | 24h |
| 搜索 | `search:{keyword}:{limit}` | 10min |
| 专辑详情 | `album:detail:{id}` | 24h |
| 歌手信息 | `artist:info:{id}` | 24h |
| 每日推荐 | `recommend:daily` | 1h |
| 私人 FM | `fm:personal` | 30min |
| 登录类（captcha/login/qrcode/status/logout） | — | 不缓存 |

## 可复用资产速查（来自勘察）

**直接迁移（改 import 路径）**：crypto.go + crypto_test.go、errors.go 映射逻辑、session_rotator.go round-robin、store/redis/*、cache/redis/cache.go。

**需改造**：client.go（去掉 provider.Options 依赖）、converter.go（转 model 层）、services.go（按能力拆 endpoint）、wire.go（ProviderSet 重构）。

**要删**：internal/server/、openapi/、cmd/export-openapi/、pkg/mimomusic/（旧 HTTP SDK，降级为薄便利层后重做）、provider/decorator.go。

## Testing Decisions

- **engine 层**：RawDo 用 httptest mock 网易云响应，验证加密/HTTP/cookie 注入/错误映射。Execute 用 mock cache + mock RawDo，验证缓存命中跳过、未命中回填、写操作不缓存。
- **model 层**：MapSong/MapArtist 等纯函数测试，fixture 是网易云原始 JSON 样本。
- **endpoint 层**：MapRequest/MapResponse 纯函数测试（15 接口各一组）。
- **service 层**：不测（恒一行，lint 机械校验）。
- **集成**：gRPC server + gateway 起真实进程，grpcurl 或生成 client 调 15 接口的 happy path。

## Out of Scope

- 新增任何网易云接口（357 - 15 = 342 个未实现接口全部不在本阶段）— Phase 4-8
- protoc-gen-netease 自研插件 — 后置到 50-80 接口时
- pkg/mimomusic 薄便利层的完整实现 — 可在本阶段做最小连接管理，也可后置
- mimo-blog api 对接 — 独立需求，用户说「做完之后自己对接」
- Rust client 发布 — gen/rust/ 生成即可，发布是独立需求

## Further Notes

### 迁移策略：大爆炸 vs 渐进

本阶段是大爆炸迁移（旧架构整层删，新架构整层建），不做新旧并存的渐进迁移。理由：新旧架构的契约层（proto vs 手写 handler）和核心抽象（engine.Execute vs service 编排）根本不同，并存会比迁移更混乱。15 个接口规模可控，一个阶段内迁完。

### 依赖顺序的硬约束

5 个子工程的顺序不可调换：proto 没建 → 没法生成 service stub；engine 没建 → endpoint 没法调 RawDo；session/cache 没定位 → engine 拿不到依赖；model 层没建 → endpoint 的 MapResponse 没法复用。

### 拆分

地基阶段拆成 5 个 issue（proto 脚手架 / engine / session+cache / 领域模型层 / 迁移 15 接口），见 `docs/issues/0009-mimo-music-foundation/`。前 4 个有严格顺序依赖，第 5 个（迁移）依赖全部前 4。

### 进度

| issue | 内容 | 状态 |
|---|---|---|
| 0001 | proto 基础设施与代码生成 | ✅ 已完成（`78064dc9`） |
| 0002 | engine 核心层迁移 | ✅ 已完成（`8139a29b`） |
| 0003 | session 与 cache 基础设施 | ✅ 已完成（`9734dde7`） |
| 0004 | 领域模型层首批 5 实体 | ✅ 已完成（`481375a4`） |
| 0005 | 迁移 15 接口并删除旧产物 | ✅ 已完成（`37ac9531`） |
