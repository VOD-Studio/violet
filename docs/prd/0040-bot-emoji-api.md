# PRD: Bot 表情 API

## Problem Statement

Violet 的聊天与推文正文用同一套内联表情占位符：系统表情写 `[name]`，自定义表情写 `[name:id]`。人类侧由表情选择器生成这两种 token，但 Bot API（PRD-0029、PRD-0039）没有对应的发现与授权入口：

- bot 拿到的表情 DTO 只有 `name` 和图片 URL，要自己推断方括号包裹规则，还要自己拼自定义表情的 `[name:uuid]`；
- 自定义表情按 ADR-0013 私有：`customemoji.ValidateContent` 要求发送者本人拥有或收藏该表情。bot 即使在某条消息里看到 `[name:id]`，也没有合法途径获得选用权，发出去会被 403。

系统表情不需要服务端校验，只缺一个「可以直接发的 token」。自定义表情缺的是「发现 + 收藏」两个动作，而不是放宽校验。

## Solution

新增一组挂在根 router、绕过 CSRF 的 bot 表情端点，鉴权复用 `BotAuth`，业务分别复用 `media.EmojiService` 与 `customemoji.Service`：

```
外部 Bot (如 Saber)
    │  Authorization: Bearer violet_bot_xxx
    ▼
/api/v1/chat/bot/emojis
    ├─ GET    /                                   ← 系统目录 + 本 bot 的自定义库
    ├─ POST   /{customEmojiId}/favorite           ← 获得 [name:id] 的选用权
    └─ DELETE /{customEmojiId}/favorite           ← 放弃选用权
```

不新增消息类型：正文仍是同一份文本 + 内联占位符，`chat.Service`、`message.custom_emote` 渲染与推文正文处理完全复用。放开校验会破坏 ADR-0013，给 bot 单开一条校验分支则让「私有」形同虚设。

### Token 语法

| 类型 | 形态 | 生成方式 |
|---|---|---|
| 系统表情 | `[name]` | 名称已带方括号则原样返回，否则包裹 |
| 自定义表情 | `[name:id]` | `name` 为表情名，`id` 为 UUID |

`EmojiToken(name)` 与 `FormatCustomEmojiToken(name, id)` 是唯一的 token 生成入口，避免每个消费方各拼一次方括号。公开 `GET /api/v1/emojis` 的 `EmojiDTO` 也新增 `token` 字段（纯追加，不破坏既有消费方）。

### 自定义表情的私有 / 收藏模型

- 不提供「全站自定义表情目录」：表情 ID 是随机 UUID，且内容默认私有；能枚举就绕过了 ADR-0013。
- `GET /chat/bot/emojis` 的 `custom` 只包含本 bot 上传（当前恒为空）与自己收藏的表情，来源以 `source` 区分。
- bot 只能通过收藏获得选用权：它需要在聊天、评论或推文里实际见到 `[name:id]`，再调用收藏端点。收藏后 `ValidateContent` 的关系为 `favorited`，发送放行。
- 收藏是引用而非拷贝，受站点自定义表情份额上限约束；原表情被删除或下架后，bot 同步失去选用权。收藏自己上传的表情被拒绝，重复收藏/取消收藏均幂等。

### 接口契约

全部端点要求 `Authorization: Bearer <bot token>`；响应统一信封（`data`）。

`GET /api/v1/chat/bot/emojis` → 200

```json
{
  "data": {
    "groups": [
      {
        "id": 1, "name": "小电视", "source": "bilibili", "sort_order": 0,
        "is_enabled": true, "type": 2,
        "emojis": [
          {"id": 2, "group_id": 1, "name": "doge", "url": "/uploads/emojis/doge.png", "token": "[doge]"}
        ]
      }
    ],
    "custom": [
      {"id": "uuid", "name": "mycat", "token": "[mycat:uuid]", "url": "/uploads/custom/mycat.png", "source": "favorited"}
    ]
  }
}
```

- `groups` 来自 `EmojiService.GetAll`，只含启用分组；每个表情都带可直接发送的 `token`。
- `custom` 按 `owned` 后 `favorited` 展平并按 ID 去重（同一表情同时拥有与收藏时保留 `owned`）。
- 数组恒定非 null；无自定义表情时为 `[]`。

`POST /api/v1/chat/bot/emojis/{customEmojiId}/favorite` → 204

- 400：ID 非 UUID；403：收藏自己的表情或份额已满；404：表情不存在或已下架。

`DELETE /api/v1/chat/bot/emojis/{customEmojiId}/favorite` → 204

- 幂等；400：ID 非 UUID。

### 限流

两个收藏写操作共用 `chat-bot-emoji` 绑定：按 bot 虚拟用户（`user` identity），60 秒 30 次。目录是只读查询，与其他 bot GET 一致不限流。

### 与既有能力的关系

- 系统表情本来就不需要服务端校验，新增能力只是让 bot 不必猜 `[name]` 的拼法。
- 自定义表情继续走 `customemoji.ValidateContent`，没有放松任何校验。
- 消息类型、DTO、SSE 事件均不变；Bot 仍以 `POST .../messages` 或推文写入端点发送带占位符的文本。
- 前端无需改动：聊天与推文渲染已复用同一套 Markdown 表情渲染器。

## 测试

- `application/shared`：`EmojiToken` 的裸名、已带括号、空名；`FormatCustomEmojiToken` 的普通名与含空格/中文名。
- `application/media`：`EmojiDTO.Token` 对裸名与已带括号名称的取值，分组 DTO 同样携带。
- `handler/chat`：目录返回启用分组与带 token 的自定义列表（含去重与来源）；收藏/取消收藏以 bot 虚拟用户调用；未鉴权 401；服务未装配、目录/收藏读取失败、未知 ID、非法 ID、收藏自己（403）等错误路径。
- `routing`：三条路由存在，未鉴权的收藏 POST 返回 401 而非 CSRF 403；限流绑定随 `TestRouteSpecParity` 编译校验。
- `openapi`：新增 `token`、`BotEmojiCatalogDTO`、`BotCustomEmojiDTO` 与三条路径，`TestRouteSpecParity` 双向对账通过。

## 不做

- 新增消息类型或专门的「表情消息」结构。
- 放宽 `customemoji.ValidateContent` 或提供全站自定义表情枚举。
- bot 专属的表情上传 / 管理端点（自定义表情仍由人类用户上传，bot 通过收藏使用）。