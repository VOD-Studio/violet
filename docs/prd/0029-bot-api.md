# PRD: 聊天 Bot API

## Problem Statement

Violet 有完整的站内聊天系统（会话、消息、SSE 实时推送、已读回执、输入状态），但只服务于人与人之间的交流。要接入 AI agent（如 Saber）作为聊天 bot，需要让外部 bot 以虚拟用户身份参与聊天——收消息、发消息、编辑消息、设置输入状态。

现有 API 全部基于 session 认证（浏览器用户），没有面向 bot 的 token 认证、事件订阅和消息发送入口。

## Solution

新增 **Bot API**：一套独立的 HTTP 路由，让持有 bot token 的外部程序（不只 Saber，任何 bot）能像普通用户一样参与聊天。

Bot 以虚拟用户身份存在，走现有 `chat.Service` 的消息保存链路，经过现有 SSE 推送给前端。前端无需感知 bot 与人类的区别。

### 架构

```
外部 Bot (如 Saber)
    │
    │  ① 订阅事件流 (SSE)
    ▼
Violet Bot API (/api/v1/chat/bot/*)
    │
    ├─ BotAuth 中间件 (Bearer token → Bot 实体)
    │
    ├─ GET /events (SSE)           ← 入站：bot 收消息事件
    ├─ GET /profile                ← 自查：自己的 user_id 与 username
    ├─ POST .../messages           ← 出站：bot 发消息
    ├─ PATCH .../messages/{id}     ← 出站：bot 编辑消息（流式）
    ├─ POST .../typing             ← 出站：bot 输入状态
    └─ GET .../conversations       ← 查询：会话信息
```

### 关键设计

**Bot 身份体系**：

- `Bot` 实体：name、avatar、tokenHash、permissions
- 注册通过 admin 后台管理，生成 token（不存明文）
- Bot 对应 `domain/user` 中的一个虚拟用户（复用用户体系）
- Bot token 认证通过独立中间件 `BotAuth`，不走 session

**Bot SSE 事件流**：

只推送 bot 参与会话中的事件（不全量推送）：

- `message.created`：用户发消息到 bot 参与的会话
- `typing.updated`：用户输入状态
- 不推送 bot 自己发的消息（避免回环）

触发条件：

- 会话是 direct 且对端是 bot → 推给 bot
- 消息正文 mention 了 bot → 推给 bot
- 消息发送者是 bot → 不推给任何 bot

**消息发送**：

- `POST /api/v1/chat/bot/conversations/{conversationId}/messages`
- header: `Idempotency-Key`（必填）；body: `{ content, reply_to_id? }`
- 只开放文本消息：图片与分享推文涉及媒体归属校验，bot 侧没有上传通道
- 调用现有 `chat.Service.SendMessage`，senderID = bot 虚拟用户 ID
- 返回 violet 消息 ID（供 bot 后续 Edit）

**消息编辑**：

- `PATCH /api/v1/chat/bot/conversations/{conversationId}/messages/{messageId}`
- body: `{ content }`；路径带 conversationId 是因为 EditMessage 需要会话上下文做成员与归属校验
- 调用现有 `chat.Service.EditMessage`，校验发送者是 bot
- 用于流式回复：先 Send 占位消息，再逐步 Edit 更新内容

**输入状态**：

- `POST /api/v1/chat/bot/conversations/{conversationId}/typing`
- body: `{ is_typing: true/false }`
- 调用现有 `chat.Service.SetTyping`

### 消息流转（以 Saber 为例）

```
用户在 Violet 前端发消息
    │
    ▼
chat.Service.SendMessage (senderID = 用户)
    │
    ├─ 保存消息 → SSE 推 message.created 给前端
    │
    └─ BotEventNotifier.Push(botID, event)
            │
            ▼
       Bot SSE: message.created
            │
            ▼
       Saber 收到事件
       构造 chat.Message → aiService.HandleChat
            │
            ▼
       Agent Runtime (模型 + 工具)
            │
            ▼
       Presenter 流式回调
            │
            ├─ Send()    → POST /bot/.../messages → 创建 bot 消息
            │             → SSE 推 message.created → 前端显示"正在回复..."
            │
            ├─ Edit()    → PATCH /bot/messages/{id} → 编辑 bot 消息
            │             → SSE 推 message.updated → 前端流式渲染
            │
            └─ SetTyping → POST /bot/.../typing
                          → SSE 推 typing.updated → 前端显示输入中
```

## 领域模型

签名与字段以源码为准（`internal/domain/chat/bot.go`、`bot_repository.go`）。这里只记
代码读不出来的约束与取舍。

**`Bot` 不变量**

- `token_hash` 存 SHA-256 hex，明文只在 `NewBot` / `RegenerateToken` 的返回值里露面一次。
- `user_id` 指向的虚拟用户创建后不可换：换主体等于换一个人，该重建凭证而不是改字段。
- 显示名上限 32 个 Unicode 字符，比 `chat_bots.name` 的 VARCHAR(80) 严——名字会同步到
  虚拟用户的 `display_name`，取上限的交集才不会写出「能存不能显示」的名。
- `enabled` 只门控鉴权：禁用不删记录，token 仍可比对但一律 403。

**虚拟用户**

复用 `domain/user`，不额外造 bot 用户表。注册时一并建的这个用户：

- 密码哈希留空（与 OAuth-only 用户同构），所以它永远无法用密码登录。
- 邮箱落在 `bot+<uuid>@bot.violet.invalid`，`.invalid` 是 RFC 2606 保留 TLD，永不解析。
- `is_active=true`：`ListContacts` 过滤未激活用户，不激活就搜不到、无法发起私聊。
- 改名同步 `display_name`、换头像同步 `avatar_url`。凭证的 name 是权威，用户侧是投影。

**吊销语义**：删 `chat_bots` 行并把虚拟用户置为 `is_active=false`，不删用户。
`chat_messages.sender_id` 对 `users` 是 `ON DELETE CASCADE`，删用户会连带抹掉它发过的
全部消息，毁掉可追溯的聊天历史。

**仓储端口**：`FindByID` / `FindByUserID` / `FindByToken` / `ListByUserIDs` / `ListPage` /
`Save` / `Delete`。`ListByUserIDs` 是给事件分发用的——判定「会话成员里哪些是 bot」要一次
查完，逐个 `FindByUserID` 是 N+1。

**领域事件**：`chat.bot.created`、`.renamed`、`.avatar.updated`、`.enabled`、`.disabled`、
`.token.regenerated`、`.deleted`，全部由审计订阅者落到操作日志。重置 token 只记
「regenerated」，绝不落新旧凭据——哈希同样是泄露面。

## 应用层

- `BotService`（`application/chat/bot_service.go`）：管理与鉴权。创建时先写 users 再写
  chat_bots（后者对前者有外键），bot 行写失败就补偿删掉刚建的用户，不为此引一套 UoW 装配。
- `BotConnectionManager` + `BotEventDispatcher`（`bot_notifier.go`）：前者按 bot ID 维护
  SSE 连接、队列满即丢，后者按规则判定接收者——私聊对端 bot 收、群聊仅被 @ 的 bot 收、
  发送者是 bot 时整条不投（切回环）、禁用的 bot 不投。
- `chat.Service` 经可选端口 `BotNotifier` 接进来：`WithBotNotifier` 未注入时聊天完全不做
  bot 分发；投递失败只记日志，绝不把已成功的发消息请求改成错误。

## 接口层

路由源码即真相：`internal/interfaces/http/routing/bot_routes.go`（Bot API）与
`admin_router.go` 的 `/chat-bots` 段（管理端）；契约细节看 `/api/v1/openapi.json`
的「聊天 Bot」标签，路由与 spec 由 `TestRouteSpecParity` 双向对账防漂移。

### Bot API（`/api/v1/chat/bot/*`，Bearer bot token）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/profile` | 本 bot 身份：`user_id` 与 `username`，供自指判定 |
| GET | `/events` | SSE 事件流 |
| GET | `/conversations` | 本 bot 参与的会话 |
| GET | `/conversations/{conversationId}` | 会话详情 |
| GET | `/conversations/{conversationId}/messages` | 消息历史，也是断线恢复通道 |
| POST | `/conversations/{conversationId}/messages` | 发文本消息，`Idempotency-Key` 必填 |
| PATCH | `/conversations/{conversationId}/messages/{messageId}` | 编辑自己的消息（流式回复） |
| POST | `/conversations/{conversationId}/typing` | 上报输入状态 |

两点与直觉不同，实现时容易踩：

- **挂在 v1 组外**。`/api/v1` 组对全部写方法做 CSRF 的 cookie+header 配对校验，
  bot 没有 cookie，落在组内会被 403 拦在鉴权之前。与 MCP 端点同策略在根 router 上
  挂载，`TestBotAPIRoutesBypassCSRF` 守住这条。
- **编辑路径带 conversationId**。`chat.Service.EditMessage` 的入参本就含会话 ID，
  成员与归属校验都在服务层做；handler 不另找一份「按消息 ID 反查会话」的旁路。

写端点按 bot 虚拟用户维度限流（`RateLimitByUser`），不是 IP：多个 bot 常从同一台
服务器出口进来，按 IP 计会互相挤占配额。

### 管理端（`/admin/chat-bots`，session + `chat:bot-manage`）

`GET /`、`POST /`、`PATCH /{botId}`、`DELETE /{botId}`、
`POST /{botId}/regenerate-token`。权限点由迁移 `123_add_chat_bot_permission` seed
给 admin 角色；与 `chat:manage`（消息处置）分码——能删违规消息的人未必要能给外部
程序发凭据。

### 中间件

`middleware.BotAuth(lookup)`：`Authorization: Bearer <token>` → 哈希比对 → 注入 bot
与 `UserIDKey`（值取 bot 的虚拟用户 ID，复用现有 `currentUserID` 与用户维度限流）。
失败分类：缺头或 token 不认识 401、bot 已禁用 403、**查库本身出错 500**——把仓储
故障伪装成鉴权失败，会让 bot 误判凭据过期而白白重置。

### SSE 事件格式

帧的事件名就是类型（`message.created`、`typing.updated`），data 里带消息全文快照，
外部实现不必再回查：

```text
event: message.created
data: {"type":"message.created","version":1,"occurred_at":"2026-09-22T10:00:00Z",
       "data":{"conversation_id":"uuid-xxx","message":{"id":"uuid-yyy","sender":{...},
       "type":"text","content":"你好","created_at":"..."}}}
```

**不写 `id:` 行、不支持 Last-Event-ID 补发**。用户侧事件存进 `chat_events` 的是给
浏览器看的引用形态（只有 message_id），与 bot 侧的自带正文形态不同形状；两套形状
塞进同一条流，外部实现就得两边都兼容。bot 的恢复路径是重连后按 `created_at`
拉一次消息历史。


## 前端

人类侧改动极小（V7，待做）：

- bot 用户在联系人列表中显示（可搜索到 bot 虚拟用户）
- bot 消息正常渲染（`MessageDTO` sender 是 bot 虚拟用户）
- 流式编辑通过现有 `message.updated` SSE 事件（前端已支持）
- 无需知道外部 bot 的存在

管理侧（V6，待做）：`/admin` 平台组加「聊天 Bot」页，列表 + 注册 + 一次性 token 展示
+ 启停 + 重置 + 吊销。

## 数据库迁移

`122_create_chat_bots`（表 + `user_id`、`token_hash` 两个唯一索引；`avatar_id` 不建
外键，与 chat_messages.media 同构，由应用层经 FileRepository 校验）与
`123_add_chat_bot_permission`（`chat:bot-manage` 权限点 seed）。


## 安全

- Bot token 只在创建/重置时返回明文，存储用哈希；`token_hash` 在持久化模型上带
  `json:"-"`，防它经任何 DTO 序列化外泄
- Bot 发消息走现有 `chat.Service.SendMessage`，经过消息保存、mention 解析、SSE 推送全链路；
  bot 能进的会话 = 它的虚拟用户是成员的会话，不另设一套范围授权
- Bot SSE 只收本 bot 参与会话的事件，不全量推送；bot 自己发的消息不投给任何 bot
- Bot 写端点按虚拟用户维度限流；虚拟用户无密码，凭据泄露只能靠重置 token 处置
- 未做：token 作用域（按会话/按能力细分）。当前一枚 token 等于该用户在聊天里的全部权限

## 实施顺序

| 阶段 | 内容 | 状态 |
|---|---|---|
| V1 | 领域层：`Bot` 实体 + `BotRepository` + 表迁移 122 | 完成 |
| V2 | 应用层：GORM 仓储 + `BotService` + `BotEventDispatcher` + 审计映射 | 完成 |
| V3 | 接口层：`BotAuth` 中间件 + bot 路由（含 CSRF 豁免回归测试） | 完成 |
| V4 | Handler：`Profile`/`SendMessage`/`EditMessage`/`SetTyping`/会话与消息查询 + SSE + OpenAPI | 完成 |
| V5 | 集成到 `chat.Service`：发消息与输入状态推给参与的 bot | 完成 |
| V6 | admin 后台：bot 管理界面 | 待做 |
| V7 | 前端：bot 用户搜索与会话发起 | 待做 |


## 对接方

本 API 不绑定 Saber。任何持有 bot token 的外部程序均可：
1. `GET /api/v1/chat/bot/profile` 拿到自己的 `user_id` 与 `username`（判定消息是不是自己发的、
   被 @ 的是不是自己）
2. 订阅 `GET /api/v1/chat/bot/events`（SSE，事件名即类型）
3. 发消息 `POST /api/v1/chat/bot/conversations/{id}/messages`，带 `Idempotency-Key` 头
4. 编辑消息 `PATCH /api/v1/chat/bot/conversations/{id}/messages/{id}`（流式回复）
5. 设置输入状态 `POST /api/v1/chat/bot/conversations/{id}/typing`

事件流不补发，重连后用第 3 组的消息历史接口（`GET .../messages`）补齐断线期间漏掉的消息。

Saber 的接入实现见 Saber 仓库 `docs/platform-system.md`。
