# 图片预览组件改造：缩略图飞入 + 模糊层 + 原图渐进替换

> 日期：2026-06-30
> 范围：`web/src/shared/ui/image-preview/` 组件内部改造 + 调用方传参
> 关联：撤销的 6 个提交（`6a138e1`..`50b388c`）曾尝试同类"渐进式加载"，本次重做。

## 背景与问题

用户反馈图片预览组件（`ImagePreview`）三个问题：

1. **飞入用原图**：当前打开预览时，从触发位置飞入的是**原图**（`ImagePreviewImage`，src=`images[index]`）。原图体积大、首次打开需加载，飞入过程可能卡顿/空白。期望改为飞入**缩略图**，且缩略图渲染尺寸要与原图一致（如原图占 800×1000，缩略图也占 800×1000，使模糊均匀覆盖）。
2. **缺模糊层**：缩略图飞入后，表面应有一层模糊效果。
3. **工具栏无法点击**：点击工具栏按钮**完全没反应**（不是关闭、不是延时，而是点不动），说明工具栏被某个层盖住，点击落不到按钮上。

## 设计

### 数据流

调用方已有缩略图 URL（`MediaFile.thumbnail`、`ContentImage.thumbnailUrl`）。给 `ImagePreview` 增加 `thumb` 参数，由调用方传入缩略图源。

```
MediaLightbox / ContentImage
   │  已有原图 url + 缩略图 thumbnailUrl
   ▼
ImagePreview (images=原图[], thumb=缩略图[])   ← 新增 thumb 参数
   │  飞入动画作用于缩略图层；动画稳定后加载原图；原图 onLoad 后替换缩略图
   ▼
渲染两层：
   - 缩略图层（带模糊层覆盖）：动画期间可见
   - 原图层：动画稳定后开始加载，加载完淡入替换
```

### 时序（核心）

| 阶段 | 缩略图层 | 模糊层 | 原图层 | 工具栏 |
|------|---------|--------|--------|--------|
| ① 打开瞬间 | 从触发位置飞入（opacity 0→1, transform） | 在 | 不加载 | 可点击 |
| ② 飞入动画稳定（onAnimationComplete） | 停在中心，模糊 | 在 | **开始加载** | 可点击 |
| ③ 原图 onLoad | 淡出 | 淡出 | 淡入 | 可点击 |
| ④ 稳态 | 隐藏 | 隐藏 | 显示，可拖拽/缩放 | 可点击 |

关键约束：**原图不在打开瞬间就加载**，而是等飞入动画稳定后才开始——避免与飞入动画争抢网络/解码资源导致掉帧。

### 接口变更

**1. `ImagePreviewProps`**（`image-preview/types/image-preview-types.ts`）新增可选参数：

```ts
/** 缩略图地址列表（与 images 一一对应；飞入动画用缩略图，原图加载完成后替换）。
 *  不传则回退为原图飞入（向后兼容）。 */
thumbnails?: string[];
```

- 命名用 `thumbnails`（复数，与 `images` 对齐，支持多图）。
- 可选，不传时回退现有行为（原图飞入），保证向后兼容。

**2. `onImageClick` 回调签名扩展**（`file-preview/types/file-preview-types.ts`，两处：`FilePreviewProps` 与图片 `ImagePreviewProps`）：

```ts
// 旧
onImageClick?: (url: string, trigger?: HTMLElement | null) => void;
// 新（增加 thumbnailUrl 参数）
onImageClick?: (url: string, trigger?: HTMLElement | null, thumbnailUrl?: string) => void;
```

缩略图需要从 `ContentImage`（持有 `thumbnailUrl`）一路传到 `MediaLightbox`（渲染顶层 `ImagePreview`），因此回调必须能携带缩略图。新增参数可选，旧调用方不传不影响。

调用方改造：
- `MediaLightbox.tsx`（**生产路径**）：`fullscreen` state 增加 `thumbnail` 字段；`openFullscreen` 接收并快照缩略图；传给 `ImagePreview`。`FilePreview` 已透传 `thumbnailUrl`（`file.thumbnail`），`ContentImage` 的 `onImageClick(url, imgRef)` 回调需扩展为也传出 `thumbnailUrl`。
- `ContentImage.tsx` 自渲染分支（`!onImageClick`，向后兼容旧路径）：`useImagePreview` 当前不暴露缩略图（`openPreview(imageList, index, element)` 无缩略图参数），该分支**暂不传 `thumbnails`**，回退原图飞入。若日后需要，再扩展 hook。

### 组件改造

**`ImagePreview.tsx`**（主组件）——飞入容器从单个原图层改为两层结构：

```
<motion.div 飞入动画容器> (relative, 飞入 transform + opacity)
   ├── 缩略图层 (absolute inset-0, 显示 thumb img)
   │    └── 模糊层 (absolute inset-0, backdrop-blur 或 filter:blur)
   └── 原图层 (ImagePreviewImage)  ← 动画稳定后才挂载/加载
</motion.div>
```

- 飞入动画（transform + opacity）仍作用于外层 `motion.div`，缩略图/原图共享这个变换。
- 缩略图层 `absolute inset-0`，尺寸跟随容器（=原图尺寸），保证模糊均匀。
- 原图层在 `onAnimationComplete` 后才设置 `src`（用 state 控制是否加载），`onLoad` 后触发缩略图+模糊层淡出。

**`ImagePreviewImage.tsx`**——保持职责（原图的缩放/拖拽/旋转），但需要：
- 接受一个"是否开始加载"的控制（或在父层控制 src 是否传入），确保不在飞入阶段就请求原图。
- 原图加载完成回调上抛（已有 `onLoad`），供父层切换缩略图淡出。

### 工具栏无法点击——根因与修复

**根因**：飞入动画容器 `motion.div`（`ImagePreview.tsx:115`，`className="relative ..."`）在动画/稳态下占据预览中心区域。工具栏 `ImagePreviewControls` 是 `absolute top-0 z-50`，理论上 z 更高，但**图片容器内的 `<img>` 是可交互元素（cursor:grab、onMouseDown 拖拽）**，且容器 `onClick={stopPropagation}` 拦截了事件。

更关键：图片容器 `motion.div` 的几何尺寸由内部 `<img max-h-[90vh] max-w-full>` 撑开，**可能覆盖到顶部工具栏区域**（top-0），导致点击工具栏位置时，事件实际落在图片容器上而非工具栏按钮。工具栏虽 `z-50`，但若图片容器也在同一 stacking context 且尺寸重叠，pointer-events 会让更靠上的元素吃掉点击。

**修复方向**（二选一，实现时验证）：
- **A（推荐）**：工具栏容器改为 `pointer-events-none`，仅按钮自身 `pointer-events-auto`。这样工具栏区域本身不挡下层，只有按钮可点。但需确认工具栏背景渐变 (`from-black/50`) 是否仍要挡下层点击——若要，则此方案不适用。
- **B**：调整层叠——确保工具栏 `z-index` 严格高于图片容器，且图片容器不向上溢出到工具栏区域（给图片容器加 `pointer-events: none` 在非交互态，仅在原图稳态可拖拽时打开）。

实现时先复现 bug、用 DevTools 确认是哪个元素吃掉了点击，再定 A/B。

### 向后兼容

- `thumbnails` 可选，不传 → 回退原图飞入（现有行为）。
- 单图/多图均支持（多图切换时，新 index 的缩略图同样飞入/模糊/替换流程）。

## 不做（YAGNI）

- 不做缩略图预生成/缓存（用调用方现有 URL）。
- 不改 `useImagePreviewControls`（缩放/旋转/翻转逻辑不变）。
- 不改 `ImagePreviewThumbnails`（底部缩略图导航）。
- 不引入新依赖。

## 验证

- `cd web && npx tsc --noEmit`
- `cd web && npx biome check .`
- 手动验证（需 dev server）：
  1. 打开预览：缩略图飞入（带模糊），动画稳定后原图加载替换，模糊消失。
  2. 工具栏所有按钮可点击（缩放/旋转/翻转/关闭/重置）。
  3. 左右切换、键盘操作正常。
  4. 关闭预览：缩回动画正常。
  5. 不传 `thumbnails` 的旧调用方：行为不变（原图飞入）。
