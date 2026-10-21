# violet / api

Go 后端服务，为博客平台提供 RESTful API。采用 **DDD 四层架构**（领域驱动设计），支持文章、评论、音乐、表情、项目管理、用户认证与权限等功能。

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Go 1.26.10 |
| Web 框架 | chi v5 |
| ORM | GORM（仓储实现；生产表结构由 SQL 迁移管理） |
| 数据库 | PostgreSQL 16 + golang-migrate（SQL 迁移） |
| 缓存 | Redis 7（session / 验证码 / 限流 / 状态存储） |
| 认证 | Opaque session cookie + CSRF double-submit |
| 依赖注入 | 手工装配（`internal/app/*_container.go` 模块容器，wire 已移除） |
| 邮件 | Resend API |
| 配置 | Viper（YAML + 环境变量） |
| 日志 | zerolog |

## 快速开始

```bash
# 1. 初始化环境（复制根 .env 模板；api/config.yaml 已入库自带注释，无需复制）
make env

# 2. 启动基础设施（PostgreSQL + Redis）并迁移
make up
make migrate

# 3. 启动 API（热重载）
make api
```

或从项目根目录一键初始化：

```bash
make setup   # 复制环境变量、启动数据库、执行迁移
make api     # 启动 API
```

服务默认监听 `:9090`，API 前缀 `/api/v1`。

文章仅提交 `content_md` 时由 `application/markdown` 的 Goldmark 解析器生成 HTML：公式和高亮遵守代码、转义与围栏边界；Mermaid 与可运行围栏生成保留源码的语义载体。可运行标记支持 `run` / `runnable`，资源参数允许含空格的 JSON。`application/post` 的 HTML 转 Markdown 保留脚注重复引用、多段正文、代码围栏及带属性的表格；具体格式见[编辑器手册·存储与有损](../web/src/features/editor/docs/storage.md)。

GitHub 提示块识别独占首行的 `[!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]`、`[!CAUTION]`，普通引用和代码示例保持原义。HTML 转 Markdown 保留原生 `<sub>/<sup>` 与 `<details>/<summary>`，载体内换行使用字符实体保留；若载体内部包含脚注引用，则保留整篇 HTML，避免转换定义时更换 ID 导致断链。已保存的 HTML 不会因解析器更新而自动重写。

## 目录结构

```text
api/
├── cmd/
│   ├── server/            # 应用入口（路由注册 + 依赖装配 + 启动）
│   ├── migrate/           # 数据库迁移 CLI
│   ├── check-publications/ # 发布物投影一致性校验 CLI
│   └── export-openapi/    # OpenAPI 导出 CLI
├── config/                # 配置加载（Viper）
├── migrations/            # 数据库迁移脚本（golang-migrate）
├── internal/
│   ├── app/               # 依赖注入容器（每个模块一个 *_container.go）
│   ├── domain/            # 领域层：聚合根、值对象、仓储端口、领域服务
│   ├── application/       # 应用层：用例（CQRS：command/query）
│   ├── infrastructure/    # 基础设施层：仓储实现、外部 API 适配器、SessionStore
│   ├── interfaces/http/   # 接口层：HTTP handler + 中间件
│   ├── middleware/        # 全局 HTTP 中间件（Session/CSRF/限流/CORS/审计）
│   ├── job/               # 定时任务（订阅抓取调度、文件清理）
│   ├── migrate/           # 迁移执行器
│   ├── openapi/           # OpenAPI 文档生成
│   └── service/           # 启动期服务（B站表情种子）
└── uploads/               # 文件存储目录（运行时生成）
```

### DDD 四层架构

请求流转：`HTTP Request → [middleware] → interfaces/handler → application/usecase → domain/entity → infrastructure/repo → Database`

| 层 | 职责 | 依赖方向 | 示例 |
|----|------|---------|------|
| **domain** | 业务核心：聚合根、值对象、仓储端口（接口）、领域错误。零外部依赖。 | 无（被其他层依赖） | `User` 聚合根、`UserRepository` 接口 |
| **application** | 用例编排：协调领域对象完成业务流程，不含业务规则。CQRS 拆分 command/query。 | 依赖 domain | `RegisterUserHandler`（注册用例） |
| **infrastructure** | 技术实现：数据库访问（GORM）、外部 API 调用、Redis session 存储等。实现 domain 端口。 | 依赖 domain（实现端口） | `UserRepository` 的 GORM 实现 |
| **interfaces** | 入口适配：HTTP handler、请求/响应 DTO、路由注册。不含业务逻辑。 | 依赖 application | `auth.Handler.Register` |

**核心原则**：依赖只能从外向内（interfaces → application → domain ← infrastructure）。domain 层不依赖任何其他层。

## 认证模型：Opaque Session Cookie

项目已用 **opaque session cookie** 取代 access/refresh JWT：

| cookie | 内容 | HttpOnly | 作用 |
|--------|------|----------|------|
| `violet_session` | 不透明 session id（cryptographically random ≥256-bit） | 是 | 鉴权凭证，后端查 Redis session 鉴权 |
| `violet_csrf` | CSRF token | 否 | double-submit：写请求需回传 `X-CSRF-Token` |
| `violet_uid` | user_id | 否 | 前端直读，减少一次请求 |

### 生命周期

- **滑动续期（idle timeout）**：后端中间件对每个带有效 session 的真实请求延长 Redis expiry，**不轮换 session id、不产生 Set-Cookie**。
- **绝对寿命（max）**：`max <= 0` 表示无上限；`max > 0` 从登录起算强制过期。
- 改密码、重置密码后删除该用户全部 session，强制重登。

### SSR 探活

`/auth/session` 为 SSR 只读端点：读 cookie → 查 Redis → 返回 claims，**不续期、不写 cookie**。这是避免 TanStack Start server function 无法透传 `Set-Cookie` 的根因方案。

### 主页封面

- `POST /uploads` 接受 `purpose: "cover"`，使用既有分片上传与秒传链路。
- `PATCH /auth/profile` 接受可选的 `cover_url`：省略时保留原值，空串移除封面；不改变头像或简介。
- `GET /auth/me` 与 `GET /users/{username}` 返回 `cover_url`，未设置时为空串。
- GIF 保留原文件与动画，URL 的 `crop=x,y,width,height` 表示归一化展示选区；静态图片可使用裁剪后的文件。
- 数据库迁移 `133_add_user_cover` 为既有用户提供空封面默认值。

## 业务模块

每个模块在四层各有对应目录，命名一致：

| 模块 | domain | application | 功能 |
|------|--------|-------------|------|
| **auth** | user, session | auth/command + auth/query | 注册/登录/登出/探活/邮箱验证/密码重置 |
| **role** | role, permission | role + permission | 角色 CRUD、权限 CRUD、角色-权限分配 |
| **post** | post | post | 文章 CRUD、发布/归档/草稿状态机、可选作者落款、浏览计数、版本管理 |
| **comment** | comment | comment | 评论 CRUD、回复、批注、审核（通过/垃圾/删除）、批量操作 |
| **commentreaction** | commentreaction | commentreaction | 评论表情反应（IP 哈希匿名） |
| **friendlink** | friendlink | friendlink | 友链申请、审核、上下架管理 |
| **notification** | notification | notification | 站内通知（事件订阅写通知、未读中心、SSE 实时推送、浏览器 Web Push） |
| **chat** | chat | chat | 私聊/私有房间、文本与图片消息、成员提及与房间全体提及、cursor 历史、SSE 事件流、Web Push 订阅 |
| **chatreaction** | chatreaction | chat | 聊天消息表情反应（成员鉴权、聚合计数、SSE 变化事件） |
| **chat(bot)** | chat | chat | Bot API：外部程序以 Bearer bot token 代表虚拟用户收发文本与图片、发布命令目录、引用回复时推进已读位置与订阅事件流（`/api/v1/chat/bot/*`）；成员从会话接口读取目录，后台凭据管理需 `chat:bot-manage` |
| **chatappearance** | chatappearance | chatappearance | 账号级聊天外观（头像框/挂件/气泡主题/佩戴徽章），本人读写与批量公开查询（CAS 乐观锁），管理员徽章授予与撤销（chat:manage） |
| **api_token** | api_token | api_token | 本人访问令牌 PAT 的创建、分页查询、原位编辑与吊销；编辑不轮换 MCP 凭据 |
| **project** | project | project | 项目展示 CRUD，唯一 slug 可在后台编辑；公开详情支持 `GET /projects/by-slug/{slug}`，保留按 ID 读取；列表附带路线图进度和近期条目摘要 |
| **roadmap** | roadmap | roadmap | 项目内稳定编号的路线图条目、三阶段进度与内容编辑；写操作需 `project:update` |
| **music** | music | music | Kite 单一网易云账号连接与每日续期、展示歌单配置、按站点账号权益或匿名解析播放；上游分页与私有读取限制见下文 |
| **announcement** | announcement | announcement（并入 content） | 公告管理 |
| **emoji** | emoji | media | 表情分组/表情 CRUD、B站表情导入、文件上传 |
| **customemoji** | customemoji | customemoji | 用户自定义表情上传、软删除、收藏与按 ID 解析 |
| **upload** | upload | media | 分片上传（秒传/断点续传/合并）、文件管理 |
| **image** | image | image | 图片处理 |
| **tweet** | tweet | tweet | 推文发布与互动、免凭据 X 原文预览、共享来源刷新和撤回 |
| **settings** | settings | settings | 站点配置（key-value） |
| **tag** | tag | tag | 标签 CRUD |
| **github** | github | github | GitHub 贡献日历/仓库数据（GraphQL API） |
| **mcp** | — | mcp | MCP 服务（写作/评论检索/RSS 抓取，按 PAT scope 拆分） |
| **system** | — | system | 服务器与数据库状态、受控 SQL、数据导出及备份恢复 |
| **coderunner** | coderunner | coderunner | 可运行代码块沙箱执行（复用 yggdrasil runner 镜像） |
| **subscription** | subscription, subscription_entry | subscription | RSS 订阅源管理、抓取调度与转载 |
| **audit** | audit | audit | 操作日志记录与查询 |
| **stats** | stats | stats | 仪表盘统计聚合 |
| **useradmin** | useradmin | useradmin | 用户管理（CRUD/角色/状态/批量操作） |
| **releases** | releases | releases | 版本发布（release-please 集成） |
| **gallery** | gallery | gallery | 图集视觉作品：双快照工作稿、更新发布、撤回删除、own-or-moderator 审核、生命周期审计与稳定地址读取 |
| **note** | note | note | 知识笔记：markdown+标签轻量条目、draft→published 单向发布、公开流 keyset 分页与标签筛选 |
| **persona** | persona | persona | 多语言人设档案：默认语言、共享头像、完整文档保存、单一当前人设选择、素材引用计数与公开语言协商（`GET /persona?locale=`） |
| **publication** | publication | publication | 首页统一发布物投影：文章、知识笔记与图集的轻量 cursor 时间流（`GET /publications`） |
| **siteidentity** | settings | siteidentity | 首页站点身份：默认值、公开链接和可用订阅渠道归一（`GET /site-identity`） |
| **siteimpression** | siteimpression | siteimpression | 首页匿名设备印记：HMAC 令牌去重、私有状态查询与限流写入（`GET/POST /site-impressions`） |

> **注意**：`media` application 层服务 emoji/upload 两个 domain，共享文件存储基础设施。

旧音乐实现已移除；历史 `playlists`、`music_settings` 表及其中的数据保留，当前应用不再读写或通过 AutoMigrate 管理这两张表。新的 Kite 音乐模块使用迁移 `140_add_music_admin` 创建的 `music_account`、`music_login_challenges` 与 `music_featured_playlists`，不恢复旧解析服务、播放器设置或旧权限。通用音频文件上传与素材管理不受影响。

迁移 `141_music_account_expiry` 为站点账号增加持久化失效标记。部署新 API 前需执行迁移；回滚仅移除此标记，不删除 Cookie、账号资料或展示歌单。

迁移 `139_retire_playlist_permissions` 回收 `playlist:view/create/update/delete/toggle` 的角色授权并删除权限点，仅清理不再包含其他子节点的 `playlist` 菜单。回滚只恢复权限定义、菜单及默认 `admin` 角色授权，不恢复已回收的自定义授权；历史歌曲权限已由迁移 `055_remove_dead_permissions` 退役。

`POST /uploads` 与 `GET /uploads/instant` 只对磁盘上仍存在的素材返回秒传成功。数据库记录存在但文件丢失时，记录保留并标记为 `failed`，重新上传会创建可读取的新文件；权限等读取错误直接返回错误，不当作秒传未命中。已丢失的图片字节无法从数据库恢复，原有失效地址需重新上传后替换。

### 站点音乐接口（Kite）

管理接口由前端 `/admin/music` 页面消费；公开展示列表由站点的 `@violetjs/kite-player` 播放组件消费。全站维护一个网易云账号：后台浏览音乐库，前台展示歌单按该账号权益解析播放（`/music/playback` 返回当前模式）。Cookie 由独立 `MUSIC_CREDENTIAL_KEY` 加密后存入 PostgreSQL；响应与启动配置日志不暴露 Cookie、服务令牌或加密密钥。接入配置见 [部署指南](../docs/deploy/manual-deploy.md#kite-音乐服务可选)。

**版本限制**：旧版 Kite v0.4.0 存在 [曲目 offset 未生效 #89](https://github.com/VOD-Studio/kite/issues/89)、[账号歌单分页结果错误 #88](https://github.com/VOD-Studio/kite/issues/88) 和 [账号歌单读取丢弃登录上下文 #90](https://github.com/VOD-Studio/kite/issues/90)。是否受影响以实际服务版本与业务验收为准，不将旧版结论当作线上当前事实；重复页或缺页不能作为完整歌单交付，匿名结果也不作为完整私有音乐库。

以下路径均以 `/api/v1` 为前缀。管理接口要求管理员身份；读取需 `music:view`，写入需 `music:manage` 与 CSRF。网易云 ID 均为十进制字符串。分页沿用 `page`/`limit` 与 `meta.pagination`，上游限制同时影响后台与公开曲目接口。

| 方法与路径 | 行为 |
| --- | --- |
| `GET /admin/music/status` | 返回 `configured`、`credential_storage_ready`、`base_url`，不发起外部请求 |
| `POST /admin/music/verify` | 同时检查 Kite 健康和受服务令牌保护的只读接口，返回 `valid` 与说明 |
| `GET /admin/music/account` | 返回 `disconnected` / `connected` / `expired` 和可空的 `profile`；网络故障返回错误，不冒充未登录 |
| `POST /admin/music/login/qr` | 返回 201；提供本站挑战 `id`、二维码内容 `url`、RFC3339 `expires_at`，管理页生成二维码图像并在到期后停止轮询 |
| `POST /admin/music/login/qr/{id}/check` | 返回 `waiting` / `scanned` / `confirmed` / `expired`；确认时加密保存 Cookie，`account` 仅确认成功时非空 |
| `DELETE /admin/music/login/qr/{id}` | 发起者幂等取消挑战；取消先于确认提交时，迟到结果不能接入账号 |
| `POST /admin/music/account/refresh` | 续期后先用账号版本校验保存完整 Cookie，再查询状态；状态查询失败仍保留新凭据并返回错误，账号已退出或变更时拒绝迟到写入 |
| `DELETE /admin/music/account` | 先清除本地连接，再尝试上游退出；上游失败仍保持本地断开，并明确返回失败说明 |
| `GET /admin/music/library/playlists` | 使用已保存账号的 ID/Cookie 请求我的歌单，受上述 Kite 限制影响 |
| `GET /admin/music/library/search?q=&type=song\|playlist` | 匿名搜索歌曲或歌单 |
| `GET /admin/music/library/playlists/{id}/tracks` | 管理端曲目读取，可向 Kite 传入站点 Cookie |
| `GET /admin/music/playlists` | 返回全部展示歌单及 `enabled`、`position` |
| `POST /admin/music/playlists` | 接受 `{playlist_id}`，匿名校验歌单可公开读取后保存引用；成功 201，重复 409 |
| `PATCH /admin/music/playlists/{id}` | 接受必填 `{enabled}` |
| `PUT /admin/music/playlists/order` | 接受当前全部 ID 的无重复 `{ids}` 排列，原子排序；无效输入不改变原顺序 |
| `DELETE /admin/music/playlists/{id}` | 仅移除本站引用，不删除网易云原歌单 |
| `GET /music/playback` | 返回 `account` / `anonymous` 播放模式；只读本地存储，不发上游请求，不暴露账号资料 |
| `GET /music/playlists` | 按配置顺序返回已启用的展示歌单 |
| `GET /music/playlists/{id}/tracks` | 匿名读取已启用展示歌单的曲目；未展示或已停用返回 404 |
| `GET /music/songs/{id}` | 匿名歌曲元数据 |
| `GET /music/songs/{id}/url?level=standard` | 请求 `standard` / `exhigh` / `lossless` / `hires` 音质，按需获取播放地址；仅试听片段时 `trial=true` 且照常交付 |
| `GET /music/songs/{id}/stream?level=standard` | 按需解析地址并返回 302；无可用地址时 404，不代理音频 |
| `GET /music/songs/{id}/lyric` | 返回 `lrc`、`translated`、`romanized` |

站点账号已连接时，`/url` 与 `/stream` 携带其凭据按账号权益解析，且仅限启用展示歌单内的曲目（展示外返回 404），凭据不离开后端；未连接或已退出时匿名解析。`/url` 无播放权限时返回 `playable=false`、`url=null`；实际音质以返回的 `format` / `bitrate` 为准，上游可能降级。Kite 当前契约丢弃上游试听信息，试听按地址时长估算判定（估算 <45s 且曲目 >90s）并标记 `trial=true` 照常交付，前端提示「仅试听」；精确判定依赖 [Kite #103](https://github.com/VOD-Studio/kite/issues/103)。`/stream` 可直接作为音频源，跟随重定向后由浏览器向 CDN 读取音频；Violet 不转发音频字节。临时播放 URL 不持久化，播放地址的成功 JSON 与 302 响应使用 `Cache-Control: no-store`。

歌曲资料、歌词与公开曲目查询共用每 IP 每分钟 60 次配额；播放地址与音频重定向单独收紧为每 IP 每分钟 20 次，并叠加全站每分钟 30 次的解析聚合限流——站点账号取链形态保持低频，避免被上游识别为批量行为。超限返回 `429` 与 `Retry-After`，不会继续调用 Kite；本地展示歌单列表与播放模式不占配额。复用现有 Redis 限流中间件及其故障放行策略。成功解析结果进程内缓存 25 分钟（按凭据版本整体失效），同曲目全站重复解析在窗口内只发一次上游请求；凭据不缓存。

二维码挑战绑定发起管理员，三分钟绝对过期、一次性消费；轮询建议约两秒，关闭时调用取消接口，过期/确认后停止。退出会使旧挑战和在途续期结果失效。Kite 服务鉴权错误与网易云登录过期均不是博客登录失效，不返回会触发本站退出的 401。

Violet API 的 `MusicRenewalJob` 每 24 小时调用一次账号续期用例，首次在进程启动 24 小时后执行，重启会重新计时；沿用当前单实例后台任务模式，不依赖浏览器页面或外部 cron。未配置 Kite、缺少凭据加密密钥、未连接或已确认失效时跳过，不先请求上游状态。每轮串行执行，临时故障仅记录安全错误，下一周期再尝试；进程关闭会取消在途请求。

自动续期与手动刷新共用完整 Cookie 替换及账号版本校验。`LOGIN_REQUIRED` 会持久化失效标记并推进凭据版本，保留加密 Cookie 和账号资料；后台直接返回 `expired`，公开播放模式切为 `anonymous`，旧账号播放缓存失效，免费歌不带 Cookie 解析。失效账号停止自动续期，重新扫码或手动续期成功后恢复账号模式。网络或服务鉴权故障不冒充账号失效；退出或换号后，旧版本的成功或失效结果都不能覆盖当前账号。

Kite 连接故障、超时、无效响应和服务令牌错误映射为 `500 INTERNAL_ERROR`；网易云登录过期或请求参数错误仍为 `400 BAD_REQUEST`。错误响应不透出上游响应体或凭据，也不清除博客 Session。账号退出接口保留上述「本地先断开、上游失败明确返回」的独立语义。

账号状态机、取消竞态和退出失败通过独立 PostgreSQL 与确定性协议夹具验证；真实 Kite 的搜索、公开歌单、歌曲 URL、歌词和二维码待扫状态已实跑。真实扫码确认、真实账号续期及私有歌单验收仍需用户参与，夹具不能替代该验收。

### 项目路线图接口

以下路径均以 `/api/v1` 为前缀；写操作需登录、CSRF 与 `project:update` 权限。

`GET /projects`（包括 `page`/`limit` 分页）为每个项目附带 `roadmap`：三阶段进度、至多 2 条 `in_progress`、1 条 `latest_completed`（含完成日期）。无条目时返回零进度、空数组与 `null`，由消费方隐藏空进度区；按 ID 或 slug 读取项目本身不附带摘要。

| 方法与路径 | 行为 |
| --- | --- |
| `GET /projects/by-slug/{slug}/roadmap` | 公开返回项目、全部未删除条目、关系与进度概览 |
| `POST /admin/projects/{projectID}/roadmap/items` | 创建条目，分配项目内不复用的编号 |
| `PUT /admin/projects/{projectID}/roadmap/items/{id}` | 全量编辑内容（含有序子项 `checklist`，整体替换）；未传完成日期时保留原值 |
| `POST /admin/projects/{projectID}/roadmap/items/{id}/move` | 按目标阶段与邻居移动；邻居失效时追加末尾，已完成阶段拒绝手动重排 |
| `DELETE /admin/projects/{projectID}/roadmap/items/{id}` | 标记软删除，返回 204 |
| `POST /admin/projects/{projectID}/roadmap/items/{id}/restore` | 恢复原条目，保留编号、位置和内容 |
| `POST /admin/projects/{projectID}/roadmap/relations` | 建立项目内扩展、修复或阻塞关系 |
| `DELETE /admin/projects/{projectID}/roadmap/relations/{relationID}` | 显式删除关系 |

阶段固定为 `planned`、`in_progress`、`completed`。进度为已完成数除以未删除条目总数，四舍五入为整数百分比，空路线图为 0。完成日期格式为 `YYYY-MM-DD`，默认取 `Asia/Shanghai` 当天；仅已完成条目持有完成日期与交付版本，离开已完成时两者一并清空。阶段变更记录操作日志，同阶段排序不记录。

关系按 `extends`、`fixes`、`blocks` 分别校验无环，不允许自指、同类型重复或跨项目。软删除条目只隐藏关系，恢复时保留同一关系；环校验仍包含隐藏关系。显式删除关系后，恢复条目不会重建该关系。`blocked` 由未完成且未删除的阻塞前置条目派生，不改变阶段。

## 基础设施适配器

`internal/infrastructure/` 下的外部系统集成：

| 目录 | 端口（domain 定义） | 实现 | 说明 |
|------|---------------------|------|------|
| `auth/` | `SessionStore`, `CodeStore` | RedisSessionStore, RedisCodeStore | session 存储、验证码存储 |
| `email/` | `EmailSender` | Sender (Resend) | 验证码/密码重置邮件 |
| `eventbus/` | `EventBus` | Noop / InMemory | 领域事件总线（audit / notification 订阅者消费事件） |
| `github/` | `GitHubProvider` | Adapter | GitHub GraphQL + REST API |
| `xtweet/` | tweet 应用层的获取、媒体和预览缓存端口 | Fetcher, MediaStore, PreviewStore | FxTwitter v2 与一次 Syndication 回退、来源图片本地保存、用户绑定预览凭证 |
| `storage/` | `ChunkStorage` | LocalStorage | 分片文件存储、缩略图生成（imaging + ffmpeg） |
| `persistence/gorm/` | 各 `*Repository` | GORM 实现 | 所有数据库访问 |

### X 原文预览与转发

接口前缀为 `/api/v1`，写请求沿用 session cookie 与 `X-CSRF-Token`。字段和响应见 OpenAPI；行为与验收记录见 [PRD-0031](../docs/prd/0031-X推文免凭据转发.md)。

| 方法与路径 | 请求与权限 |
| --- | --- |
| `POST /tweets/external/preview` | 登录后提交 `{ "url": "https://x.com/jack/status/20" }`，每用户每分钟 5 次、每日 50 次 |
| `POST /tweets` | 外部转发提交 `external_preview_token` 与 UUID `client_request_id`，可附 `content` 和本人上传的 `images`；不与 `quote_of` 同时使用，沿用每用户每小时 10 次请求限流 |
| `POST /tweets/external/{externalId}/refresh` | 内置超管或 `tweet:delete-any`，刷新所有转发共用的来源 |
| `DELETE /tweets/external/{externalId}` | 同上权限，下架来源正文与所有版本媒体，保留本站推文及讨论 |

部署需允许服务端访问 `api.fxtwitter.com`、`cdn.syndication.twimg.com` 与 `pbs.twimg.com`，无需配置 X 凭据。来源图片保存在上传目录的 `external-tweets/`；该目录及其图片变换响应使用 `Cache-Control: no-store`，反向代理或 CDN 必须遵守此策略。确认撤回后阻止自动重新导入；后台分批检查仍被引用的来源，并回收孤立媒体。

X 获取与图片下载逐请求沿用部署已有的 `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY`：目标始终限制为上述 HTTPS 白名单（含每次重定向）；环境代理是运维配置的可信出站边界，未配置代理或匹配 `NO_PROXY` 时仍使用 DNS/IP SSRF 安全直连，不回退到无校验网络请求。生产 Compose 已注入已有出站代理；直连 `pbs.twimg.com` 被网络阻断时，勿只核对来源链接在个人浏览器是否可打开，应检查 API 容器的代理连通性。

原作者头像按真实格式校验后保存为该版本目录下的 `avatar.jpg`（PNG/GIF/WebP 使用相应扩展名）。头像确实不存在或非致命下载失败时保持空 URL，由界面使用姓名占位，仅服务端记录失败，不混入投票等内容缺失提示。历史快照不会因代码升级立即重写；恢复网络后可调用上表的共享原文刷新接口。即使原文指纹未变化，缺少本站头像且来源仍提供头像 URL 的快照也会重新落盘；嵌套引用沿同一保存链修复，无需重建本站转发。

## 依赖注入

手工装配：每个模块在 `internal/app/` 有一个 `*_container.go`，由根容器（`container.go` / `run.go`）统一构造：

```go
// internal/app/auth_container.go
func NewAuthContainer(db, redis, cfg, emailSender, bus) (*AuthContainer, error) {
    userRepo := gormrepo.NewUserRepository(db)
    sessionStore := infraauth.NewRedisSessionStore(redis)
    // ... 构造各 command/query handler
    return &AuthContainer{AuthHandler: ..., SessionStore: sessionStore}, nil
}
```

> 历史说明：role/permission 模块曾用 google/wire 生成装配代码，为统一 DI 方式已移除（全仓手工装配），go.mod 中的 wire 依赖为待清理残留。

## 如何新增一个模块

以新增 `subscription`（RSS 订阅）模块为例（仓库已有同名模块，可按此模式扩展）：

### 1. domain 层

```text
internal/domain/newsletter/
├── entity.go       # Subscription 聚合根 + 值对象
└── repository.go   # SubscriptionRepository 接口（端口）+ 领域错误
```

```go
// entity.go
package newsletter

type Subscription struct {
    id      shared.ID
    email   string
    active  bool
}

func NewSubscription(id shared.ID, email string) *Subscription {
    return &Subscription{id: id, email: email, active: true}
}

// repository.go
type SubscriptionRepository interface {
    FindByEmail(ctx context.Context, email string) (*Subscription, error)
    Save(ctx context.Context, s *Subscription) error
    Delete(ctx context.Context, id shared.ID) error
}
```

### 2. infrastructure 层

```text
internal/infrastructure/persistence/gorm/
└── newsletter_repo.go     # 实现 SubscriptionRepository 接口
```

GORM PO 模型放在 `persistence/gorm/model/`。

### 3. application 层

```text
internal/application/newsletter/
└── service.go             # 用例（Subscribe/Unsubscribe/List）
```

```go
type Service struct {
    repo domainnewsletter.SubscriptionRepository
}

func (s *Service) Subscribe(ctx context.Context, email string) error {
    // 业务编排：构造聚合根 → 调用 repo 保存
}
```

### 4. interfaces 层

```text
internal/interfaces/http/handler/newsletter/
└── newsletter.go          # HTTP handler + 请求/响应 DTO
```

### 5. 装配与路由

```go
// internal/app/newsletter_container.go
func NewNewsletterContainer(db *gorm.DB) *NewsletterContainer { ... }

// cmd/server/main.go
newsletterContainer := app.NewNewsletterContainer(gormDB)
v1.Route("/newsletter", func(r chi.Router) {
    r.Post("/subscribe", newsletterContainer.Handler.Subscribe)
})
```

### 6. 数据库

生产表结构由 golang-migrate SQL 迁移管理：在 `api/migrations/` 手写递增序号的 `NNN_xxx.{up,down}.sql` 后执行迁移：

```bash
make migrate              # 应用新迁移
make migrate-down n=1     # 回滚最近一次迁移
```

生产环境（`ENVIRONMENT=production`）启动只读取迁移状态，不执行 SQL 迁移或 GORM AutoMigrate。发布前须运行镜像内的 `/migrate up`。空库、缺少所需迁移或 dirty 状态会阻止启动；数据库版本高于镜像携带版本时允许启动，兼容性回滚仍要求业务代码适配当前 schema。开发环境保留启动自动迁移与 AutoMigrate。

迁移失败后必须核对失败 SQL 和实际 schema，由维护者修复；应用不会自动清除 dirty 或跳到最新版本。新增迁移 132 接管历史 AutoMigrate 补出的时间字段，回退该迁移时保留字段与数据。

迁移安全集成测试在独立 schema 中运行，使用专用 PostgreSQL 测试库：

```bash
cd api
MIGRATE_TEST_DSN='postgres://postgres:password@127.0.0.1:5432/migration_test?sslmode=disable' \
  go test -tags=integration ./internal/migrate -count=1
```

> 已应用到任何环境的迁移文件**禁止原地修改**（改动不会同步进库，产生 schema 漂移），变更一律新增迁移。

## 常用命令

```bash
make api          # 启动 API（热重载，air）
make api-build    # 编译
make api-test     # 运行测试
make api-lint     # golangci-lint 检查（或回退 go vet）
make migrate      # 执行数据库迁移
make migrate-down n=1  # 回滚最近一次迁移
make check-publications # 校验公开来源与发布物投影一致性
make reset-db     # 重置数据库
make apifox       # 导出 OpenAPI 并导入 Apifox
make help         # 查看所有命令
```

## 配置

配置架构遵循 Grafana 模式：

- **`config.yaml`（入库）**：全部配置键 + 非敏感默认值 + 注释，配置的权威文档，随镜像分发
- **根 `.env`（不入库）**：密钥与敏感值，唯一敏感来源（参考 `.env.example`）
- **优先级**：进程环境变量 > 根 `.env` > `config.yaml` > 代码默认值

启动时 API 会打印每个键的生效值与来源（env / config.yaml / default）。

| 配置项 | 说明 |
|--------|------|
| `database.*` | PostgreSQL 连接（DSN/连接池） |
| `redis.*` | Redis 连接 |
| `cookie.*` | session cookie 域名、Secure、SameSite 等 |
| `session.*` | idle_ttl（滑动续期窗口）、max_ttl（绝对寿命上限） |
| `cors_allowed_origins` | CORS 允许来源 |
| `trusted_proxies` | 受信代理 CIDR（为空时忽略 X-Forwarded-For） |
| `resend_api_key` | Resend 邮件 API Key |
| `web_push.*` | 浏览器 Web Push 的 VAPID 公钥、私钥与 subject；私钥仅从环境变量读取 |

`GET /api/v1/chat/push/config` 与 `GET /api/v1/notifications/push/config` 可传 `endpoint_hash`（浏览器订阅地址的 SHA-256 十六进制指纹），返回当前登录用户在对应通道的 `subscribed` 状态；未传时为 `false`，不返回订阅地址或密钥。
| `superadmin.*` | 初始超级管理员账户 |

> 各键上方的行内注释标注对应的 env 覆盖名；敏感值一律走环境变量，不写入 `config.yaml`。

## 测试

```bash
cd api && go test ./...
# 或从根目录
make api-test
```

测试集中在 domain 层（聚合根不变量）和 application 层（用例编排），使用 mock 实现仓储端口。

## 相关文档

- [项目总览](../README.md)
- [项目级代理规范与开发须知](../AGENTS.md)
- [文档目录](../docs/README.md)
- [架构决策记录](../docs/adr/)
