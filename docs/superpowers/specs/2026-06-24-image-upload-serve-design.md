# 图片上传与图片服务设计

- **日期**: 2026-06-24
- **状态**: 已确认,待实现计划
- **参考**: Rust 项目 `upload.rs` / `image.rs`(上传转码 + 动态图片服务)
- **范围**: 后端(改造分片上传 + WebP 转码 + 动态图片服务)、前端(头像上传)、顺带修复现有 IDOR

---

## 1. 背景与目标

### 现状
- 后端已实现分片上传体系(`application/media.UploadService`:秒传 + 续传 + 合并 + 缩略图 + 定时清理),但前端尚未接入(个人中心页是 `ComingSoon`)。
- 现有上传**不做转码**,落盘原始格式;图片服务是裸 `http.FileServer`(`main.go:440`),无动态处理。
- Review 发现分片上传链路存在 IDOR: `SaveChunk`/`CompleteUpload`/`CancelUpload`/`GetUploadStatus`/`UploadThumbnail` 均缺 owner 校验。

### 目标
参考 Rust 方案,实现:
1. **上传转码**:上传时同步把 JPEG/PNG 转为 WebP(仅当更小时采用),GIF/WebP 原样保留;只保留转码结果。
2. **动态图片服务**: `GET /uploads/{path}?w&h&format&quality&rotate&thumb` 动态 resize/转码,内存 + 磁盘二级缓存,ETag/304。
3. **前端头像上传**:替换个人中心占位页,跑通「上传→转码→动态展示」全链路。
4. **修复 IDOR**:作为前置任务,把 owner 校验补齐。

### 非目标(YAGNI)
- 不做客户端图片压缩/裁剪(头像走服务端动态处理即可)。
- 不做独立的媒体库管理页(本次只做头像场景)。
- 视频上传转码不在本次范围(视频缩略图仍走现有 ffmpeg 路径)。

---

## 2. 技术选型

| 关注点 | 选型 | 理由 |
|--------|------|------|
| 图片处理 | `disintegration/imaging`(项目已有) | resize(Lanczos3)/缩略图/解码 |
| WebP 解码 | `golang.org/x/image/webp` | 标准库,支持 decode |
| WebP 编码 | `HugoSmits86/nativewebp` | 纯 Go,无 cgo,部署简单 |
| 内存缓存 | `hashicorp/golang-lru` | 纯 Go,API 简单,LRU + TTI |
| 缓存击穿 | `golang.org/x/sync/singleflight` | 同 key 并发只处理一次 |
| SHA-256(前端) | `crypto.subtle.digest` | 浏览器原生,零依赖 |

> **WebP 编码风险**: 纯 Go encoder 质量/体积略逊于 cgo libwebp。缓解: `ImageProcessor` 端口隔离,后续可无痛切换 `kolesa-team/go-webp`(cgo libwebp)。

---

## 3. 详细设计

### 3.1 IDOR 修复(前置)

给分片上传方法补 owner 校验。统一模式:

```go
session, err := s.sessionRepo.FindByID(ctx, sid)
if err != nil {
    return err
}
if !session.UserID().Equal(callerID) {
    return shared.Forbidden("无权操作他人上传会话")
}
```

| 方法 | 当前签名 | 改动 |
|------|---------|------|
| `SaveChunk` | `(ctx, uploadID, index, data)` | 补 `callerID string` 参数,handler 从 context 取 |
| `CompleteUpload` | `(ctx, uploadID, userID)` | 补 `session.UserID().Equal(uid)` 比对 |
| `CancelUpload` | `(ctx, uploadID)` | 补 `callerID string` |
| `GetUploadStatus` | `(ctx, uploadID)` | 补 `callerID string` |
| `UploadThumbnail` | `(ctx, in)` | 补 file owner 校验 + 改走 `LocalStorage` 统一 `safePath`(去掉裸 `os.WriteFile`) |

handler 对应透传 `userID`。秒传查询 `FindByHash` 额外加 `owner_id` 条件(只秒传自己上传过的文件)。

---

### 3.2 上传 + 转码链路

#### 数据流(改造 `CompleteUpload`)

```
合并 MergeChunks → Validate(magic bytes+解码) → Transcode[转 WebP] → Move → Dimensions → 落库 → Cleanup
```

#### 新增领域端口 `ImageProcessor`(`domain/upload`)

```go
type ProcessResult struct {
    Path     string // 最终落盘路径
    MimeType string // 可能从 image/jpeg 变成 image/webp
    Ext      string // 可能从 .jpg 变成 .webp
}

type ImageProcessor interface {
    // Validate 校验图片有效性(magic bytes + 解码),返回真实 MIME
    Validate(path string) (mime string, err error)
    // Transcode 转 WebP;GIF/WebP 跳过,JPEG/PNG 解码后编码,
    // 仅当 WebP 更小才采用,否则回退原格式
    Transcode(srcPath, destDir, fileUUID string, srcMime string) (ProcessResult, error)
    // Dimensions 取宽高
    Dimensions(path string) (w, h int)
    // Thumbnail 生成缩略图(迁移现有 generateThumbnail 逻辑)
    Thumbnail(srcPath, fileUUID, storageDir, mime string) string
}
```

现有 `LocalStorage.ImageDimensions`/`GenerateThumbnail` 迁移进 `infrastructure/image/processor.go` 实现;`UploadService` 改为依赖 `ImageProcessor` 端口。

#### `CompleteUpload` 改造步骤

```
1. MergeChunks → mergedPath
2. Validate(mergedPath)              ← 新增,非图片直接拒绝(422,不落盘)
3. Transcode(mergedPath, ...)        ← 新增
   - GIF/WebP:跳过,原样 Move
   - JPEG/PNG:decode → webp encode → 若 webpSize < original 采用,否则回退
4. Move 转码结果到 uploads/<purpose>/
5. Dimensions + Thumbnail
6. NewFile(用转码后的 mime/ext) → Save
7. CleanupDir(mergedPath + 临时转码文件)   ← 失败时也清理,防孤儿
```

转码为 CPU 密集,头像场景(几百 KB)<100ms,在 goroutine 中执行可接受(无需 Rust 的显式 `spawn_blocking`)。

#### 三重校验(对齐 Rust)

| 层级 | 实现 | 位置 |
|------|------|------|
| 扩展名白名单 | 现有 `allowedUploadTypes` | InitSession(已有) |
| MIME 白名单 + magic bytes | `http.DetectContentType`(复用现有 `sniffImageContent`) | handler + CompleteUpload 转码前 |
| 真正解码验证 | `ImageProcessor.Validate`(`imaging.Open`) | CompleteUpload,失败 422 |

非图片(视频/文档/音频)跳过 Transcode,走原 Move 逻辑保持兼容。

#### 原文件处理

只保留转码结果。转码临时文件在 `uploads/tmp/<sid>/`,CompleteUpload 末尾 `CleanupDir` 清掉。

---

### 3.3 动态图片服务

#### 路由

替换 `main.go:440` 的裸 `http.FileServer`:

```
GET /uploads/{path}?w=100&h=100&format=webp&quality=80&rotate=90&thumb=200x200
```

#### 处理流程

```
限流(image 桶)
  → 路径安全校验(拒 ../\0/绝对路径 + canonicalize;.cache/ 禁止外部访问)
  → 参数校验(见下表,无效返回 400)
  → 有参数?
       ├ 否 → 直接返回原文件(≤20MB) + immutable 缓存头
       └ 是 → 二级缓存查找(singleflight 去重)
                ├ 命中 → 返回
                └ miss → decode → rotate → resize → thumbnail → encode → 写缓存 → 返回
```

#### 参数(全量)

| 参数 | 格式 | 校验/上限 |
|------|------|----------|
| `w` / `h` | int | ≤ 4096 |
| `thumb` | `WxH` | 像素 ≤ 25M(宽×高) |
| `rotate` | `0\|90\|180\|270` | 枚举 |
| `format` | `jpeg\|png\|webp` | 枚举 |
| `quality` | int | 1-100 |

处理顺序: `decode → rotate → resize(按 w/h,保比例,Lanczos3,只缩不放) → thumbnail(强制裁剪到精确 WxH) → encode`。

#### 二级缓存

| 层 | 实现 | 容量 | 失效 |
|----|------|------|------|
| 内存 | `hashicorp/golang-lru` + TTI 封装 | 100 条 | TTI 300s |
| 磁盘 | `uploads/.cache/<sha256(path+sorted-params)>.<ext>` | 靠清理任务 | 永久(命中即用) |

- **key**: `sha256(原始路径 + 排序后的参数)`。
- **写入**: miss → 处理 → 先写磁盘(原子写: `tmp` + `os.Rename`)→ 填内存。
- **击穿防护**: `singleflight` 合并同 key 并发请求,只处理一次。

#### 响应头

- **ETag**: 处理结果字节的 SHA-256 前 16 字节(十六进制);`If-None-Match` 命中返回 304。
- **Cache-Control**: 原图 `public, max-age=31536000, immutable`;处理后 `public, max-age=86400`。
- **X-Content-Type-Options**: `nosniff`。
- **解码失败**: 422(不降级返回原字节,防内容混淆)。

#### 组件边界(DDD)

```
domain/image/
  - ImageTransformer 接口(Transform(params) → bytes, mime, err)
  - ImageCache       接口(Get/Set)

application/image/
  - Service          编排: 查缓存 → miss 调 Transformer(经 singleflight)→ 写缓存

infrastructure/image/
  - processor.go     imaging + nativewebp 实现 ImageTransformer
  - cache_mem.go     golang-lru 实现 ImageCache(内存层)
  - cache_disk.go    磁盘层

interfaces/http/handler/image/
  - image.go         解析参数/路径 → 调 Service → 写响应
```

> `ImageTransformer`(按需处理)与 `ImageProcessor`(上传转码)是两个端口,前者面向请求、后者面向一次性转码。底层共享 `infrastructure/image/processor.go` 的 imaging 能力,但端口分离避免职责混淆。

#### 清理任务扩展

现有 `CleanupJob` 新增 `CleanImageCache`: 每日扫描 `uploads/.cache/`,删除超过 7 天未访问的文件。

---

### 3.4 前端头像上传

#### 新增模块 `web/src/features/upload/`

```
features/upload/
  api/queries.ts        # 上传 API 封装
  model/uploadStore.ts  # 上传状态(Zustand)
  ui/AvatarUploader.tsx # 头像选择 + 预览 + 上传组件
  lib/imageUrl.ts       # imageUrl(path, {w,h,thumb}) 生成带参 URL
```

替换 `web/src/routes/profile/index.tsx` 的 `ComingSoon`。

#### 上传流程

```
选图 → 算 SHA-256(crypto.subtle) → InitSession(秒传检查)
  → 秒传命中: 直接拿 URL
  → 未命中: 头像按单分片处理(chunkSize = fileSize, totalChunks = 1)
           → SaveChunk(index=0) → CompleteUpload → 拿到 URL
  → PATCH /auth/profile { avatar: url }  ← 复用现有接口
  → invalidate 用户信息(TanStack Query)
```

头像通常 <1MB,前端按**单分片**处理(整文件作为一个 chunk),省去并发分片复杂度,仍享秒传。多分片留待文章配图场景。

#### UI

`AvatarUploader`: 圆形头像预览 + 点击/拖拽选图 + 上传 spinner + 进度 + 错误提示。上传成功后刷新导航栏/个人中心头像。

#### 图片服务对接

头像展示处 `<img src>` 用动态参数:
```
/uploads/avatar/xxx.webp?w=200&h=200&thumb=200x200&format=webp
```
统一走 `imageUrl()` helper 生成。

---

## 4. 测试策略

| 层 | 重点 | 方式 |
|----|------|------|
| domain/upload | `ImageProcessor` 端口契约 | mock |
| application/media | CompleteUpload 转码编排、owner 校验 | fake ImageProcessor + fake repo |
| application/image | 缓存命中/未命中编排 | fake cache |
| infrastructure/image | 转码正确性(JPEG→WebP 更小才采用)、尺寸/参数校验 | 真实图片样本 |
| infrastructure/image | 缓存击穿(singleflight)、磁盘原子写 | 并发测试 |
| 接口层 | 图片服务参数校验(400)、路径穿越拒绝、422、304/ETag | httptest |
| 安全回归 | owner 校验(IDOR) | 集成测试,锁死防回归 |

测试样本: `testdata/` 放固定 JPEG/PNG/GIF/WebP 各一张。

---

## 5. 工作量与风险

- **新增依赖**: `hashicorp/golang-lru`、`HugoSmits86/nativewebp`(`golang.org/x/sync`、`disintegration/imaging` 已有)。
- **最大风险**: 纯 Go WebP encoder 质量/体积。缓解: 端口隔离,可无痛切换 cgo libwebp。
- **不影响**: 现有 emoji 上传、视频缩略图(ffmpeg)继续工作。

---

## 6. 实施顺序建议

1. **IDOR 修复** + 回归测试(安全地基)
2. **`ImageProcessor` 端口 + 转码** + 测试样本
3. **动态图片服务** + 二级缓存 + 清理任务
4. **前端头像上传** + imageUrl helper
5. 端到端联调
