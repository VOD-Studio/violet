# PRD: Bot 媒体 API

## Problem Statement

Violet 的 [Bot API](./0029-bot-api.md)（PRD-0029）当前只开放文本消息：`bot.go:SendMessage` 硬编码 `Type=MessageText`，请求体只有 `content / reply_to_id / status`；`handler/chat/bot.go:113-115` 注释明确写「图片与分享推文涉及媒体归属与引用校验，bot 侧没有对应上传通道」。

同时 `/uploads/*` 上传链路只认 `SessionAuth` cookie，bot 拿不到 cookie，无法把文件以 `ownerID = bot.UserID()` 注册到 `upload.File`。

结果是接入 violet 的 AI bot（如 Saber）既不能发送图片，也不能被用户发的图片触达——图片消息在 `normalizeMessage` 里被直接跳过。

本 PRD 给 Bot API 补上图片能力：一个 bot 鉴权的上传端点，以及 SendMessage 对图片消息的支持。

## Solution

在 Bot API 下新增媒体上传端点，并扩展 SendMessage 分派图片消息。领域层与应用层已就绪，本次只补 HTTP 层和上传通道。

### 复用基线（本次不重写）

- `domain/chat/entity.go:42` `MessageImage` 类型；`Message.mediaIDs []shared.ID`（`entity.go:280`）；`NewImageMessage`（`entity.go:337`，校验/去重 mediaIDs）。
- `application/chat/service.go:884` `SendMessage` 已支持 image 分派 + `chatImage`（`service.go:1814`）做**归属/类型/状态/purpose 四重校验**：`!file.OwnerID().Equal(userID) || file.Status() != StatusReady || !strings.HasPrefix(file.MimeType(), "image/") || !isAllowedChatImagePurpose(file.Purpose())`。
- `purpose="chat"` 已在白名单（`service.go:1828-1840`）。
- `SendMessageInput.MediaIDs`（`service.go:110`）字段已存在，bot 入口此前未填。
- `MessageDTO.Media []MediaDTO`（`service.go:280`）已含 `url / thumbnail / mime_type / width / height / size`，事件流与历史消息理论上已带。

### 架构

```
外部 Bot (如 Saber)
    │
    │  ① 上传图片字节
    ▼
POST /api/v1/chat/bot/media          ← 新增：multipart 整体上传
    │   BotAuth → bot.UserID() 作 ownerID，purpose="chat"
    │   落盘 + 建 upload.File 记录，返回 file_id
    │
    │  ② 引用 file_id 发图片消息
    ▼
POST .../conversations/{id}/messages ← 扩展：type=image + media_ids
    │   复用 chat.Service.SendMessage → chatImage 归属校验
    │   复用 SSE 推送给前端
    ▼
前端无感知（MessageImage 早已支持渲染）
```

### 关键设计

**上传通道：独立端点，不复用 `/uploads/*`**

- `/uploads/*` 挂 `SessionAuth` cookie，是浏览器用户的分片/秒传/缩略图链路，bot 不需要这套状态机。
- 新端点 `POST /api/v1/chat/bot/media` 挂 `BotAuth` Bearer token，`ownerID = bot.UserID()`，`purpose = "chat"`，**整体上传，不分片不秒传**。
- 落盘建记录逻辑从 `application/media.UploadService` 提取共享内部方法（如 `SaveBotMedia(ctx, ownerID, purpose, reader, mime, filename)`），或直接调 `FileRepository.Create` + 落盘工具函数。**避免重复实现落盘**。

**图片消息：一次性发送，不进流式状态机**

- bot 发图片直接走 `type=image + media_ids`，`status` 不设 `pending`。
- `bot_reply` 的 `pending/thinking/streaming/completed/failed` 状态机只挂文本生成；图片没有「先模糊再清晰」的语义。
- 因此本次**不扩展 `EditMessage` 的图片替换路径**（`EditMessageInput.MediaIDs` 字段虽存在但不接 bot 端）。未来若要 AI 生图重绘可再补。

**归属校验天然闭环**

- `chatImage` 校验 `file.OwnerID().Equal(userID)`，bot 入口的 `userID = bot.UserID()`，只要上传时 ownerID 一致即通过。
- 跨 bot 引用（bot A 的 file_id 被 bot B 引用）会被 `chatImage` 拦回 403，无需额外代码。
- 引用计数复用 `service.go:911` 的 `UpdateRefCount(..., 1)`，消息删除时既有回滚路径。

**入站：bot 事件流已携带 media**

- `MessageDTO.Media` 已存在。本 PRD 只需**验证** bot SSE 事件与 `GET .../messages` 响应是否序列化了 `media` 字段（`bot_notifier.go`、`bot.go:writeBotEvent`）；若被裁剪则补上。无新增领域逻辑。

## 接口契约

### POST /api/v1/chat/bot/media

上传一张图片，注册到 `upload.File`（ownerID=bot 虚拟用户，purpose=chat，status=ready）。

- **鉴权**：`BotAuth`（Bearer token）
- **限流**：bot 写端点维度（或独立 `bot-media` 维度）
- **请求体**：`multipart/form-data`
  - `file`（必填）：图片字节
  - `filename`（可选）：原始文件名，仅作 `originalName` 元数据
- **校验**：
  - 大小上限 ≤ `chat.bot.media_max_bytes`（默认 10MB，0 = 不限制）
  - MIME 白名单：`image/png|jpeg|gif|webp`（`mime.ParseMediaType` 后比对）
  - 存储名内部生成（UUID/哈希），**不接受 filename 作路径**，防路径注入
  - 宽高用 `image.DecodeConfig` 解析
- **响应** `201`：
  ```json
  {
    "id": "<file_id>",
    "url": "/uploads/...",
    "mime_type": "image/png",
    "width": 800,
    "height": 600,
    "size": 12345
  }
  ```
- **错误**：超大→`413`；非图片 MIME→`400`；未鉴权→`401`；禁用 bot→`403`

### POST /api/v1/chat/bot/conversations/{id}/messages（扩展）

在 [PRD-0029](./0029-bot-api.md) 既有端点上扩字段，向后兼容。

- **请求体**新增：
  ```json
  {
    "type": "image",          // 新增，默认 "text"
    "content": "caption",     // image 时作为 caption，可空
    "media_ids": ["<fid>"],   // 新增，type=image 时必填
    "reply_to_id": "...",     // 不变
    "status": ""              // image 时禁止设 "pending"
  }
  ```
- `type` 为空回退 `"text"`（已有客户端不受影响）。
- `type=="image"`：
  - 校验 `media_ids` 非空、`status != "pending"`
  - 解析为 `[]shared.ID`，透传 `domainchat.MessageImage`，调 `SendBotMessage`
- `bot.go:113-115`「只开放文本」注释失效，更新为说明图片走 bot 专用上传端点 + 既有归属校验。

## 安全考虑

- **新上传端点是安全敏感面**（PR 必须标注）：
  - 限大小、限 MIME 白名单、限频；落盘路径不接受 filename 注入。
  - bot token 可上传文件到服务器磁盘，限流维度建议独立，防滥用占满磁盘。
- **purpose=chat 归属链**：bot 上传的文件 ownerID = bot 虚拟用户，`chatImage` 校验天然拦住跨 bot 引用。
- **入站下载（供 saber 侧消费）**：`/uploads/*` 是站内公开路径（`router.go:120` 无鉴权读取），bot 直连下载无需额外凭证。若 violet 站点未来给 `/uploads/*` 加防盗链，需同步给 bot 提供带凭证的读取端点。

## 测试策略

### 媒体上传端点（新文件 `handler/chat/bot_media_test.go`）
- 上传成功：返回 `file_id` + 可被 SendMessage 引用
- 超 10MB → `413`
- 非 `image/*` MIME → `400`
- 未带 Bearer → `401`
- 禁用 bot → `403`
- 落盘路径不被 filename 注入（传 `../../etc/passwd` 之类）

### SendMessage 图片分派（扩展 `handler/chat/bot_test.go`）
- `type=image + media_ids` 成功，落库 `MessageImage`，引用计数 +1
- `media_ids` 空 → `400`
- `status=pending` + `type=image` 组合 → `400`
- 跨 bot 引用（bot B 引用 bot A 上传的 file_id）→ `403`（复用 `chatImage`）
- `type` 为空回退 `text`（向后兼容）

### 事件流 media 携带
- `writeBotEvent` 对 image 消息的事件 data 含 `media` 数组
- `GET .../messages` 历史消息含 `media`
- 若已带，该测试作为回归保障；若被裁剪，修补后此测试覆盖

### 覆盖率
按仓库既有门禁；新增分支（上传失败、非图片 MIME、大小边界、跨 bot 拒绝）全部覆盖。

## 提交拆分

遵循仓库 Conventional Commits + package scope + 中文 summary 惯例，每完成一个功能点提交一次，CI 绿后进下一个。

1. `feat(chat): bot 专用媒体上传端点`
   - `POST /api/v1/chat/bot/media` + `BotAuth` + 落盘建 `upload.File`（ownerID/purpose/status）
   - 大小/MIME/限频校验
   - `handler/chat/bot_media.go` + `bot_media_test.go`
   - OpenAPI 补 `paths_bot.go`
2. `feat(chat): bot SendMessage 支持图片消息`
   - `bot.go:SendMessage` 请求体加 `type / media_ids`
   - `type=image` 分派 `MessageImage`，复用 `SendBotMessage`
   - 更新 `bot.go:113-115` 注释
   - 扩展 `bot_test.go`
3. `feat(chat): bot 事件流携带 media 字段`
   - 验证 `bot_notifier.go` / `bot.go:writeBotEvent` 是否序列化 `MessageDTO.Media`
   - 缺则补；补后加回归测试
   - 若第 2 步验证已携带，该提交可省，仅在测试里固化

## 配置变更

`config.Chat`（或对应结构）新增：
```go
BotMediaMaxBytes int64 `mapstructure:"bot_media_max_bytes"` // 默认 10MB，0 = 不限制
```
`config.SetDefault("chat.bot_media_max_bytes", 10*1024*1024)`。仅一个可调项，避免过度参数化。

## 待确认事项（实现时读代码即可定）

1. **`MessageDTO.Media[].URL` 相对还是绝对路径**？读 `application/chat/service.go` 的 MediaDTO 组装代码确认。saber 侧下载时据此决定是否拼 endpoint。
2. **`bot_notifier.go` / `bot.go:writeBotEvent` 是否已序列化 `Media`**？若裁剪了字段，第 3 个提交需要补全。
3. **落盘逻辑复用方式**：`UploadService` 是否有可直接调的「整体落盘建记录」入口，还是要从 `CompleteUpload`（`service.go:987`）里抽一个共享方法。

## 不在本次范围

- bot 图片消息的编辑替换（`EditMessage` 传 `MediaIDs`）——无场景驱动。
- bot 分片/秒传上传——bot 图片通常小且整体上传。
- 入站图片下载（这是 saber 侧实现，saber 仓库的 `docs/violet-image-support.md` 覆盖）。
- violet 用户侧已有图片能力（已由 PRD-0019 等覆盖）。
