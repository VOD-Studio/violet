# PRD: mimo-music Phase 4

> 状态：✅ 已完成（地基阶段完成 + Phase 4 全部 8 个 issue 实现）
> 关联：[全功能蓝图](./mimo-music-netease-full-api-roadmap.md)、[架构 ADR](../adr/mimo-music-architecture.md)
> 范围：网易云能力扩展 P0 四模块——搜索 type 多类型 + 歌单管理 + 用户模块 + 歌手扩展

## Problem Statement

Phase 1-3 实现了网易云 15 个核心接口（登录、歌曲详情/URL/歌词、歌单详情、搜索单曲、专辑、歌手信息、每日推荐、私人 FM），让 mimo-music 成了一个能跑的服务。但这只是网易云 357 个接口的 4.2%——作为对标 NeteaseCloudMusicApi 全功能的独立服务，现有能力远远不够。

最痛的几个缺口：

- **搜索只能搜单曲**：地基阶段迁移的搜索端点仍只支持 type=1 单曲。网易云支持 9 种搜索类型（专辑/歌手/歌单/用户/MV/歌词/主播/视频/综合），这是已规划却未做的能力。
- **歌单只能按 ID 拉详情**：无法拉用户歌单列表、无法按分类/热门浏览歌单、无法收藏/新建/管理歌单。
- **没有用户能力**：拿不到用户详情、用户歌单、关注/粉丝、动态、播放记录。用户是网易云的中心实体，大量接口依赖用户 UID，缺了这块后续模块难以展开。
- **歌手信息不全**：只有基础信息，拿不到全部歌曲、MV、专辑、描述、相似歌手、粉丝数。

## 前置依赖

**Phase 4 假设地基阶段已完成：**

- proto 基础设施（buf + grpc-gateway 脚手架）可用
- `internal/netease/engine/`（RawDo + Execute）可用
- `internal/netease/session/`（SessionStore）可用
- `internal/netease/crypto.go`（weapi/eapi）已迁移
- 领域模型层首批 5 实体已建：Song / Artist / Album / Playlist / User
- 已实现 15 接口已迁移到新架构（proto 契约 + endpoint 声明 + engine.Execute）
- proto 已有 `SongService` / `PlaylistService` / `AuthService` / `SearchService` / `AlbumService` / `ArtistService` / `RecommendService` / `FMService` 八个领域 service

Phase 4 在这个地基上扩展四个模块，每个接口走 ADR 第 3-4 节的「引擎 + 声明 + 领域模型层」架构。

## Solution

Phase 4 补齐 P0 四模块，约 69 个接口。每个接口严格遵循新架构：

```
proto/netease/music/v1/<域>.proto       proto 契约：领域 service + message（唯一真相）
internal/netease/endpoint/<域>/*.go     每接口声明：Meta + CachePolicy + MapRequest + MapResponse
internal/netease/model/*.go             领域实体映射：复用首批 5 实体的 map 函数 + 本期新建实体
internal/netease/engine/                共享执行引擎（RawDo + Execute，不改动）
internal/service/<域>.go                grpc impl：恒一行 return engine.Execute(...)
```

四模块按依赖顺序推进：

1. **搜索 type 扩展**：proto 给 Search 加 type 枚举，endpoint 透传，9 种类型共用一个 endpoint 声明结构（按 type 返回不同 Result message）。实现成本低，作为 Phase 4 入口。
2. **用户模块**（扩展 UserService）：用户是网易云中心实体，歌单管理依赖用户歌单列表，必须先做。
3. **歌单管理**：用户歌单列表、分类、热门、收藏、新建/删除/更新。
4. **歌手扩展**：全部歌曲、专辑、MV、描述、相似歌手、粉丝、分类列表、收藏。

## User Stories

### 搜索扩展

1. 作为调用方，我想按关键词搜索专辑，这样能找到包含某关键词的专辑列表。
2. 作为调用方，我想按关键词搜索歌手，这样能找到匹配的歌手。
3. 作为调用方，我想按关键词搜索歌单，这样能发现相关主题歌单。
4. 作为调用方，我想按关键词搜索用户，这样能找到特定用户。
5. 作为调用方，我想按关键词搜索 MV，这样能找到音乐视频。
6. 作为调用方，我想按歌词片段搜索，这样通过歌词找歌。
7. 作为调用方，我想做综合搜索（多类型混合），这样一次请求拿到各类型结果。
8. 作为调用方，我想获取搜索建议，这样输入时自动补全关键词。
9. 作为调用方，我想获取热搜词列表（简略），这样知道大家在搜什么。
10. 作为调用方，我想获取热搜词列表（详细），这样看到热搜的完整信息。
11. 作为调用方，我想获取默认搜索关键词，这样首页能展示推荐搜索。

### 用户模块

12. 作为调用方，我想获取账号信息，这样知道当前登录账号的资料。
13. 作为调用方，我想获取用户详情，这样查看指定用户的资料。
14. 作为调用方，我想获取用户信息/歌单/收藏/mv/dj 数量统计，这样了解用户的资源概况。
15. 作为调用方，我想获取用户歌单列表，这样浏览某用户创建和收藏的歌单。
16. 作为调用方，我想获取用户的创建歌单列表，这样只看用户自己创建的。
17. 作为调用方，我想获取用户的收藏歌单列表，这样只看用户收藏的。
18. 作为调用方，我想获取用户关注列表，这样查看某用户关注了谁。
19. 作为调用方，我想获取用户粉丝列表，这样查看某用户的粉丝。
20. 作为调用方，我想获取用户动态，这样查看某用户的活动流。
21. 作为调用方，我想获取用户播放记录，这样查看某用户的听歌历史。
22. 作为调用方，我想获取用户等级信息，这样查看某用户的等级和经验。
23. 作为调用方，我想根据 nickname 获取 userid，这样通过昵称定位用户。
24. 作为调用方，我想判断两个用户是否互相关注，这样了解用户间关系。

### 歌单管理

25. 作为调用方，我想获取精品歌单列表，这样发现高质量歌单。
26. 作为调用方，我想获取精品歌单标签列表，这样按标签筛选精品歌单。
27. 作为调用方，我想获取歌单分类列表，这样浏览所有歌单分类。
28. 作为调用方，我想获取网友精选碟（热门歌单），这样按分类浏览热门歌单。
29. 作为调用方，我想获取歌单收藏者列表，这样查看谁收藏了某歌单。
30. 作为调用方，我想获取歌单的所有歌曲（分页），这样大歌单能分批拉取。
31. 作为调用方，我想收藏或取消收藏歌单，这样管理我的歌单收藏。
32. 作为调用方，我想新建歌单，这样创建自己的歌单。
33. 作为调用方，我想删除歌单，这样清理不需要的歌单。
34. 作为调用方，我想更新歌单名/描述/标签，这样编辑歌单元信息。
35. 作为调用方，我想对歌单添加或删除歌曲，这样管理歌单内容。
36. 作为调用方，我想调整歌单顺序，这样排序我的歌单。
37. 作为调用方，我想调整歌单内歌曲顺序，这样排序歌单内歌曲。

### 歌手扩展

38. 作为调用方，我想获取歌手的全部歌曲（分页），这样浏览歌手完整曲库。
39. 作为调用方，我想获取歌手热门 50 首，这样快速了解歌手代表作。
40. 作为调用方，我想获取歌手的 MV 列表，这样浏览歌手的音乐视频。
41. 作为调用方，我想获取歌手的专辑列表，这样浏览歌手的专辑。
42. 作为调用方，我想获取歌手描述（详细介绍），这样了解歌手背景。
43. 作为调用方，我想获取相似歌手，这样发现同类歌手。
44. 作为调用方，我想获取热门歌手列表，这样发现当下热门歌手。
45. 作为调用方，我想获取歌手分类列表，这样按分类浏览歌手。
46. 作为调用方，我想收藏或取消收藏歌手，这样管理关注的歌手。
47. 作为调用方，我想获取歌手粉丝数，这样了解歌手的人气。
48. 作为调用方，我想获取歌手动态信息，这样查看歌手近期动态。
49. 作为调用方，我想获取歌手的 MV/视频，这样观看歌手的视频内容。

## Implementation Decisions

### 每个 interface 的改动形态（新架构）

每个接口的完整改动是：

- **proto**：领域 service 加 rpc + 对应 message（请求 + 响应）。message 复用已有领域实体（Song/Artist/Album/Playlist/User），新实体（如 MV/Video）在本期 proto 里新建。
- **endpoint 声明**：`internal/netease/endpoint/<域>/<接口>.go` 一个包级 `var`，含 `Meta`（path/method/crypto/auth）+ `CachePolicy`（nil 或带 key/TTL）+ `MapRequest` + `MapResponse`。
- **model 复用**：`MapResponse` 内调 `model.MapSong` / `model.MapPlaylist` 等已有函数组装，不为每个接口重写映射。
- **service**：`internal/service/<域>.go` 加一个方法，恒一行 `return engine.Execute(...)`。
- **测试**：endpoint 的 `MapRequest` / `MapResponse` 是纯函数测试（mock 网易云 JSON）；engine 集成测试复用地基脚手架，不重写。

无 handler、无 router、无 openapi 手写——gRPC service 由 proto 生成，REST 由 gateway 派生。

### 搜索 type 扩展

- proto `SearchService.Search` 的请求 message 加 `SearchType type` 字段，`SearchType` 是 enum（`SEARCH_TYPE_SONG=1` / `ALBUM=10` / `ARTIST=100` / `PLAYLIST=1000` / `USER=1002` / `MV=1004` / `LYRIC=1006` / `DJ=1009` / `VIDEO=1014` / `ALL=1018`）。
- 响应 `SearchResponse` 扩展为联合 message，各类型字段独立（`repeated Album albums = N` / `repeated Artist artists = N` / ...），按 type 填充对应字段。
- endpoint 的 `MapRequest` 透传 type 到上游；`MapResponse` 按 type 分支调对应 model map 函数（搜歌手调 `model.MapArtists`，搜专辑调 `model.MapAlbums`）。
- cache key 加 type 维度（`search:{type}:{keyword}:{limit}`），避免不同 type 串缓存。
- 网易云端点 `/api/search/get`（type 透传，非加密 GET）。

### 用户模块（扩展 UserService）

- proto `UserService` 加 rpc：Account（账号信息，需登录）/ Detail / SubCount（数量统计）/ Playlist（用户歌单列表）/ Follows / Followeds / Events / Record / Level / DetailByName / FollowEachOther。
- 用户歌单列表（Playlist）一次返回全部，按 `userId == creator.userId` 区分创建/收藏。proto 响应带完整列表 + service 层可选过滤参数（proto 请求加 `playlist_filter` enum：`ALL` / `CREATED` / `SUBSCRIBED`）。
- Account 需登录态（`Meta.Auth = AuthLoggedIn`），其余查他人用匿名（`AuthAnonymous`）。
- 新建 model 实体：本期不需要新实体，User 实体已在首批 5 实体中。若网易云返回的用户子结构（如 Event 动态）字段足够多，提炼为 Event 实体放 model 层——否则直接在 endpoint 的 raw struct 里声明。

### 歌单管理

- proto `PlaylistService` 加 rpc：HighQuality / HighQualityTags / CatList / Hot / Subscribers / AllTracks（分页）/ Subscribe / Create / Delete / UpdateName / UpdateDesc / UpdateTags / UpdateTracks / UpdateOrder / UpdateSongOrder。
- 读类（HighQuality/CatList/Hot/Subscribers/AllTracks）做缓存（CachePolicy TTL 24h）；写类（Subscribe/Create/Delete/Update*）`CachePolicy = nil`，`Meta.Auth = AuthLoggedIn`。
- 写成功后不主动失效缓存（cache 在 Execute 内，endpoint 声明无法回填失效逻辑）——读类接口自然过期即可，TTL 24h 足够短。

### 歌手扩展

- proto `ArtistService` 加 rpc：AllSongs（分页）/ TopSongs / MVs / Albums / Desc / Similar / Dynamic / Videos / Fans / TopArtists / Categories / Subscribe。
- 新建 model 实体：MV（被歌手 MV 列表和未来 MV 模块复用）、Video（歌手视频）。若 MVP 字段少，先在 endpoint raw struct 里声明，提炼到 model 层留到该实体被第二个领域复用时。
- TopArtists / Categories 是全局浏览（非按 artistID），仍放 ArtistService。
- 分页接口（AllSongs/MVs/Albums/Videos）的 proto 响应带 `int32 total` + `int32 offset` + `int32 limit`。

### 分页约定

网易云分页用 offset + limit。proto 请求统一 `int32 offset` + `int32 limit`（非页码），响应统一带 `int32 total`。gateway 暴露的 REST 沿用 offset/limit query 参数。

## Testing Decisions

测试原则与地基阶段一致：只测外部行为，不测实现细节。

### 主 seam：endpoint 的 MapRequest / MapResponse

这两个函数是纯函数（proto req → params map / raw JSON → proto resp），单元测试覆盖：

- 各接口的网易云原始 JSON 样本（fixture）→ proto 响应的字段映射正确
- MapRequest 的入参构造（网易云入参格式古怪，如 `ids:[123]`、`c:"[...]"`）
- type 分支（搜索各 type 的返回结构解析）
- 错误码映射（网易云 code != 200 → 统一错误）

### engine 集成测试

复用地基阶段的 engine 测试脚手架，mock 网易云 HTTP 响应，验证：

- 缓存命中时跳过 RawDo（Execute 内部）
- 缓存未命中时调 RawDo，结果回填缓存
- 写操作（CachePolicy=nil）不查不写缓存
- 登录态接口走 SessionStore.GetAvailable，cookie 失效 ReportFailure

### service 层

service 每个方法恒一行 `return engine.Execute(...)`，无独立测试价值（lint 机械校验方法体形态）。行为测试在 endpoint + engine 层覆盖。

## Out of Scope

- 专辑扩展（数字专辑、语种风格馆、新碟上架）— Phase 5
- 推荐扩展（推荐歌单/新音乐/MV/电台/节目）— Phase 5
- 排行榜 — Phase 5
- MV/视频独立模块（MV 详情、播放地址、视频分类）— Phase 5（本期只做歌手关联的 MV/Video 列表）
- 相似/相关（相似歌单、相似音乐）— Phase 5
- 歌曲扩展（喜欢音乐、逐字歌词、音质详情）— Phase 5
- 评论模块 — Phase 6
- 收藏/关注/点赞模块 — Phase 6
- 签到、云盘、动态、音乐人等 — Phase 7
- 播客、助眠、DIFM 等小众功能 — Phase 8
- 用户状态/徽章/绑定信息等边缘用户接口 — 视需求
- 歌单封面上传（涉及文件上传，跨模块）— 独立需求

## Further Notes

### 依赖顺序

四模块有依赖关系：搜索扩展独立可做；用户模块是歌单管理的前置（用户歌单列表依赖用户 UID）；歌单管理和歌手扩展互相独立。实现顺序：搜索扩展 → 用户模块 → 歌单管理 → 歌手扩展。

### 写操作的登录态

创建/删除/更新/收藏类接口 `Meta.Auth = AuthLoggedIn`，engine 内部走 `SessionStore.GetAvailable(ctx, AuthLoggedIn)` 选取已登录 cookie。失败时 `ReportFailure`，对齐地基阶段模式。

### 拆分

Phase 4 拆成 8 个垂直切片 issue（搜索 2、用户 2、歌单 2、歌手 2），见 `docs/issues/0008-mimo-music-phase-4/`。
