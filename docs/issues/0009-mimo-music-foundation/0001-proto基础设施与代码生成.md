# Issue-0001：proto 基础设施与代码生成

## Parent

PRD：`../../prd/0009-mimo-music-foundation.md`（Solution 第 1 步）
关联：[架构 ADR 第 2.1/4 节](../../adr/mimo-music-architecture.md)

## What to build

从零搭建 proto 工程化基础设施。这是整个地基阶段的第一步——没有 proto，后续 engine/endpoint/service 都无法落地。

### buf 配置

- `proto/buf.yaml`：模块定义，包目录 `proto/netease/music/v1`
- `proto/buf.gen.yaml`：生成配置，调以下插件：
  - `protoc-gen-go` + `protoc-gen-go-grpc` → `gen/go/`（Go stub + gRPC service）
  - `protoc-gen-grpc-gateway` → `gen/go/`（gateway pb，REST 派生）
  - `protoc-gen-openapiv2` → `gen/openapi/`（OpenAPI spec）
  - `prost` + `tonic` → `gen/rust/`（Rust client）
- Makefile 目标 `make proto`：`buf generate` 一键产出全部

### 8 个领域 proto 文件

`proto/netease/music/v1/` 下 8 个文件，对应已实现的 8 个能力域。每个含领域 service + message。message 复用约定：领域实体（Song/Artist/Album/Playlist/User）定义在各自 proto 里（song.proto 定义 Song，其他 proto import 它），不重复定义。

首批 proto 只覆盖 15 个已实现接口的 rpc：

- `song.proto`：`SongService{ GetSongDetail, GetSongURL, GetLyric }` + Song/Artist/Album message
- `auth.proto`：`AuthService{ SendCaptcha, LoginByCellphone, LoginByQrcode, CheckQrcode, LoginStatus, Logout }` + 登录相关 message
- `playlist.proto`：`PlaylistService{ GetPlaylist }` + Playlist message（含内联 Song）
- `search.proto`：`SearchService{ Search }` + SearchResult message（本期只 type=1 单曲）
- `album.proto`：`AlbumService{ GetAlbum }`
- `artist.proto`：`ArtistService{ GetArtist }`
- `recommend.proto`：`RecommendService{ GetDailyRecommend }`
- `fm.proto`：`FMService{ GetPersonalFM }`

`common/` 目录放跨领域共享 message（分页 `PageRequest{offset,limit}` / `PageResponse{total}`，后续扩展）。

### grpc-gateway 装配

- `cmd/server/main.go`：启动 gRPC server + gateway runtime mux 双 server（gateway 监听 HTTP 端口，转发到 gRPC）
- google.api.http annotation 标在每个 rpc 上（gateway 据此生成 REST 路由）

### 依赖更新

go.mod 提为 direct：`google.golang.org/grpc`、`google.golang.org/protobuf`、`grpc-ecosystem/grpc-gateway/v2`。现有 chi 依赖暂留（迁移完成在 issue 0005 删）。

## Acceptance criteria

- [ ] `proto/buf.yaml` + `proto/buf.gen.yaml` 配置完整
- [ ] 8 个领域 proto 文件定义 15 个 rpc + 全部 message
- [ ] 领域实体（Song/Artist/Album/Playlist/User）各定义一次，被引用处 import
- [ ] 每个 rpc 有 google.api.http annotation（gateway REST 路由）
- [ ] `make proto` 成功产出 `gen/go/` + `gen/openapi/`
- [ ] `gen/rust/` 推迟：buf prost 插件配置较重，地基阶段先产出 Go + OpenAPI。Rust client 通过 OpenAPI codegen 接入，或后续 issue 补 buf prost 插件。Rust 生成不阻塞 Go 侧地基推进。
- [ ] common/ 分页 message（PageRequest/PageResponse）推迟到 Phase 4：buf STANDARD 要求子包带 version 后缀，单独建 common 子包不值得，分页 message 在 Phase 4 首个分页接口时直接定义在对应领域 proto 内。
- [ ] `gen/go/` 含全部 service 的 gRPC server interface（可被 service 层 implement）
- [ ] `cmd/server/main.go` 能起 gRPC + gateway 双 server（grpcurl 能连上）
- [ ] go.mod 的 grpc/protobuf/grpc-gateway 提为 direct
- [ ] buf lint 通过（`make proto-lint` 或 `buf lint`）
- [ ] 所有 proto message 和 rpc 有注释（proto 注释是契约注释）

## Blocked by

无 —— 这是地基阶段第一步，全部后续 issue 的前置。
