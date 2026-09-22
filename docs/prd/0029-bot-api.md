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
    ├─ GET /events (SSE)          ← 入站：bot 收消息事件
    ├─ POST .../messages           ← 出站：bot 发消息
    ├─ PATCH /messages/{id}       ← 出站：bot 编辑消息（流式）
    ├─ POST .../typing            ← 出站：bot 输入状态
    └─ GET .../conversations      ← 查询：会话信息
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

- `POST /api/v1/chat/bot/conversations/{id}/messages`
- body: `{ content, idempotency_key, reply_to_id? }`
- 调用现有 `chat.Service.SendMessage`，senderID = bot 虚拟用户 ID
- 返回 violet 消息 ID（供 bot 后续 Edit）

**消息编辑**：

- `PATCH /api/v1/chat/bot/messages/{messageId}`
- body: `{ content }`
- 调用现有 `chat.Service.EditMessage`，校验发送者是 bot
- 用于流式回复：先 Send 占位消息，再逐步 Edit 更新内容

**输入状态**：

- `POST /api/v1/chat/bot/conversations/{id}/typing`
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

### 新增实体

```go
// internal/domain/chat/bot.go

// Bot 聊天机器人实体
type Bot struct {
    shared.AggregateRoot
    userID      shared.ID    // 对应的虚拟用户 ID
    name        string       // 显示名
    avatarID    *shared.ID   // 头像文件 ID
    tokenHash   string       // API token 哈希（不存明文）
    enabled     bool
}

// BotToken 一次性生成的 token，只在创建时返回明文
type BotToken struct {
    Value string // 仅创建/重置时返回
}
```

### 仓库端口

```go
// internal/domain/chat/repository.go (新增方法)

type BotRepository interface {
    FindByID(ctx context.Context, id shared.ID) (*Bot, error)
    FindByUserID(ctx context.Context, userID shared.ID) (*Bot, error)
    FindByToken(ctx context.Context, tokenHash string) (*Bot, error)
    Save(ctx context.Context, bot *Bot) error
    Delete(ctx context.Context, id shared.ID) error
}
```

## 应用层

### Bot 管理服务

```go
// internal/application/chat/bot_service.go

type BotService struct {
    botRepo  domainchat.BotRepository
    userRepo UserRepository
    chatSvc  *Service
}

// CreateBot 注册新 bot：创建虚拟用户 + 生成 token
func (s *BotService) CreateBot(ctx context.Context, name string, avatarID *shared.ID) (*Bot, string, error)

// RegenerateToken 重置 token
func (s *BotService) RegenerateToken(ctx context.Context, botID shared.ID) (string, error)

// DisableBot / EnableBot 启停 bot
```

### Bot 事件通知器

```go
// internal/application/chat/bot_notifier.go

// BotEventNotifier 面向 bot 的 SSE 事件推送
type BotEventNotifier struct {
    mu    sync.Mutex
    conns map[shared.ID][]chan EventDTO  // botID → channels
}

// Push 向 bot 推送事件
func (n *BotEventNotifier) Push(botID shared.ID, event EventDTO)

// Register bot 订阅事件流
func (n *BotEventNotifier) Register(botID shared.ID) (<-chan EventDTO, func())
```

集成到 `chat.Service`：`SendMessage` 完成后检查消息是否涉及 bot，若涉及则推送给 `BotEventNotifier`。

## 接口层

### 路由

```go
// internal/interfaces/http/routing/bot_router.go

func registerBotRoutes(v1 chi.Router, deps *Deps) {
    v1.Route("/chat/bot", func(r chi.Router) {
        r.Use(middleware.BotAuth(deps.BotService))

        r.Get("/events", deps.BotStream.Stream)
        r.Get("/conversations", deps.BotHandler.ListConversations)
        r.Get("/conversations/{conversationId}", deps.BotHandler.GetConversation)
        r.Get("/conversations/{conversationId}/messages", deps.BotHandler.ListMessages)
        r.Post("/conversations/{conversationId}/messages", deps.BotHandler.SendMessage)
        r.Patch("/messages/{messageId}", deps.BotHandler.EditMessage)
        r.Post("/conversations/{conversationId}/typing", deps.BotHandler.SetTyping)
    })
}

// 管理路由（admin）
func registerBotAdminRoutes(admin chi.Router, deps *Deps) {
    admin.Route("/chat/bots", func(r chi.Router) {
        r.Use(middleware.RequirePermission(...))
        r.Get("/", deps.BotAdmin.ListBots)
        r.Post("/", deps.BotAdmin.CreateBot)
        r.Delete("/{botId}", deps.BotAdmin.DeleteBot)
        r.Post("/{botId}/regenerate-token", deps.BotAdmin.RegenerateToken)
        r.Patch("/{botId}", deps.BotAdmin.UpdateBot)
    })
}
```

### 中间件

```go
// internal/middleware/bot_auth.go

func BotAuth(svc *chatapp.BotService) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w, r) {
            auth := r.Header.Get("Authorization")
            token := strings.TrimPrefix(auth, "Bearer ")
            bot, err := svc.FindByToken(r.Context(), token)
            if err != nil {
                http.Error(w, "无效的 Bot Token", http.StatusUnauthorized)
                return
            }
            if !bot.Enabled {
                http.Error(w, "Bot 已禁用", http.StatusForbidden)
                return
            }
            ctx := context.WithValue(r.Context(), botKey{}, bot)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

### SSE 事件格式

```json
event: message.created
data: {
    "id": "evt-123",
    "type": "message.created",
    "occurred_at": "2026-09-22T10:00:00Z",
    "data": {
        "conversation_id": "uuid-xxx",
        "message": {
            "id": "uuid-yyy",
            "sender": {"id": "user-uuid", "username": "alice"},
            "type": "text",
            "content": "你好",
            "created_at": "2026-09-22T10:00:00Z"
        }
    }
}
```

## 前端

改动极小：

- bot 用户在联系人列表中显示（可搜索到 bot 虚拟用户）
- bot 消息正常渲染（`MessageDTO` sender 是 bot 虚拟用户）
- 流式编辑通过现有 `message.updated` SSE 事件（前端已支持）
- 无需知道外部 bot 的存在

## 数据库迁移

```sql
-- bot 表
CREATE TABLE chat_bots (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(80) NOT NULL,
    avatar_id UUID,
    token_hash VARCHAR(128) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX idx_chat_bots_user_id ON chat_bots(user_id);
CREATE UNIQUE INDEX idx_chat_bots_token_hash ON chat_bots(token_hash);
```

## 安全

- Bot token 只在创建/重置时返回明文，存储用哈希
- Bot 消息发送走现有 `chat.Service.SendMessage`，经过消息保存、mention 解析、SSE 推送全链路
- Bot 权限可配：限制可发消息的会话范围
- Bot SSE 只收 bot 参与会话的事件，不全量推送
- Bot 限流：独立 rate limiter

## 实施顺序

| 阶段 | 内容 |
|---|---|
| V1 | 领域层：`Bot` 实体 + `BotRepository` |
| V2 | 应用层：`BotService` + `BotEventNotifier` |
| V3 | 接口层：`BotAuth` 中间件 + bot 路由 + `BotStream` SSE |
| V4 | Handler：`SendMessage`/`EditMessage`/`SetTyping`/`ListConversations` |
| V5 | 集成到 `chat.Service.SendMessage`：检测 bot 参与会话并推送 `BotEventNotifier` |
| V6 | admin 后台：bot 管理界面 |
| V7 | 前端：bot 用户搜索 + 会话发起 |
| V8 | 数据库迁移 |

## 对接方

本 API 不绑定 Saber。任何持有 bot token 的外部程序均可：
1. 订阅 `GET /api/v1/chat/bot/events` (SSE)
2. 发消息 `POST /api/v1/chat/bot/conversations/{id}/messages`
3. 编辑消息 `PATCH /api/v1/chat/bot/messages/{id}`
4. 设置输入状态 `POST /api/v1/chat/bot/conversations/{id}/typing`

Saber 的接入实现见 Saber 仓库 `docs/platform-system.md`。
