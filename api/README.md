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

### 镜像构建

生产 Dockerfile 的 `APK_MIRROR` 构建参数默认使用 `mirrors.aliyun.com`，下载失败时回退 Alpine 官方源。GitHub 官方 runner 上的 CI 与发布构建传入 `APK_MIRROR=dl-cdn.alpinelinux.org`；国内自托管 CI 保留国内源，避免跨地域下载编译依赖。

后端 CI 从生产镜像的 `webp-builder` 阶段提取固定版本编码器，供真实 WebP 测试使用；编码器准备与完整 API 镜像构建使用同一镜像源参数。

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

## 正文处理

- 文章提交 `content_md` 时由 Goldmark 生成 HTML：Mermaid 与可运行围栏保留源码的语义载体，可运行标记支持 `run` / `runnable`。
- HTML 转 Markdown 保留脚注（含重复引用）、多段正文、代码围栏、带属性表格与原生 `<sub>/<sup>`、`<details>/<summary>`；正文含脚注引用时整篇保留 HTML，避免引用断链。
- GitHub 提示块识别独占首行的 `[!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]`、`[!CAUTION]`；已保存的 HTML 不会因解析器更新自动重写。
- 具体格式契约见[编辑器手册·存储与有损](../web/src/features/editor/docs/storage.md)。

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
| **upload** | upload | media | 分片上传、稳定会话续传、持久化取消与原子完成、文件管理 |
| **image** | image | image | 图片处理 |
| **tweet** | tweet | tweet | 推文发布与互动、免凭据 X 原文预览、共享来源刷新和撤回 |
| **settings** | settings | settings | 站点配置与分组运行策略（版本 CAS、字段来源、当前实例有效快照） |
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

## 关键接口

### 入口限流

`GET /admin/settings/rate-limit` 返回实际绑定入口、规则、字段来源与本实例有效版本，读取需要 `settings:view`；`PUT` 需要 `settings:update` 和 CSRF，提交 `expected_version` 以及 `values.rules.<id>` 的部分字段，或用 `reset: true` 清除整组覆盖。版本冲突返回 409，非法规则不会部分落库。

滑动窗口、一秒突发和 UTC 自然日配额由 Redis 原子判定；组合入口不半扣额度，修改规则不清除已获准请求历史。管理员使用相同规则，Redis 故障遵循入口的 `allow` / `deny`。429 的 `Retry-After`、`X-RateLimit-Reason`、`X-RateLimit-Reset` 可供跨域客户端读取。

上传初始化、分片、合并共用上传写额度，状态查询、取消与认证后的 `GET /uploads/policy` 不占写额度。该只读接口返回当前实例的上传调度版本和文件并发上限。

`GET/PUT /admin/settings/upload-queue` 配置浏览器后续文件调度，使用相同的版本与权限契约。`POST /uploads` 可携带客户端 UUID `clientUploadId`；同一文件的重试复用该 ID，并按返回的 `chunk_size` 和 `uploaded_chunks` 续传。未携带 ID 的旧客户端保留按本人文件哈希续传的入口。

`DELETE /uploads/{id}` 对尚未初始化的稳定 ID 同样记录取消。响应 `{completed: false}` 表示取消已提交；若合并先完成，则返回 `{completed: true, file: ...}`，不撤销正式文件。文件记录与会话完成结果在同一事务提交；取消赢得竞争时，合并返回 409 并清除未提交文件，重复完成返回原文件结果。

### 图片处理与派生缓存

`GET/PUT /admin/settings/image` 使用相同的版本、权限和重置契约，覆盖上传、素材替换、独立缩略图、外部媒体与动态图片。源图先检查输入字节、单边和累计动画像素，再解码；外部 WebP 也进入同一受限处理器，不在策略检查前单独完整解码。编码进程有共享并发、超时和输出上限。

镜像包含固定 `cwebp 1.6.0`，支持实际无损与有损 WebP，质量和方法参数均参与编码。GIF 和动画 WebP 保留原动画；透明图请求 JPEG 时返回 PNG；APNG 明确拒绝并提示使用 GIF 或动画 WebP，不静默取首帧。

内存与磁盘缓存分别受容量和 TTL 约束，缓存身份包含源内容与策略版本。专用维护只删除可重建缓存，先清过期项，再按写入时间和路径收敛容量；响应的 `cleanup` 给出真实时间、删除量与失败状态。工具准备失败保留最近有效策略，不能把保存成功当成应用成功。

### 运行器策略

`GET/PUT /admin/settings/code-runner` 使用版本化策略契约，启停、语言白名单、资源上限、并发、排队时限和任务保留影响后续任务。空语言数组禁止全部语言；旧配置和部署默认支持 `js/javascript`、`ts/typescript`、`rs` 别名，未知语言不会被当作允许全部语言。

提交时固定任务保留期，完成后按该时长设置 Redis TTL；排队及执行期间另留收尾预算。启动沙箱前再次检查启停、语言和源码上限，资源取提交策略与最新策略的较严边界。降低并发不杀已运行任务，不为它们重复发放名额。

公开 `GET /code-runner/policy` 只返回有效版本、启停和语言，供编辑器与阅读器消费；`GET /settings` 保留同源启停与语言投影。部署环境只提供默认资源值，不再使用 `CODE_RUNNER_ENABLED`，合法旧后台覆盖在首次启动时导入，升级不会重置。


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

`MusicRenewalJob` 每 24 小时自动续期一次（进程启动 24 小时后首跑，重启重新计时），未配置 Kite、未连接或已失效时跳过。续期收到 `LOGIN_REQUIRED` 时持久化失效标记：后台返回 `expired`，公开播放切为 `anonymous`，免费歌不带 Cookie 解析；重新扫码或手动续期成功后恢复账号模式。网络或服务鉴权故障不冒充账号失效。

Kite 连接故障、超时、无效响应和服务令牌错误映射为 `500 INTERNAL_ERROR`；网易云登录过期或请求参数错误仍为 `400 BAD_REQUEST`。错误响应不透出上游响应体或凭据，也不清除博客 Session。账号退出接口保留上述「本地先断开、上游失败明确返回」的独立语义。

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

原作者头像校验格式后保存到该版本目录；不存在或下载失败时保持空 URL，界面使用姓名占位，仅服务端记录失败。历史快照不因代码升级重写，恢复网络后可用上表的共享原文刷新接口补齐。

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
