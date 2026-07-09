# Issue 001: Emoji 解析展示（端到端）

## Parent

PRD: `../prd/0003-rich-comment-input.md`

## What to build

评论正文中的 `[name]` 占位符在展示时渲染为内联表情图片。需要后端在评论响应中内嵌 `emote` 映射表，前端新增 `EmojiText` 共享组件解析渲染，`CommentItem` 接入该组件替换当前的纯文本 `{comment.body}`。

**后端改动：**
- `CommentDTO` 新增 `emote` 字段（`map[string]EmojiRef`，omitempty），结构为 `{ "url": string, "gif_url": string }`
- `toDTO` 时解析 `body` 中所有 `[name]` 模式，批量查 emoji 表构建映射
- 需在 comment application service 中注入 emoji repository（或等效查询能力）

**前端改动：**
- `Comment` 接口（`entities/comment/model/types.ts`）新增 `emote?: Record<string, { url: string; gif_url?: string }>`
- 新建 `shared/ui/emoji-text/` 组件：接收 `text` + `emote` props，按 `\[([^\]]+)\]` 正则拆段，文本段用 `<span>`，匹配的 emoji 用 `<img>`（优先 `gif_url`），未匹配的保持原文。**禁止 `dangerouslySetInnerHTML`**
- `CommentItem` 中 `{comment.body}` 替换为 `<EmojiText text={comment.body} emote={comment.emote} />`

**参考：** `origin/main` 的 `CommentContent.tsx` 有旧版实现（用 `dangerouslySetInnerHTML`，新版改用 React 元素渲染）。

## Acceptance criteria

- [ ] 后端 CommentDTO 包含 `emote` 字段，值为 body 中出现的 emoji 的 `{ url, gif_url? }` 映射
- [ ] body 中没有 `[name]` 模式时，`emote` 字段为空 map 或省略
- [ ] `[name]` 对应的 emoji 已被删除时，`emote` 中不包含该项，前端展示为原文 `[name]`
- [ ] EmojiText 组件正确拆分文本和 emoji，渲染为混合 React 元素
- [ ] EmojiText 不使用 `dangerouslySetInnerHTML`
- [ ] CommentItem 使用 EmojiText 渲染 body
- [ ] 颜文字（有 `text_content`）的 emoji 也能正确渲染为文本
- [ ] Backend handler test：创建含 `[doge]` 的评论 → 响应 `emote` 字段包含正确映射
- [ ] EmojiText unit test：解析 `[name]`、查表、未匹配保持原文、混合渲染

## Blocked by

无 — 可立即开始
