# PRD：聊天框中的 Saber 斜杠命令

状态：待实施。本 PRD 描述 Violet 的命令目录、群聊寻址与聊天框交互；Saber 命令定义和执行的对应方案见其仓库 `docs/unified-chat-commands-plan.md`。跨仓库请求字段、命令语法和部署顺序须同步维护。

## 用户要完成什么

在与 Saber 的私聊输入 `/`，或在包含 Saber 的房间输入 `/`，用户能看到当前 bot 提供的命令，筛选并补全命令，填写参数后按现有发送方式提交。可执行的命令由 Saber 决定；Violet 负责展示、寻址、保存消息和投递事件。多个 bot 在同一房间时，用户能明确选择目标，命令只由目标 bot 执行。

当前 `MessageComposer` 复用 `RichCommentInput`，输入区已有 `@` 候选、光标插入、图片和表情能力。Violet Bot API 已能以虚拟用户收发文本、编辑回复和订阅 SSE，但没有命令目录接口，也没有 bot 文件或图片上传发送通道。群聊事件只投给被提及的 bot；仅把 `/task list` 放进房间消息，Saber 收不到事件。文章编辑器的 SlashCommand 使用 Tiptap，聊天输入框不能直接套用。

## 用户交互

| 场景 | 行为 |
| --- | --- |
| 私聊中输入 `/` | 展示该会话中 Saber 发布的可用命令 |
| 房间中输入 `/` | 按 bot 分组展示命令；多个 bot 时先确定目标 bot |
| 输入 `/ta` 或 `/task ` | 按路径与中文描述筛选，展示子命令和参数提示 |
| 方向键、Enter/Tab、鼠标或触屏选择 | 把命令插入草稿，保留焦点；本次选择不直接发送 |
| 输入参数后发送 | 走现有 `sendChatMessage`、幂等键、乐观消息和 SSE 链路 |
| Esc | 先关闭命令菜单；菜单已关闭时按现有规则取消回复或分享 |

无参数命令也先补全，再由用户下一次发送。参数占位符只用于提示，不写入待发送正文。Shift+Enter 保持换行；中文输入法组合期间不把 Enter 当命令选择或发送。光标离开开头的 `/查询词`、删除斜杠或切换会话时关闭菜单。`@` 和 `/` 候选一次只开一个。没有 bot 或目录不可用时，输入仍可作为普通草稿编辑；不能显示一份前端写死、可能与 Saber 不符的命令列表。

群聊发送格式沿用已有提及 token：

```text
私聊：/task list
房间：@(saber:<bot-user-id>) /task list
```

菜单绑定 bot 的真实虚拟用户 ID，插入可见的 `@Saber` 提及；显示名和用户名只用于展示。房间只有一个 bot 时，用户手输完整命令直接发送也由 composer 补上目标；有多个 bot 时，未选目标须先选择，不能广播给所有 bot。服务端对“开头 bot 提及 + 斜杠命令”只投给该目标 bot，不能因为参数中还提及其他 bot 而让多个 bot 执行。Saber 收到后只剥离开头寻址自身的提及。普通聊天的提及投递规则保持原样。

对话框内的候选建议显示 bot 名称、命令、简短描述和参数。可考虑的文案示例：

```text
Saber
/ai                   向 Saber 提问
/ai models            查看可用模型
/ai clear             清除当前会话上下文
/task list            查看任务列表
/task status <id>     查看任务状态
```

目录只展示 Saber 声明在 Violet 可执行的命令。`/task logs`、`/meme` 在 bot 文件/图片能力完成前不作为可选项；手工输入时由 Saber 返回明确的不可用原因。客户端不能凭目录推断用户有执行权限，权限提示可以帮助理解，但结果以 Saber 的执行检查为准。

## Bot 目录协议

Saber 通过现有 Bot Token 调用 `PUT /api/v1/chat/bot/commands`，整体替换自己的目录。请求体协议版本为 1：

```json
{
  "schema_version": 1,
  "commands": [
    {
      "id": "task.status",
      "path": ["task", "status"],
      "description": "查看任务状态",
      "arguments": [{"name": "id", "type": "integer", "required": true}],
      "scope": "conversation"
    }
  ]
}
```

`path` 不含前缀；前端渲染时添加 `/`。Violet 检查版本、请求大小、命令个数、字段长度、路径字符、重复 ID 和参数格式。只接受当前凭证所属 bot 的写入，内容可用空数组撤销。服务端从规范化内容计算 `revision`；相同目录重复发布不产生新版本。持久化可用以 `bot_id` 为主键的 `chat_bot_command_catalogs`，保存协议版本、摘要、目录 JSON 和更新时间；删除 bot 时级联删除目录。

浏览器调用 `GET /api/v1/chat/conversations/{conversationId}/bot-commands`：

```json
{
  "bots": [
    {
      "bot_user_id": "<bot-user-id>",
      "name": "Saber",
      "revision": "<content-hash>",
      "commands": []
    }
  ]
}
```

该接口使用现有登录会话认证，只向当前会话有效成员返回目录，并只包含当前会话中的启用 bot。Violet 不代理浏览器请求到 Saber，也不向浏览器提供 Bot Token。目录由 Saber 在启动、重连或配置变更时重发；目录获取失败不会影响现有聊天。目录更新时间不代表 bot 在线，界面不把旧目录解释为“在线”。降级 Saber 到不支持命令的版本前，先撤销目录。

## 后端与前端落点

后端在 `domain/chat` 保存目录的归属与格式约束，`application/chat` 处理整体替换和会话成员可见范围，`interfaces/http/handler/chat`、路由及 OpenAPI 暴露读写端点。写接口沿用 BotAuth；读接口沿用用户登录态。迁移只新增目录存储，不改变已有聊天消息内容、Bot Token 或 SSE 事件形状。

Bot 事件分发增加命令目标判定：仅当正文开头是有效成员 bot 的提及 token 且后面紧接命令前缀时，将事件投给该 bot。目标使用 token 中的用户 ID，并验证其确属本会话的启用 bot；不能只按用户名匹配。普通人类提及和普通 bot 提及仍按现有规则处理。这个判定只决定投递对象，不解析 Saber 的具体命令路径。

前端在 `features/chat` 增加目录查询、按会话缓存和菜单状态。`MessageComposer` 继续使用现有消息发送调用。输入区的光标范围替换和候选键盘逻辑可从 `RichCommentInput`/`useRichTextInput` 提取为没有 chat、comments、upload 等 feature 依赖的公共编辑能力；评论与聊天分别组合自己的功能。文章编辑器的 Tiptap SlashCommand 只参考交互，不接入聊天输入框。

目录在进入会话时获取并缓存，打开菜单、会话成员变化或发布版本变化时刷新；用户每输入一个字符只在本地筛选。补全仅替换光标前的 `/查询词`，保留其他草稿、提及和图片占位符。菜单使用站内设计 token，提供键盘焦点、候选读屏信息，移动端避开软键盘遮挡。

## 交付顺序与验收

1. 先落地 Saber 的通用命令分发，手工发送 `/task list` 已能得到控制命令回执，再开放菜单。
2. 增加 Violet 目录迁移、Bot 写接口、会话成员读接口、OpenAPI 与权限测试。
3. 接入 Saber 目录发布；验证目录变更、重复发布、空目录撤销和 Bot Token 拒绝访问其他 bot 目录。
4. 增加群聊目标投递，验证多 bot、参数提及另一个 bot、无效目标和普通提及行为。
5. 增加聊天框菜单，验证 `@`/`/` 候选互斥、中文输入法、Enter/Tab/Esc、Shift+Enter、草稿保留、手机软键盘与读屏。
6. 完成真实 Saber ↔ Violet 私聊与群聊联调：目录读取、命令补全、发送、权限拒绝、任务取消、重连重复投递和回复编辑。文件与图片命令待媒体接口完成后另行验收。

Violet 的后端与前端按仓库要求分开提交；PRD 随此功能分支保存。后端执行 `make api-test api-lint api-build`，前端执行 `make web-lint web-typecheck web-test web-build`，再使用现有 Playwright 聊天场景验证菜单。接口模拟和浏览器契约通过后，仍须在真实 Bot API 与 Saber 上完成最终验收。
