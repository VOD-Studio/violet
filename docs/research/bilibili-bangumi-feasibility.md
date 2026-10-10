# B 站公开追番与番剧更新数据可行性调查

调查日期：2026-10-10。范围：中国大陆 `bilibili.com` 的公开清单、作品季详情、单集元数据及更新时间表，不包含 `bilibili.tv` 国际站。此文提供需求访谈事实，不实现产品功能，也不替代 B 站的授权或稳定性承诺。

## 结论摘要

- **公开 UID 的追番清单可以匿名读取，已实测成功。** `GET /x/space/bangumi/follow/list` 返回分页结构、季身份及 `follow_status`；本次只读取第一页一项，不保存个人番单。[实际清单请求 A](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259)
- **B 站确有“想看 / 在看 / 已看”三类状态。** 当前站点播放页 JavaScript 明确将状态 `1 / 2 / 3` 对应这三个菜单项。但本次仅实测全部清单与 `follow_status=1` 的空结果，尚未逐类验证非空筛选。[B 站当前播放页源码](https://s1.hdslb.com/bfs/static/ogv/video3/_next/static/chunks/pages/bangumi/play/%5BvideoId%5D-d8ae7246a6f49daf.js)
- **清单的 `type=1` 不等于作品的 `season_type=1`。** 实测 `type=1` 的清单条目为 `season_type=4`，说明追番清单可包含国创；作品详情与更新时间表另以 `1 / 4` 区分番剧和国创。[实际清单请求 A](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259)、[国创详情](https://api.bilibili.com/pgc/view/web/season?season_id=45969)、[官方时间表源码](https://s1.hdslb.com/bfs/static/bangumi-timeline/bangumi-timeline.f36fa54448d5b0612f257219e9bcf0df5ebc7f9b.js)
- **季、媒体详情与单集是不同身份，不能按标题或“第几集”合并。** 已实测季详情返回 `season_id`、`media_id`、`series.series_id`、多个 `seasons`，单集有 `id / ep_id`。[轻音少女第一季详情](https://api.bilibili.com/pgc/view/web/season?season_id=1172)
- **公开更新时间表可以匿名读取，番剧、国创均成功。** 返回按日分组的季、单集、计划时间、发布时间戳、已发布与延迟字段；这是 B 站更新安排，不是全球动漫首播日历，也不自动等于用户有权播放。[番剧时间表](https://api.bilibili.com/pgc/web/timeline?types=1&before=1&after=1)、[国创时间表](https://api.bilibili.com/pgc/web/timeline?types=4&before=1&after=1)
- **私密清单的匿名读取未证实；不能承诺“任何 UID 都可同步”。** 社区文档描述隐私拒绝码 `53013`，但本次未命中该码，不能当作已实测事实。另一次官方空间页访问确实返回 HTTP `412`、业务码 `-412`，而 API 请求成功，证明页面与 API 的可访问性不能互相代替。[官方空间页](https://space.bilibili.com/208259/bangumi)、[社区隐私限制发现资料](https://lxb007981.github.io/bilibili-API-collect/user/space.html#查询用户追番-追剧-明细)

## 调查方法与证据等级

1. **主证据**：B 站实际 API 响应、官方 HTML 的公开元数据，以及由 HTML 引用的第一方 JavaScript。
2. **发现资料**：社区 API 收集文档、RSSHub 源码，用于发现路径、参数和公开样例 UID。它们不是官方文档，不构成鉴权、配额或兼容承诺。
3. **未确认**：未实际请求成功、没有第一方说明，或者只观察到一个样例的行为，明确保留为未知。

实测使用无 Cookie 的只读 `GET`，请求头为 `User-Agent: Mozilla/5.0`、`Accept: application/json,text/html,*/*`；没有加载用户 Cookie、登录态或凭据，没有处理验证码、签名绕过、代理轮换或风控重试。连续 API 请求间隔约 3 秒，每个 API 路径最多请求两次；列表 `ps=1`。不保存完整响应、番单、用户观看进度或评价，仅记录响应结构和公开作品元数据。

**样例 UID 来源**：

- `208259` 来自 [RSSHub 的公开追番路由示例](https://raw.githubusercontent.com/DIYgod/RSSHub/master/lib/routes/bilibili/user-bangumi.ts)，不是临时编造的账号。本调查不据此认定该 UID 的所有清单都公开。
- `98627270` 来自 [《牧神记》官方播放页](https://www.bilibili.com/bangumi/play/ss45969) `__NEXT_DATA__.props.pageProps.dehydratedState` 内的公开 `up_info.mid`，`uname` 为“哔哩哔哩国创”。只作为公开官方账号的接口样例，不推断其个人使用习惯。

## 实际请求记录

下表时间为 UTC，均发生于 2026-10-10。业务 `code` 与 HTTP 状态分别记录；不以 HTTP 200 直接判断业务成功。

| 时间 UTC | 请求 | HTTP / 业务 code | 响应摘要 |
|---|---|---|---|
| 02:33:46 | [A：`/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259`](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259) | `200 / 0`，`message=OK` | `data.list/pn/ps/total`；返回一项，观察到 `follow_status=2`、`season_type=4`。不记录条目标题、用户进度或整个清单。 |
| 02:33:50 | [B：`/x/space/bangumi/follow/list?type=1&follow_status=1&pn=1&ps=1&vmid=98627270`](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=1&pn=1&ps=1&vmid=98627270) | `200 / 0`，`message=OK` | `data.list=[]`、`total=0`；只证明该请求成功且结果为空，不证明非空想看分类的筛选行为，也不是隐私拒绝样例。 |
| 02:33:54 | [C：`/pgc/view/web/season?season_id=1172`](https://api.bilibili.com/pgc/view/web/season?season_id=1172) | `200 / 0`，`message=success` | 《轻音少女 第一季》，`media_id=28220978`、`type=1`、`total=14`，14 个 `episodes`；`series_id=771`，`seasons` 有第一季、第二季、剧场版。 |
| 02:33:58 | [D：`/pgc/view/web/season?season_id=45969`](https://api.bilibili.com/pgc/view/web/season?season_id=45969) | `200 / 0`，`message=success` | 《牧神记》，`media_id=21082961`、`type=4`、`total=0`、`publish.is_finish=0`；`new_ep.title="103"`；`episodes` 实际有 181 项，包含预告。 |
| 02:34:03 | [E：`/pgc/review/user?media_id=28220978`](https://api.bilibili.com/pgc/review/user?media_id=28220978) | `200 / 0`，`message=success` | 匿名成功取得 `result.media`，其 `season_id=1172`、`type=1`、`type_name=番剧`、`new_ep.index="14"`。没有借此读取个人点评。 |
| 02:34:15 | [F：`/pgc/web/timeline?types=1&before=1&after=1`](https://api.bilibili.com/pgc/web/timeline?types=1&before=1&after=1) | `200 / 0`，`message=success` | `result` 含三天，每天有 `date/date_ts/day_of_week/is_today/episodes`。单集有 `season_id/episode_id/pub_index/pub_time/pub_ts/published/delay/delay_reason`。 |
| 02:34:18 | [G：`/pgc/web/timeline?types=4&before=1&after=1`](https://api.bilibili.com/pgc/web/timeline?types=4&before=1&after=1) | `200 / 0`，`message=success` | 同样返回三天与公开国创单集元数据；未验证时间窗极值、完整季度或历史全量。 |
| 02:35:05 | [H：官方空间页 `/208259/bangumi`](https://space.bilibili.com/208259/bangumi) | `412 / -412` | 响应为 `{"code":-412,"message":"request was banned","ttl":1}`。停止对此页面的请求；没有绕过。不能推断此 UID 清单私密，更不能推断 API 全球不可用。 |

### 第一方页面与源码获取

- [《牧神记》播放页](https://www.bilibili.com/bangumi/play/ss45969)：HTTP 200，实测于 02:32:39 UTC。页面 JSON 的 query key 为 `pgc/view/web/simple/season`，携带 `season_id=45969`；其中可取得季、媒体、更新描述、发布信息与官方 UP 信息。
- [播放页当前 bundle](https://s1.hdslb.com/bfs/static/ogv/video3/_next/static/chunks/pages/bangumi/play/%5BvideoId%5D-d8ae7246a6f49daf.js)：HTTP 200，实测于 02:33:16 UTC。看到 `/pgc/view/web/simple/season` 与 `/pgc/view/web/ep/page` 的实际 GET 调用、`page_index` 的逗号拼接，以及三种追番状态的 UI 映射；也包含旧 `/pgc/view/web/season` 路径。未额外请求新分页接口，因此不声称已完成它的分页验证。
- [官方新番时间表页](https://www.bilibili.com/anime/timeline/)：HTTP 200，实测于 02:35:08 UTC，标题为“新番时间表”。
- 该页引用的 [业务 bundle](https://s1.hdslb.com/bfs/static/bangumi-timeline/bangumi-timeline.f36fa54448d5b0612f257219e9bcf0df5ebc7f9b.js) 与 [共享 bundle](https://s1.hdslb.com/bfs/static/bangumi-timeline/1.bangumi-timeline.f36fa54448d5b0612f257219e9bcf0df5ebc7f9b.js) 均 HTTP 200。业务源码实际使用 `pgc/web/timeline?types=...&before=6&after=6`，番剧和国产动画入口分别传 `1 / 4`。
- 提取脚本 URL 时，本地正则误截断了 hash，曾请求同目录下两个不完整路径，均 HTTP 404：`1.bangumi-timeline.f36fa54448d5b0612f25`、`bangumi-timeline.f36fa54448d5b0612f25`。随后按 HTML 原文取得完整 URL，成功读取。**这两个 404 是本地 URL 提取错误，不是 B 站真实资源失效或接口风控。**
- [官方隐私政策入口](https://www.bilibili.com/blackboard/privacy-pc.html)的静态读取只得到页面壳，未取得可用于证明追番清单隐私规则的正文；本调查不把搜索摘要当作规则证据。

## 能力核查

### 1. 公开清单、三种分类与番剧 / 国创范围

**已验证**：清单请求 A 无 Cookie、业务 `code=0`，证明至少该公开样例能按 UID 匿名取得清单。响应条目有 `season_id/media_id/season_type/season_type_name`，还可见 `follow_status`、`new_ep`、`publish`、`series`、`renewal_time`、`rating` 等字段。[请求 A](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259)

**第一方分类证据**：播放页当前源码的菜单回调分别是 `m(e,1)`、`m(e,2)`、`m(e,3)`，文案分别为“标记为 想看”“标记为 在看”“标记为 已看”；`followStatus` 判断也分别为 `1/2/3`。[播放页 bundle](https://s1.hdslb.com/bfs/static/ogv/video3/_next/static/chunks/pages/bangumi/play/%5BvideoId%5D-d8ae7246a6f49daf.js)

**筛选能力边界**：`follow_status=0` 的清单实测返回状态 2 的条目；`follow_status=1` 请求成功但为空。`0=全部` 的参数约定来自 [RSSHub 实现](https://raw.githubusercontent.com/DIYgod/RSSHub/master/lib/routes/bilibili/user-bangumi.ts)；对清单 `follow_status=2/3` 的非空筛选、分页上限、分页过程中的条目排序与去重，本次未实测。不能把 UI 有三种状态等同于所有清单筛选组合均已验证。

**国创范围**：请求 A 的 `type=1` 返回 `season_type=4`，直接证明国创可以出现在追番清单中。季详情 C 的 `type=1` 与 D 的 `type=4`，以及官方时间表的两种入口，证明作品内容类型另有区分。清单 `type=2`（社区资料称追剧）没有实测，也不属于当前已确认的追番需求。[请求 A](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259)、[C](https://api.bilibili.com/pgc/view/web/season?season_id=1172)、[D](https://api.bilibili.com/pgc/view/web/season?season_id=45969)、[官方时间表源码](https://s1.hdslb.com/bfs/static/bangumi-timeline/bangumi-timeline.f36fa54448d5b0612f257219e9bcf0df5ebc7f9b.js)

### 2. 身份：系列、季、媒体详情、单集

公开元数据示例：

| 层次 | 本次可观察的身份 | 证据与限制 |
|---|---|---|
| 系列 | `series.series_id=771`，标题“轻音少女” | [C](https://api.bilibili.com/pgc/view/web/season?season_id=1172)；只证明样例有系列关联，不保证所有作品都有完整系列。 |
| 季 / 内容版本 | `season_id=1172` 第一季、`1173` 第二季、`1175` 剧场版 | [C 的 seasons](https://api.bilibili.com/pgc/view/web/season?season_id=1172)；剧场版也有 season identity，因此 season 不一定是电视剧式的一季。 |
| 媒体详情 | 第一季 `media_id=28220978`，映射 `season_id=1172` | [C](https://api.bilibili.com/pgc/view/web/season?season_id=1172)、[E](https://api.bilibili.com/pgc/review/user?media_id=28220978)；样例不能证明全库永远一对一。 |
| 单集 | 第一季第 1 话 `id=ep_id=21265`；《牧神记》第 1 话 `id=ep_id=836727` | [C](https://api.bilibili.com/pgc/view/web/season?season_id=1172)、[D](https://api.bilibili.com/pgc/view/web/season?season_id=45969)；日历对应字段名为 `episode_id`，不能用 `title` 字符串替代 ID。 |

**[INFERENCE] 身份关联**：`season_id` 是已观察到的清单和日历交点，可用于保持导入条目的关联；系列聚合显示与同名不同配音版的合并并非来源数据自动提供的产品规则。不能仅按作品标题合并不同季、剧场版或内容版本。[清单 A](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259)、[详情 C](https://api.bilibili.com/pgc/view/web/season?season_id=1172)、[日历 F](https://api.bilibili.com/pgc/web/timeline?types=1&before=1&after=1)

### 3. 当前集数、总集数与预告不能混为一谈

- 第一季 C：`total=14`、`new_ep.title="14"`，`publish.is_finish=1`，14 个 episode，样例三者一致。[C](https://api.bilibili.com/pgc/view/web/season?season_id=1172)
- 国创 D：`total=0`、`publish.is_finish=0`、`new_ep.title="103"`，但 `episodes.length=181`。其中 103 项 `section_type=0`，78 项 `section_type=1`；后者样例 `badge=预告`，最后一项 `title="104"`，不是已发布正片第 104 集。`new_ep.id=3537949` 对应 `section_type=0` 的第 103 集，`badge=会员`。[D](https://api.bilibili.com/pgc/view/web/season?season_id=45969)
- **因此不能将数组长度当当前正片集数、将 `total=0` 当零集作品，或将最大集名当最新可看正片。** 这由 D 的实际反例直接支持；正片 / 预告枚举是否还有其他取值、特别篇和分段长篇如何计数，未覆盖。[D](https://api.bilibili.com/pgc/view/web/season?season_id=45969)
- `new_ep.title`、媒体详情的 `new_ep.index` 是字符串；更新说明 `new_ep.desc`、清单 `renewal_time` 是展示文案而非统一的机器时间。本次看到“每周日 11:00更新”与“上部完结，下部敬请期待”。不能默认这些字符串都是连续整数或可可靠解析的每周计划。[D](https://api.bilibili.com/pgc/view/web/season?season_id=45969)、[E](https://api.bilibili.com/pgc/review/user?media_id=28220978)、[清单 A 字段](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259)

### 4. 发布时间、更新时间与时区

**不同字段的实际语义与形态**：

| 字段 | 实测形态 | 能证明什么 |
|---|---|---|
| `publish.pub_time` | 季详情中的无时区日期字符串；C 为 `2009-04-02 00:00:01`，D 为 `2024-10-27 11:00:00` | 季级发布信息，不是“最近一次同步时间”或“下一集的播出时间”。[C](https://api.bilibili.com/pgc/view/web/season?season_id=1172)、[D](https://api.bilibili.com/pgc/view/web/season?season_id=45969) |
| `episodes[].pub_time` | 整数；D 第 1 话 `1729998000`，对应 UTC `2024-10-27T03:00:00Z` | 样例为秒级时间戳。C 第 1 话是 `1557720000`，与其 2009 年季级日期不同；不能当作全球首次首播时间。[C](https://api.bilibili.com/pgc/view/web/season?season_id=1172)、[D](https://api.bilibili.com/pgc/view/web/season?season_id=45969) |
| 清单 `new_ep.pub_time` | 字符串 | 不能与 episode 同名字段的整数直接统一解析。[A 字段结构](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259) |
| 日历 `date/date_ts` | `"10-9" / 1791475200` | 日期字符串没有年份；时间戳对应 UTC `2026-10-08T16:00:00Z`，即 UTC+8 当日零点。[F](https://api.bilibili.com/pgc/web/timeline?types=1&before=1&after=1) |
| 日历 `pub_time/pub_ts` | `"10:00" / 1791511200` | 该公开样例 UTC `2026-10-09T02:00:00Z`，换 UTC+8 为 10:00，与展示时间一致。[F](https://api.bilibili.com/pgc/web/timeline?types=1&before=1&after=1) |
| 日历 `published/delay/delay_reason` | 样例 `1 / 0 / ""` | 当前响应提供发布状态和延迟字段；本次没有命中延迟样例，不能验证延期后的具体处理规则。[F](https://api.bilibili.com/pgc/web/timeline?types=1&before=1&after=1)、[G](https://api.bilibili.com/pgc/web/timeline?types=4&before=1&after=1) |

**时区主证据**：官方时间表业务源码计算当前北京时间使用 `getTimezoneOffset()` 与 `+288e5`（8 小时），其日历时间样例也与 UTC+8 一致。因此该时间表的日分组及展示时间有第一方 UTC+8 证据；它并没有给每个字符串字段声明 IANA 时区，不应把这一证据扩展成所有 API 日期字符串均有官方时区契约。[官方时间表业务源码](https://s1.hdslb.com/bfs/static/bangumi-timeline/bangumi-timeline.f36fa54448d5b0612f257219e9bcf0df5ebc7f9b.js)、[F](https://api.bilibili.com/pgc/web/timeline?types=1&before=1&after=1)

**更新时间边界**：本次响应提供已发布单集、季的更新描述及近期计划时间，但未发现可确认为“作品元数据最后修改时刻”的统一字段；`pub_time` 不能冒充抓取时间或最后修改时间。没有测试 `ETag / Last-Modified` 的可用性，也未证实推送订阅能力。[C](https://api.bilibili.com/pgc/view/web/season?season_id=1172)、[D](https://api.bilibili.com/pgc/view/web/season?season_id=45969)、[F](https://api.bilibili.com/pgc/web/timeline?types=1&before=1&after=1)

### 5. 更新时间表范围与提醒边界

官方页面本身使用 `before=6&after=6`；本次 `before=1&after=1` 实测返回昨天、今天、明天三天。社区文档声称 `before/after` 范围为 0–7，但本次没有测极值，因此 **不能声称能按接口取得完整季度、任意日期或全历史**。[官方业务源码](https://s1.hdslb.com/bfs/static/bangumi-timeline/bangumi-timeline.f36fa54448d5b0612f257219e9bcf0df5ebc7f9b.js)、[F](https://api.bilibili.com/pgc/web/timeline?types=1&before=1&after=1)、[社区参数发现资料](https://esclone82.github.io/bilibili-API-collect/docs/bangumi/timeline.html)

**[INFERENCE] 日历关联**：日历的 `season_id` 可与本站用户导入清单关联，以展示该清单的更新安排；这是基于已观察字段的可行性推论，不是已经实现的交互。计划时间与实际发布、会员抢先看与免费开放仍需明确口径；一次公开日历响应不证明存在 B 站面向第三方的提醒服务。[清单 A](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259)、[F](https://api.bilibili.com/pgc/web/timeline?types=1&before=1&after=1)

### 6. 私密清单、风控与稳定性

- **私密清单：未实测确认。** 发现资料描述用户可隐藏追番 / 追剧，匿名读取受限时可能返回 `53013`，本人查看需要登录态；本次没有经第一方响应验证这些具体规则，也没有请求私有数据或凭据。因此这里只将其记录为必须保留的能力限制候选，不以它作已确认的官方错误码契约。[社区发现资料](https://lxb007981.github.io/bilibili-API-collect/user/space.html#查询用户追番-追剧-明细)
- **明确的风控观察**：官方空间页 H 返回 HTTP `412`，正文 `code=-412/message=request was banned`。同一调查中清单 API A、B 和详情、日历都成功。该失败仅适用于当次页面访问，不代表账号私密、所有接口都失败，或所有网络出口都失败。[H](https://space.bilibili.com/208259/bangumi)、[A](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259)
- **不可作为稳定承诺**：这些路径在本次实测可用，其中季详情和日历有站点源码使用证据；未找到或验证官方对第三方的版本兼容、调用配额、SLA、数据许可或长期可用性承诺。没有用压力请求测限额，也没有测部署服务器出口。[播放页源码](https://s1.hdslb.com/bfs/static/ogv/video3/_next/static/chunks/pages/bangumi/play/%5BvideoId%5D-d8ae7246a6f49daf.js)、[日历源码](https://s1.hdslb.com/bfs/static/bangumi-timeline/bangumi-timeline.f36fa54448d5b0612f257219e9bcf0df5ebc7f9b.js)
- 当前播放页已出现 `simple/season` 和 `ep/page` 的新拆分调用，而旧详情接口本次仍成功。这是接口演进的现场证据，不是旧接口即将下线的公告。[播放页源码](https://s1.hdslb.com/bfs/static/ogv/video3/_next/static/chunks/pages/bangumi/play/%5BvideoId%5D-d8ae7246a6f49daf.js)、[D](https://api.bilibili.com/pgc/view/web/season?season_id=45969)

## 下一轮访谈可直接使用的 9 条事实 / 限制

1. 公开追番清单至少有样例可仅凭 UID 匿名读取；不是必须要求用户提供 Cookie，但不能承诺每个 UID 都可读取。来源：请求 A、私密清单核查边界。
2. B 站已有想看 / 在看 / 已看三类状态；分类映射有当前官方源码证据，清单三类非空筛选尚未全部实测。来源：播放页 bundle、请求 A/B。
3. 追番清单可包含国创，不能只把作品 `season_type=1` 当追番范围；番剧与国创更新时间表要区分 `types=1/4`。来源：请求 A、C/D、官方日历源码。
4. 同系列的第一季、第二季、剧场版有不同 `season_id`；访谈需要确定是按季记录，还是提供系列聚合显示，不能无条件按同名合并。来源：C 的 `series/seasons`。
5. 最新集、预计总集数和包含预告的 episode 数量是三件事；《牧神记》实测为最新正片 103、`total=0`、episode 数组 181。来源：D。
6. 番剧和国创都有可匿名读取的近期日历；只验证了三天窗口，不是全年或全球首播日历。来源：F/G、官方日历源码。
7. 日历有 UTC+8 的第一方证据；季级发布日期、B 站单集发布时间、下一次更新时间不能混作同一时间。来源：C/D/F、官方日历源码。
8. 最新正片可能标记为会员，存在预告、延期字段；“更新了”不自动等于用户能免费观看。提醒若纳入需求，必须先定触发口径。来源：D 的 `badge`、F/G 的 `delay` 字段。
9. 官方空间页已经观察到 HTTP 412 风控，但实际 API 同期成功；应向用户说明导入可失败，不能把失败当作删除清单或覆盖本站观看记录的依据。后一项为产品约束建议，不是 B 站保证。来源：H 与 A/B，结合当前已确认的“同步不覆盖本站记录”要求。

上述条目对应的完整主来源 URL 均见前文，不将社区约定提升为官方承诺。

## 未确认能力清单

- 私密追番清单的第一方拒绝语义与当前实际错误码；本次未命中 `53013`，不访问登录态验证。
- 三类清单的非空筛选完整行为，以及大清单的分页上限、排序变化和全量一致性。
- UID 与本站用户的所有权证明；读取某个公开 UID 并不证明本站操作者拥有该 B 站账号。
- 同名多版本、特别篇、跨季编号、作品下架和季 ID 长期迁移规则。
- 新 `/pgc/view/web/ep/page` 的完整分页、章节及正片 / 预告枚举契约；当前只确认站点调用存在。
- 延期、临时调档、会员抢先看与免费开放的日历覆盖完整性及差异。
- 任意历史日期、完整季度日历或远期计划的获取能力。
- 官方面向第三方的授权、配额、服务等级和 API 稳定性政策；实际部署环境的出口可访问性。
- 面向第三方的通知推送 / webhook、统一最后修改时间与增量同步保证。

## 来源索引

### 第一方

- [公开追番列表 A](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=0&pn=1&ps=1&vmid=208259)
- [清单分类请求 B](https://api.bilibili.com/x/space/bangumi/follow/list?type=1&follow_status=1&pn=1&ps=1&vmid=98627270)
- [季详情 C](https://api.bilibili.com/pgc/view/web/season?season_id=1172)
- [季详情 D](https://api.bilibili.com/pgc/view/web/season?season_id=45969)
- [媒体详情 E](https://api.bilibili.com/pgc/review/user?media_id=28220978)
- [番剧日历 F](https://api.bilibili.com/pgc/web/timeline?types=1&before=1&after=1)
- [国创日历 G](https://api.bilibili.com/pgc/web/timeline?types=4&before=1&after=1)
- [空间页面 H](https://space.bilibili.com/208259/bangumi)
- [《牧神记》播放页](https://www.bilibili.com/bangumi/play/ss45969)
- [当前播放页 JavaScript](https://s1.hdslb.com/bfs/static/ogv/video3/_next/static/chunks/pages/bangumi/play/%5BvideoId%5D-d8ae7246a6f49daf.js)
- [官方新番时间表](https://www.bilibili.com/anime/timeline/)
- [时间表业务 JavaScript](https://s1.hdslb.com/bfs/static/bangumi-timeline/bangumi-timeline.f36fa54448d5b0612f257219e9bcf0df5ebc7f9b.js)
- [时间表共享 JavaScript](https://s1.hdslb.com/bfs/static/bangumi-timeline/1.bangumi-timeline.f36fa54448d5b0612f257219e9bcf0df5ebc7f9b.js)
- [隐私政策入口](https://www.bilibili.com/blackboard/privacy-pc.html)（未取得正文，不作追番隐私规则证据）。

### 社区发现资料（非官方保证）

- [RSSHub user-bangumi 路由源码](https://raw.githubusercontent.com/DIYgod/RSSHub/master/lib/routes/bilibili/user-bangumi.ts)：发现公开 UID 样例及列表 `follow_status=0` 使用方式。
- [用户空间 API 收集](https://lxb007981.github.io/bilibili-API-collect/user/space.html)：发现清单端点与隐私限制候选。
- [番剧详情 API 收集](https://raw.githubusercontent.com/gxwane/bilibili-api-collect-mirror/master/docs/bangumi/info.md)：发现季、媒体与单集端点，以及公开作品样例。
- [时间线 API 收集](https://esclone82.github.io/bilibili-API-collect/docs/bangumi/timeline.html)：发现日历参数与字段；其中 Cookie 标注没有被当作必需鉴权条件，本次 F/G 实际无 Cookie 成功。
