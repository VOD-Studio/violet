# 聊天消息「重新编辑已发送消息」最佳实践调研

**目的。** 为 violet 博客平台的聊天功能新增「重新编辑自己已发送消息」能力提供一手证据。以下每个论断均给出 primary source（官方帮助中心 / 官方博客 / 官方开发者文档 / 协议规范 / 官方开源代码）。少数官方文档未覆盖的点会明确标注为非官方来源或产品行为观察。

## 总览速查表

| 产品 | 编辑时限 | 编辑历史 | 已编辑标识 | 可编辑范围 | 实时同步机制 |
| --- | --- | --- | --- | --- | --- |
| WhatsApp | 发送后 15 分钟 | 不保留 | 「edited」小字 | 仅文本（不可改媒体） | 客户端同步（E2E 加密消息内携带） |
| Telegram | 官方文档未标注时限（社区文档称普通用户 48 小时、管理员不限） | 不保留，但显示最后编辑时间 | 小的「edited」标签 + 最后编辑时间戳 | 文本；后续版本支持给已发消息追加媒体 | MTProto `messages.editMessage` |
| Discord | 无时限 | 不保留 | 「(edited)」行内小字，悬停见编辑时间 | 文本、embed、附件（增删）、组件 | 网关 `MESSAGE_UPDATE` 事件 + `edited_timestamp` 字段 |
| Slack | 默认无时限；工作区所有者可设为「永不 / 任意时间 / 指定窗口」 | 普通成员不可见历史；付费版可配置留存供导出/合规审计 | 「(edited)」行内标签 | 文本与附件 | Events API `message_changed` 子类型事件 |
| Signal | 发送后 24 小时，每条最多改 10 次；「Note to Self」不限时 | 保留，点「Edited」或消息详情可查看历史版本 | 气泡时间戳旁「Edited」 | 文本 | Signal 协议消息同步（E2E） |
| Matrix（协议） | 协议不规定时限，由服务器/房间策略决定 | 编辑事件全部保留在事件图中（可被撤回 redact） | 客户端自行渲染（常见为「(edited)」） | 任意事件 content（`m.new_content` 全量替换，可含媒体消息） | `m.replace` 关系事件 + 服务器端聚合 |
| Discourse | 默认 1440 分钟（24h），TL2 用户默认 30 天；staff 不限 | 保留 diff 历史，默认对所有人公开（铅笔图标点开） | 铅笔图标 + 修订计数 | 帖子全文（Markdown） | 站内消息总线实时更新 |
| GitHub 评论 | 无时限 | 保留全部版本 diff，有读权限者可看；单条内容最多保留 100 次编辑 | 评论头部「edited」下拉 | 评论 Markdown 正文 | 页面内实时更新 / REST API |

## 1. WhatsApp

- **编辑时限：发送后 15 分钟。** 官方博客原文：「All you need to do is long-press on a sent message and choose 'Edit' from the menu for up to fifteen minutes after.」（[Now you can edit your WhatsApp messages – WhatsApp Blog](https://blog.whatsapp.com/now-you-can-edit-your-whatsapp-messages)，2023-05-22）
- **不保留编辑历史。** 官方博客明确：「Edited messages will display 'edited' alongside them, so those you're messaging are aware of the correction **without showing edit history**.」（同上）
- **已编辑标识：** 消息旁显示「edited」小字（行内 suffix），与时间戳同区域。
- **可编辑范围：仅文本，不能编辑照片、视频等媒体类消息。**（[WhatsApp Help Center – Edit messages](https://faq.whatsapp.com/6614640168569481)）
- **入口：** 移动端长按消息 → 菜单选 Edit；桌面端悬停消息出现菜单。（官方博客 + Help Center）
- **隐私语境：** 编辑本身也走端到端加密（「your messages and the edits you make are protected by end-to-end encryption」，官方博客）。这决定了 WhatsApp 无法做服务器端历史留存——「无历史」既是产品选择也是加密架构的必然。

## 2. Telegram

- **功能定位：** 2016 年 5 月官方博客宣布上线消息编辑：「Starting today, you can edit the text of your messages after sending them. This works across all Telegram chats, including groups and one-on-one conversations.」（[Edit Messages, New Mentions and More – Telegram Blog](https://telegram.org/blog/edit)）
- **已编辑标识：** 「The messages will display a small 'edited' label so that it's easy to tell which were altered.」（同上）。2024 年 10 月更新又加入了**最后编辑时间戳**（last edit timestamps）（[Improved Videos and Much More – Telegram Blog](https://telegram.org/blog/dynamic-video-quality-and-more)）。
- **不保留可查看的编辑历史**——接收方能看出消息被改过，但看不到改前内容。
- **编辑时限：** 官方 FAQ 只写「Edit your messages after posting」（[Telegram FAQ – Unified history](https://telegram.org/faq#q-what-makes-telegram-groups-cool)），未标注时限。**非官方**社区文档 [tginfo limits](https://limits.tginfo.me/en) 记载：普通用户发送后 48 小时内可编辑；拥有「Pin Messages」权限的群组/频道管理员不受限；Saved Messages 不限。此 48 小时数字无法从官方一手文档核实，引用时需注意来源属性。API 层对应 [messages.editMessage](https://core.telegram.org/method/messages.editMessage)（官方 MTProto 文档）。
- **可编辑范围：** 文本；2024 年 10 月更新支持**给已发送的消息追加媒体附件**（attaching media to sent messages，见上「Improved Videos」官方博客）。
- **入口：** 移动端长按 → Edit；桌面端**输入框为空时按 ↑ 方向键编辑最后一条消息**（官方博客原文：「If you're on desktop, press the up arrow button to edit your last message.」）。

## 3. Discord

- **编辑时限：无。** Discord 官方 API 文档的 Edit Message 端点未定义任何时间窗口；消息对象用独立的 `edited_timestamp` 字段记录编辑时间（「when this message was edited (or null if never)」），说明编辑是面向任意历史消息的原地更新。（[Message 资源文档 – discord/discord-api-docs](https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx)；在线渲染版：[docs.discord.com/developers/resources/message#edit-message](https://docs.discord.com/developers/resources/message#edit-message)）
- **不保留编辑历史**：客户端只显示当前版本 + 「(edited)」。
- **已编辑标识：** 消息行内「(edited)」灰色小字，悬停可看到最后编辑时间；不可关闭。
- **可编辑范围（API 语义）：** 消息原作者可改 `content`、`embeds`、`flags`、`components`；**附件可增删**（编辑时通过 `attachments` 字段声明保留哪些附件，新文件以 multipart 追加）。其他用户即使有 `MANAGE_MESSAGES` 权限也只能改 `flags`，**不能改别人消息的内容**。（Edit Message 端点文档，同上）
- **编辑后 mention 重建：** 官方文档明确——content 被编辑时，`mentions`、`mention_roles`、`mention_everyone` 会**基于新内容从头重建**，并受本次编辑请求的 `allowed_mentions` 控制（即编辑可以触发对新被 @ 用户的通知）。（Edit Message 端点文档，同上）
- **实时同步：** 编辑触发网关 **MESSAGE_UPDATE** 事件，payload 为完整 message 对象；消息排序不受影响——原 `timestamp`（发送时间）与 `edited_timestamp` 是分离字段，timeline 按原 `timestamp` 保持原位。（[Gateway Events 文档](https://github.com/discord/discord-api-docs/blob/main/developers/events/gateway-events.mdx) / [在线版](https://docs.discord.com/developers/events/gateway-events#message-update)）
- **权限边界：** 删除他人消息需要 `MANAGE_MESSAGES` 权限；编辑他人消息内容在 API 上根本不存在此能力（bot 场景下 webhook 消息除外）。
- **入口：** 桌面端输入框为空时按 **↑** 编辑自己最后一条消息（官方博客 [How to Use Keyboard Shortcuts on Discord](https://discord.com/blog/how-to-use-keyboard-shortcuts-on-discord-create-custom-keybinds)）；悬停消息 → 更多操作 → Edit；移动端长按消息 → Edit。

## 4. Slack

- **编辑时限：默认无时限，但可配置。** 「By default, any member can edit their messages, but owners and admins can restrict this permission.」（[Edit or delete messages – Slack Help Center](https://slack.com/help/articles/202395258-Edit-or-delete-messages)）。工作区所有者可在 Administration → Workspace settings → Permissions 中把编辑策略设为「任意时间 / 永不 / 发送后指定时间窗口内」。（[Manage permissions for message editing and deletion – Slack Help Center](https://slack.com/help/articles/115004868646-Manage-permissions-for-message-editing-and-deletion)）
- **已编辑标识：** 消息行内「(edited)」标签，悬停显示最后编辑时间。
- **编辑历史：对普通成员不展示**；但付费版工作区所有者可通过数据留存策略保留全部编辑与删除记录，供数据导出 / Discovery API 合规审计使用——即界面上改掉的内容未必从组织数据里消失。（[Slack Privacy FAQ](https://slack.com/trust/privacy/privacy-faq)）
- **实时同步：** 编辑（包括 `chat.update` API 调用与用户手动编辑）都会触发 Events API 的 **`message_changed`** 子类型事件，payload 同时携带新 `message` 与 `previous_message`，订阅方可对比差异。注意该事件也会因链接展开等系统行为触发，接入方需过滤。（[message_changed event – Slack API](https://api.slack.com/events/message/message_changed)；[chat.update – Slack API](https://api.slack.com/methods/chat.update)）
- **权限边界：** 只能编辑自己的消息；所有者/管理员可**删除**成员在公共频道、私有频道和群组 DM 中的消息，但不能编辑他人消息。（Edit or delete messages，同上）
- **入口：** 桌面端悬停 → ⋯ → Edit message；**输入框为空时按 ↑ 编辑最后一条**（默认快捷键，可在 Accessibility 设置改行为）（[Slack keyboard shortcuts – Help Center](https://slack.com/help/articles/201374536-Slack-keyboard-shortcuts)）；移动端长按或双击（Android）消息。

## 5. Signal

- **编辑时限与次数双限制：发送后 24 小时内、每条消息最多编辑 10 次**；例外是「Note to Self」（自己发给自己的消息）不限时但仍限 10 次。（[Edit Message – Signal Support](https://support.signal.org/hc/en-us/articles/6255134251546-Edit-Message)；功能发布见 [Signal 官方博客 New Features Fall 2023](https://signal.org/blog/new-features-fall-2023/)）
- **编辑历史：保留且对接收方可见。** 点击气泡时间戳旁的「Edited」即可查看历史版本，也可从消息详情进入——这是主流 IM 中少见的「历史公开」路线，与其「防抵赖/防篡改语境」的隐私定位一致。
- **已编辑标识：** 气泡内时间戳旁显示「Edited」，可点击查看历史。
- **入口：** 移动端双击气泡快捷编辑、或长按 → Edit；桌面端按 ↑ 编辑上一条，或悬停 → ⋯ → Edit。（Signal Support 同上）
- **排序：** 编辑后的消息保留原时间戳原位，不会因编辑上浮。

## 6. Matrix（协议规范）

Matrix 是其中唯一把编辑写进开放协议规范的实现，见 [Client-Server API 规范「Event replacements」一节](https://spec.matrix.org/latest/client-server-api/#event-replacements)。

- **数据模型：追加式，而非原地更新。** 编辑是发送一个带 `m.replace` 关系类型的新事件，`m.relates_to` 指向原事件 `event_id`，新内容放在 `m.new_content` 字段；`body`/`msgtype` 里放降级内容供不支持编辑的旧客户端显示。服务器**不修改原事件 content**，只做聚合：在被编辑事件的 `unsigned.m.relations` 下挂出「最新一次有效替换」。v1.7 之前规范要求服务器直接替换 content，后来因「可靠的客户端实现难以做到」而废止。（规范 Server behaviour / Server-side aggregation of `m.replace` relationships 小节）
- **权限边界写死在协议里：** 替换事件合法的前提包括——与原事件同房间、**同发送者（不能编辑别人的消息）**、同事件类型、不能是 state 事件、原事件本身不能已是替换事件（不可「编辑编辑」，但可对同一原事件多次编辑）。不满足则实现方应当忽略。（规范 Validity of replacement events 小节）
- **多次编辑的定序：** 以替换事件的 `origin_server_ts` 比较新旧，时间戳相同则取 `event_id` 字典序大者；客户端渲染最新一次有效替换。
- **排序语义天然稳定：** 原事件在时间轴中的位置不变，编辑只是挂在它身上的关系事件。
- **编辑与 @mention 的交互有明确规范：** 替换事件顶层 `m.mentions` 只放**本次编辑新增**的提及（决定是否再次通知），`m.new_content` 内的 `m.mentions` 放最终版本的完整提及集合——「确保用户不会因为每次编辑修订都被重复通知，但允许新提及用户被通知」。编辑中移除某人的提及时，两处都不应再包含该用户。（规范 Edits of events with mentions 小节）
- **与撤回（redaction）的关系：** 原事件被 redact 后，其 `m.replace` 关系不再随事件下发。（规范 Redactions of edited events 小节）
- **可编辑范围：** 理论上任意非 state 事件的内容（`m.new_content` 可含任何正常 content 属性，如 `formatted_body`）；甚至允许替换后 `msgtype` 与原事件不同（如 `m.text` 改成 `m.emote`）。应用时 `m.new_content` 整体覆盖原 content，但原事件的 `m.relates_to`（回复关系）被保留。

## 7. Discourse（论坛类代表）

- **编辑时限：按信任级别（Trust Level）分层的站点设置**，默认值来自官方源码 [site_settings.yml](https://github.com/discourse/discourse/blob/main/config/site_settings.yml)：
  - `post_edit_time_limit` 默认 1440 分钟（24 小时），上限 10080；
  - `tl2_post_edit_time_limit` 默认 43200 分钟（30 天）——高信任用户窗口更宽。
- **「忍者编辑」宽限期（grace period）：** `editing_grace_period` 默认 300 秒——发帖后 5 分钟内的小改动**不产生修订记录、不显示编辑标记**；另有 `editing_grace_period_max_diff`（默认 100 字符，低信任级）和 `editing_grace_period_max_diff_high_trust`（默认 400 字符）限制宽限期内允许的改动幅度，超过则正常记修订。（源码同上；行为说明见官方社区 [How do I view the edit history?](https://meta.discourse.org/t/how-do-i-view-the-edit-history/68662)）
- **编辑历史：保留 diff 且默认公开。** 修订以红/绿 diff 形式存储展示，帖子上的铅笔图标点开即看历史；`edit_history_visible_to_public` 默认 true，关掉后只有 staff 能看历史。（源码同上；[How long are user edits visible to the public?](https://meta.discourse.org/t/how-long-are-user-edits-visible-to-the-public/180483)）
- **已编辑标识：** 帖子右上/底部铅笔图标 + 修订次数；宽限期内的微改不显示。
- **权限边界：** 谁能编辑他人帖子由 `edit_all_post_groups` 控制，默认值为 `admins|moderators|TL4`（管理员、版主、最高信任级用户）——即**管理员可以编辑他人消息，这是论坛语境与 IM 语境的关键差异**。（源码同上）
- **实时同步：** 编辑通过 Discourse 的 MessageBus 推送到在线客户端原地更新（公开源码行为；可参见官方仓库 [discourse/discourse](https://github.com/discourse/discourse)）。

## 8. GitHub 评论（论坛类代表）

- **编辑时限：无。**
- **编辑历史：完整保留且公开。** 评论头部出现「edited」下拉，任何对仓库有读权限的人都能逐版本查看 diff。（[Tracking changes in a comment – GitHub Docs](https://docs.github.com/en/communities/moderating-comments-and-conversations/tracking-changes-in-a-comment)）
- **历史脱敏逃生口：** 评论作者和具有写权限的人可以从历史中**删除某个修订的 diff**（用于泄露密钥等场景）；删除后「谁、何时编辑过」仍然可见，只是该版本内容不可见。（同上）
- **历史上限：每条内容最多保留 100 次编辑**——超出后自动移除最老的中间修订，但原始版本与最近 99 次编辑始终保留。（同上）
- **已编辑标识：** 评论头部「edited」字样 + 下拉列表；无历史则不显示。
- **权限边界：** 评论作者可编辑自己评论；具有仓库写权限者可编辑/隐藏/删除他人评论，相关治理能力见 [Managing disruptive comments – GitHub Docs](https://docs.github.com/en/communities/moderating-comments-and-conversations/managing-disruptive-comments)。

## 数据模型对比：原地更新 vs 追加式事件

| 路线 | 代表 | 做法 | 取舍 |
| --- | --- | --- | --- |
| 原地更新 + `edited_at` | Discord、Slack、WhatsApp | 直接改消息行，记录最后编辑时间；历史版本丢弃（Slack 合规留存除外） | 存储与查询最简单；代价是历史不可追溯，依赖「时限 + (edited) 标记」防滥用 |
| 原地更新 + 独立修订表 | Discourse、GitHub | 消息行存最新版本，revision 表存每次 diff/快照 | 历史完整可审计，适合「内容即资产」的论坛；多一张表与 diff 渲染成本 |
| 追加式关系事件 | Matrix | 编辑是新事件（`m.replace`），原事件永不改动，服务器聚合「最新替换」 | 与分布式/端到端加密架构天然兼容（事件不可变才能签名/去重）；代价是客户端实现复杂、协议层需处理降级显示、多次编辑定序、mention 重算等边角 |

## 对小型社区博客聊天功能的建议

综合上述实践，针对 violet「只有登录用户、消息量小、无端到端加密」的场景，推荐如下取舍：

1. **数据模型选「原地更新 + `edited_at` 时间戳」，不上独立历史表。** 无 E2E 加密意味着 Matrix 追加式模型的最大动机（不可变事件图）不存在；而论坛式的完整 diff 历史对聊天语境过重——聊天是高频短消息，帖子才是内容资产。Discord/Slack/WhatsApp/Telegram 四家的 IM 实践全部收敛于此。
2. **设编辑时限，且宁长勿短。** 时限的本质是防止「事后篡改既有讨论」造成的信任问题。参考锚点：WhatsApp 15 分钟（纯纠错）、Signal 24 小时、Telegram 约 48 小时、Discourse 默认 24 小时。对一个节奏慢、消息量小的社区聊天，**24 小时**是兼顾纠错与语境稳定的中位数选择；配置化（类似 Slack 的工作区级开关）成本不高，值得留口。
3. **行内「已编辑」小字 + 悬停显示编辑时间**，这是 Discord/Slack/Telegram/Signal 的一致形态；不保留历史时就靠这个标记保证透明度。位置放在时间戳旁（suffix），不要藏进右键菜单。
4. **只允许编辑文本内容，不允许增删附件/媒体**（与 WhatsApp 一致；Discord 允许改附件但那是富 API 场景）。附件想换就删除整条重发，避免「编辑后引用图片被偷换」的歧义。
5. **权限规则就一条：作者本人可编辑，管理员只能删除不能编辑。** 这正是 Discord API 的边界（他人即使有 MANAGE_MESSAGES 也只能改 flags/删除），比 Discourse 的「管理员可编辑一切」更适合 IM 语境，实现也最简单。
6. **实时推送走现有的消息通道发 `message_updated` 事件**（对标 Discord 的 MESSAGE_UPDATE / Slack 的 message_changed）：payload 带消息 id 与新 content，客户端原地替换渲染、**保持按原时间戳排序不上浮**。编辑不触发新通知；若未来支持 @mention，可参考 Matrix 的双 `m.mentions` 语义——只为本次编辑新增的提及发通知。
7. **桌面端支持「输入框为空时按 ↑ 编辑最后一条」**：Telegram/Discord/Slack/Signal 四家全部实现了这个快捷键，成本极低、是编辑功能最高频的入口；移动端/触屏走长按消息菜单。
8. **可不做的：** 编辑历史版本 UI、编辑次数上限、grace period 忍者编辑——这些都是大社区/论坛语境的产物；消息量小的博客聊天用不上，后续真有滥用再补。唯一建议服务端留一条审计日志（谁在何时编辑了哪条消息），成本一行日志，出纠纷时可查。

## 证据质量说明

- 引用来源均为官方一手材料：产品官方帮助中心/官方博客（WhatsApp、Telegram、Signal、Discord、Slack）、协议规范（Matrix）、官方文档（GitHub Docs）、官方开源源码（Discourse `site_settings.yml`、Discord `discord-api-docs` 仓库）。
- 唯一例外是 Telegram 的 48 小时编辑窗口：官方 FAQ/博客未标注时限，该数字来自社区文档 tginfo（已在正文标注其非官方属性）。
- Discord 的「无编辑时限」「(edited) 悬停显示编辑时间」属于产品观察 + 官方 API 文档语义佐证（Edit Message 端点无时间窗口参数、`edited_timestamp` 字段独立存在），官方帮助中心没有单独成文。
- 各产品的界面文案与时限会随版本变化，落地前建议以当时版本再核对一次关键数字。
