# 图片预览渐进加载 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 图片预览改为"缩略图飞入（拉伸到原图盒）+ 模糊层 + 原图加载完成后替换"，并修复工具栏无法点击的 bug。

**Architecture:** `ImagePreview` 新增可选 `thumbnails` 参数，内部把飞入容器从单原图层拆为"缩略图层（带模糊覆盖）+ 原图层"双层结构。飞入动画作用于外层 motion.div，缩略图层用与原图相同的 contain 约束渲染（因后端缩略图等比缩放，宽高比与原图一致，盒自然重合）。动画稳定后（`onAnimationComplete`）才加载原图，原图 `onLoad` 后缩略图+模糊层淡出。调用方 `MediaLightbox` 通过扩展 `onImageClick` 回调签名携带 `thumbnailUrl` 传入。

**Tech Stack:** React 19 + TypeScript + motion + Tailwind v4 + Biome。

**Spec:** `docs/superpowers/specs/2026-06-30-image-preview-progressive-load-design.md`

---

## 关键背景（执行者必读）

- **后端缩略图规则**（`api/internal/infrastructure/image/processor.go:127`）：`imaging.Resize(img, 300, 0, Lanczos)` —— 最大宽 300px、**高度等比**。所以缩略图与原图**宽高比完全相同**。这是"缩略图拉伸到原图盒、替换无跳变"成立的前提。
- **当前飞入逻辑**：`ImagePreview.tsx:115` 的 `motion.div` 承载 `ImagePreviewImage`（原图），从 `initialPosition` 飞入中心。
- **工具栏 bug 根因**：飞入的图片容器几何尺寸由 `<img max-h-[90vh] max-w-full>` 撑开，可能向上覆盖到 `top-0` 的工具栏区域；图片容器是可交互元素（拖拽 `onMouseDown`）+ `onClick={stopPropagation}`，吃掉了本应落在工具栏上的点击。
- **生产数据链**：`MediaLightbox` → `FilePreview`(透传 `thumbnailUrl`/`onImageClick`) → `ContentImage`(持有 `thumbnailUrl`，调 `onImageClick(url, imgRef)`) → `MediaLightbox.openFullscreen` → 顶层渲染 `ImagePreview`。
- **测试方式**：本组件无单元测试基建，验证依赖 `tsc --noEmit` + `biome check` + 手动验证（dev server）。

## 文件结构

| 文件 | 责任 | 操作 |
|------|------|------|
| `web/src/shared/ui/image-preview/types/image-preview-types.ts` | `ImagePreviewProps` 类型 | 修改：加 `thumbnails?: string[]` |
| `web/src/shared/ui/image-preview/components/ImagePreview.tsx` | 预览主组件、飞入动画、双层结构编排 | 修改：核心改造 |
| `web/src/shared/ui/image-preview/components/ImagePreviewImage.tsx` | 原图层（缩放/拖拽/旋转） | 修改：接受 `shouldLoad` 控制何时加载 |
| `web/src/shared/ui/file-preview/types/file-preview-types.ts` | `onImageClick` 回调类型 | 修改：两处签名加 `thumbnailUrl` 参数 |
| `web/src/shared/ui/file-preview/components/ContentImage.tsx` | 图片内容预览 | 修改：`onImageClick` 调用带 `thumbnailUrl` |
| `web/src/features/media/ui/MediaLightbox.tsx` | 素材灯箱 | 修改：`fullscreen` state 存 thumbnail，传 `thumbnails` |

---

### Task 1: 扩展 `ImagePreviewProps` 类型

**Files:**
- Modify: `web/src/shared/ui/image-preview/types/image-preview-types.ts`

- [ ] **Step 1: 加 `thumbnails` 可选参数**

在 `ImagePreviewProps` 接口的 `images` 字段后插入：

```ts
    /** 图片列表 */
    images: string[];
    /**
     * 缩略图地址列表（与 images 一一对应；飞入动画用缩略图，原图加载完成后替换）。
     * 后端缩略图为等比缩放（最大宽 300px），宽高比与原图一致，
     * 用与原图相同的 contain 约束渲染即可自然重合，替换时无尺寸跳变。
     * 不传或对应位为空 → 回退原图飞入（向后兼容）。
     */
    thumbnails?: string[];
```

- [ ] **Step 2: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 通过（纯类型新增，无破坏）

- [ ] **Step 3: Commit**

```bash
git add web/src/shared/ui/image-preview/types/image-preview-types.ts
git commit -m "feat(image-preview): ImagePreviewProps 新增 thumbnails 参数"
```

---

### Task 2: `ImagePreviewImage` 支持"延迟加载原图"

让原图层接受 `shouldLoad` 控制：`false` 时不设置 `src`（不发起请求），`true` 后才加载。

**Files:**
- Modify: `web/src/shared/ui/image-preview/components/ImagePreviewImage.tsx`

- [ ] **Step 1: 加 `shouldLoad` prop（默认 true，向后兼容）**

修改 `ImagePreviewImageProps` 接口，在 `src` 后加：

```ts
    /** 图片地址 */
    src: string;
    /** 是否开始加载（false 时不设置 src，不发起请求；用于飞入动画稳定后再加载原图） */
    shouldLoad?: boolean;
```

修改组件签名解构出 `shouldLoad = true`：

```ts
export function ImagePreviewImage({
    src,
    shouldLoad = true,
    alt,
    scale,
    rotate = 0,
    flipX = false,
    flipY = false,
    onLoad,
    onReset,
}: ImagePreviewImageProps) {
```

- [ ] **Step 2: 用 `shouldLoad` 门控 `src`**

把 `motion.img` 的 `src={src}` 改为 `src={shouldLoad ? src : undefined}`：

```tsx
                <motion.img
                    ref={imgRef}
                    key={src}
                    src={shouldLoad ? src : undefined}
                    alt={alt}
```

- [ ] **Step 3: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 通过

- [ ] **Step 4: Commit**

```bash
git add web/src/shared/ui/image-preview/components/ImagePreviewImage.tsx
git commit -m "feat(image-preview): ImagePreviewImage 支持 shouldLoad 延迟加载原图"
```

---

### Task 3: `ImagePreview` 双层结构 + 缩略图飞入 + 模糊层 + 工具栏修复

核心改造。把飞入容器从单原图层拆为"缩略图层（带模糊覆盖）+ 原图层"，飞入动画作用于外层 motion.div；动画稳定后加载原图；原图 onLoad 后缩略图+模糊层淡出。同时修复工具栏被图片容器遮挡导致无法点击的 bug。

**Files:**
- Modify: `web/src/shared/ui/image-preview/components/ImagePreview.tsx`

- [ ] **Step 1: 读取当前完整文件，定位飞入容器块（行 112-144）**

Run: 读 `web/src/shared/ui/image-preview/components/ImagePreview.tsx`，确认要替换的"图片容器"motion.div 块。

- [ ] **Step 2: 在组件顶部加状态：原图是否已加载、飞入动画是否稳定**

在 `const initialPosition = getInitialPosition(...)` 之后，加入状态：

```tsx
    const initialPosition = getInitialPosition(triggerElement, triggerRect);

    // 当前图是否有可用缩略图（无则回退原图飞入）
    const thumb = thumbnails?.[index];
    const useThumb = !!thumb;

    // 飞入动画是否已稳定（稳定后才开始加载原图，避免与飞入争抢解码资源掉帧）
    const [flyInSettled, setFlyInSettled] = useState(false);
    // 原图是否加载完成（完成后缩略图+模糊层淡出）
    const [originalLoaded, setOriginalLoaded] = useState(false);
    // 缩略图+模糊层是否可见（原图加载完成淡出后隐藏）
    const showThumbLayer = useThumb && !originalLoaded;
```

并把 `useState` 加入 import（文件顶部 `import { createPortal } from "react-dom";` 上方加 React hooks import）。实际 import 行（文件第 8 行附近）：

```ts
import { useEffect, useState } from "react";
```

放在 `import { createPortal } from "react-dom";` 之前。（`useEffect` 在 Step 3 会用到，一并导入。）

- [ ] **Step 3: index 变化时重置渐进状态**

在 Step 2 的状态之后加 effect（图片切换时重新走一遍渐进流程）：

```tsx
    // 切换图片时重置渐进加载状态
    // biome-ignore lint/correctness/useExhaustiveDependencies: index 是重置触发器
    useEffect(() => {
        setFlyInSettled(false);
        setOriginalLoaded(false);
    }, [index]);
```

（`useEffect` 已在 Step 2 的 import 中导入。）

- [ ] **Step 4: 解构 `thumbnails` prop**

在组件签名参数列表加入 `thumbnails`：

```tsx
export function ImagePreview({
    open,
    onClose,
    images,
    thumbnails,
    currentIndex = 0,
    onIndexChange,
    triggerElement,
    triggerRect,
    onExitComplete,
}: ImagePreviewProps) {
```

- [ ] **Step 5: 替换"图片容器"motion.div 块为双层结构**

用下面整块替换原 `图片容器` motion.div（从 `{/* 图片容器 */}` 注释到其闭合 `</motion.div>`）。注意：`ImagePreviewImage` 的 `onLoad` 改为同时设置 `originalLoaded` 并调用原 `onLoad`（原为空函数）；`onAnimationComplete` 触发 `setFlyInSettled(true)`。

```tsx
                    {/* 图片容器（飞入动画作用于此外层；内部缩略图层 + 原图层） */}
                    <motion.div
                        initial={{
                            x: initialPosition.x,
                            y: initialPosition.y,
                            scale: initialPosition.scale,
                            opacity: 0,
                        }}
                        animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                        exit={{
                            x: initialPosition.x,
                            y: initialPosition.y,
                            scale: initialPosition.scale,
                            opacity: 0,
                        }}
                        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                        onAnimationComplete={() => setFlyInSettled(true)}
                        className="relative max-h-[90vh] max-w-[90vw]"
                        style={{ willChange: "transform, opacity" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 缩略图层（飞入阶段可见；原图加载完成后淡出）。
                            用与原图相同的 contain 约束渲染，因后端缩略图等比缩放、
                            宽高比与原图一致，盒自然重合，替换无尺寸跳变。 */}
                        {showThumbLayer ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <img
                                    src={thumb}
                                    alt=""
                                    aria-hidden
                                    className="max-h-[90vh] max-w-full select-none object-contain"
                                    draggable={false}
                                />
                                {/* 模糊层：覆盖拉伸后的缩略图盒 */}
                                <div
                                    className="absolute inset-0 backdrop-blur-xl bg-black/5"
                                    aria-hidden
                                />
                            </div>
                        ) : null}

                        {/* 原图层：飞入动画稳定后才开始加载（shouldLoad 门控） */}
                        <ImagePreviewImage
                            src={images[index]}
                            alt={`预览图片 ${index + 1}`}
                            shouldLoad={!useThumb || flyInSettled}
                            scale={scale}
                            rotate={rotate}
                            flipX={flipX}
                            flipY={flipY}
                            onLoad={() => {
                                if (useThumb) setOriginalLoaded(true);
                            }}
                            onReset={handleReset}
                        />
                    </motion.div>
```

要点解释（执行者无需修改，仅理解）：
- `shouldLoad={!useThumb || flyInSettled}`：无缩略图时立即加载（回退原图飞入）；有缩略图时等飞入稳定。
- 缩略图层与原图层都用 `max-h-[90vh] max-w-full object-contain`，盒重合。
- 模糊层 `absolute inset-0` 覆盖整个缩略图层（含拉伸后的 img 盒）。

- [ ] **Step 6: 修复工具栏无法点击 —— 飞入容器 pointer-events 门控**

飞入/模糊期间，图片容器不应拦截事件（让 `top-0` 工具栏可点击）。给 Step 5 的外层 motion.div 加 `style.pointerEvents`：

把 Step 5 中的：

```tsx
                        style={{ willChange: "transform, opacity" }}
```

改为：

```tsx
                        style={{
                            willChange: "transform, opacity",
                            // 飞入未稳定 + 有缩略图层期间，容器不拦截事件，
                            // 避免其几何尺寸覆盖到顶部工具栏导致工具栏点不动。
                            // 原图加载完成后才允许图片拖拽交互。
                            pointerEvents:
                                showThumbLayer && !flyInSettled ? "none" : "auto",
                        }}
```

- [ ] **Step 7: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 通过

- [ ] **Step 8: Biome 检查**

Run: `cd web && npx biome check src/shared/ui/image-preview/`
Expected: 通过（若有格式问题，按提示用 `--write` 修复后重新检查）

- [ ] **Step 9: Commit**

```bash
git add web/src/shared/ui/image-preview/components/ImagePreview.tsx
git commit -m "feat(image-preview): 缩略图飞入+模糊层+原图渐进替换，修复工具栏无法点击"
```

---

### Task 4: 扩展 `onImageClick` 回调签名携带 `thumbnailUrl`

**Files:**
- Modify: `web/src/shared/ui/file-preview/types/file-preview-types.ts`

- [ ] **Step 1: 两处 `onImageClick` 签名加 `thumbnailUrl` 参数**

把 `FilePreviewProps`（约第 27 行）的：

```ts
    onImageClick?: (url: string, trigger?: HTMLElement | null) => void;
```

改为：

```ts
    onImageClick?: (url: string, trigger?: HTMLElement | null, thumbnailUrl?: string) => void;
```

把图片 `ImagePreviewProps`（约第 64 行）的同名签名同样改为上面这行。

- [ ] **Step 2: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 通过（新增可选参数，调用方未传不影响）

- [ ] **Step 3: Commit**

```bash
git add web/src/shared/ui/file-preview/types/file-preview-types.ts
git commit -m "feat(file-preview): onImageClick 回调携带 thumbnailUrl"
```

---

### Task 5: `ContentImage` 调用 `onImageClick` 时传 `thumbnailUrl`

**Files:**
- Modify: `web/src/shared/ui/file-preview/components/ContentImage.tsx`

- [ ] **Step 1: `onImageClick` 调用带上 `thumbnailUrl`**

把（约第 62-64 行）：

```tsx
                        if (onImageClick) {
                            onImageClick(url, imgRef.current);
                        } else {
```

改为：

```tsx
                        if (onImageClick) {
                            onImageClick(url, imgRef.current, thumbnailUrl);
                        } else {
```

- [ ] **Step 2: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add web/src/shared/ui/file-preview/components/ContentImage.tsx
git commit -m "feat(file-preview): ContentImage 向 onImageClick 透传 thumbnailUrl"
```

---

### Task 6: `MediaLightbox` 存 thumbnail 并传 `thumbnails` 给 `ImagePreview`

**Files:**
- Modify: `web/src/features/media/ui/MediaLightbox.tsx`

- [ ] **Step 1: `fullscreen` state 加 `thumbnail` 字段**

把（约第 42-45 行）：

```tsx
    const [fullscreen, setFullscreen] = useState<{
        url: string;
        triggerRect: DOMRect | null;
    } | null>(null);
```

改为：

```tsx
    const [fullscreen, setFullscreen] = useState<{
        url: string;
        thumbnail: string | null;
        triggerRect: DOMRect | null;
    } | null>(null);
```

- [ ] **Step 2: `openFullscreen` 接收并存储 thumbnail**

把（约第 47-50 行）：

```tsx
    const openFullscreen = useCallback((url: string, trigger?: HTMLElement | null) => {
        setFullscreen({ url, triggerRect: trigger ? trigger.getBoundingClientRect() : null });
        setFullscreenOpen(true);
    }, []);
```

改为：

```tsx
    const openFullscreen = useCallback(
        (url: string, trigger?: HTMLElement | null, thumbnail?: string) => {
            setFullscreen({
                url,
                thumbnail: thumbnail ?? null,
                triggerRect: trigger ? trigger.getBoundingClientRect() : null,
            });
            setFullscreenOpen(true);
        },
        [],
    );
```

- [ ] **Step 3: `ImagePreview` 传 `thumbnails`**

把（约第 149-157 行）：

```tsx
            {fullscreen ? (
                <ImagePreview
                    open={fullscreenOpen}
                    onClose={closeFullscreen}
                    onExitComplete={handleFullscreenExitComplete}
                    images={[fullscreen.url]}
                    triggerRect={fullscreen.triggerRect}
                />
            ) : null}
```

改为：

```tsx
            {fullscreen ? (
                <ImagePreview
                    open={fullscreenOpen}
                    onClose={closeFullscreen}
                    onExitComplete={handleFullscreenExitComplete}
                    images={[fullscreen.url]}
                    thumbnails={fullscreen.thumbnail ? [fullscreen.thumbnail] : undefined}
                    triggerRect={fullscreen.triggerRect}
                />
            ) : null}
```

- [ ] **Step 4: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 通过

- [ ] **Step 5: Biome 检查**

Run: `cd web && npx biome check src/features/media/ui/MediaLightbox.tsx`
Expected: 通过

- [ ] **Step 6: Commit**

```bash
git add web/src/features/media/ui/MediaLightbox.tsx
git commit -m "feat(media): MediaLightbox 全屏预览传入缩略图走渐进加载"
```

---

### Task 7: 全量验证

- [ ] **Step 1: 全量类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 通过，无错误

- [ ] **Step 2: 全量 Biome 检查**

Run: `cd web && npx biome check .`
Expected: 通过

- [ ] **Step 3: 手动验证（dev server）**

启动 `make dev`（或 `cd web && pnpm dev`），进入素材管理 / 含图片的内容，打开图片预览，逐项核对：

1. **缩略图飞入**：打开预览瞬间，从触发位置飞入的是**缩略图**（带模糊层），非原图。
2. **模糊层**：缩略图表面有明显模糊（`backdrop-blur-xl`）。
3. **渐进替换**：飞入动画稳定后，原图加载完成，缩略图+模糊层淡出，原图淡入，**无尺寸跳变**。
4. **工具栏可点击**：飞入过程中及稳态下，工具栏所有按钮（缩放-、缩放+、左旋、右旋、水平翻转、垂直翻转、重置、关闭）都能正常响应，不再"点不动"。
5. **左右切换 + 键盘**：多图切换正常，新图重新走渐进流程；ESC 关闭、←→ 切换、+/- 缩放正常。
6. **关闭动画**：缩回触发位置，无闪退。
7. **无缩略图回退**：若某图无缩略图（如纯图直接预览场景），回退原图飞入，行为正常。

- [ ] **Step 4: 若有工具栏残留问题，DevTools 定位**

若 Step 3 第 4 项仍有按钮点不动，在浏览器 DevTools 用元素拾取器点到该按钮位置，确认实际命中的元素。若是飞入容器仍挡住，则给 `ImagePreviewControls` 顶部工具栏的容器 div（`ImagePreviewControls.tsx:84` 的 `absolute inset-x-0 top-0 z-50`）临时加 `pointer-events-none`，再给每个 `<Button>` 加 `pointer-events-auto`，验证后视情况保留。先验证再决定，不要无依据改动。

- [ ] **Step 5: 最终 Commit（仅当 Step 4 触发了额外改动）**

```bash
# 仅当 Task 7 Step 4 产生了改动时执行
git add -A
git commit -m "fix(image-preview): 工具栏 pointer-events 门控兜底"
```

---

## 完成标准

- 缩略图飞入（拉伸到原图盒）+ 模糊层 + 原图渐进替换，全部生效，替换无尺寸跳变。
- 工具栏所有按钮可点击。
- `tsc --noEmit` 与 `biome check .` 通过。
- 不传 `thumbnails` 的旧路径回退原图飞入，行为不变。
