# ADR: mimo-music 列表/浏览接口统一完整实体，禁用列表专用 DTO

> 状态：已采纳
> 日期：2026-07-16
> 关联：[架构 ADR](./mimo-music-architecture.md) §3.2 领域模型层

## 背景

网易云 357 个接口中大量是「列表/浏览」类（新碟上架、精品歌单、热门歌手、MV 列表、排行榜目录等），返回某实体的集合。这类接口面临一个建模选择：

- 列表场景返回的实体通常字段较少（上游不返回详情字段，如歌单列表不含 `tracks`）
- 详情接口（`GetPlaylist` 等）返回完整字段（含 `tracks`）

是否应为列表场景定义精简的 DTO message（如 `PlaylistSummary`/`PlaylistListItem`），还是统一用完整实体？

Phase 4 曾引入 `SearchPlaylist`（搜索结果专用的精简歌单），随后被 `HighQuality`/`BrowseHot`/`UserPlaylist` 等浏览/列表接口复用，导致：
- `UserPlaylist` 的 filter（按 `creator.userId` 判断创建/收藏）失效——`SearchPlaylist` 的 `creator` 是字符串昵称，没有 `userId`
- 一个搜索 DTO 反噬了用户/歌单两个模块的契约

Phase 4 code-review 修复时已把浏览/列表接口改回完整 `Playlist`。本 ADR 把这个决策固化。

## 决策

**一个领域实体 = 一个 proto message，所有接口（列表/详情/搜索）返回同一类型。禁止为列表/浏览场景新建精简 DTO。**

具体规则：

1. proto 层：`Song`/`Artist`/`Album`/`Playlist`/`MV`/`Video`/`Toplist` 等领域实体定义一次，所有返回该实体的 rpc 共用同一个 message。
2. model 层：列表场景的 `MapResponse` 有什么字段填什么，上游没返回的字段留 proto3 零值。调用方要拿详情字段（如歌单的 `songs`），明确调详情接口。
3. **例外**：搜索结果的 `Search*` message（`SearchPlaylist`/`SearchUser`/`SearchMV`）是搜索专属的精简视图，字段确实与领域实体不同（如 `SearchPlaylist.creator` 是昵称字符串而非 `User`）。这类 message 限定在 `search.proto` 内，**不得被其他 service 引用**。

## 为什么不用 FieldMask

Google AIP-157 / Netflix 生产实践推荐的「单一 resource + `google.protobuf.FieldMask`」模式不适用于 mimo-music：

- FieldMask 的前提是**服务端拥有完整数据，按需裁剪返回**
- mimo-music 是网易云协议的强类型代理——列表接口字段少是**上游的客观限制**（网易云 `/playlist/highquality/list` 返回的歌单不含 `tracks`，只有元数据），不是 mimo-music 的裁剪选择
- mimo-music 无法用 FieldMask「补全」上游根本不返回的字段；强行实现要么去二次请求详情接口（N+1），要么 FieldMask 形同虚设（mask 了上游没给的字段，返回空）

因此 FieldMask 解决的是「服务端有数据、客户端按需少要」的问题，而 mimo-music 的问题是「上游就少给」，两者不匹配。

## 后果

- proto message 数量收敛到领域实体数（~25-30），不会有 `XxxSummary`/`XxxListItem` 的平行类型 proliferation
- 完整实体在列表场景带一些「详情才有」的字段（如 `Playlist.songs`），这些字段留空是**诚实反映上游数据**，调用方按需调详情接口
- proto3 空 repeated 不占序列化空间，列表用完整实体无传输代价
- 避免了 Phase 4 的 SearchPlaylist 反噬——DTO 一旦存在就会被复用、扩散到不该用的地方

## 代价

- 调用方需知道「列表接口的某些字段是空的，要详情得另调」——这是上游协议的真实形态，proto 注释标注哪些字段在列表场景不填
- 完整实体的 message 会比「精简到极致」的 DTO 略胖，但这是为一致性付出的合理代价
