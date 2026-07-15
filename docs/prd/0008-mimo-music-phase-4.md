# PRD: mimo-music Phase 4

> 状态：待实现
> 关联：[全功能蓝图](./mimo-music-netease-full-api-roadmap.md)、[Phase 1 PRD](./0005-mimo-music-phase-1.md)、[架构 spec](../adr/mimo-music-architecture.md)
> 范围：网易云能力扩展 P0 四模块——搜索 type 多类型 + 歌单管理 + 用户模块 + 歌手扩展

## Problem Statement

Phase 1-3 实现了网易云 15 个核心接口（登录、歌曲详情/URL/歌词、歌单详情、搜索单曲、专辑、歌手信息、每日推荐、私人 FM），让 mimo-music 成了一个能跑的解析代理。但这只是网易云 357 个接口的 4.2%——作为对标 NeteaseCloudMusicApi 全功能的独立服务，现有能力远远不够。

最痛的几个缺口：

- **搜索只能搜单曲**：Phase 1 PRD 就规划了 search 的 type 参数（搜专辑/歌手/歌单/MV/用户/歌词），但实现时硬编码了 type=1，只能搜单曲。这是已规划却漏做的能力。
- **歌单只能按 ID 拉详情**：无法拉用户歌单列表、无法按分类/热门浏览歌单、无法收藏/新建/管理歌单。博主要管理自己的网易云歌单，只能去网易云客户端操作。
- **没有用户能力**：拿不到用户详情、用户歌单、关注/粉丝、动态、播放记录。用户是网易云的中心实体，大量接口依赖用户 UID，缺了这块后续模块难以展开。
- **歌手信息不全**：只有热门 50 首，拿不到全部歌曲、MV、专辑、描述、相似歌手、粉丝数。

## Solution

Phase 4 补齐 P0 四模块，约 69 个接口。每个接口严格走四层架构（provider 接口 → netease 实现 → service 编排 → handler 端点 → SDK 镜像），对齐 Phase 1-3 既定模式。

四模块按依赖顺序推进：

1. **搜索 type 扩展**：透传 type 参数到上游，9 种搜索类型共用同一端点，实现成本低，作为 Phase 4 入口。
2. **用户模块**（新能力域）：用户是网易云中心实体，歌单管理、收藏、动态都依赖用户 UID，必须先做。
3. **歌单管理**：用户歌单列表、分类、热门、收藏、新建/删除/更新。
4. **歌手扩展**：全部歌曲、专辑、MV、描述、相似歌手、粉丝、分类列表、收藏。

## User Stories

### 搜索扩展

1. 作为调用方，我想按关键词搜索专辑，这样能找到包含某关键词的专辑列表。
2. 作为调用方，我想按关键词搜索歌手，这样能找到匹配的歌手。
3. 作为调用方，我想按关键词搜索歌单，这样能发现相关主题歌单。
4. 作为调用方，我想按关键词搜索用户，这样能找到特定用户。
5. 作为调用方，我想按关键词搜索 MV，这样能找到音乐视频。
6. 作为调用方，我想按关键词搜索歌词，这样能通过歌词片段找歌。
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

### 搜索 type 扩展

- `provider.Search` 接口的 `Search` 方法签名扩展：增加 `searchType` 参数（int 或枚举常量），透传到网易云上游的 `type` query 参数。
- type 常量定义在 provider 包：`SearchTypeSong=1` / `SearchTypeAlbum=10` / `SearchTypeArtist=100` / `SearchTypePlaylist=1000` / `SearchTypeUser=1002` / `SearchTypeMV=1004` / `SearchTypeLyric=1006` / `SearchTypeDJ=1009` / `SearchTypeVideo=1014` / `SearchTypeAll=1018`。
- 不同 type 的返回结构不同（搜专辑返回专辑列表、搜歌手返回歌手列表），`SearchResult` 扩展为可容纳多类型的联合结构，或按 type 返回不同 Result 类型。优先用联合结构（避免接口方法膨胀），各类型字段用独立 slice。
- 搜索建议、热搜列表、默认搜索词作为 Search 能力域的额外方法（Suggest / Hot / HotDetail / DefaultKeyword）。
- 搜索端点仍用非加密 GET `/api/search/get`（type 透传），建议/热搜用 weapi。

### 用户模块（新能力域）

- `provider/provider.go` 新增 `User` 子接口，`Client` 新增 `User() User` accessor。
- User 子接口方法：Account（账号信息）/ Detail（用户详情）/ SubCount（数量统计）/ Playlist（用户歌单）/ Follows（关注）/ Followeds（粉丝）/ Events（动态）/ Record（播放记录）/ Level（等级）/ DetailByName（按昵称查）/ FollowEachOther（互相关注判断）。
- 用户接口大多不需要登录态（查别人用匿名 cookie 即可），但 Account（查自己）需要登录。需登录的走 cookie 轮换（对齐 Recommend/FM 模式）。
- 用户歌单列表内部区分创建/收藏：网易云 `/user/playlist` 一次返回全部，按歌单的 `userId == creator.userId` 判断是否创建的歌单，service 层可提供过滤参数。

### 歌单管理

- `provider.Playlist` 接口扩展，新增方法：HighQuality（精品）/ CatList（分类）/ Hot（网友精选碟）/ Subscribers（收藏者）/ Tracks（分页全曲）/ Subscribe（收藏/取消）/ Create（新建）/ Delete（删除）/ UpdateName / UpdateDesc / UpdateTags / AddOrDeleteSongs / OrderUpdate（歌单排序）/ SongOrderUpdate（歌曲排序）。
- 精品歌单标签列表单独一个方法（HighQualityTags）。
- 歌单管理类接口（创建/删除/更新/收藏/排序）是写操作，不做缓存，需登录态。
- 歌单浏览类（精品/分类/热门）做缓存（24h，对齐歌单详情）。

### 歌手扩展

- `provider.Artist` 接口扩展，新增方法：AllSongs（分页全曲）/ TopSongs（热门 50）/ MVs（MV 列表）/ Albums（专辑列表）/ Desc（描述）/ Similar（相似歌手）/ Fans（粉丝数）/ Dynamic（动态信息）/ Videos（视频）/ Sub（收藏/取消）。
- 热门歌手列表（/top/artists）和歌手分类列表（/artist/list）是全局浏览接口，考虑放在 Artist 能力域或单独的 Browse 能力域。优先放 Artist（避免新增能力域），作为 Artist.TopArtists / Artist.Categories。
- 歌手全部歌曲、专辑列表需分页（offset/limit），Result 带分页信息。

### 四层改动范围

每个接口涉及：
- `provider/provider.go`：子接口方法 + Result 类型
- `provider/netease/*.go`：weapiPost/apiGet + 解析结构 + 转 Result
- `service/*.go`：缓存（读类）或直接透传（写类）
- `internal/server/handler/*.go`：HTTP 端点
- `internal/server/router.go`：路由注册
- `internal/bootstrap/wire*.go`：service 装配（User 是新 service，需新 wire provider）
- `pkg/mimomusic/*.go` + `types.go`：SDK 方法 + DTO
- `openapi/`：接口文档
- 各层 `_test.go`

### HTTP 端点契约

沿用统一信封 `{code, data, message}`。

Phase 4 新增端点（按模块）：

**搜索扩展**：
- GET /api/v1/search?type={type}（扩展现有端点）
- GET /api/v1/search/suggest
- GET /api/v1/search/hot
- GET /api/v1/search/hot/detail
- GET /api/v1/search/default

**用户模块**：
- GET /api/v1/user/account（需登录）
- GET /api/v1/users/{id}
- GET /api/v1/users/{id}/subcount
- GET /api/v1/users/{id}/playlists
- GET /api/v1/users/{id}/follows
- GET /api/v1/users/{id}/followeds
- GET /api/v1/users/{id}/events
- GET /api/v1/users/{id}/record
- GET /api/v1/users/{id}/level

**歌单管理**：
- GET /api/v1/playlists/highquality
- GET /api/v1/playlists/highquality/tags
- GET /api/v1/playlists/categories
- GET /api/v1/playlists/hot
- GET /api/v1/playlists/{id}/subscribers
- GET /api/v1/playlists/{id}/tracks（分页）
- POST /api/v1/playlists/{id}/subscribe（需登录）
- POST /api/v1/playlists（新建，需登录）
- DELETE /api/v1/playlists/{id}（需登录）
- PATCH /api/v1/playlists/{id}（更新名/描述/标签，需登录）
- POST /api/v1/playlists/{id}/tracks（添加/删除歌曲，需登录）

**歌手扩展**：
- GET /api/v1/artists/{id}/songs（分页全曲）
- GET /api/v1/artists/{id}/top
- GET /api/v1/artists/{id}/mvs
- GET /api/v1/artists/{id}/albums
- GET /api/v1/artists/{id}/desc
- GET /api/v1/artists/{id}/similar
- GET /api/v1/artists/{id}/fans
- GET /api/v1/artists/{id}/dynamic
- GET /api/v1/artists/{id}/videos
- POST /api/v1/artists/{id}/subscribe（需登录）
- GET /api/v1/artists/top（热门歌手）
- GET /api/v1/artists/categories

## Testing Decisions

测试原则与 Phase 1-3 一致：只测外部行为，不测实现细节。

### 主 seam：service 层

mock provider + mock cache，验证：
- 缓存命中时直接返回，不打 provider
- 缓存未命中时调 provider，结果写入缓存
- 需登录态的接口走 cookie 轮换，cookie 失效时 MarkUnavailable
- 写操作（创建/删除/更新/收藏）不做缓存，直接透传

### provider/netease 层

converter 和 errors 是纯函数，单元测试覆盖各分支（网易云原始结构 → provider Result 的字段映射）。不测真实网络调用。

### SDK 层

httptest.Server mock mimo-music 响应，覆盖成功 / 各错误码 / type 参数透传。

### 新能力域的测试先例

参考 Phase 2 的 album_test.go / artist_test.go（service 层 mock 测试）和 netease/converter_test.go（纯函数测试）。

## Out of Scope

- 专辑扩展（数字专辑、语种风格馆、新碟上架）— Phase 5
- 推荐扩展（推荐歌单/新音乐/MV/电台/节目）— Phase 5
- 排行榜 — Phase 5
- MV/视频模块 — Phase 5
- 相似/相关（相似歌单、相似音乐）— Phase 5
- 歌曲扩展（喜欢音乐、逐字歌词、音质详情）— Phase 5
- 评论模块 — Phase 6
- 收藏/关注/点赞模块 — Phase 6
- 签到、云盘、动态、音乐人等 — Phase 7
- 播客、助眠、DIFM 等小众功能 — Phase 8
- 用户状态/徽章/绑定信息等边缘用户接口 — 视需求
- 歌单封面上传（涉及文件上传，跨模块）— 独立需求
- mimo-blog 前端接入 — 独立需求

## Further Notes

### 依赖顺序

四模块有依赖关系：搜索扩展独立可做；用户模块是歌单管理的前置（用户歌单列表依赖用户 UID）；歌单管理和歌手扩展互相独立。建议实现顺序：搜索扩展 → 用户模块 → 歌单管理 → 歌手扩展。

### 分页约定

网易云的分页用 offset + limit（非页码）。分页接口的 Result 统一带 `Total int` 字段，query 参数统一用 `offset` 和 `limit`（对齐搜索现有模式）。handler 层接收 `page`/`page_size`（前端友好），service 层转换为 offset/limit。

### 写操作的登录态

创建/删除/更新/收藏类接口需登录态。这些接口的 service 层走 cookie 轮换（SessionRotator.NextCookie），对齐 Recommend/FM 的模式。失败时标记 session 不可用。

### 拆分预估

Phase 4 拆成约 10-12 个垂直切片 issue（搜索扩展 2 个、用户模块 4 个、歌单管理 4 个、歌手扩展 3 个）。
