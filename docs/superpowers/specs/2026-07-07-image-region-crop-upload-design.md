# 图片选区裁剪上传设计

- **日期**: 2026-07-07
- **状态**: 已确认,待实现计划
- **范围**: 前端(GIF 坐标 + CSS 视觉裁剪、静态图 canvas 重编码上传、三个接入点) + 后端(素材覆盖接口)
- **依赖**: 前端复用既有分片上传链路;后端复用 UploadService 存储/转码能力

---

## 1. 背景与目标

### 现状

- `AvatarUploader`(`features/upload/ui/AvatarUploader.tsx`)直接上传原图,**无裁剪步骤**,头像显示永远走 `avatarUrl()` 的 `?w=200&thumb=200x200&format=webp`。
- `Cover`(`features/admin-media/ui/Cover.tsx`)**纯素材库选择**,回填 `onChange(url)`,无裁剪、无上传。
- 素材库上传(`routes/admin.media.tsx` 的上传 Modal)走通用 `Uploader` 多文件拖拽,**无单图裁剪**;素材网格(`MediaGrid`)图片卡片无裁剪入口。
- 代码库**无任何图片裁剪组件**,`grep crop/选区` 仅命中评论模块的文本选区(无关)。
- `avatarUrl()` 无条件追加 `format=webp`,后端对 GIF 解码时**只取第一帧**,动画静默丢失。
- 后端**无「替换已上传文件」接口**:`/media/{id}` PATCH 只改 alt_text/category/original_name,File 实体的 url/path/hash/size 无 setter;`/uploads/complete` 只建新记录不覆盖。

### 目标

让 `Cover` 和 `AvatarUploader` 支持选区上传;让素材库图片支持裁剪(含覆盖原图):

1. **静态图**(jpeg/png/webp):canvas 重编码为 WebP 上传,得到真裁剪后文件。
2. **GIF**:保留动画,不重编码;存归一化坐标到 URL `?crop=`,显示层用 CSS 视觉裁剪聚焦选区。
3. **素材库覆盖**:用户对**自己上传的静态图**素材点裁剪 icon,可选「覆盖原图」——走新的 `/uploads/replace` 接口,把原记录指针替换为裁剪后文件;不选则新建记录。

### 非目标(YAGNI)

- 不做客户端 GIF 重编码(库重 40KB+、有损、卡顿,违背保留动画初衷)。
- 不做后端按坐标裁剪(Go `image/gif` 编码慢、调色板支持一般)。
- 不重构 `Uploader`(它是多文件拖拽列表,语义不同)。
- GIF 素材不参与「覆盖」(文件字节不变,无可覆盖对象,裁剪仅产生 `?crop=` 引用)。
- AvatarUploader / Cover 不显示「覆盖原图」(无原图概念:头像是指向某 file 的引用、封面是素材库选择)。

---

## 2. 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| GIF 动画保留 | **存坐标 + CSS 视觉裁剪** | 无损、零延迟、零 bundle。前端重编码有损且 40KB+ |
| 静态图裁剪生效 | **前端 canvas 重编码上传** | 已有上传链路,真裁剪文件变小 |
| 裁剪 UI 库 | **react-easy-crop** | ~8KB,触屏/鼠标支持好 |
| 坐标持久化 | **URL 查询参数 `?crop=x,y,w,h`** | 自包含,DB schema 不动;后端 transformer 忽略未知参数 |
| 覆盖语义 | **更新 File 记录指针** | url/path/hash/size 指向新文件,旧物理文件保留。秒传按新 hash 查询准确,不误覆盖 |
| 覆盖接口位置 | **`POST /uploads/replace`** | 所有文件上传走 /uploads 体系;复用 SessionAuth + UploadRateLimit + owner 校验 |
| 覆盖 vs 新建 | **裁剪弹窗内 checkbox** | 用户每次选;默认不勾 |
| 「覆盖」适用范围 | **仅素材库静态图裁剪** | 头像/封面无原图;GIF 不重编码 |

### 秒传安全(关键约束)

后端秒传 `FindByHash(file_hash, owner_id, status=ready)`(按 owner 隔离)。覆盖若**改物理字节**会破坏语义:原 hash 的秒传会命中被改后的文件。

**正确做法**:replace 接口更新 File 记录的 `file_hash` 为裁剪后文件的新 hash。这样:
- 未来上传与「原文件」相同内容 → 按原 hash 查不到(记录已改)→ 正常新建,不误命中
- 未来上传与「裁剪后文件」相同内容 → 按新 hash 命中本记录 → 秒传,符合预期

旧物理文件**保留不删**(可能被其他 owner 引用,或 refCount > 0)。

---

## 3. 详细设计

### 3.1 坐标 URL 工具(`features/upload/lib/cropUrl.ts`,前端)

归一化坐标(0~1)编码进 URL 查询参数:

```ts
export interface CropRect { x: number; y: number; w: number; h: number }
export function withCrop(path: string, rect: CropRect): string   // 附加/覆盖 ?crop=,保留其他参数
export function parseCrop(url: string): CropRect | null           // 解析,非法/超界返回 null
```

### 3.2 公共组件层(`shared/ui/image-cropper/`,前端,零 feature 依赖)

#### `ImageCropper.tsx` — 选区交互
基于 react-easy-crop,输出归一化 CropRect(图片自然尺寸归一化)。props:`src`、`aspect`(undefined 自由)、`onChange(rect)`。

#### `CroppedImage.tsx` — 显示层视觉裁剪
解析 src 的 `?crop=`,用 CSS transform 聚焦选区(cover 模式)。无 `?crop=` 退化普通 `object-cover`。GIF 原图完整加载,动画保留。

#### `lib/crop-to-style.ts` — transform 纯函数
`cropToStyle(rect, containerAspect) => { transform }`,纯函数 + 单测,保证 transform 公式正确。

### 3.3 编排层(`features/upload/`,前端)

#### `lib/crop-image.ts` — canvas 重编码
`cropImageToBlob(src, rect, quality) => Promise<Blob>`:Image 加载 → canvas drawImage 选区 → WebP Blob。仅静态图用。

#### `ui/CropUploadDialog.tsx` — 裁剪上传弹窗
单一职责:判 GIF + 重编码 + 上传。props:`file`(本地新选)/`srcUrl`(已有素材 URL)、`aspect`、`purpose`、`fileNameBase`、`open`、`onOpenChange`、`onConfirm`。

**「覆盖原图」选项不在本组件**,由调用方按场景决定(见 3.5)。

输出契约:
```ts
export type CropUploadResult =
  | { kind: "static"; url: string }      // 静态图:重编码上传
  | { kind: "gif"; url: string }          // GIF:原 URL + ?crop=
```

### 3.4 显示层 GIF 动画保护(`features/upload/lib/imageUrl.ts`,前端)

`avatarUrl(path)` 检测 path 剥查询后以 `.gif` 结尾时,**剥除所有动态处理参数**(w/thumb/format/quality/rotate),只返回原 path(含已有 `?crop=`)。静态图正常走 `?w=200&thumb=200x200&format=webp`。

**约束:GIF 不走任何后端图片处理参数,只用 `?crop` + CSS。** 这是动画保留的必要条件。

### 3.5 三个接入点(前端)

#### AvatarUploader(`features/upload/ui/AvatarUploader.tsx`)
选图 → CropUploadDialog(aspect=1, purpose=avatar) → onConfirm:
- 静态:canvas 重编码 → `/uploads` → `updateProfile({ avatar_url: url })`
- GIF:`/uploads` 传原图 → `withCrop(url, rect)` → `updateProfile`
显示层 `<CroppedImage>` 替换 `<img>`。**无覆盖选项。**

#### Cover(`features/admin-media/ui/Cover.tsx`)
MediaPicker 选完 → CropUploadDialog(srcUrl=file.url, aspect=16/9, purpose=cover) → onConfirm:
- 静态:重编码 → `/uploads` 新建 → onChange(新 url)
- GIF:`withCrop(file.url, rect)` → onChange(不产生新素材)
显示层 `<CroppedImage>`。**无覆盖选项。**

#### 素材库网格(`features/admin-media/ui/MediaGrid.tsx` + 路由)
图片卡片 hover 出**裁剪 icon**(套用视频「选帧设封面」Film icon 的模式,line ~96-105),点击开裁剪弹窗。弹窗内含**「覆盖原图」checkbox**(默认不勾):
- **不勾**:静态图重编码 → `/uploads` → 新建素材记录
- **勾**:静态图重编码 → `POST /uploads/replace`(带 fileId)→ 覆盖原记录指针
- **GIF**:无论勾否,只产生 `?crop=` 引用(文件不变,无可覆盖/新建语义)→ **GIF 不显示「覆盖」checkbox**

### 3.6 后端覆盖接口(`POST /uploads/replace`)

**路由**:挂在现有 `/uploads` group(`api/cmd/server/main.go:341-352`),复用 SessionAuth + UploadRateLimit:

```go
r.Post("/replace", mediaH.ReplaceMediaFile)  // 加在 /thumbnail、/emoji 同级
```

**Handler**(`api/internal/interfaces/http/handler/media/media.go`):multipart 解析套用 `UploadThumbnail`(line 778-817)模式:
- `MaxBytesReader` + `ParseMultipartForm`
- `r.FormValue("fileId")` 取目标记录 ID(注意 camelCase,与 thumbnail 一致)
- `r.FormFile("file")` 取裁剪文件
- `sniffImageContent` 嗅探真实 MIME
- `GetUserIDFromContext(r)` 取 callerID
- 调 `h.uploadSvc.ReplaceMediaFile(ctx, in, callerID)` → 返回 FileDTO

**Service**(`api/internal/application/media/service.go`):新增 `ReplaceMediaFile(ctx, in ReplaceMediaFileInput, callerID string) (FileDTO, error)`,逻辑:
1. `fileRepo.FindByID(fileId)` → owner 校验 `f.OwnerID().Equal(cid)`,不符 `Forbidden("无权操作他人文件")`
2. 把裁剪文件写临时路径 → `processor.Validate`(校验真图片)
3. **仅静态图支持**(GIF 不应到达此处,前端已挡;后端若收到 GIF 返回 BadRequest)
4. `processor.Transcode` 转 WebP(若更小)→ `storage.BuildPath(purpose, now, fileUUID, ext)` → `storage.EnsureDir` + `storage.Move` 到最终路径
5. `storage.FileSize` + `processor.Dimensions` + `processor.Thumbnail`
6. 计算 SHA-256:`sha256.Sum256(content)` + `hex.EncodeToString`(`crypto/sha256` + `encoding/hex`,无现成 helper)
7. `f.ReplaceStoredFile(path, url, size, mimeType, fileHash, width, height, thumbnail)` 更新实体指针
8. `fileRepo.Save(ctx, f)` 持久化
9. `fileToDTO(f)` 返回

旧物理文件保留不删。

**Input 结构**(套用 `UploadThumbnailInput` 形状):
```go
type ReplaceMediaFileInput struct {
    FileID   string
    FileName string
    MimeType string
    Content  []byte
}
```

**File 实体新增方法**(`api/internal/domain/upload/entity.go`):
```go
// ReplaceStoredFile 替换文件存储指针(覆盖原图)。仅 owner 校验通过后调用。
// fileHash 用新文件 SHA-256,保证秒传查询准确。
func (f *File) ReplaceStoredFile(path, url string, size int64, mimeType, fileHash string, width, height *int, thumbnail string) {
    f.path = path
    f.url = url
    f.size = size
    f.mimeType = mimeType
    f.fileHash = fileHash
    f.width = width
    f.height = height
    f.thumbnail = thumbnail
}
```

**无 wire 改动**:media 用 `media_container.go` 手动 DI,UploadService 已注入所有依赖。

**无 OpenAPI 文档更新则接口缺失**:需在 `api/internal/openapi/paths_media.go` 加 `/uploads/replace` 定义 + run `make openapi` 同步前端类型(若项目有 openapi→前端类型生成)。

---

## 4. 风险与权衡

| 风险 | 缓解 |
|------|------|
| GIF 头像显示若带处理参数,后端取第一帧 | `avatarUrl` 对 GIF 剥所有处理参数;`CroppedImage` 对 GIF 只保留 `?crop` |
| 秒传误覆盖 | replace 更新 file_hash 为新值,旧 hash 查不到本记录 |
| 旧物理文件残留(覆盖后) | 保留安全(refCount/他人引用);GC 为后续话题 |
| `react-easy-crop` 像素坐标归一化边界 | 归一化函数 + 单测覆盖 0/1 边界 |
| CSS 视觉裁剪公式跨比例偏差 | transform 提纯函数 + 单测覆盖宽/高/正方 |
| 素材库网格裁剪 icon 与视频选帧 icon 并存 | 套用现有 hover icon 模式,仅图片显示裁剪 icon |
| 后端 GIF 到达 replace | 前端 GIF 不勾覆盖、不调 replace;后端 BadRequest 兜底 |

---

## 5. 提交拆分计划

按 AGENTS.md:**前后端必须分离提交**、公共组件单独提、组件 vs 接入分离、同层按职责拆。

### 后端(api/)

| # | 类型 | 标题 | 内容 |
|---|------|------|------|
| B1 | `feat(api)` | File 实体新增 ReplaceStoredFile 方法 | `entity.go`,仅实体方法 |
| B2 | `feat(api)` | UploadService 新增 ReplaceMediaFile | `service.go` + Input 结构 + 单测,mock repo/processor |
| B3 | `feat(api)` | 新增 POST /uploads/replace 接口 | handler 方法 + main.go 路由注册 + openapi 定义 |
| B4 | `chore(api)` | 同步 OpenAPI / 前端类型(若有生成) | 视项目 openapi 流程 |

### 前端(web/)

| # | 类型 | 标题 | 内容 |
|---|------|------|------|
| F1 | `chore(web)` | 引入 react-easy-crop 依赖 | pnpm add |
| F2 | `feat(web)` | 新增坐标 URL 编码工具 | `cropUrl.ts` + 单测 |
| F3 | `feat(web)` | 新增 cropToStyle transform 纯函数 | `shared/ui/image-cropper/lib/crop-to-style.ts` + 单测 |
| F4 | `feat(web)` | 新增 ImageCropper 选区交互组件 | 公共件 |
| F5 | `feat(web)` | 新增 CroppedImage 视觉裁剪显示组件 | 公共件 + barrel |
| F6 | `feat(web)` | avatarUrl 对 GIF 剥除处理参数 | `imageUrl.ts` + 单测 |
| F7 | `feat(web)` | 新增 cropImageToBlob canvas 重编码工具 | `features/upload/lib/crop-image.ts` |
| F8 | `feat(web)` | 新增 CropUploadDialog 裁剪上传弹窗 | 编排层,依赖 F2/F4/F7 + useChunkedUpload |
| F9 | `feat(web)` | AvatarUploader 接入选区上传 | 接 F8 + CroppedImage |
| F10 | `feat(web)` | Cover 选区裁剪接入 | Cover.tsx 接 F8 + CroppedImage |
| F11 | `feat(web)` | 新增 replace 上传 mutation | `features/upload/api/mutations.ts`,对接后端 B3 |
| F12 | `feat(web)` | 素材库网格图片裁剪 icon + 覆盖接入 | MediaGrid 加 icon + CropDialog 加「覆盖」checkbox |

每个 commit 单独 revert 不误伤。B1-B4 后端先行,F11/F12 依赖 B3 接口存在。

---

## 6. 待实现计划展开的点

- `avatarUrl` 对 GIF 的 `.gif` 后缀检测细节(query 已剥离再判断)
- `CropUploadDialog` 如何向调用方表达「覆盖」意图(可能加 `replaceFileId?` prop,素材库场景传入,头像/封面不传)
- 素材库网格裁剪 icon 的位置(与视频选帧 icon 并列,仅图片卡片显示)
- canvas 重编码 WebP 的 quality、长边上限
- 外部 `cover_image`/`avatar_url` 渲染点(PostCard/blog 详情/CommentItem/AvatarGroup)替换 `CroppedImage` 的 follow-up 范围

---

## 变更历史

- 2026-07-07:初稿(纯前端零后端)
- 2026-07-07:修订——新增素材库裁剪 icon + 覆盖原图(`POST /uploads/replace`),项目转为前后端;明确「覆盖」仅限素材库静态图
