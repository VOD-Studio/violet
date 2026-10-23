# Violet API

Violet 的 Go 后端，负责内容发布、用户权限、社区互动、媒体处理与 MCP 服务。HTTP 服务使用 Chi，业务代码按 DDD 分层，通过手工容器装配。

[快速开始](#快速开始) · [配置](#配置) · [接口与认证](#接口与认证) · [数据库迁移](#数据库迁移) · [项目结构](#项目结构)

## 快速开始

以下命令均在**仓库根目录**执行。后端依赖 PostgreSQL 16 和 Redis 7；容器开发不要求本机安装 Go。

### Docker 开发

准备 Docker Compose（支持 `watch`）和 Make，先生成环境文件：

```bash
make env
```

编辑根 `.env`，至少修改 `DATABASE_PASSWORD`。需要初始管理员时，设置 `SUPERADMIN_ENABLED=true`，并填写管理员用户名、邮箱和密码；配置示例见 [../.env.example](../.env.example)。

只启动 API 及其依赖：

```bash
docker compose -f docker-compose.dev.yml up -d --build api
docker compose -f docker-compose.dev.yml watch --no-up api
```

Compose 负责启动数据库和 Redis；API 在开发环境自动应用迁移。源码由 Compose Watch 同步到容器，再由 Air 重编译。仅启动容器、不运行 Watch 时，后续宿主源码修改不会自动进入容器。

另开终端检查服务：

```bash
curl --fail http://localhost:9090/api/health
docker compose -f docker-compose.dev.yml logs -f api
```

需要同时开发前端时，使用根目录的 `make docker-dev` 启动整套环境，不要再启动另一套占用相同端口的服务。

### 本机 Go 开发

需要 Go 1.26.10+，数据库和 Redis 仍使用 Docker。配置好根 `.env` 后执行：

```bash
make up
make migrate
make api
```

`make api` 执行 `go run ./cmd/server`，不会监听文件变更；热重载使用容器内的 Air 配置。

## 配置

| 文件 | 职责 |
| --- | --- |
| [config.yaml](config.yaml) | 配置键、非敏感默认值及对应环境变量说明；随镜像分发 |
| [根 .env 示例](../.env.example) | 数据库凭据、密钥与环境差异；真实 `.env` 不入库 |
| [开发 Compose](../docker-compose.dev.yml) | 容器网络、服务依赖、源码同步与开发环境变量 |

读取优先级为：**进程环境变量 → 根 `.env` → `config.yaml` → 代码默认值**。启动日志显示配置来源与脱敏后的值。

邮件、OAuth、Web Push、Kite 音乐和代码沙箱需要各自的外部配置。生产还要求签名密钥、真实 CORS 来源与安全 Cookie，不能直接沿用本地默认值。配置校验见 [config/config.go](config/config.go)，服务器前置条件见[部署手册](../docs/deploy/manual-deploy.md)。

## 接口与认证

### 接口入口

服务默认监听 `:9090`。下面的资源接口均位于 `/api/v1`，健康检查、MCP 与媒体地址不应机械地拼上此前缀。

| 入口 | 用途 |
| --- | --- |
| `GET /api/health` | 无鉴权健康检查 |
| `GET /api/v1/openapi.json` | 当前服务的 OpenAPI 描述，可导入 API 调试工具 |
| `/api/v1/auth` | 登录、会话、资料与账户管理 |
| `/api/v1/admin` | 管理接口，使用会话、管理员身份与具体权限点校验 |
| `/uploads/` | 默认媒体路径，由图片服务处理 |
| MCP | 按 PAT 权限开放，地址和客户端配置见 [MCP 指南](../docs/guides/mcp-servers.md) |
| `/api/v1/chat/bot` | 独立 Bearer Bot token 鉴权，不使用浏览器 Session |

完整字段、参数和状态码以 OpenAPI 为准；定义在 [internal/openapi/](internal/openapi/)，路由注册在 [internal/interfaces/http/routing/](internal/interfaces/http/routing/)。

### Cookie 与 CSRF

| Cookie | 内容 | 浏览器脚本可读 |
| --- | --- | --- |
| `violet_session` | 不透明 Session ID，服务端在 Redis 查验 | 否（HttpOnly） |
| `violet_csrf` | 写请求需回传至 `X-CSRF-Token` 的令牌 | 是 |
| `violet_uid` | 用户 ID，不作为鉴权凭据 | 是 |

真实请求会滑动续期，不轮换 Session ID；绝对寿命由 `session.max_ttl` 控制。修改或重置密码会撤销该用户的全部会话。

SSR 使用 `GET /auth/session` 只读探活，**不续期、不写 Cookie**。不要用会续期的客户端探活接口替换它。MCP 和 Bot 使用独立的令牌认证，不与浏览器 Cookie / CSRF 混用。

### 响应与分页

普通 JSON 成功响应使用 `data` 信封；分页信息位于 `meta.pagination`。错误响应使用 `error`、`message`，可附带 `request_id` 与字段错误 `details`。

- 后台分页使用 `page` / `limit`，返回总量与页数。
- 游标流使用 `cursor` / `limit`，通过 `has_more` / `next_cursor` 继续读取。
- 204、SSE、文件下载与媒体重定向不套普通 JSON 信封。

新增 Handler 复用 [response](internal/interfaces/http/response/) 的响应与错误辅助函数，分页规则复用 [domain/shared](internal/domain/shared/)。

## 业务模块

按用例定位 [internal/application/](internal/application/)，再查看对应领域与适配器；不是每个模块都具有完全同名的四层目录。

| 领域 | 应用层入口 | 职责 |
| --- | --- | --- |
| 身份与权限 | `auth`、`role`、`permission`、`useradmin`、`api_token` | 登录、账户、RBAC、用户管理与 PAT |
| 文章与知识 | `post`、`series`、`note`、`tag`、`markdown` | 文章、系列、笔记、标签与正文转换 |
| 视觉内容 | `gallery`、`persona` | 图集工作稿与公开版本、多语言人设 |
| 评论互动 | `comment`、`commentreaction` | 普通评论、锚点批注、审核与表情反应 |
| 社区与消息 | `tweet`、`chat`、`chatappearance`、`notification` | 推文、X 转发、聊天、Bot、外观与通知 |
| 项目 | `project`、`roadmap` | 项目资料、路线图条目与关系 |
| 媒体 | `media`、`image`、`customemoji` | 上传、表情目录、图片处理与个人表情 |
| 站点 | `settings`、`announcement`、`friendlink`、`stats` | 配置、公告、友链与统计 |
| 首页资源 | `publication`、`siteidentity`、`siteimpression` | 发布物投影、公开身份与匿名印记 |
| 外部内容 | `subscription`、`github`、`releases`、`music` | RSS、GitHub、版本记录与 Kite 音乐 |
| 开放与运营 | `mcp`、`coderunner`、`audit`、`system` | MCP、沙箱、审计、数据库运维 |

### 正文与媒体

文章只提交 `content_md` 时，由 Goldmark 生成 HTML；Mermaid、可运行围栏与内容卡片保留对应语义载体。HTML 与 Markdown 的往返边界、脚注和表格等格式规则见[编辑器存储说明](../web/src/features/editor/docs/storage.md)，不在这里维护第二份语法手册。

上传支持分片、秒传与会话续传。`clientUploadId` 用于复用同一次文件上传；取消和合并有明确的竞争结果，不能把“取消已受理”理解为“正式文件已删除”。秒传还会确认磁盘文件存在，数据库记录不能替代丢失的文件字节。

### 运行策略

下表均支持 `GET` / `PUT`；读取需 `settings:view`，写入需 `settings:update` 与 CSRF。

| 路径 | 管理内容 |
| --- | --- |
| `/admin/settings/rate-limit` | 窗口、突发、UTC 日配额与故障策略 |
| `/admin/settings/image` | 图片处理资源、WebP 编码与派生缓存 |
| `/admin/settings/upload-queue` | 浏览器后续文件的并发调度 |
| `/admin/settings/code-runner` | 沙箱启停、语言、资源和任务生命周期 |

更新携带 `expected_version`，冲突返回 409；`reset: true` 清除整组覆盖。**保存版本和当前实例有效版本是两回事**，应读取 `runtime.status`，不能只看 HTTP 200。429 保留 `Retry-After`；上传与运行器的消费端分别读取 `/uploads/policy` 和 `/code-runner/policy`，其中上传策略要求登录。

### 站点音乐接口（Kite）

后台管理一个站点网易云账号及展示歌单。读取管理接口需 `music:view`；写入需 `music:manage` 与 CSRF。网易云 ID 使用十进制字符串，歌单曲目使用 `page` / `limit` 分页。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/admin/music/status` | 本地配置就绪状态 |
| POST | `/admin/music/verify` | 验证 Kite 健康与服务令牌 |
| GET | `/admin/music/account` | `disconnected` / `connected` / `expired` 与账号资料 |
| POST | `/admin/music/login/qr` | 创建扫码挑战 |
| POST | `/admin/music/login/qr/{id}/check` | 检查扫码结果 |
| DELETE | `/admin/music/login/qr/{id}` | 取消挑战 |
| POST | `/admin/music/account/refresh` | 手动续期 |
| DELETE | `/admin/music/account` | 断开连接 |
| GET | `/admin/music/library/playlists` | 账号歌单 |
| GET | `/admin/music/library/search` | 搜索歌曲或歌单 |
| GET | `/admin/music/library/playlists/{id}/tracks` | 后台读取曲目 |
| GET、POST | `/admin/music/playlists` | 查询、添加展示歌单 |
| PATCH、DELETE | `/admin/music/playlists/{id}` | 启停、移除展示引用 |
| PUT | `/admin/music/playlists/order` | 提交全部展示歌单的排序 |
| GET | `/music/playback` | 公开播放模式 |
| GET | `/music/playlists` | 已启用展示歌单 |
| GET | `/music/playlists/{id}/tracks` | 已展示歌单的曲目 |
| GET | `/music/songs/{id}` | 歌曲资料 |
| GET | `/music/songs/{id}/url` | 按需解析临时播放地址 |
| GET | `/music/songs/{id}/stream` | 302 跳转到媒体源，不代理音频 |
| GET | `/music/songs/{id}/lyric` | 原文、翻译与音译歌词 |

Cookie 由 `MUSIC_CREDENTIAL_KEY` 加密保存，凭据不交给前端。账号模式的取链仅允许已启用展示歌单中的曲目；无连接或账号失效时匿名解析。播放地址不持久化，JSON 与重定向响应均不缓存。

扫码挑战三分钟过期、一次性消费；关闭管理弹窗时取消，确认或过期后停止轮询。退出先断开本地连接，上游退出失败仍返回明确说明。续期任务在进程启动 24 小时后首次运行，此后每 24 小时执行；登录过期转 `expired` 并切匿名播放，网络故障不冒充账号失效。

账号权益、试听判定和分页能力受上游版本影响。重复页、缺页或匿名结果不能当作完整私有音乐库；已知限制见 [Kite 接入分析](../docs/research/kite-integration.md)，配置见[部署手册](../docs/deploy/manual-deploy.md#kite-音乐服务可选)。

### 项目路线图接口

公开接口按项目 slug 读取；写操作需 `project:update` 与 CSRF。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/projects/by-slug/{slug}/roadmap` | 条目、关系与进度 |
| POST | `/admin/projects/{projectID}/roadmap/items` | 创建条目 |
| PUT | `/admin/projects/{projectID}/roadmap/items/{id}` | 全量编辑内容与子项清单 |
| POST | `/admin/projects/{projectID}/roadmap/items/{id}/move` | 改阶段与位置 |
| DELETE | `/admin/projects/{projectID}/roadmap/items/{id}` | 软删除 |
| POST | `/admin/projects/{projectID}/roadmap/items/{id}/restore` | 恢复条目 |
| POST | `/admin/projects/{projectID}/roadmap/relations` | 建立关系 |
| DELETE | `/admin/projects/{projectID}/roadmap/relations/{relationID}` | 删除关系 |

阶段为 `planned`、`in_progress`、`completed`；项目内编号不复用。`extends`、`fixes`、`blocks` 分别校验无环，拒绝自指和跨项目关系。软删除隐藏但保留关系，显式删除的关系不会随条目恢复而重建。

### X 原文预览与转发

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/tweets/external/preview` | 登录用户预览 X 原文，获得发布凭证 |
| POST | `/tweets` | 携带 `external_preview_token` 发布本站转发 |
| POST | `/tweets/external/{externalId}/refresh` | 刷新共享来源 |
| DELETE | `/tweets/external/{externalId}` | 下架来源，保留本站讨论 |

刷新与下架需内置超管或 `tweet:delete-any`。来源抓取、媒体下载的白名单与代理边界由后端适配器维护，无需 X 账号凭据；反向代理须遵守来源媒体的 `Cache-Control: no-store`。字段与媒体接口见 OpenAPI。

## 数据库迁移

迁移文件位于 [migrations/](migrations/)，成对新增递增序号的 `NNN_name.up.sql` / `NNN_name.down.sql`。**已应用的文件不原地修改**。

本机 Go 环境在仓库根执行：

```bash
make migrate-version
make migrate
```

容器开发可使用同一个 CLI：

```bash
docker compose -f docker-compose.dev.yml exec -T api go run ./cmd/migrate version
docker compose -f docker-compose.dev.yml exec -T api go run ./cmd/migrate up
```

开发启动会自动迁移；生产只校验版本与 dirty 状态，不执行 SQL 或 AutoMigrate。发布流水线先运行镜像内 `/migrate up` 再启动服务。回滚前先确认业务代码与当前 schema 的兼容性，dirty 状态需核对失败 SQL 和实际数据库后处理，不能直接强制标记为最新版本。发布事务见[发布与回滚手册](../docs/deploy/release-runbook.md)。

## 测试与构建

以下 Make 命令在仓库根执行，需要本机 Go：

| 命令 | 用途 |
| --- | --- |
| `make api-test` | 运行 Go 测试 |
| `make api-lint` | golangci-lint；未安装时回退 go vet |
| `make api-build` | 编译到 `api/bin/server` |
| `make check-publications` | 校验公开来源与发布物投影 |

容器内执行测试不需要本机 Go：

```bash
docker compose -f docker-compose.dev.yml exec -T api go test ./...
```

迁移集成测试使用 `integration` 构建标签，并要求 `MIGRATE_TEST_DSN` 指向专用 PostgreSQL 测试库；未配置时会跳过，不能当作已验收数据库迁移。测试放置与编写规范见 [Go 测试指南](../docs/guides/go-testing-guide.md)。

生产镜像使用 [Dockerfile](Dockerfile)，包含服务、迁移 CLI、cwebp、ffmpeg 与数据库运维工具；自行运行裸二进制时也需准备对应功能依赖。部署命令见[根 README](../README.md#生产部署)。

## 分层与新增模块

| 位置 | 应放内容 |
| --- | --- |
| `domain` | 聚合根、值对象、业务不变量、仓储接口和领域事件 |
| `application` | 用例编排与输出 DTO；通过端口访问外部能力 |
| `infrastructure` | GORM、Redis、邮件、Kite、X 等适配器 |
| `interfaces` | HTTP 输入输出、错误翻译与路由 |
| `app` | 具体实现的构造、依赖注入与生命周期 |

领域层不依赖 HTTP、数据库实现或应用层。通用横切逻辑放在 `internal/middleware/`，不把具体业务规则塞入鉴权或限流中间件。

新增模块时，从领域与用例契约开始，再补仓储 / 外部适配、HTTP Handler 和 SQL 迁移；最后在 `app/*_container.go`、根 `Container`、路由 `Deps` 与注册入口完成装配。可参照现有 [music_container.go](internal/app/music_container.go) 与 [music_routes.go](internal/interfaces/http/routing/music_routes.go)。接口变化同步 OpenAPI，模块变化同步本 README；不另建一套旧式 handler/service/repository 分层。

## 项目结构

```text
api/
├── cmd/                  server、migrate、export-openapi、check-publications
├── config/               配置加载与校验
├── config.yaml           配置键与非敏感默认值
├── migrations/           SQL 迁移
└── internal/
    ├── domain/           领域模型与端口
    ├── application/      用例编排
    ├── infrastructure/   持久化与外部适配
    ├── interfaces/http/  Handler、路由与响应
    ├── app/              装配与启动
    ├── middleware/       通用 HTTP 中间件
    ├── job/              后台任务
    ├── migrate/          迁移执行与状态检查
    └── openapi/          接口描述
```

## 相关文档

- [项目总览](../README.md)
- [前端开发](../web/README.md)
- [领域术语](../CONTEXT.md)
- [架构决策](../docs/adr/)
- [贡献指南](../CONTRIBUTING.md)
