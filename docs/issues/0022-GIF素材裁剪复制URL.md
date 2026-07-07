# Issue-0022：GIF 素材裁剪（复制 URL）

## Parent

spec：`docs/superpowers/specs/2026-07-07-image-region-crop-upload-design.md`
plan：`docs/superpowers/plans/2026-07-07-image-region-crop-upload.md`

## What to build

补全素材库裁剪的 GIF 分支。GIF 素材点裁剪 icon 后：不显示「覆盖原图」checkbox（GIF 不重编码，覆盖无意义），裁剪确认时把 `withCrop(cropFile.url, rect)` 的结果 URL 复制到剪贴板，toast 提示。

GIF 裁剪结果是「带 `?crop=` 参数的引用 URL」，素材库场景下没有自然的回填目标（不像头像 updateProfile、不像封面 onChange），所以提供「复制 URL」让用户自行粘贴到需要的地方。

## Acceptance criteria

- [ ] `web/src/routes/admin.media.tsx` 裁剪弹窗：当 `cropFile.mime_type` 含 gif 时，**不显示覆盖 checkbox**（Issue-0021 已约束，本切片确保 GIF 走到这里不报错）
- [ ] GIF 裁剪确认：`withCrop(cropFile.url, rect)` 生成带 `?crop=` 的 URL → `navigator.clipboard.writeText(url)` → toast「已复制裁剪后 URL（GIF 保留动画）」→ 关弹窗
- [ ] clipboard API 不可用时降级：toast 显示 URL 文本供手动复制（不静默失败）
- [ ] GIF 素材的裁剪 icon 仍显示（Issue-0020 给所有图片加了 icon，GIF 是图片）
- [ ] `make web-typecheck && make web-lint` 全绿
- [ ] 手动验证：GIF 素材点裁剪 → 无覆盖 checkbox → 确认 → 剪贴板拿到 `xxx.gif?crop=...` → 粘贴可访问且动画保留

## Blocked by

- Issue-0020（素材库裁剪弹窗基座，GIF 占位在此切片替换为真实行为）
- Issue-0017（cropUrl.withCrop，GIF 坐标编码工具）

## 实现指引

参考 plan Task F12 Step 3 的 `handleCropConfirm` isGif 分支。`withCrop` 来自 `@features/upload/lib/cropUrl`（Issue-0017 产出）。

**注意**：Issue-0020 的 GIF 占位可能是「不显示裁剪 icon 给 GIF」或「toast 暂不支持」。本切片要把 GIF 的裁剪 icon 显示出来（或确认 Issue-0020 已显示），并实现复制 URL 行为。若 Issue-0020 已对 GIF 显示 icon 但占位 toast，本切片替换占位。

## Follow-up（不在本切片范围）

外部 `cover_image` / `avatar_url` 渲染点（PostCard、blog 详情、CommentItem、AvatarGroup）替换为 `CroppedImage` 以支持 GIF 视觉裁剪聚焦——这些是消费侧改造，独立于本功能的核心切片。
