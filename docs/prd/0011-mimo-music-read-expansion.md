# PRD: mimo-music 读类扩展（Bounded Context）

> 状态：待实现
> 关联：[全功能蓝图 roadmap](./mimo-music-netease-full-api-roadmap.md)、[架构 ADR](../adr/mimo-music-architecture.md)、[列表响应统一实体 ADR](../adr/mimo-music-list-response-single-entity.md)、[cookie 重构 PRD](./0010-mimo-music-cookie-metadata-refactor.md)（已完成）
> 范围：深化现有实体的查询能力——普通专辑扩展 + 相似/相关 + 歌曲扩展 + 推荐扩展。无新领域实体。

## Problem Statement

地基阶段建立了 Song/Artist/Album/Playlist/User 五个领域实体，Phase 4 扩展了搜索/歌单/用户/歌手。但「歌曲」和「专辑」两个核心实体仍只有最基础的查询——歌曲只有详情/URL/歌词，专辑只有内容详情。网易云围绕歌曲和专辑有大量深化能力尚未实现：

- **歌曲深化缺失**：喜欢音乐、逐字歌词、音质详情、红心数量、动态封面、创作者信息等。逐字歌词（yrc）是结构化时间戳格式，和现有纯文本歌词是两种数据形态。
- **专辑深化缺失**：新碟上架、最新专辑、收藏专辑、专辑动态信息等。数字专辑（购买/销量/榜单）是独立体系，归数字专辑 Context，本 Context 只做普通专辑。
- **相似/相关能力缺失**：基于歌曲找相似歌单/相似音乐/听歌的人，基于歌单找相关歌单。这些是「推荐发现」的入口。
- **推荐能力单薄**：只有每日推荐歌曲，缺推荐歌单、推荐新音乐。

本 Context 不引入新实体，全是 Song/Album/Playlist/User 的深化查询 + 少量写操作（喜欢音乐、收藏专辑），与 Phase 4 同构，风险低。

## Solution

四个子模块，约 28 个接口。每个接口遵循「引擎 + 声明 + 领域模型层」架构（ADR §3-4）：

```
proto/netease/music/v1/*.proto       proto 契约：领域 service + message（唯一真相）
internal/netease/endpoint/<域>/*.go  每接口声明：Meta + CachePolicy + NewResp + MapRequest + MapResponse
internal/netease/model/*.go          领域实体映射：复用现有 MapSong/MapAlbum/MapPlaylist + 新建逐字歌词结构
internal/service/*.go                grpc impl：读类恒一行 Execute，写类恒一行 executeOverride
```

四模块：

1. **歌曲扩展**（SongService 扩展）：喜欢音乐、垃圾桶、不感兴趣（写，executeOverride）；可用检查、喜欢列表、本地匹配、音质详情、红心数量、是否喜爱、动态封面、副歌时间、创作者信息（读，Execute）；逐字歌词（独立 rpc + WordLyric message）。
2. **专辑扩展**（AlbumService 扩展）：新碟上架、最新专辑、收藏专辑列表、专辑动态、全部新碟、专辑歌曲音质（读，Execute）；收藏/取消收藏（写，executeOverride）。
3. **相似/相关**（按返回实体归属各 service）：相似歌单（PlaylistService）、相似音乐（SongService）、听歌的人（UserService）、相关歌单/相关歌单推荐（PlaylistService）。5 个独立 rpc，各调对应 model map 函数。
4. **推荐扩展**（RecommendService）：每日推荐歌单、推荐歌单、推荐新音乐。返回 Playlist/Song，复用现有实体。

## User Stories

### 歌曲扩展

1. 作为调用方，我想喜欢或取消喜欢一首歌，这样管理我的红心列表。
2. 作为调用方，我想把歌曲丢进垃圾桶，这样减少它的推荐权重。
3. 作为调用方，我想标记每日推荐歌曲不感兴趣，这样影响后续推荐。
4. 作为调用方，我想检查音乐是否可用，这样知道能否播放。
5. 作为调用方，我想获取喜欢音乐列表，这样看我的红心歌曲。
6. 作为调用方，我想本地歌曲文件匹配网易云歌曲，这样补全本地音乐元数据。
7. 作为调用方，我想获取歌曲音质详情，这样知道有哪些音质可选。
8. 作为调用方，我想获取歌曲红心数量，这样了解歌曲受欢迎程度。
9. 作为调用方，我想判断歌曲是否已喜爱，这样在 UI 标记红心状态。
10. 作为调用方，我想获取歌曲动态封面，这样展示动态封面图。
11. 作为调用方，我想获取副歌时间，这样跳到歌曲高潮段。
12. 作为调用方，我想获取歌曲创作者信息，这样了解作词作曲编曲。
13. 作为调用方，我想获取逐字歌词，这样实现卡拉 OK 式逐字高亮。
14. 作为调用方，我想获取逐字歌词（带时间戳结构），这样精确同步每字每句。

### 专辑扩展

15. 作为调用方，我想获取新碟上架，这样发现新专辑。
16. 作为调用方，我想获取最新专辑，这样看本周新专。
17. 作为调用方，我想获取已收藏专辑列表，这样管理我的专辑收藏。
18. 作为调用方，我想收藏或取消收藏专辑，这样管理收藏。
19. 作为调用方，我想获取专辑动态信息，这样看专辑的动态更新。
20. 作为调用方，我想获取全部新碟，这样分页浏览所有新专辑。
21. 作为调用方，我想获取专辑歌曲的音质，这样知道专辑内歌曲可选音质。

### 相似/相关

22. 作为调用方，我想基于歌曲获取相似歌单，这样发现相关歌单。
23. 作为调用方，我想基于歌曲获取相似音乐，这样发现相似歌曲。
24. 作为调用方，我想基于歌曲获取听歌的人，这样找到同好。
25. 作为调用方，我想基于歌单获取相关歌单，这样发现更多歌单。
26. 作为调用方，我想获取相关歌单推荐，这样扩展发现。

### 推荐扩展

27. 作为调用方，我想获取每日推荐歌单，这样获得每日个性化歌单。
28. 作为调用方，我想获取推荐歌单，这样发现热门歌单。
29. 作为调用方，我想获取推荐新音乐，这样发现新歌。

## Implementation Decisions

### 每个 interface 的改动形态（新架构，Phase 4 模式）

每个接口的完整改动：

- **proto**：领域 service 加 rpc + 对应 message（请求 + 响应）。message 复用现有领域实体（Song/Album/Playlist/User）。
- **endpoint 声明**：`internal/netease/endpoint/<域>/<接口>.go` 一个包级 `var`，含 `Meta` + `CachePolicy` + `NewResp` + `MapRequest` + `MapResponse`。
- **model 复用**：`MapResponse` 调 `model.MapSong` / `model.MapAlbum` / `model.MapPlaylist` 等已有函数组装。
- **service**：读类 `internal/service/<域>.go` 恒一行 `return engine.Execute(...)`；写类 `return service.executeOverride(...)`（cookie 经 metadata 传入，已在 context）。

### 读/写区分

- **读类**（~22 个）：`Meta.Auth = AuthAnonymous` 或 `AuthLoggedIn`（推荐/喜欢列表需登录态），走 `Execute`（缓存），`CachePolicy` TTL 按接口性质定（详情类 24h、推荐类 1h）。
- **写类**（#40 喜欢音乐、#41 垃圾桶、#341 不感兴趣、#120 收藏专辑）：`Meta.Auth = AuthLoggedIn`，走 `executeOverride`（cookie override 路径，`CachePolicy=nil`）。

### 逐字歌词独立 rpc

歌曲详情的 `GetLyricResponse` / `Lyric` message 是纯文本（lrc/translated/romanized）。逐字歌词（yrc）是结构化时间戳格式，新建独立 rpc `GetWordLyric` + `WordLyric` message（保留时间戳结构：每句含开始时间 + 每字含开始/持续时长）。不合并进歌词接口——逐字歌词体积大，调用方按需取。

### 相似/相关按返回实体归属

5 个相似/相关 rpc 按返回实体归属各 service（不建 SimilarService）：
- 相似歌单（返回 Playlist）→ PlaylistService
- 相似音乐（返回 Song）→ SongService
- 听歌的人（返回 User）→ UserService
- 相关歌单、相关歌单推荐（返回 Playlist）→ PlaylistService

rpc 名带 Similar/Related 前缀表达业务语义。

### 列表响应统一实体

遵循[列表响应统一实体 ADR](../adr/mimo-music-list-response-single-entity.md)：列表/浏览接口（新碟列表、推荐歌单列表等）用完整 Album/Playlist 实体，repeated songs 等重字段留空，不建精简 DTO。

### 分页约定

网易云用 offset + limit。proto 请求统一 `int32 offset` + `int32 limit`，响应带 `int32 total`。

## Testing Decisions

测试原则与 Phase 4 一致：只测外部行为，不测实现细节。

### 主 seam：endpoint 的 MapRequest / MapResponse

纯函数测试（proto req → params map / raw JSON → proto resp），覆盖：
- 各接口的网易云原始 JSON 样本（fixture）→ proto 响应字段映射
- MapRequest 入参构造（网易云古怪格式如 `ids:[...]`）
- 错误码映射

### engine 集成测试

复用 cookie 重构时建的 `WithBaseURL` + httptest + 内存 cache 脚手架，验证缓存命中/回填（已覆盖通用路径，本 Context 不重复）。

### service 层

service 每个方法恒一行，无独立测试价值（lint 机械校验）。

## Out of Scope

- **数字专辑**（#115/#145/#160-163/#217/#218，9 个）：归数字专辑 Context，含购买/销量/榜单/语种馆。
- **MV/视频相关**：#33 相似 MV、#46 推荐 MV、#51/#150 独家放送、#151 推荐视频 → MV/视频 Context（依赖 MV/Video 实体）。
- **电台/节目推荐**：#49 推荐电台、#50 推荐节目 → FM/电台 Context（依赖 DJ 实体）。
- **排行榜**：归排行榜 Context（Toplist 实体）。
- 歌单写操作的排序（#148/#149）：端点不稳定，推迟验证。

## Further Notes

### 依赖顺序

四模块互相独立，可任意顺序推进。建议歌曲扩展先（接口最多、逐字歌词建模有决策价值），专辑/相似/推荐随后。

### cookie 传递

写操作（喜欢音乐、收藏专辑等）走 `executeOverride`，cookie 经 metadata `x-netease-cookie` 传入（cookie 重构已完成，PRD 0010）。proto request message 不含 cookie 字段。
