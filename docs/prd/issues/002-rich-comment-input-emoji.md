# Issue 002: RichCommentInput — Emoji 输入

## Parent

PRD: `docs/prd/rich-comment-input.md`

## What to build

新建自包含的 `RichCommentInput` 组件（contentEditable + EmojiPicker），替换 `CommentForm` 中当前的纯 `<Textarea>`。用户在输入框中选择表情后，表情以内联图片形式显示在输入区，提交时 body 包含 `[name]` 占位符。

**组件接口：**
```ts
interface RichCommentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxImages?: number;           // 默认 10，本期此 issue 不实现图片
  enableEmoji?: boolean;         // 默认 true
  enableImage?: boolean;         // 默认 true，本期此 issue 不实现图片
  compact?: boolean;             // 默认 false
  disabled?: boolean;
  placeholder?: string;
}
```

**核心实现（参考 origin/main 旧实现）：**
- contentEditable div 作为输入区，`useRichTextInput` hook 管理 Selection/Range + DOM↔Markdown 双向转换
- Emoji 插入：用户从 `EmojiPicker` 选择 → 在光标位置插入 `<img data-emoji="[name]">` 内联元素
- DOM→Markdown 转换：遍历 contentEditable 子节点，`<img data-emoji>` → `[name]`，`<br>` → `\n`
- Markdown→DOM 转换：初始化/编辑回显时，`[name]` → `<img>`（需全局 emoji 查表，用已有 `useAllEmojis` hook）
- 粘贴强制纯文本
- `Cmd/Ctrl + Enter` 触发 `onSubmit`
- 工具栏：Emoji 按钮（复用 `EmojiPicker` 组件，`enableEmoji` 控制），图片按钮占位（`enableImage` 控制，本期不实现功能）

**CommentForm 集成：**
- 用 `RichCommentInput` 替换 `<Textarea>`
- `value`/`onChange` 对接 CommentForm 的 `body` state
- 保持现有的匿名两步流（昵称/邮箱/验证码）逻辑不变

**参考：**
- `origin/main:web/src/features/comments/components/RichTextInput.tsx`
- `origin/main:web/src/features/comments/hooks/useRichTextInput.ts`

## Acceptance criteria

- [ ] RichCommentInput 渲染 contentEditable 输入区 + 底部工具栏（emoji 按钮）
- [ ] 从 EmojiPicker 选择表情 → 光标位置插入内联 `<img>`，显示为图片
- [ ] `onChange` 输出纯文本 value（emoji 为 `[name]` 占位符，普通文本不变）
- [ ] 换行正确转换为 `\n`（contentEditable 可能生成 `<br>` 或 `<div>`）
- [ ] 粘贴富文本时只保留纯文本
- [ ] Cmd/Ctrl + Enter 触发 onSubmit
- [ ] `compact` 模式减小 padding 和字号
- [ ] `disabled` 时 contentEditable 不可编辑，工具栏按钮禁用
- [ ] CommentForm 使用 RichCommentInput 替换 Textarea，提交流程不变
- [ ] RichCommentInput integration test：输入文字 → 插入 emoji → value 包含 `[name]` → 模拟提交

## Blocked by

- Issue 001（需要 emote 字段才能端到端验证：输入 `[doge]` → 提交 → 展示渲染为图片）
