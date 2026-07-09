# PRD: 评论富文本输入（Emoji 内联渲染 + 图片上传）

## Problem Statement

评论系统当前是纯文本 `<Textarea>`，无法插入自定义表情或图片。用户在评论/批注中表达态度时只能打字，体验远不如 B站/微博等平台。后端数据模型已支持 `CommentPicture[]`（评论附图），但前台完全没有渲染。用户需要一个能输入表情（内联显示为图片）和上传图片的评论输入框，并且评论展示侧能正确解析渲染。

## Solution

封装一个自包含的 `RichCommentInput` 组件（contentEditable + emoji 选择器 + 图片上传），替换当前的纯 `<Textarea>`。评论展示侧新增 `EmojiText`（解析 `[name]` 占位符渲染为 `<img>`）和 `ImageGrid`（九宫格图片画廊）两个共享组件。后端在评论响应中内嵌 `emote` 映射表，前端渲染时直接查表。

## User Stories

1. 作为评论者，我想在评论输入框中选择自定义表情，这样我能用图片表情表达态度
2. 作为评论者，我想在输入框中看到表情以图片形式内联显示（而非 `[doge]` 文本），这样所见即所得
3. 作为评论者，我想在评论中上传图片（一次最多 10 张），这样我能分享截图或配图
4. 作为评论者，我想看到上传中每张图片的进度，这样我知道上传状态
5. 作为评论者，我想删除已选未提交的图片，这样我能撤销误操作
6. 作为评论者，我想在所有图片上传完成前不能提交（按钮禁用），这样避免提交不完整的数据
7. 作为访客，我想在评论展示中看到表情渲染为图片，这样评论内容生动易读
8. 作为访客，我想看到评论中的图片以九宫格方式展示，这样浏览体验统一美观
9. 作为访客，当评论图片超过 9 张时，我想看到 `+N` 遮罩提示还有更多图片，这样我知道可以点击查看全部
10. 作为访客，我想点击评论图片打开全屏预览，这样能看清楚图片细节
11. 作为批注者，我想在划线批注输入框中使用表情（不支持图片），这样批注更简洁
12. 作为批注者，批注输入框以紧凑模式展示，这样不占用太多正文空间
13. 作为文章作者，我想在回复框中也拥有同样的富文本能力，这样回复体验与主评论一致
14. 作为开发者，我想上传图片数量后续可由站点设置控制，这样管理员能灵活调整限制

## Implementation Decisions

### Emoji 存储与解析

- 评论 `body` 中 emoji 以 `name` 字段原文存储，如 `[doge]`、`[笑哭]`（B站风格方括号格式）
- 解析时正则 `\[([^\]]+)\]` 匹配，查 emote 映射表替换为 `<img>` 或文本
- 未匹配的 `[xxx]` 保持原文显示（emoji 可能已删除/改名）
- 颜文字（有 `text_content` 的 emoji）也使用 `[name]` 占位符，渲染时查表输出文本

### Emoji 渲染数据源（后端 emote 映射）

- 每个 comment 响应内嵌 `emote` 字段，格式：`{ "[doge]": { "url": "...", "gif_url": "..." } }`
- 后端在构建 `CommentDTO` 时解析 `body` 中的 `[name]`，查 emoji 表构建映射
- 前端渲染时不依赖全局 emoji 预加载，直接使用 comment 自带的 emote 映射
- 优势：评论数据自包含，无 loading 闪烁，无缓存竞态

### EmojiText 渲染方式

- 使用 React 元素渲染，**禁止** `dangerouslySetInnerHTML`
- 将文本按 `[name]` 拆段：文本段用 `<span>`（React 自动转义），emoji 段用 `<img>`
- 组件接口：`<EmojiText text={comment.body} emote={comment.emote} />`

### 输入框技术方案（contentEditable）

- 基于 contentEditable div，参考 `origin/main` 旧实现（`RichTextInput` + `useRichTextInput`）
- Emoji 插入为 `<img data-emoji="[name]">` 内联元素，用 Selection/Range API 管理光标
- DOM ↔ Markdown 双向转换：输入时 emoji 显示为图片，value 输出为 `[name]` 纯文本
- 粘贴强制纯文本（`clipboardData.getData("text/plain")`），防止富文本污染
- `Cmd/Ctrl + Enter` 触发提交

### RichCommentInput 组件形态（自包含）

- 单一组件包含：contentEditable 输入区 + 工具栏（emoji 按钮 + 图片按钮）+ 图片预览条
- 受控 API：`{ value, onChange, onSubmit, maxImages, enableEmoji, enableImage, compact, disabled }`
- Props 开关控制能力：批注场景 `enableImage={false}` + `compact={true}`
- Emoji 按钮复用已有 `EmojiPicker` 组件（`features/emojis/ui/EmojiPicker.tsx`）

### 图片上传 UX

- 点击图片按钮 → 触发系统文件选择器（`<input type="file" multiple accept="image/*">`）
- 选中后用 `useChunkedUpload({ purpose: "comment" })` 后台上传
- 缩略图逐个出现在输入框下方（用本地 Object URL 预览 + 进度条覆盖层）
- 每张缩略图带删除按钮（hover 显示）
- 所有图片上传中时提交按钮禁用
- 最大数量默认 10 张，通过 `maxImages` prop 控制（后续可由站点设置传入）
- 超过 `maxImages` 时文件选择器不追加新图

### ImageGrid 组件（评论图片展示）

- 1 张：大图单列
- 2 张：双列
- 3 张及以上：三列九宫格
- 超过 9 张：显示前 9 张，第 9 张叠加 `+N` 半透明遮罩
- 点击任意图片打开 `ImagePreview` 全屏预览，展示全部图片
- 复用已有 `useImagePreview` hook

### 组件边界

| 组件 | 位置 | 使用方 |
|------|------|--------|
| `EmojiText` | `shared/ui/emoji-text/` | CommentItem, AnnotationCard, 后台 CommentDetail |
| `ImageGrid` | `shared/ui/image-grid/` | CommentItem, AnnotationCard, 后台 CommentDetail |
| `RichCommentInput` | `features/comments/ui/` | CommentForm, FloatingToolbar |

### 后端 API 变更

- `CommentDTO` 新增 `emote` 字段（`map[string]EmojiRef`，omitempty）
- `EmojiRef` 结构：`{ "url": string, "gif_url": string }`
- 后端 `toDTO` 时解析 `body` 中所有 `[name]`，批量查 emoji 表（需注入 emoji repository）
- `CreateComment` 已支持 `pictures` 字段（`PictureInput` 数组，含 url/width/height/size），无需改动

### 前端类型变更

- `Comment` 接口新增 `emote?: Record<string, { url: string; gif_url?: string }>`
- `CreateComment` 接口新增 `pictures?: Array<{ url: string; width: number; height: number; size: number }>`

### 批注场景（FloatingToolbar）

- 使用 `RichCommentInput` 的 compact 模式：`enableEmoji={true}` + `enableImage={false}` + `compact={true}`
- 不支持图片上传（批注是对正文片段的即时点评，图片在此上下文意义不大）
- 保留表情支持（批注用表情表达态度很自然）

## Testing Decisions

### 测试原则

- 只测外部行为，不测实现细节
- 组件测试用 `@testing-library/react`，断言用 `vitest`
- 后端测试用 Go 标准 `testing` + 已有测试基础设施

### 测试 Seam

| Seam | 层级 | 覆盖 |
|------|------|------|
| Backend handler test | API 集成 | 创建含 `[doge]` 的评论 → 验证响应 `emote` 字段 |
| EmojiText unit test | shared/ui 纯组件 | `[name]` 解析、emote 查表、未匹配保持原文 |
| RichCommentInput integration test | feature 组件 | 输入 → 插入 emoji → value 输出 `[name]` → 模拟上传 → 提交 |
| ImageGrid unit test | shared/ui 纯组件 | 不同图片数量的 grid class、+N 遮罩 |

### 先例

- 后端 handler 测试：参考现有 comment handler 测试模式
- 前端组件测试：参考 `src/features/comments/__tests__/useCreateComment.test.tsx`
- shared/ui 组件测试：参考 `src/shared/lib/__tests__/url.test.ts` 模式

## Out of Scope

- **站点设置控制图片上传数量**：当前硬编码 `maxImages=10`，站点设置基础设施不存在。后续添加站点设置后，由调用方传入配置值。
- **图片拖拽上传**：当前仅支持点击触发文件选择器。拖拽上传作为增强后续添加。
- **图片粘贴上传**：当前粘贴强制纯文本。粘贴图片自动上传后续添加。
- **评论编辑**：当前仅支持新建评论。编辑已有评论（回显 emoji + 图片）不在本期范围。
- **移动端 contentEditable 优化**：contentEditable 在移动端可能有兼容性问题，本期不做专项优化。
- **Emoji 搜索/快速输入**：当前仅支持从 EmojiPicker 面板选择。输入 `:` 触发快速搜索后续添加。
- **GIF 动图播放**：EmojiPicker 中已优先使用 `gif_url`，但评论展示侧是否自动播放动图取决于浏览器对 `img` 的处理，本期不做特殊控制。

## Further Notes

### 旧实现参考

`origin/main` 分支有完整的前版实现，可作为技术参考：
- `web/src/features/comments/components/RichTextInput.tsx` — contentEditable 输入
- `web/src/features/comments/hooks/useRichTextInput.ts` — Selection/Range 管理 + DOM↔Markdown 转换
- `web/src/features/comments/components/CommentContent.tsx` — emoji 渲染（旧版用 `dangerouslySetInnerHTML`，新版改用 React 元素）
- `web/src/features/comments/components/CommentImageButton.tsx` — 图片上传（旧版用 Dialog，新版改为直接文件选择器）
- `web/src/components/shared/ImageGallery.tsx` — 九宫格展示（旧版三模式合一，新版拆为独立的 `ImageGrid`）

### URL 解析

项目无 `getUploadUrl` 工具函数。emoji URL 和图片 URL 均为相对路径（如 `/uploads/emojis/xxx.png`），Vite dev server 通过 proxy 转发 `/uploads/*` 到后端，生产环境由 nginx 反代。前端 `img src` 直接使用相对路径即可。

### 图片上传数据流

1. 用户选择文件 → `<input type="file">` onChange
2. 对每个文件创建 Object URL 用于即时缩略图预览
3. 对每个文件调用 `useChunkedUpload({ purpose: "comment" }).uploadFile(file, onProgress)`
4. 上传完成 → 用返回的 `{ url, width, height }` 替换 Object URL
5. 提交评论时，将所有已上传图片的 `{ url, width, height, size }` 作为 `pictures` 字段发送

### 提交时的图片数据

后端 `createCommentRequest` 已接受 `pictures: []PictureInput`（`{ url, width, height, size }`），前端 `CreateComment` 类型需同步添加此字段。上传后的 `CompleteUploadResult` 含 `{ file_id, url, width?, height? }`，需映射为 `PictureInput` 格式（`size` 可从 File 对象获取）。
