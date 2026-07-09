# Issue 003: 图片上传与展示（端到端）

## Parent

PRD: `../prd/0003-rich-comment-input.md`

## What to build

在 `RichCommentInput` 中添加图片上传能力（文件选择器 + `useChunkedUpload` + 缩略图进度条），新建 `ImageGrid` 共享组件（九宫格 + `+N` 遮罩），`CommentItem` 渲染评论图片画廊。提交评论时将已上传图片作为 `pictures` 字段发送。

**RichCommentInput 图片上传：**
- 工具栏图片按钮点击 → 触发 `<input type="file" multiple accept="image/*">`
- 每个选中文件创建 Object URL 即时预览，用 `useChunkedUpload({ purpose: "comment" })` 后台上传
- 缩略图条在输入框下方：每张图带进度条覆盖层 + hover 删除按钮
- 上传中提交按钮禁用（`onUploading` 回调或内部状态通知父组件）
- 已上传图片数达到 `maxImages` 时禁用图片按钮
- 新增 `onImagesChange` 回调或通过 `ref` 暴露图片列表，供 CommentForm 提交时读取

**前端类型改动：**
- `CreateComment` 接口（`features/comments/model/types.ts`）新增 `pictures?: Array<{ url: string; width: number; height: number; size: number }>`

**ImageGrid 组件（`shared/ui/image-grid/`）：**
- 接收 `images: Array<{ url: string; thumbnail?: string; width?: number; height?: number }>` 和 `className`
- 布局规则：1 张大图单列、2 张双列、3+ 张三列九宫格
- 超过 9 张：显示前 9 张，第 9 张叠加 `+N` 半透明遮罩
- 点击任意图片 → 打开 `ImagePreview`（复用已有 `useImagePreview` hook）展示全部图片
- 缩略图优先使用 `thumbnail`，fallback 到 `url`

**CommentItem 展示集成：**
- `comment.pictures` 非空时，在 body 下方渲染 `<ImageGrid images={comment.pictures} />`

**CommentForm 提交集成：**
- 从 RichCommentInput 获取已上传图片列表
- 组装 `pictures: Array<{ url, width, height, size }>` 放入 `CreateComment` payload
- 提交成功后清空图片列表

**上传数据流：**
1. 文件选择 → Object URL 即时预览
2. `useChunkedUpload({ purpose: "comment" }).uploadFile(file, onProgress)` → `CompleteUploadResult { file_id, url, width?, height? }`
3. 映射为 `{ url, width, height, size }`（size 从 File 对象获取）
4. 提交时作为 `pictures` 发送

## Acceptance criteria

- [ ] 点击图片按钮 → 打开系统文件选择器（多选）
- [ ] 选中图片后立即显示缩略图（Object URL），后台开始上传
- [ ] 每张缩略图显示上传进度条
- [ ] 上传完成后进度条消失，缩略图切换为真实 URL
- [ ] hover 缩略图显示删除按钮，点击删除
- [ ] 上传中提交按钮禁用
- [ ] 达到 maxImages（默认 10）时图片按钮禁用
- [ ] CreateComment 类型包含 `pictures` 字段
- [ ] CommentForm 提交时携带 pictures 数据
- [ ] ImageGrid 正确渲染不同数量的图片（1/2/3+/9+/10+）
- [ ] 超过 9 张时第 9 张显示 +N 遮罩
- [ ] 点击图片打开 ImagePreview 全屏预览，可切换查看全部图片
- [ ] CommentItem 在 body 下方渲染 ImageGrid
- [ ] ImageGrid unit test：不同图片数量的布局 class、+N 遮罩显示

## Blocked by

- Issue 002（需要 RichCommentInput 组件作为图片上传的容器）
