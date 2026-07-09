# Issue 004: 批注 Emoji 支持

## Parent

PRD: `../prd/0003-rich-comment-input.md`

## What to build

`FloatingToolbar` 的批注输入区替换为 `RichCommentInput`（compact + `enableImage={false}`），`AnnotationCard` 的 body 渲染替换为 `EmojiText`。批注支持表情输入和展示，不支持图片。

**FloatingToolbar 集成：**
- 展开的输入区中，`<Textarea>` 替换为 `<RichCommentInput compact enableEmoji={true} enableImage={false} />`
- `value`/`onChange` 对接 FloatingToolbar 的 `body` state
- `onSubmit` 对接现有的批注提交流程（带 anchor）
- 保持引言区（blockquote）、取消按钮等现有 UI 不变
- 工具栏只有 emoji 按钮（无图片按钮）

**AnnotationCard 集成：**
- `{comment.body}` 替换为 `<EmojiText text={comment.body} emote={comment.emote} />`
- 批注回复也使用 EmojiText 渲染

## Acceptance criteria

- [ ] FloatingToolbar 输入区使用 RichCommentInput（compact 模式）
- [ ] 批注输入区不显示图片按钮，只有 emoji 按钮
- [ ] 用户可在批注中选择表情，内联显示为图片
- [ ] 提交批注时 body 包含 `[name]` 占位符
- [ ] 批注提交流程（anchor + body）不受影响
- [ ] AnnotationCard 使用 EmojiText 渲染 body
- [ ] AnnotationCard 的回复也使用 EmojiText 渲染
- [ ] compact 模式下输入区尺寸适配 FloatingToolbar 的 w-80 宽度

## Blocked by

- Issue 001（需要 EmojiText 组件）
- Issue 002（需要 RichCommentInput 组件）
