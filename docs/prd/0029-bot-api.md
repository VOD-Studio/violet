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
- 注册通过 admin 后台管理，生成 token（比对用哈希，明文另存一份密文）
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

- `token_hash` 存 SHA-256 hex 供鉴权比对；明文另经 AES-256-GCM 存在 `token_encrypted`，
  所以 `NewBot` / `RegenerateToken` 之后还能反复取回。密钥没配、或 bot 早于密文列创建时
  取不回来，只能重置。
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

留下的虚拟用户仍占着 `users.username` 的唯一索引，所以注册对这种空壳是**回收复用**，
不是见名就判冲突：邮箱形如 `bot+<自身 ID>@bot.violet.invalid`（连本地部分的 ID 一起核，
光看域名会把真用户误判成壳）且名下已无凭证，就把原用户重新启用、按新表单同步展示名与
头像（未选头像即清空），凭证挂回同一个 user ID，历史消息继续归属新 bot。真用户、被禁用
的账号、以及仍挂着凭证的 bot（哪怕已禁用）一律 409——抢名等于抢署名。

**仓储端口**：`FindByID` / `FindByUserID` / `FindByToken` / `ListByUserIDs` / `ListPage` /
`Save` / `Delete`。`ListByUserIDs` 是给事件分发用的——判定「会话成员里哪些是 bot」要一次
查完，逐个 `FindByUserID` 是 N+1。

**领域事件**：`chat.bot.created`、`.renamed`、`.avatar.updated`、`.enabled`、`.disabled`、
`.token.regenerated`、`.token.viewed`、`.deleted`，全部由审计订阅者落到操作日志。重置 token
只记「regenerated」，查看只记「谁看了哪个 bot」，绝不落新旧凭据——哈希同样是泄露面。

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

人类侧零改动（V7）：

- bot 用户在联系人列表中显示（可搜索到 bot 虚拟用户）
- bot 消息正常渲染（`MessageDTO` sender 是 bot 虚拟用户）
- 连续编辑会发出 `message.updated` SSE 事件；V8 在线事件携带正文快照，前端直接更新消息，断线补发时回查
- 无需知道外部 bot 的存在

实测：`GET /chat/contacts?q=saber` 直接返回 bot 虚拟用户（`display_name` 即 bot 名），
私聊创建与消息渲染走既有人类链路，前端一行未改。

管理侧（V6）：`/admin/chat-bots`（平台组，`chat:bot-manage` 门禁）——列表（带头像）、注册（
可从素材库选头像）、token 卡（复制后关闭即从内存丢弃，但随时能从列表再调出来）、启停开关、
重置与吊销的二次确认框。

注册完不是终点：列表行内即可改名（点名称就地编辑，失焦提交、Esc 放弃）与换头像（点头像开素材库，
角标清除），都走 `PATCH /admin/chat-bots/{id}` 的单字段补丁，复用注册时那份 `AvatarPicker`。

## 数据库迁移

`122_create_chat_bots`（表 + `user_id`、`token_hash` 两个唯一索引；`avatar_id` 不建
外键，与 chat_messages.media 同构，由应用层经 FileRepository 校验）、
`123_add_chat_bot_permission`（`chat:bot-manage` 权限点 seed）与
`124_add_chat_bot_token_ciphertext`（`token_encrypted` 可空列，存明文凭据的 AES-GCM 密文）。


## 安全

- Bot token 比对用哈希，明文以 AES-256-GCM 密文存在 `token_encrypted`，密钥是 `BOT_TOKEN_KEY`；
  两者在持久化模型上都带 `json:"-"`，防它们经任何 DTO 序列化外泄
- 明文凭据只经 `POST /admin/chat-bots/{id}/token` 单个回显，不随列表广播；走 POST 而非 GET 是为了
  不让凭据迚 URL（浏览器历史与反代理访问日志都存 URL），每次查看进操作日志
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
| V6 | admin 后台：bot 管理界面 | 完成 |
| V7 | 前端：bot 用户搜索与会话发起 | 零改动即成立 |
| V8 | bot 回复的前端实时增量显示 | 本地实现完成，真实 bot 联调待验收 |

## V8：bot 回复的前端实时增量显示

实施 issue：[后端事件契约 #416](https://github.com/VOD-Studio/violet/issues/416)、[前端实时消费 #417](https://github.com/VOD-Studio/violet/issues/417)。前端依赖后端事件契约。

**验收目标**：外部 bot 收到模型的文本增量后，用户在同一条消息气泡中持续看到真实生成的正文；刷新或断线重连后看到数据库里的最新正文。前端不按定时器伪造打字过程。

Bot 通过 `POST .../messages` 创建消息，再连续 `PATCH .../messages/{messageId}` 提交累计正文；Saber 的 Presenter 消费模型 `TextDelta`，按约 200 ms 的间隔调用 Edit。每次 Edit 都保存完整消息并产生 `message.updated`。V8 之前，用户侧事件只带 `conversation_id` 与 `message_id`，前端每次都要通过 HTTP 重拉消息；V8 让在线事件带正文，前端按事件更新缓存。

### 事件契约

- 保留 bot 的 `POST` 创建和 `PATCH` 累计正文接口；模型增量仍由外部 bot 负责发送，不让 Violet 运行模型，也不新增一条上传长连接。
- 文本消息 Edit 成功落库后，在线用户的 `message.updated` SSE 在现有 `data.conversation_id`、`data.message_id` 外附 `data.content`（本次累计正文）与 `data.edited_at`。旧客户端忽略新增字段，旧事件格式仍可读取。
- `chat_events` 保持只存消息 ID 的轻量引用。实时 SSE 帧带正文快照，断线补发的旧帧仍只带 ID；否则每次累计正文会按会话成员数重复写入事件表。重连时从消息查询取当前最终快照，不逐条重放旧增量。
- 图片、分享等非文本编辑仍走原有按 ID 重拉路径。文本编辑事件的正文以已落库内容为准；SSE 投递失败不能把已成功的编辑改判失败。

实时帧示例（`id` 仍是用户聊天事件序号）：

```json
{"type":"message.updated","version":1,"data":{"conversation_id":"uuid-a","message_id":"uuid-b","content":"正在生成的累计正文","edited_at":"2026-09-23T10:00:00Z"}}
```

### 浏览器消费

- `useChatStream` 收到带 `content` 的 `message.updated` 后，按 `conversation_id`、`message_id` 定位消息缓存并直接替换正文与 `edited_at`。同一气泡随真实增量更新，不为每一段重新请求消息列表、会话列表和未读数。
- 缓存里还没有这条消息、事件没有正文（断线补发或旧服务端）、非文本编辑、或正文含需按查看者解析的自定义表情时，走现有查询失效回查路径。连接建立时继续全量对账。
- 用事件序号或编辑时间防止旧帧覆盖新正文；在途消息查询应支持取消，避免较早的 HTTP 响应在 SSE 快照之后覆盖新内容。
- 沿用现有 Markdown 正文、输入状态与时间戳样式；本阶段不引入逐字动画。编辑标识是否对 bot 的生成过程隐藏，要先有明确的流完成信号，本阶段不靠时间猜测完成。

### 实施与验收

1. **后端提交**：在应用层文本编辑的通知路径增加仅用于实时投递的快照，更新事件契约及 OpenAPI；保持持久化事件载荷和 bot 鉴权、成员校验不变。测试实时帧含已保存正文、补发帧按 ID 回查、普通编辑仍可用。
2. **前端提交**：消费快照并更新 TanStack Query 消息缓存；无快照时回查。测试连续三段更新使用同一消息 ID、不会逐段发消息列表请求，旧帧与在途查询不会使正文倒退。
3. **真链路验收（待做）**：在站内与启用流式模型的 bot 对话，观察至少三次真实增量、最终正文与历史接口一致；刷新与断线重连能恢复，普通用户编辑及另一个会话不受影响。浏览器契约测试使用模拟 SSE，`scripts/bot-smoke.mjs` 只证明 Bot API 连续编辑成功；两者都不能代替真实模型验收。

V8 不需要数据库迁移；如果后续确需“回复中/完成/失败”的持久状态，再单独设计显式的完成协议，避免从两次增量间隔猜状态。


## 对接方

本 API 不绑定 Saber。任何持有 bot token 的外部程序均可：
1. `GET /api/v1/chat/bot/profile` 拿到自己的 `user_id` 与 `username`（判定消息是不是自己发的、
   被 @ 的是不是自己）
2. 订阅 `GET /api/v1/chat/bot/events`（SSE，事件名即类型）
3. 发消息 `POST /api/v1/chat/bot/conversations/{id}/messages`，带 `Idempotency-Key` 头
4. 编辑消息 `PATCH /api/v1/chat/bot/conversations/{id}/messages/{id}`（流式回复）
5. 设置输入状态 `POST /api/v1/chat/bot/conversations/{id}/typing`

事件流不补发，重连后用第 3 组的消息历史接口（`GET .../messages`）补齐断线期间漏掉的消息。

上面五步的最小参考实现是 `scripts/bot-smoke.mjs`（零依赖 Node，真链路冒烟）：

```bash
BOT_SMOKE_TOKEN=violet_bot_xxx node scripts/bot-smoke.mjs   # 默认打 http://localhost:9090
```

除五步外还顺带卡住三件容易在集成处碎掉的事：同一 `Idempotency-Key` 重发只会拿到同一条消息、
bot 自己发的消息不会回投给自己、历史接口读到的内容是最后一次编辑后的最终态。

Saber 的接入实现见 Saber 仓库 `docs/platform-system.md`。
