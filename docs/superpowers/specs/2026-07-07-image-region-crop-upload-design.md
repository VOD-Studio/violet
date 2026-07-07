# 图片选区裁剪上传设计

- **日期**: 2026-07-07
- **状态**: 已确认,待实现计划
- **范围**: 纯前端(GIF 坐标 + CSS 视觉裁剪、静态图 canvas 重编码上传、三个接入点)
- **依赖**: 复用既有分片上传链路(`useChunkedUpload` / `initUpload` / `uploadChunk` / `completeUpload`)

---

## 1. 背景与目标

### 现状

- `AvatarUploader`(`features/upload/ui/AvatarUploader.tsx`)直接上传原图,**无裁剪步骤**,头像显示永远走 `avatarUrl()` 的 `?w=200&thumb=200x200&format=webp`。
- `Cover`(`features/admin-media/ui/Cover.tsx`)**纯素材库选择**,回填 `onChange(url)`,无裁剪、无上传。
- 素材库上传(`routes/admin.media.tsx` 的上传 Modal)走通用 `Uploader` 多文件拖拽,**无单图裁剪**。
- 代码库**无任何图片裁剪组件**,`grep crop/选区` 仅命中评论模块的文本选区(无关)。
- `avatarUrl()` 无条件追加 `format=webp`,后端对 GIF 解码时**只取第一帧**,动画静默丢失。当前没有任何机制保护 GIF 动画。

### 目标

让 `Cover` 和 `AvatarUploader`(以及素材库上传单图)支持**选区上传**:

1. 用户选定文件后弹出裁剪选区,确认后才上传/回填。
2. **静态图**(jpeg/png/webp):canvas 重编码为 WebP 上传,得到真裁剪后文件。
3. **GIF**:保留动画,不重编码;存归一化坐标到 URL,显示层用 CSS 视觉裁剪聚焦选区。

### 非目标(YAGNI)

- 不动后端:不新增接口、不改 DB schema、不改图片 transformer。
- 不做客户端 GIF 重编码(库重 40KB+、有损、卡顿,违背保留动画初衷)。
- 不做后端按坐标裁剪(Go `image/gif` 编码慢、调色板支持一般,不值得)。
- 不重构 `Uploader`(它是多文件拖拽列表,语义不同)。

---

## 2. 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| GIF 动画保留方式 | **存坐标 + CSS 视觉裁剪** | 无损、零延迟、零 bundle、后端零改动。前端重编码有损且 40KB+,后端裁剪需开发 |
| 静态图裁剪生效层 | **前端 canvas 重编码上传** | 已有上传链路,真裁剪文件变小 |
| 裁剪 UI 库 | **react-easy-crop** | ~8KB,触屏/鼠标支持好,API 简洁 |
| 坐标持久化 | **URL 查询参数 `?crop=x,y,w,h`** | 自包含,DB schema 不动;后端 transformer 只读已知参数,会忽略 `crop` |
| Cover 上传入口 | **素材库支持上传图片,单张走裁剪;选择封面时也走裁剪** | 用户明确需求 |
| 素材库单图 aspect | **自由比例** | 素材库是通用素材 |
| Cover/avatar aspect | **16:9 / 1:1** | 场景固有比例 |
| 静态图 Cover 裁剪后落地 | **上传为新素材(purpose=cover)** | URL 必须持久化才能引用 |

### FSD 分层约束

依赖方向必须保持 `shared ← features ← routes/pages`:

- `shared/ui/image-cropper/` 只能放**无业务依赖**的纯 UI(选区交互、视觉裁剪显示)
- 任何依赖 `useChunkedUpload` / 上传 API 的编排逻辑放 `features/upload/`
- 坐标 URL 工具放 `features/upload/lib/`(与 `imageUrl.ts` 同位,语义绑定)

---

## 3. 详细设计

### 3.1 坐标 URL 工具(`features/upload/lib/cropUrl.ts`)

归一化坐标(相对原图 0~1),编码进 URL 查询参数:

```ts
export interface CropRect { x: number; y: number; w: number; h: number }

/** 编码:xxx.gif => xxx.gif?crop=0.12,0.08,0.60,0.45(保留已有查询参数) */
export function withCrop(path: string, rect: CropRect): string

/** 解析:有 crop 参数返回 CropRect,否则 null */
export function parseCrop(url: string): CropRect | null
```

实现要点:
- 保留 URL 上其他查询参数(`w`/`format` 等),只增删 `crop`
- 数值四舍六入到 4 位小数,避免 URL 过长
- `withCrop` 幂等:同一 URL 多次调用不会叠加多个 `crop`

### 3.2 公共组件层(`shared/ui/image-cropper/`)

零 feature 依赖,只依赖 react-easy-crop + CSS。

#### `ImageCropper.tsx` — 选区交互

```ts
interface ImageCropperProps {
  src: string          // 图片源(object URL 或远程 URL)
  aspect: number       // 16/9、1,或自由(传 undefined)
  onChange: (rect: CropRect) => void  // 归一化坐标
}
```

- 基于 `react-easy-crop` 的 `Cropper`
- `onCropComplete` 给像素坐标 → 除以图片自然宽高 → 归一化 `CropRect`
- `aspect` 为 `undefined` 时不限定比例

#### `CroppedImage.tsx` — 显示层视觉裁剪

```ts
interface CroppedImageProps {
  src: string          // 可能带 ?crop= 参数
  aspect?: number      // 容器比例
  className?: string   // 透传
}
```

CSS 视觉裁剪公式(cover 模式聚焦选区中心):

```
设 rect = parseCrop(src),容器比例 aspect_c,选区比例 aspect_r = rect.w/rect.h

若 aspect_r > aspect_c:选区上下留白,scale = 1/rect.h(容器高=选区高)
  translate_y = -(rect.y / rect.h) * 100%
  translate_x = -((rect.x + rect.w/2)/rect.w - 0.5) * 100% * (容器宽/选区可见宽)
若 aspect_r < aspect_c:对称
否则 scale = 1/rect.w 或 1/rect.h,二选一
```

精确公式在实现时写死并附单元测试(纯函数,给定 rect + 容器比例返回 transform style),避免反复试。**无 `?crop=` 时回退为普通 `object-cover`。**

`index.ts` 导出 `ImageCropper`、`CroppedImage`。

### 3.3 编排层(`features/upload/ui/CropUploadDialog.tsx`)

```ts
export type CropUploadResult =
  | { kind: "static"; url: string }   // 静态图:重编码上传,URL 干净
  | { kind: "gif"; url: string }      // GIF:原 URL + ?crop=...

interface CropUploadDialogProps {
  file?: File          // 本地选的文件(头像/素材库上传场景)
  srcUrl?: string      // 已有素材 URL(Cover 选择场景,静态图会重新上传)
  aspect: number       // 16/9、1、undefined(自由)
  purpose: string      // 透传 useChunkedUpload:avatar/cover/material
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (result: CropUploadResult) => void
}
```

内部流程:

```
预览源 = file ? createObjectURL(file) : srcUrl
用户拖动选区 → ImageCropper 输出 rect

确认时:
  isGif = (file?.type === "image/gif") || (srcUrl?.endsWith(".gif"))

  if isGif:
    url = srcUrl ?? await uploadOriginal(file)   // GIF 仍需先上传原图拿 URL
    onConfirm({ kind: "gif", url: withCrop(url, rect) })
  else:
    blob = await cropAndEncode(预览源, rect)      // canvas drawImage → WebP Blob
    result = await useChunkedUpload({ purpose }).uploadFile(new File([blob], name, {type:"image/webp"}))
    onConfirm({ kind: "static", url: result.url })
```

复用 `Modal`(`shared/ui/modal`)+ `ImageCropper` + `useChunkedUpload`。

### 3.4 三个接入点

#### AvatarUploader(`features/upload/ui/AvatarUploader.tsx`)

```
原: <input type=file onChange=handleFile>  → 直接上传
新: <input type=file> → open CropDialog(aspect=1, purpose=avatar, file)
   → onConfirm:
       静态: updateProfile({ avatar_url: url })      // url 干净
       GIF:  先 uploadOriginal(file) 拿 url,再 withCrop(url, rect) → updateProfile
   → 显示: <CroppedImage src={avatarUrl(...)}> 替换 <img>
```

**GIF 动画保护(关键约束)**:`avatarUrl()` 当前无条件追加 `format=webp`,后端对 GIF 解码取第一帧,动画静默丢失。必须修正:

- `avatarUrl(path)` 检测 `path` 以 `.gif` 结尾时,**剥除所有动态处理参数**(`w`/`thumb`/`format`/`quality`/`rotate`),只返回原 path(可选附加 `?crop=`)
- 静态图头像正常走 `avatarUrl()` 的 `?w=200&thumb=200x200&format=webp`
- 这样 GIF 头像显示用原图字节,动画完整保留;`CroppedImage` 再叠加 CSS 视觉裁剪

即:**GIF 不走任何后端图片处理参数,只用 `?crop` + CSS**。这是 GIF 动画保留的必要条件,实现时严格遵守。

#### 素材库上传(`routes/admin.media.tsx`)

上传 Modal 内,图片走裁剪单图,其他类型仍走原 `Uploader` 多文件:

- 新增「上传图片(裁剪)」入口(按钮),触发文件选择 → `CropUploadDialog(aspect=undefined 自由, purpose=material)` → `onConfirm` → `invalidateQueries(adminMediaKeys.lists())`
- 原拖拽 `Uploader` 保留,accept 去掉图片(或保留但图片走裁剪入口)

实现时定:是并存两个入口(裁剪入口只接图片、原入口接非图),还是上传 Modal 内按文件类型分流。

#### Cover(`features/admin-media/ui/Cover.tsx`)

MediaPicker 单选确认后,开 `CropUploadDialog`:

```
MediaPicker onConfirm([file]) → 不直接 onChange
  → open CropDialog(srcUrl=file.url, aspect=16/9, purpose=cover)
  → onConfirm:
      静态: canvas 重编码 → useChunkedUpload(purpose=cover) → onChange(新 url, 入库为新素材)
      GIF:  withCrop(file.url, rect) → onChange(带 ?crop 的 url, 不产生新素材)
```

显示层:Cover 预览区用 `CroppedImage` 替换 `<img>`,自动解析 `?crop`。

### 3.5 显示层全景

所有「可能带选区」的图片消费点统一用 `CroppedImage`:
- `AvatarUploader` 头像预览
- `Cover` 封面预览
- 文章详情/列表渲染封面 URL 的位置(grep `cover_url`/`coverUrl` 接入点,实现时枚举)

未带 `?crop` 的 URL 自动回退 `object-cover`,零破坏性。

---

## 4. 风险与权衡

| 风险 | 缓解 |
|------|------|
| GIF 头像显示若带 `w`/`thumb` 参数,后端取第一帧破坏动画 | `CroppedImage` 对 GIF 只保留 `?crop`,剥除 `w/thumb/format`;静态图正常用缩略图参数 |
| GIF 原文件字节不变,占用存储 | 可接受;已有 `w=` 参数缩传输,用户侧下行流量小 |
| `react-easy-crop` 输出像素坐标需归一化,边界精度 | 归一化函数加单测,覆盖 0/1 边界 |
| CSS 视觉裁剪公式在不同比例组合下偏差 | transform 计算提为纯函数 + 单测,覆盖宽图/高图/正方 |
| Cover 静态图裁剪产生新素材记录,素材库膨胀 | purpose=cover 可在素材库按用途筛选;不阻塞 |

---

## 5. 提交拆分计划

全部前端 commit,严格按 AGENTS.md 原子性原则(公共组件单独提、组件 vs 接入分离、同层按职责拆):

| # | 类型 | 标题 | 内容 |
|---|------|------|------|
| 1 | `chore(web)` | 引入 react-easy-crop 依赖 | `pnpm add react-easy-crop`,依赖变更独立可回滚 |
| 2 | `feat(web)` | 新增坐标 URL 编码工具 | `features/upload/lib/cropUrl.ts`(withCrop/parseCrop,纯函数 + 单测) |
| 3 | `feat(web)` | 新增 ImageCropper 选区交互组件 | `shared/ui/image-cropper/ImageCropper.tsx`(公共件独立提) |
| 4 | `feat(web)` | 新增 CroppedImage 视觉裁剪显示组件 | `shared/ui/image-cropper/CroppedImage.tsx` + transform 纯函数 + 单测 |
| 5 | `feat(web)` | 新增 CropUploadDialog 裁剪上传弹窗 | `features/upload/ui/CropUploadDialog.tsx`(编排层,依赖 2/3 + useChunkedUpload) |
| 6 | `feat(web)` | AvatarUploader 接入选区上传 | 接 5 + `CroppedImage` 替换 `<img>` + `avatarUrl` GIF 特判 |
| 7 | `feat(web)` | 素材库上传单图支持裁剪 | `routes/admin.media.tsx` 接 5 |
| 8 | `feat(web)` | Cover 选区裁剪接入 | `Cover.tsx` 接 5 + 显示层 `CroppedImage` |

每个 commit 单独 revert 不误伤:1 是依赖、2/3/4 是公共件、5 是编排、6/7/8 是各接入点。符合「公共组件单独提」「组件本身 vs 页面接入分离」。

---

## 6. 待实现计划展开的点

以下细节留给 writing-plans 阶段展开,不影响设计确认:

- `avatarUrl` 对 GIF 的特判实现细节(`.gif` 后缀检测的边界:query 参数已剥离后再判断)
- 素材库上传入口的 UI 形态(裁剪入口与原拖拽区的关系)
- `CroppedImage` 在文章详情/列表等更多消费点的逐一替换范围
- canvas 重编码的 WebP 质量、长边上限等参数
- GIF 上传原图的 purpose 取值(avatar 还是 material)

---

## 变更历史

- 2026-07-07:初稿
