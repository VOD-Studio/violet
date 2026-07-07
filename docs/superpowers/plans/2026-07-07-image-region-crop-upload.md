# 图片选区裁剪上传 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `Cover` 和 `AvatarUploader` 支持选区裁剪上传(静态图 canvas 重编码、GIF 存坐标 + CSS 视觉裁剪保留动画);让素材库图片支持裁剪 icon + 可选「覆盖原图」(走新的 `POST /uploads/replace` 后端接口)。

**Architecture:** 前端公共纯 UI 进 `shared/ui/image-cropper/`;编排进 `features/upload/ui/CropUploadDialog.tsx`;坐标编码进 URL `?crop=x,y,w,h`。后端新增 `POST /uploads/replace`:multipart 收裁剪文件 + fileId,复用 UploadService 存储/转码能力,更新 File 记录指针(url/path/hash/size/thumbnail/width/height),旧文件保留。秒传安全靠更新 file_hash。

**Tech Stack:** 前端 React 19 + react-easy-crop + canvas 2D + 既有 useChunkedUpload + Vitest + Biome。后端 Go 1.25 + Chi + 既有 UploadService/Processor/Storage + golang-migrate(无 schema 改动)+ golangci-lint。

**Reference spec:** `docs/superpowers/specs/2026-07-07-image-region-crop-upload-design.md`

**Conventions (AGENTS.md):**
- 前端包管理器 **pnpm**;测试 `make web-test`,类型 `make web-typecheck`,lint `make web-lint`
- 后端 SQL 改后 `make sqlc`,DI 改后 `make wire`(本计划无);测试 `make api-test`,lint `make api-lint`
- 提交信息中文 Conventional Commits,body 用 bullet points,**不要 push**
- **前后端分离提交**;公共组件单独提;组件 vs 接入分离

**执行顺序:** 后端 task(B1-B4)先行,前端 F11/F12 依赖 B3 接口。前端 F1-F10 互相独立可并行,但 F8 依赖 F2/F4/F7。

---

## File Structure

### 后端(api/)

| 文件 | 责任 | 动作 |
|------|------|------|
| `api/internal/domain/upload/entity.go` | File 实体新增 `ReplaceStoredFile` 方法 | 改 |
| `api/internal/application/media/service.go` | 新增 `ReplaceMediaFile` + Input 结构 | 改 |
| `api/internal/application/media/upload_replace_test.go` | ReplaceMediaFile 单测(复用 fakeFileRepo/noopStorage) | 新建 |
| `api/internal/interfaces/http/handler/media/media.go` | 新增 `ReplaceMediaFile` handler | 改 |
| `api/cmd/server/main.go:341-352` | /uploads group 注册 `/replace` 路由 | 改 |
| `api/internal/openapi/paths_media.go` | `/uploads/replace` OpenAPI 定义 | 改 |

### 前端(web/)

| 文件 | 责任 | 动作 |
|------|------|------|
| `web/package.json` | 新增 react-easy-crop | 改 |
| `web/src/features/upload/lib/cropUrl.ts` | withCrop/parseCrop | 新建 |
| `web/src/features/upload/lib/__tests__/cropUrl.test.ts` | 单测 | 新建 |
| `web/src/shared/ui/image-cropper/lib/crop-to-style.ts` | transform 纯函数 | 新建 |
| `web/src/shared/ui/image-cropper/lib/__tests__/crop-to-style.test.ts` | 单测 | 新建 |
| `web/src/shared/ui/image-cropper/ImageCropper.tsx` | 选区交互 | 新建 |
| `web/src/shared/ui/image-cropper/CroppedImage.tsx` | 视觉裁剪显示 | 新建 |
| `web/src/shared/ui/image-cropper/index.ts` | barrel | 新建 |
| `web/src/features/upload/lib/imageUrl.ts` | avatarUrl GIF 特判 | 改 |
| `web/src/features/upload/lib/__tests__/imageUrl.test.ts` | 单测 | 新建 |
| `web/src/features/upload/lib/crop-image.ts` | cropImageToBlob | 新建 |
| `web/src/features/upload/ui/CropUploadDialog.tsx` | 编排弹窗 | 新建 |
| `web/src/features/upload/ui/AvatarUploader.tsx` | 接入选区上传 | 改 |
| `web/src/features/admin-media/ui/Cover.tsx` | 选区裁剪接入 | 改 |
| `web/src/features/upload/api/mutations.ts` | 新增 useReplaceMediaFile mutation | 改 |
| `web/src/features/admin-media/ui/MediaGrid.tsx` | 图片裁剪 icon | 改 |
| `web/src/routes/admin.media.tsx` | 素材库裁剪弹窗编排(覆盖/新建分流) | 改 |

---

# 后端

## Task B1: File 实体新增 ReplaceStoredFile 方法

**Files:**
- Modify: `api/internal/domain/upload/entity.go`(在 `UpdateMetadata` 方法后,line ~142)

- [ ] **Step 1: 读 entity.go 确认插入位置**

Run: `sed -n '49,95p' api/internal/domain/upload/entity.go && sed -n '130,165p' api/internal/domain/upload/entity.go`
确认 File struct 字段(line 49-69)、UpdateMetadata(line 136-142)、SetDimensions/SetThumbnail(line 98-101)。

- [ ] **Step 2: 写失败测试**

Create `api/internal/domain/upload/entity_replace_test.go`:

```go
package upload

import (
	"testing"

	domainshared "blog-api/internal/domain/shared"
)

func TestFile_ReplaceStoredFile(t *testing.T) {
	ownerID := domainshared.NewID()
	fid := domainshared.NewID()
	f, err := NewFile(fid, ownerID, "material", "orig.jpg", "/old/path.jpg", "/uploads/old.jpg", 100, "image/jpeg", "oldhash")
	if err != nil {
		t.Fatalf("NewFile: %v", err)
	}
	w, h := 800, 600
	f.ReplaceStoredFile("/new/path.webp", "/uploads/new.webp", 50, "image/webp", "newhash", &w, &h, "/uploads/new_thumb.jpg")

	if f.Path() != "/new/path.webp" {
		t.Errorf("Path = %q, want /new/path.webp", f.Path())
	}
	if f.URL() != "/uploads/new.webp" {
		t.Errorf("URL = %q, want /uploads/new.webp", f.URL())
	}
	if f.Size() != 50 {
		t.Errorf("Size = %d, want 50", f.Size())
	}
	if f.MimeType() != "image/webp" {
		t.Errorf("MimeType = %q, want image/webp", f.MimeType())
	}
	if f.FileHash() != "newhash" {
		t.Errorf("FileHash = %q, want newhash", f.FileHash())
	}
	if *f.Width() != 800 || *f.Height() != 600 {
		t.Errorf("dims = %v/%v, want 800/600", f.Width(), f.Height())
	}
	if f.Thumbnail() != "/uploads/new_thumb.jpg" {
		t.Errorf("Thumbnail = %q", f.Thumbnail())
	}
	// 不变字段
	if f.ID() != fid || f.OwnerID() != ownerID || f.Purpose() != "material" {
		t.Error("ReplaceStoredFile 误改了 id/owner/purpose")
	}
}
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd api && go test ./internal/domain/upload/ -run TestFile_ReplaceStoredFile -v`
Expected: FAIL(方法未定义)

- [ ] **Step 4: 实现 ReplaceStoredFile**

在 `entity.go` 的 `UpdateMetadata` 方法后追加:

```go
// ReplaceStoredFile 替换文件存储指针(覆盖原图)。
// 仅在 owner 校验通过后由 service 调用。fileHash 用新文件 SHA-256,
// 保证后续秒传按新 hash 查询准确,不会误命中被覆盖前的旧文件。
// 旧物理文件保留不删(可能被其他记录引用)。
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

- [ ] **Step 5: 运行测试确认通过**

Run: `cd api && go test ./internal/domain/upload/ -run TestFile_ReplaceStoredFile -v`
Expected: PASS

- [ ] **Step 6: lint + 提交**

Run: `make api-lint`
Expected: PASS

```bash
git add api/internal/domain/upload/entity.go api/internal/domain/upload/entity_replace_test.go
git commit -m "feat(api): File 实体新增 ReplaceStoredFile 方法

- 覆盖原图时更新 path/url/size/mimeType/fileHash/width/height/thumbnail
- fileHash 用新文件值,保证秒传查询准确
- id/owner/purpose/refCount 等不变字段不触碰
- 旧物理文件由 service 决定保留"
```

---

## Task B2: UploadService 新增 ReplaceMediaFile

**Files:**
- Modify: `api/internal/application/media/service.go`(在 `UploadThumbnail` 方法后,line ~1259)
- Test: `api/internal/application/media/upload_replace_test.go`

- [ ] **Step 1: 读关键参考**

Run:
```bash
sed -n '700,720p' api/internal/application/media/service.go       # UploadService struct
sed -n '1216,1272p' api/internal/application/media/service.go     # UploadThumbnailInput + UploadThumbnail + fileToDTO
sed -n '861,979p' api/internal/application/media/service.go        # CompleteUpload (转码/BuildPath/Move 模式)
sed -n '1032,1044p' api/internal/application/media/service.go      # mimeToCategory
```

- [ ] **Step 2: 写失败测试(owner 校验,复用现有 fakeFileRepo)**

Create `api/internal/application/media/upload_replace_test.go`:

```go
package media

import (
	"context"
	"testing"

	domainshared "blog-api/internal/domain/shared"
)

// 复用 upload_security_test.go 的 fakeFileRepo 与 noopStorage。

// noopProcessor ImageProcessor 的 no-op 实现,让放行用例走完流程。
type noopProcessor struct{}

func (noopProcessor) Validate(path string) (string, error)              { return "image/webp", nil }
func (noopProcessor) Transcode(srcPath, destDir, fileUUID, srcMime string) (r domainuploadResult, err error) {
	return domainuploadResult{Path: srcPath, MimeType: "image/webp", Ext: ".webp"}, nil
}
func (noopProcessor) Dimensions(path string) (int, int) { return 1, 1 }
func (noopProcessor) Thumbnail(srcPath, fileUUID, storageDir, mime string) string {
	return "/uploads/thumb.jpg"
}

// TestReplaceMediaFile_RejectsNonOwner 非 owner 调用应返回 Forbidden
func TestReplaceMediaFile_RejectsNonOwner(t *testing.T) {
	ownerA := domainshared.NewID()
	ownerB := domainshared.NewID()
	fileRepo := &fakeFileRepo{ownerID: ownerA}
	svc := NewUploadService(fileRepo, nil, noopStorage{}, noopProcessor{}, "/tmp", "/tmp", "/uploads/")
	_, err := svc.ReplaceMediaFile(context.Background(), ReplaceMediaFileInput{
		FileID:   "00000000-0000-0000-0000-000000000001",
		FileName: "c.jpg", MimeType: "image/jpeg", Content: []byte("x"),
	}, ownerB.String())
	if err == nil {
		t.Fatal("非 owner 应被拒绝")
	}
	if !domainshared.IsDomainError(err, domainshared.CodeForbidden) {
		t.Fatalf("应为 Forbidden,实际: %v", err)
	}
}
```

> 注:`domainuploadResult` 是 `domainupload.ProcessResult` 的别名引用,测试里需 `import domainupload "blog-api/internal/domain/upload"`,然后写 `domainupload.ProcessResult{...}`。实现时把 `noopProcessor.Transcode` 返回类型改为 `domainupload.ProcessResult`。

- [ ] **Step 3: 运行测试确认失败**

Run: `cd api && go test ./internal/application/media/ -run TestReplaceMediaFile_RejectsNonOwner -v`
Expected: FAIL(`ReplaceMediaFile`/`ReplaceMediaFileInput` 未定义)

- [ ] **Step 4: 实现 Input 结构 + ReplaceMediaFile**

在 `service.go` 的 `UploadThumbnail` 方法后追加。先在文件顶部 import 区确认有 `crypto/sha256` 和 `encoding/hex`(若无则加):

```go
// ReplaceMediaFileInput 覆盖素材原图入参(套用 UploadThumbnailInput 形状)
type ReplaceMediaFileInput struct {
	FileID   string
	FileName string
	MimeType string
	Content  []byte
}

// ReplaceMediaFile 用裁剪后的新文件覆盖调用者自己上传的素材记录。
//
// 流程:owner 校验 → 写临时文件 → 校验图片 → 转码 WebP → BuildPath/Move
// → 计算 SHA-256 → ReplaceStoredFile 更新指针 → Save。
//
// 安全:fileHash 更新为新值,避免旧 hash 秒传误命中;旧物理文件保留。
// 仅静态图支持(GIF 由前端挡在覆盖入口外;后端收到 GIF 返回 BadRequest)。
func (s *UploadService) ReplaceMediaFile(ctx context.Context, in ReplaceMediaFileInput, callerID string) (FileDTO, error) {
	fid, err := shared.ParseID(in.FileID)
	if err != nil {
		return FileDTO{}, err
	}
	f, err := s.fileRepo.FindByID(ctx, fid)
	if err != nil {
		return FileDTO{}, err
	}
	cid, err := shared.ParseID(callerID)
	if err != nil {
		return FileDTO{}, shared.BadRequest("无效的调用者 ID")
	}
	if !f.OwnerID().Equal(cid) {
		return FileDTO{}, shared.Forbidden("无权操作他人文件")
	}

	// GIF 不允许覆盖(文件不变,覆盖无意义;且 Transcode 会丢动画)
	if in.MimeType == "image/gif" {
		return FileDTO{}, shared.BadRequest("GIF 不支持覆盖原图")
	}

	// 写临时文件供 processor 校验/转码
	tmpDir := filepath.Join(s.uploadDir, ".replace-tmp", fid.String())
	if err := s.storage.EnsureDir(tmpDir); err != nil {
		return FileDTO{}, shared.Internal("创建临时目录失败", err)
	}
	ext := strings.ToLower(filepath.Ext(in.FileName))
	if ext == "" {
		ext = ".jpg"
	}
	tmpPath := filepath.Join(tmpDir, "src"+ext)
	if err := os.WriteFile(tmpPath, in.Content, 0o644); err != nil {
		return FileDTO{}, shared.Internal("写入临时文件失败", err)
	}
	defer s.storage.CleanupDir(tmpDir)

	// 校验真实图片 + 转码
	srcMime, err := s.processor.Validate(tmpPath)
	if err != nil {
		return FileDTO{}, shared.BadRequest("图片校验失败: " + err.Error())
	}
	if srcMime == "image/gif" {
		return FileDTO{}, shared.BadRequest("GIF 不支持覆盖原图")
	}
	result, err := s.processor.Transcode(tmpPath, tmpDir, "replaced", srcMime)
	if err != nil {
		return FileDTO{}, shared.Internal("图片转码失败", err)
	}
	finalMime := result.MimeType
	finalExt := result.Ext

	// 最终路径(date 分段,新 fileUUID 避免与旧文件同名)
	fileUUID := shared.NewID()
	finalPath, fileURL, err := s.storage.BuildPath(f.Purpose(), time.Now(), fileUUID.String(), finalExt)
	if err != nil {
		return FileDTO{}, shared.BadRequest("非法的上传用途路径: " + err.Error())
	}
	if err := s.storage.EnsureDir(filepath.Dir(finalPath)); err != nil {
		return FileDTO{}, shared.Internal("创建文件目录失败", err)
	}
	if err := s.storage.Move(result.Path, finalPath); err != nil {
		return FileDTO{}, shared.Internal("移动文件失败", err)
	}
	fileSize, err := s.storage.FileSize(finalPath)
	if err != nil {
		fileSize = int64(len(in.Content))
	}

	// 尺寸 + 缩略图
	width, height := 0, 0
	storageDir := f.Purpose()
	if storageDir == "material" {
		storageDir = filepath.Join(storageDir, mimeToCategory(finalMime))
	}
	if s.processor != nil {
		width, height = s.processor.Dimensions(finalPath)
	}
	thumbnail := s.processor.Thumbnail(finalPath, fileUUID.String(), storageDir, finalMime)

	// SHA-256(无现成 helper,inline)
	sum := sha256.Sum256(in.Content)
	newHash := hex.EncodeToString(sum[:])

	// 更新实体指针
	var w, h *int
	if width > 0 {
		ww, hh := width, height
		w, h = &ww, &hh
	}
	f.ReplaceStoredFile(finalPath, fileURL, fileSize, finalMime, newHash, w, h, thumbnail)
	if err := s.fileRepo.Save(ctx, f); err != nil {
		return FileDTO{}, err
	}
	return fileToDTO(f), nil
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd api && go test ./internal/application/media/ -run TestReplaceMediaFile_RejectsNonOwner -v`
Expected: PASS

- [ ] **Step 6: 补一个放行用例(owner 一致,验证流程走完)**

在 `upload_replace_test.go` 追加:

```go
func TestReplaceMediaFile_OwnerOK(t *testing.T) {
	owner := domainshared.NewID()
	fileRepo := &fakeFileRepo{ownerID: owner}
	svc := NewUploadService(fileRepo, nil, noopStorage{}, noopProcessor{}, "/tmp", "/tmp", "/uploads/")
	dto, err := svc.ReplaceMediaFile(context.Background(), ReplaceMediaFileInput{
		FileID:   "00000000-0000-0000-0000-000000000001",
		FileName: "c.jpg", MimeType: "image/jpeg", Content: []byte("x"),
	}, owner.String())
	if err != nil {
		t.Fatalf("owner 调用不应失败: %v", err)
	}
	if dto.MimeType != "image/webp" {
		t.Errorf("MimeType = %q, want image/webp", dto.MimeType)
	}
}
```

Run: `cd api && go test ./internal/application/media/ -run TestReplaceMediaFile -v`
Expected: 两个用例 PASS

- [ ] **Step 7: lint + 全量测试 + 提交**

Run: `make api-lint && make api-test`
Expected: PASS

```bash
git add api/internal/application/media/service.go api/internal/application/media/upload_replace_test.go
git commit -m "feat(api): UploadService 新增 ReplaceMediaFile 覆盖素材原图

- owner 校验,非 owner 返回 Forbidden
- 校验图片 + 转 WebP + BuildPath/Move + 算 SHA-256
- 调 File.ReplaceStoredFile 更新指针后 Save
- GIF 拒绝覆盖(转码丢动画,覆盖无意义)
- 旧物理文件保留不删
- 复用 fakeFileRepo/noopStorage,新增 noopProcessor mock"
```

---

## Task B3: 新增 POST /uploads/replace 接口

**Files:**
- Modify: `api/internal/interfaces/http/handler/media/media.go`(在 `UploadThumbnail` handler 后,line ~817)
- Modify: `api/cmd/server/main.go:341-352`(/uploads group 加路由)
- Modify: `api/internal/openapi/paths_media.go`

- [ ] **Step 1: 读 UploadThumbnail handler 作模板**

Run: `sed -n '778,820p' api/internal/interfaces/http/handler/media/media.go`

- [ ] **Step 2: 加 handler 方法**

在 `media.go` 的 `UploadThumbnail` 方法后追加(套用其 multipart 模式):

```go
// ReplaceMediaFile 覆盖素材原图
//
// multipart 字段:file(裁剪后新文件) + fileId(目标素材 ID)。
// 仅 owner 可覆盖自己上传的素材;GIF 拒绝(由 service 兜底)。
func (h *Handler) ReplaceMediaFile(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		response.RespondError(w, r, err)
		return
	}
	id := r.FormValue("fileId")
	if id == "" {
		response.RespondError(w, r, errors.New("fileId 不能为空"))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	defer file.Close()
	content := make([]byte, header.Size)
	n, err := io.ReadFull(file, content)
	if err != nil && err != io.ErrUnexpectedEOF {
		response.RespondError(w, r, err)
		return
	}
	content = content[:n]
	sniffedMIME, err := sniffImageContent(content)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.uploadSvc.ReplaceMediaFile(r.Context(), appmedia.ReplaceMediaFileInput{
		FileID: id, FileName: header.Filename,
		MimeType: sniffedMIME, Content: content,
	}, interfacesmw.GetUserIDFromContext(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}
```

- [ ] **Step 3: 注册路由**

在 `main.go` 的 `/uploads` group 内(line 349 `/thumbnail` 后)加:

```go
r.Post("/replace", mediaH.ReplaceMediaFile) // 覆盖素材原图(fileId 经 multipart 字段)
```

- [ ] **Step 4: 加 OpenAPI 定义**

在 `paths_media.go` 的 `/uploads/thumbnail` 定义后(line ~156)加:

```go
post(t, "/uploads/replace", &openapi3.Operation{
	Tags:     []string{"upload"},
	Summary:  "覆盖素材原图",
	Description: "multipart 字段 file(裁剪后新文件) + fileId(目标素材 ID)。仅 owner 可覆盖。",
	OperationID: "replaceMediaFile",
	RequestBody: &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Required: true,
			Content: openapi3.Content{
				"multipart/form-data": &openapi3.MediaType{
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "object",
							Properties: openapi3.Schemas{
								"file":   optRef("file", "二进制"),
								"fileId": optStr("目标素材 ID"),
							},
						},
					},
				},
			},
		},
	},
	Responses: okJSONResponse(t, "FileDTO", "更新后的素材记录"),
})
```

> 注:`optRef`/`optStr`/`okJSONResponse` 等辅助函数名按 `paths_media.go` 顶部已有 helper 实际命名调整——实现时先 `sed -n '1,60p' paths_media.go` 看 helper 函数签名,匹配现有风格。

- [ ] **Step 5: 编译 + lint + 提交**

Run: `cd api && go build ./... && make api-lint`
Expected: PASS

> 若项目有 OpenAPI 生成前端类型流程(`make openapi` 或 export-openapi),运行它并提交生成产物;否则跳过。

```bash
git add api/internal/interfaces/http/handler/media/media.go api/cmd/server/main.go api/internal/openapi/paths_media.go
git commit -m "feat(api): 新增 POST /uploads/replace 覆盖素材原图接口

- multipart 收 file + fileId,套用 UploadThumbnail handler 模式
- 注册在 /uploads group,复用 SessionAuth + UploadRateLimit
- owner 校验在 service 层完成
- 补充 OpenAPI 定义"
```

---

# 前端

## Task F1: 引入 react-easy-crop 依赖

**Files:**
- Modify: `web/package.json`, `web/pnpm-lock.yaml`

- [ ] **Step 1: 安装**

Run: `cd web && pnpm add react-easy-crop`

- [ ] **Step 2: 验证**

Run: `cd web && node -e "console.log(require('./node_modules/react-easy-crop/package.json').version)"`
Expected: 打印版本号

- [ ] **Step 3: 类型检查**

Run: `make web-typecheck`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add web/package.json web/pnpm-lock.yaml
git commit -m "chore(web): 引入 react-easy-crop 依赖

- 用于图片选区裁剪交互
- 依赖变更独立提交,可单独回滚"
```

---

## Task F2: 坐标 URL 编码工具 cropUrl.ts

**Files:**
- Create: `web/src/features/upload/lib/cropUrl.ts`
- Test: `web/src/features/upload/lib/__tests__/cropUrl.test.ts`

- [ ] **Step 1: 写失败测试**

Create `web/src/features/upload/lib/__tests__/cropUrl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCrop, withCrop, type CropRect } from "../cropUrl";

describe("withCrop", () => {
    const rect: CropRect = { x: 0.1, y: 0.2, w: 0.5, h: 0.6 };

    it("给裸 path 附加 crop 参数", () => {
        expect(withCrop("/uploads/a.gif", rect)).toBe("/uploads/a.gif?crop=0.1,0.2,0.5,0.6");
    });
    it("保留已有查询参数", () => {
        expect(withCrop("/uploads/a.gif?w=200", rect)).toBe("/uploads/a.gif?w=200&crop=0.1,0.2,0.5,0.6");
    });
    it("覆盖已有 crop 参数(幂等)", () => {
        const once = withCrop("/uploads/a.gif", rect);
        expect(withCrop(once, { x: 0, y: 0, w: 1, h: 1 })).toBe("/uploads/a.gif?crop=0,0,1,1");
    });
    it("四舍六入到 4 位小数", () => {
        expect(withCrop("/uploads/a.gif", { x: 0.123456, y: 0.00001, w: 0.999999, h: 0.5 }))
            .toBe("/uploads/a.gif?crop=0.1235,0,1,0.5");
    });
});

describe("parseCrop", () => {
    it("解析有 crop 参数的 URL", () => {
        expect(parseCrop("/uploads/a.gif?crop=0.1,0.2,0.5,0.6")).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.6 });
    });
    it("URL 有其他参数时仍能解析", () => {
        expect(parseCrop("/uploads/a.gif?w=200&crop=0.1,0.2,0.5,0.6")).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.6 });
    });
    it("无 crop 参数返回 null", () => {
        expect(parseCrop("/uploads/a.gif?w=200")).toBeNull();
    });
    it("非法 crop 值返回 null", () => {
        expect(parseCrop("/uploads/a.gif?crop=abc")).toBeNull();
    });
    it("超界值返回 null", () => {
        expect(parseCrop("/uploads/a.gif?crop=1.5,0,0.5,0.5")).toBeNull();
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && pnpm vitest run src/features/upload/lib/__tests__/cropUrl.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 cropUrl.ts**

Create `web/src/features/upload/lib/cropUrl.ts`:

```ts
/**
 * 裁剪坐标 URL 编码。GIF 选区不重编码,坐标编码进 ?crop=x,y,w,h,
 * 显示层用 CSS 视觉裁剪。与 imageUrl.ts 的动态处理参数正交。
 */

export interface CropRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

function round(n: number): number {
    return Math.round(n * 10000) / 10000;
}

function isValidRect(rect: CropRect): boolean {
    return (
        rect.x >= 0 && rect.x <= 1 && rect.y >= 0 && rect.y <= 1 &&
        rect.w > 0 && rect.w <= 1 && rect.h > 0 && rect.h <= 1 &&
        rect.x + rect.w <= 1.0001 && rect.y + rect.h <= 1.0001
    );
}

export function withCrop(path: string, rect: CropRect): string {
    const [base, search = ""] = path.split("?");
    const params = new URLSearchParams(search);
    params.set("crop", `${round(rect.x)},${round(rect.y)},${round(rect.w)},${round(rect.h)}`);
    return `${base}?${params.toString()}`;
}

export function parseCrop(url: string): CropRect | null {
    const i = url.indexOf("?");
    if (i < 0) return null;
    const params = new URLSearchParams(url.slice(i + 1));
    const raw = params.get("crop");
    if (!raw) return null;
    const parts = raw.split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
    const rect: CropRect = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    return isValidRect(rect) ? rect : null;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd web && pnpm vitest run src/features/upload/lib/__tests__/cropUrl.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/src/features/upload/lib/cropUrl.ts web/src/features/upload/lib/__tests__/cropUrl.test.ts
git commit -m "feat(web): 新增坐标 URL 编码工具 withCrop/parseCrop

- 归一化坐标(0~1)编码进 ?crop=x,y,w,h
- 保留已有查询参数,幂等覆盖
- 解析含边界校验,非法/超界返回 null"
```

---

## Task F3: cropToStyle transform 纯函数

**Files:**
- Create: `web/src/shared/ui/image-cropper/lib/crop-to-style.ts`
- Test: `web/src/shared/ui/image-cropper/lib/__tests__/crop-to-style.test.ts`

- [ ] **Step 1: 写失败测试**

Create `web/src/shared/ui/image-cropper/lib/__tests__/crop-to-style.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cropToStyle } from "../crop-to-style";

describe("cropToStyle", () => {
    it("无选区返回单位 transform", () => {
        expect(cropToStyle(undefined, 16 / 9)).toEqual({ transform: "translate(0%, 0%) scale(1)" });
    });
    it("正方形居中选区 + 正方形容器 scale=2", () => {
        const s = cropToStyle({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 1);
        expect(s.transform).toContain("scale(2)");
        expect(s.transform).toContain("translate(0%, 0%)");
    });
    it("宽选区 + 高容器按高度铺满", () => {
        const s = cropToStyle({ x: 0.1, y: 0.3, w: 0.8, h: 0.4 }, 1);
        expect(s.transform).toContain("scale(2.5)");
    });
    it("高选区 + 宽容器按宽度铺满", () => {
        const s = cropToStyle({ x: 0.3, y: 0.1, w: 0.4, h: 0.8 }, 16 / 9);
        expect(s.transform).toContain("scale(2.5)");
    });
    it("偏移选区 translate 非零", () => {
        const s = cropToStyle({ x: 0, y: 0, w: 0.5, h: 0.5 }, 1);
        expect(s.transform).toMatch(/translate\(-?\d+(\.\d+)?%, -?\d+(\.\d+)?%\)/);
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && pnpm vitest run src/shared/ui/image-cropper/lib/__tests__/crop-to-style.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 crop-to-style.ts**

Create `web/src/shared/ui/image-cropper/lib/crop-to-style.ts`:

```ts
import type { CSSProperties } from "react";
import type { CropRect } from "@features/upload/lib/cropUrl";

/**
 * 把归一化裁剪区域 + 容器宽高比,换算成 CSS transform。
 * object-fit:cover 下聚焦选区中心,GIF 原图不动保留动画。
 */
export function cropToStyle(
    rect: CropRect | undefined,
    containerAspect: number,
): Pick<CSSProperties, "transform"> {
    if (!rect) {
        return { transform: "translate(0%, 0%) scale(1)" };
    }
    const rectAspect = rect.w / rect.h;
    const scale = rectAspect > containerAspect ? 1 / rect.h : 1 / rect.w;
    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;
    const tx = (0.5 - centerX) * 100;
    const ty = (0.5 - centerY) * 100;
    return { transform: `translate(${tx}%, ${ty}%) scale(${scale})` };
}
```

> 若 lint 报 shared 引 features 的分层警告,在 `crop-to-style.ts` 同目录加 `types.ts` 定义 CropRect,由 `features/upload/lib/cropUrl.ts` re-export。先按直接 type import 实现,问题再改。

- [ ] **Step 4: 运行确认通过**

Run: `cd web && pnpm vitest run src/shared/ui/image-cropper/lib/__tests__/crop-to-style.test.ts`
Expected: PASS(公式以断言为准,若不符调试后回填)

- [ ] **Step 5: 提交**

```bash
git add web/src/shared/ui/image-cropper/lib/
git commit -m "feat(web): 新增 cropToStyle 视觉裁剪 transform 纯函数

- 归一化选区 + 容器比例换算成 CSS transform
- object-fit:cover 下聚焦选区中心,GIF 保留动画
- 无选区返回单位 transform 兼容普通图片"
```

---

## Task F4: ImageCropper 选区交互组件

**Files:**
- Create: `web/src/shared/ui/image-cropper/ImageCropper.tsx`

- [ ] **Step 1: 实现**

Create `web/src/shared/ui/image-cropper/ImageCropper.tsx`:

```tsx
import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import type { CropRect } from "@features/upload/lib/cropUrl";

export interface ImageCropperProps {
    src: string;
    aspect?: number;
    onChange: (rect: CropRect | undefined) => void;
}

/** 基于 react-easy-crop,输出归一化 CropRect(图片自然尺寸归一化)。 */
export function ImageCropper({ src, aspect, onChange }: ImageCropperProps) {
    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

    const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }, []);

    const onCropComplete = useCallback(
        (_area: Area, areaPixels: Area) => {
            if (!naturalSize || naturalSize.w === 0 || naturalSize.h === 0) return;
            onChange({
                x: areaPixels.x / naturalSize.w,
                y: areaPixels.y / naturalSize.h,
                w: areaPixels.width / naturalSize.w,
                h: areaPixels.height / naturalSize.h,
            });
        },
        [naturalSize, onChange],
    );

    return (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <Cropper
                image={src}
                aspect={aspect}
                onImgLoad={onImgLoad}
                onCropComplete={onCropComplete}
                objectFit="horizontal-cover"
            />
        </div>
    );
}
```

- [ ] **Step 2: 类型检查**

Run: `make web-typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add web/src/shared/ui/image-cropper/ImageCropper.tsx
git commit -m "feat(web): 新增 ImageCropper 选区交互组件

- 基于 react-easy-crop,输出归一化 CropRect(0~1)
- 图片自然尺寸加载后归一化像素坐标
- 支持固定 aspect 与自由比例"
```

---

## Task F5: CroppedImage 视觉裁剪显示组件 + barrel

**Files:**
- Create: `web/src/shared/ui/image-cropper/CroppedImage.tsx`
- Create: `web/src/shared/ui/image-cropper/index.ts`

- [ ] **Step 1: 实现 CroppedImage**

Create `web/src/shared/ui/image-cropper/CroppedImage.tsx`:

```tsx
import { useMemo } from "react";
import { parseCrop } from "@features/upload/lib/cropUrl";
import { cropToStyle } from "./lib/crop-to-style";
import { cn } from "@/shared/lib/utils";

export interface CroppedImageProps {
    src: string;
    aspect?: number;
    className?: string;
    alt?: string;
}

/** 显示层视觉裁剪:解析 ?crop= 用 CSS transform 聚焦选区。无参数退化为 object-cover。 */
export function CroppedImage({ src, aspect, className, alt = "" }: CroppedImageProps) {
    const rect = useMemo(() => parseCrop(src), [src]);
    const style = useMemo(
        () => cropToStyle(rect, aspect ?? (rect ? rect.w / rect.h : 16 / 9)),
        [rect, aspect],
    );
    return (
        <div className={cn("overflow-hidden", className)} style={aspect ? { aspectRatio: aspect } : undefined}>
            <img src={src} alt={alt} className="h-full w-full object-cover will-change-transform" style={style} />
        </div>
    );
}
```

- [ ] **Step 2: barrel**

Create `web/src/shared/ui/image-cropper/index.ts`:

```ts
export { ImageCropper, type ImageCropperProps } from "./ImageCropper";
export { CroppedImage, type CroppedImageProps } from "./CroppedImage";
```

- [ ] **Step 3: 类型检查 + lint**

Run: `make web-typecheck && make web-lint`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add web/src/shared/ui/image-cropper/CroppedImage.tsx web/src/shared/ui/image-cropper/index.ts
git commit -m "feat(web): 新增 CroppedImage 视觉裁剪显示组件

- 解析 ?crop= 用 CSS transform 聚焦选区
- 无 crop 参数退化为 object-cover,零破坏性
- GIF 原图完整加载保留动画
- 同步导出 image-cropper barrel"
```

---

## Task F6: avatarUrl 对 GIF 剥除处理参数

**Files:**
- Modify: `web/src/features/upload/lib/imageUrl.ts:34-41`
- Test: `web/src/features/upload/lib/__tests__/imageUrl.test.ts`

- [ ] **Step 1: 写失败测试**

Create `web/src/features/upload/lib/__tests__/imageUrl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { avatarUrl } from "../imageUrl";

describe("avatarUrl", () => {
    it("空 path 返回默认头像", () => {
        expect(avatarUrl("", "alice")).toContain("ui-avatars.com");
    });
    it("静态图追加 w/thumb/format", () => {
        const u = avatarUrl("/uploads/avatar/x.webp", "alice");
        expect(u).toContain("w=200");
        expect(u).toContain("thumb=200x200");
        expect(u).toContain("format=webp");
    });
    it("GIF 剥除所有处理参数保护动画", () => {
        const u = avatarUrl("/uploads/avatar/a.gif", "alice");
        expect(u).toBe("/uploads/avatar/a.gif");
        expect(u).not.toContain("format=webp");
    });
    it("GIF path 已有 crop 参数保留", () => {
        const u = avatarUrl("/uploads/avatar/a.gif?crop=0.1,0.2,0.5,0.5", "alice");
        expect(u).toContain("crop=0.1,0.2,0.5,0.5");
        expect(u).not.toContain("format=webp");
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && pnpm vitest run src/features/upload/lib/__tests__/imageUrl.test.ts`
Expected: FAIL

- [ ] **Step 3: 改 avatarUrl**

替换 `imageUrl.ts` 的 `avatarUrl` 函数(line 34-41):

```ts
export function avatarUrl(path: string, username?: string): string {
    if (!path || path.trim() === "") {
        const name = username ? encodeURIComponent(username) : "User";
        return `https://ui-avatars.com/api/?name=${name}&size=200&background=random`;
    }
    if (isGifPath(path)) {
        return path;
    }
    return imageUrl(path, { w: 200, thumb: "200x200", format: "webp" });
}

function isGifPath(path: string): boolean {
    return path.split("?")[0].toLowerCase().endsWith(".gif");
}
```

并更新函数文档注释说明 GIF 特判原因。

- [ ] **Step 4: 运行确认通过**

Run: `cd web && pnpm vitest run src/features/upload/lib/__tests__/imageUrl.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/src/features/upload/lib/imageUrl.ts web/src/features/upload/lib/__tests__/imageUrl.test.ts
git commit -m "feat(web): avatarUrl 对 GIF 剥除处理参数保护动画

- GIF path 直接返回,不追加 w/thumb/format
- format=webp 会让后端解码 GIF 取第一帧丢动画
- 静态图头像仍走 200x200 webp 缩略图"
```

---

## Task F7: cropImageToBlob canvas 重编码工具

**Files:**
- Create: `web/src/features/upload/lib/crop-image.ts`

- [ ] **Step 1: 实现**

Create `web/src/features/upload/lib/crop-image.ts`:

```ts
import type { CropRect } from "./cropUrl";

/** 把图片 src 按归一化选区裁剪,canvas 重编码为 WebP Blob。仅静态图用。 */
export async function cropImageToBlob(src: string, rect: CropRect, quality = 0.9): Promise<Blob> {
    const img = await loadImage(src);
    const sx = rect.x * img.naturalWidth;
    const sy = rect.y * img.naturalHeight;
    const sw = rect.w * img.naturalWidth;
    const sh = rect.h * img.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 canvas 2D 上下文");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob 返回 null"))),
            "image/webp",
            quality,
        );
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
        img.src = src;
    });
}
```

- [ ] **Step 2: 类型检查**

Run: `make web-typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add web/src/features/upload/lib/crop-image.ts
git commit -m "feat(web): 新增 cropImageToBlob canvas 重编码工具

- 加载完整图 → canvas 按归一化选区裁剪 → WebP Blob
- 仅静态图用,GIF 走坐标路径不重编码"
```

---

## Task F8: CropUploadDialog 编排弹窗

**Files:**
- Create: `web/src/features/upload/ui/CropUploadDialog.tsx`

- [ ] **Step 1: 实现**

Create `web/src/features/upload/ui/CropUploadDialog.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useChunkedUpload } from "@/features/upload/hooks/use-chunked-upload";
import { cropImageToBlob } from "@/features/upload/lib/crop-image";
import { withCrop, type CropRect } from "@/features/upload/lib/cropUrl";
import { Button } from "@shared/ui/base/button";
import { Modal } from "@shared/ui/modal";
import { ImageCropper } from "@shared/ui/image-cropper/ImageCropper";
import { toast } from "sonner";

export type CropUploadResult =
    | { kind: "static"; url: string }
    | { kind: "gif"; url: string };

export interface CropUploadDialogProps {
    /** 本地新选文件(头像/封面场景) */
    file?: File;
    /** 已有素材 URL(封面选择/素材库裁剪场景) */
    srcUrl?: string;
    aspect?: number;
    purpose: string;
    fileNameBase?: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: (result: CropUploadResult) => void;
}

/**
 * 选区上传编排:判 GIF → GIF 上传原图拼坐标 / 静态图 canvas 重编码上传。
 * 「覆盖原图」选项不在本组件,由素材库接入点用 useReplaceMediaFile 单独处理。
 */
export function CropUploadDialog({
    file, srcUrl, aspect, purpose, fileNameBase = "cropped", open, onOpenChange, onConfirm,
}: CropUploadDialogProps) {
    const [rect, setRect] = useState<CropRect | undefined>(undefined);
    const [busy, setBusy] = useState(false);
    const { uploadFile } = useChunkedUpload({ purpose });

    const previewSrc = useMemo(() => (file ? URL.createObjectURL(file) : srcUrl), [file, srcUrl]);
    useEffect(() => {
        return () => {
            if (file && previewSrc) URL.revokeObjectURL(previewSrc);
        };
    }, [file, previewSrc]);

    const isGif =
        file?.type === "image/gif" || srcUrl?.split("?")[0].toLowerCase().endsWith(".gif");

    const handleConfirm = useCallback(async () => {
        if (!rect) {
            toast.error("请先选定裁剪区域");
            return;
        }
        setBusy(true);
        try {
            if (isGif) {
                let url = srcUrl;
                if (file) {
                    const r = await uploadFile(file);
                    url = r.url;
                }
                if (!url) throw new Error("GIF 上传未返回 URL");
                onConfirm({ kind: "gif", url: withCrop(url, rect) });
            } else {
                const blob = await cropImageToBlob(previewSrc, rect);
                const cropped = new File([blob], `${fileNameBase}.webp`, { type: "image/webp" });
                const r = await uploadFile(cropped);
                onConfirm({ kind: "static", url: r.url });
            }
            onOpenChange(false);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "裁剪上传失败");
        } finally {
            setBusy(false);
        }
    }, [rect, isGif, file, srcUrl, previewSrc, fileNameBase, uploadFile, onConfirm, onOpenChange]);

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={isGif ? "选区(GIF 保留动画)" : "裁剪上传"}
            size="md"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
                    <Button onClick={handleConfirm} disabled={busy || !rect}>
                        {busy ? "处理中..." : "确认"}
                    </Button>
                </div>
            }
        >
            {previewSrc ? (
                <ImageCropper src={previewSrc} aspect={aspect} onChange={setRect} />
            ) : (
                <p className="text-sm text-muted-foreground">无可用图片源</p>
            )}
        </Modal>
    );
}
```

> 说明:素材库「覆盖原图」**不通过本组件的 onConfirm**。因为覆盖需要拿裁剪后的 File 调 replace 接口,而非走 onConfirm 的「上传拿 url」语义。素材库接入点(F12)会自行用 `cropImageToBlob` 生成 Blob,再根据 checkbox 决定走 uploadFile(新建)或 useReplaceMediaFile(覆盖)。本组件服务于头像/封面(无覆盖选项)场景。

- [ ] **Step 2: 类型检查 + lint**

Run: `make web-typecheck && make web-lint`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add web/src/features/upload/ui/CropUploadDialog.tsx
git commit -m "feat(web): 新增 CropUploadDialog 裁剪上传弹窗

- 编排 GIF 判定 + 静态图重编码 + 分片上传
- GIF 上传原图后拼 ?crop= 保留动画
- 静态图 canvas 重编码 WebP 上传
- 服务头像/封面场景(无覆盖选项)"
```

---

## Task F9: AvatarUploader 接入选区上传

**Files:**
- Modify: `web/src/features/upload/ui/AvatarUploader.tsx`

- [ ] **Step 1: 整体替换 AvatarUploader**

替换 `web/src/features/upload/ui/AvatarUploader.tsx` 全文:

```tsx
import { useState } from "react";
import type { UserDTO } from "@/entities/user/model/types";
import { useUpdateProfile } from "@/features/auth/api/mutations";
import { avatarUrl } from "../lib/imageUrl";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { CropUploadDialog, type CropUploadResult } from "./CropUploadDialog";

interface AvatarUploaderProps {
    user: UserDTO;
}

/** 头像上传:选图 → 裁剪选区 → 上传 → 更新资料。显示用 CroppedImage。 */
export function AvatarUploader({ user }: AvatarUploaderProps) {
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [cropOpen, setCropOpen] = useState(false);
    const [error, setError] = useState("");
    const updateProfile = useUpdateProfile();

    const handleConfirm = async (result: CropUploadResult) => {
        setError("");
        try {
            await updateProfile.mutateAsync({ avatar_url: result.url });
        } catch (e) {
            setError(e instanceof Error ? e.message : "更新头像失败");
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <CroppedImage
                src={avatarUrl(user.avatar_url, user.username)}
                aspect={1}
                className="h-24 w-24 rounded-full"
                alt={`${user.username} 的头像`}
            />
            <label className="cursor-pointer text-sm text-blue-600 hover:underline">
                {updateProfile.isPending ? "保存中..." : "更换头像"}
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    disabled={updateProfile.isPending}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                            setPendingFile(f);
                            setCropOpen(true);
                        }
                        e.target.value = "";
                    }}
                />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <CropUploadDialog
                file={pendingFile ?? undefined}
                aspect={1}
                purpose="avatar"
                fileNameBase="avatar"
                open={cropOpen}
                onOpenChange={setCropOpen}
                onConfirm={handleConfirm}
            />
        </div>
    );
}
```

- [ ] **Step 2: 类型检查 + lint**

Run: `make web-typecheck && make web-lint`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add web/src/features/upload/ui/AvatarUploader.tsx
git commit -m "feat(web): AvatarUploader 接入选区上传

- 选图后弹 CropUploadDialog,确认才上传
- 显示层换 CroppedImage 支持 ?crop=
- 删除手写 initUpload/uploadChunk/completeUpload 调用"
```

---

## Task F10: Cover 选区裁剪接入

**Files:**
- Modify: `web/src/features/admin-media/ui/Cover.tsx`

- [ ] **Step 1: 整体替换 Cover**

替换 `web/src/features/admin-media/ui/Cover.tsx` 全文:

```tsx
/**
 * Cover - 封面图选择器。选完素材进裁剪弹窗,静态图重编码上传, GIF 存坐标。
 */

import type { MediaFile, MediaType } from "@entities/media/model/types";
import { MediaPicker } from "@features/admin-media/ui/MediaPicker";
import { CropUploadDialog, type CropUploadResult } from "@features/upload/ui/CropUploadDialog";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { Button } from "@shared/ui/base/button";
import { ImagePlus } from "lucide-react";
import { useState } from "react";

export interface CoverProps {
    id?: string;
    value: string | undefined | null;
    onChange: (url: string) => void;
    onClear?: () => void;
    title?: string;
    mediaType?: MediaType;
}

export function Cover({ id, value, onChange, onClear, title = "选择封面图", mediaType = "image" }: CoverProps) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [cropSrc, setCropSrc] = useState<string | undefined>(undefined);

    const handlePick = (files: MediaFile[]) => {
        if (files[0]) setCropSrc(files[0].url);
    };
    const handleCropConfirm = (result: CropUploadResult) => {
        onChange(result.url);
        setCropSrc(undefined);
    };

    return (
        <div id={id} className="space-y-1.5">
            {value ? (
                <div className="group relative overflow-hidden rounded-lg border border-edge-hairline">
                    <CroppedImage src={value} aspect={16 / 9} className="w-full" alt="封面" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-linear-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button type="button" variant="secondary" size="xs" onClick={() => setPickerOpen(true)}>更换</Button>
                        {onClear ? (
                            <Button type="button" variant="secondary" size="xs" onClick={onClear}>移除</Button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-edge-hairline text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                    <ImagePlus className="size-5" />
                    选择封面图
                </button>
            )}
            <MediaPicker open={pickerOpen} onOpenChange={setPickerOpen} mediaType={mediaType} title={title} onConfirm={handlePick} />
            <CropUploadDialog
                srcUrl={cropSrc}
                aspect={16 / 9}
                purpose="cover"
                fileNameBase="cover"
                open={!!cropSrc}
                onOpenChange={(v) => { if (!v) setCropSrc(undefined); }}
                onConfirm={handleCropConfirm}
            />
        </div>
    );
}
```

- [ ] **Step 2: 类型检查 + lint**

Run: `make web-typecheck && make web-lint`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add web/src/features/admin-media/ui/Cover.tsx
git commit -m "feat(web): Cover 选完素材进裁剪弹窗

- MediaPicker 单选后开 CropUploadDialog 选区
- 静态图重编码上传为新素材,GIF 存坐标
- 预览换 CroppedImage 支持 ?crop="
```

---

## Task F11: 新增 replace 上传 mutation

**Files:**
- Modify: `web/src/features/upload/api/mutations.ts`

- [ ] **Step 1: 读 mutation 文件尾部确认插入位置**

Run: `tail -20 web/src/features/upload/api/mutations.ts`

- [ ] **Step 2: 加 uploadThumbnail 风格的 replace 函数 + mutation**

在 `mutations.ts` 末尾追加(套用 `uploadThumbnail` 的 multipart 模式,line 86-91):

```ts
export interface ReplaceMediaResult {
    id: string;
    url: string;
    thumbnail?: string;
    mime_type: string;
    updated_at: string;
}

/**
 * replaceMediaFile - 覆盖素材原图底层请求函数。
 *
 * 对接 POST /uploads/replace,multipart/form-data,
 * 字段:file(裁剪后新文件)+ fileId(目标素材 ID)。
 * 仅 owner 可覆盖自己上传的素材。
 */
export const replaceMediaFile = async (
    fileId: string,
    file: File,
): Promise<ReplaceMediaResult> => {
    const form = new FormData();
    form.append("file", file);
    form.append("fileId", fileId);
    return apiPost<ReplaceMediaResult>("/uploads/replace", form);
};

/**
 * useReplaceMediaFile - 覆盖素材原图 mutation。
 *
 * 不内置 invalidate:素材列表 key 属 admin-media slice,
 * 由调用方在 onSuccess 自行失效。
 */
export const useReplaceMediaFile = () =>
    useMutation({
        mutationFn: ({ fileId, file }: { fileId: string; file: File }) =>
            replaceMediaFile(fileId, file),
    });
```

- [ ] **Step 3: 类型检查**

Run: `make web-typecheck`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add web/src/features/upload/api/mutations.ts
git commit -m "feat(web): 新增 replaceMediaFile 覆盖素材 mutation

- 对接 POST /uploads/replace,multipart file + fileId
- 套用 uploadThumbnail 请求模式
- 不内置 invalidate,由调用方失效列表"
```

---

## Task F12: 素材库网格图片裁剪 icon + 覆盖接入

**Files:**
- Modify: `web/src/features/admin-media/ui/MediaGrid.tsx`
- Modify: `web/src/routes/admin.media.tsx`

这是最复杂的前端 task,涉及网格 icon + 弹窗编排(覆盖/新建/GIF 三分支)。

- [ ] **Step 1: MediaGrid 加裁剪 icon + onCrop 回调**

在 `MediaGrid.tsx` 顶部 import 加 `Crop` icon:
```ts
import { Crop, FileText, Film, Music, Pencil, Trash2 } from "lucide-react";
```

`MediaGridProps` 加可选回调:
```ts
/** 图片裁剪(仅图片卡片显示) */
onCrop?: (file: MediaFile) => void;
```

`MediaCard` 解构加 `onCrop`,在悬停操作区(视频选帧 icon 同位置,line ~96)加图片裁剪按钮:

```tsx
{isImage && onCrop ? (
    <Button
        size="icon-sm"
        variant="secondary"
        className="size-7 shadow-sm"
        onClick={() => onCrop(file)}
        title="裁剪"
    >
        <Crop className="size-3" />
    </Button>
) : null}
```

放在视频 `onPickCover` 块之后、`onEdit` 块之前。`MediaCard` 函数签名也要加 `onCrop` 并透传。

- [ ] **Step 2: admin.media.tsx 读现状**

Run: `sed -n '1,30p' web/src/routes/admin.media.tsx && grep -n "MediaGrid\|onPickCover\|uploadOpen\|setImageCrop\|useState\|adminMediaKeys\|queryClient" web/src/routes/admin.media.tsx | head -20`

- [ ] **Step 3: admin.media.tsx 加裁剪编排**

顶部 import 加:
```ts
import { useReplaceMediaFile } from "@features/upload/api/mutations";
import { cropImageToBlob } from "@features/upload/lib/crop-image";
import { withCrop } from "@features/upload/lib/crop-url-fallback";
import { ImageCropper } from "@shared/ui/image-cropper/ImageCropper";
import { Crop as CropIcon } from "lucide-react";
import { Checkbox } from "@shared/ui/base/checkbox";  // 若无此组件,用 input type=checkbox
```

> `crop-url-fallback` 是笔误,应为 `@features/upload/lib/cropUrl`。

组件内 state(已有 `uploadOpen` 等附近)加:
```ts
const [cropFile, setCropFile] = useState<MediaFile | null>(null);
const [cropOpen, setCropOpen] = useState(false);
const [cropRect, setCropRect] = useState<CropRect | undefined>(undefined);
const [overwrite, setOverwrite] = useState(false);
const replaceMedia = useReplaceMediaFile();
```

需要 `useState`/`useRef` import(若未引入)。`CropRect` 从 `@features/upload/lib/cropUrl` import type。

给 `<MediaGrid onCrop={(f) => { setCropFile(f); setCropOpen(true); setOverwrite(false); setCropRect(undefined); }} />` 传回调。

新增裁剪 Modal(与上传 Modal 同级):
```tsx
<Modal
    open={cropOpen}
    onOpenChange={setCropOpen}
    title={cropFile ? `裁剪「${cropFile.original_name}」` : "裁剪"}
    size="md"
    footer={
        <div className="flex items-center justify-between">
            {/* 仅静态图显示覆盖选项;GIF 不重编码,覆盖无意义 */}
            {cropFile && !cropFile.mime_type.includes("gif") ? (
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                    覆盖原图
                </label>
            ) : <span />}
            <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setCropOpen(false)} disabled={replaceMedia.isPending}>取消</Button>
                <Button onClick={handleCropConfirm} disabled={!cropRect || replaceMedia.isPending}>
                    {replaceMedia.isPending ? "处理中..." : "确认"}
                </Button>
            </div>
        </div>
    }
>
    {cropFile ? (
        <ImageCropper src={cropFile.url} aspect={undefined} onChange={setCropRect} />
    ) : null}
</Modal>
```

确认处理函数:
```ts
const handleCropConfirm = async () => {
    if (!cropFile || !cropRect) return;
    const isGif = cropFile.mime_type.includes("gif");
    try {
        if (isGif) {
            // GIF 不重编码,只产生 ?crop= 引用(作为新素材 URL 存,或仅作引用)
            // 此处按「新建引用」处理:GIF 裁剪结果是一个带 ?crop 的 URL 字符串,
            // 素材库场景下没有自然的「回填」目标,弹个 toast 提示复制了裁剪 URL
            const url = withCrop(cropFile.url, cropRect);
            await navigator.clipboard?.writeText(url);
            toast.success("已复制裁剪后 URL(GIF 保留动画)");
            setCropOpen(false);
            return;
        }
        // 静态图:canvas 重编码
        const blob = await cropImageToBlob(cropFile.url, cropRect);
        const fileName = cropFile.original_name.replace(/\.[^.]+$/, "") || "cropped";
        const file = new File([blob], `${fileName}.webp`, { type: "image/webp" });
        if (overwrite) {
            await replaceMedia.mutateAsync({ fileId: cropFile.id, file });
            toast.success("已覆盖原图");
        } else {
            // 新建:走标准上传
            const result = await uploadFile(file);  // uploadFile 来自 useChunkedUpload({purpose:"material"})
            toast.success(`已上传新素材`);
        }
        queryClient.invalidateQueries({ queryKey: adminMediaKeys.lists() });
        setCropOpen(false);
    } catch (e) {
        toast.error(e instanceof Error ? e.message : "裁剪失败");
    }
};
```

> 需要在组件内 `const { uploadFile } = useChunkedUpload({ purpose: "material" });`(若未引入 `useChunkedUpload`)。

- [ ] **Step 4: 类型检查 + lint + format**

Run: `make web-typecheck && make web-lint && make web-format`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/src/features/admin-media/ui/MediaGrid.tsx web/src/routes/admin.media.tsx
git commit -m "feat(web): 素材库网格图片裁剪 icon + 覆盖接入

- MediaGrid 图片卡片 hover 出裁剪 icon(套用视频选帧模式)
- 裁剪弹窗含「覆盖原图」checkbox,仅静态图显示
- 覆盖走 useReplaceMediaFile,不勾走 useChunkedUpload 新建
- GIF 不显示覆盖选项,只复制 ?crop URL"
```

---

## Task V: 全量验证 + 收尾

- [ ] **Step 1: 后端全量测试 + lint**

Run: `make api-test && make api-lint`
Expected: PASS

- [ ] **Step 2: 前端全量测试 + typecheck + lint**

Run: `make web-test && make web-typecheck && make web-lint`
Expected: PASS

- [ ] **Step 3: 手动验证清单(若环境允许)**

启动 `make dev`,浏览器验证:
1. 个人中心换头像:静态图裁剪 → 上传 → 头像更新(无 ?crop);GIF 裁剪 → 头像 URL 含 ?crop 且动画保留(avatarUrl 已剥 format=webp)
2. 文章封面:选素材 → 裁剪 → 静态图重编码上传、GIF 存坐标;预览聚焦选区
3. 素材库:图片卡片 hover 出裁剪 icon → 裁剪 → 不勾覆盖 → 新素材出现;勾覆盖 → 原记录 url/size/hash 更新(refCount/owner 不变)
4. 素材库:非 owner 素材调 replace → 后端返回 403
5. 素材库 GIF 裁剪:无覆盖 checkbox,复制 ?crop URL

- [ ] **Step 4: 状态确认**

Run: `git status && git log --oneline -16`
Expected: 工作区干净,16 个 commit 按序

---

## Self-Review

**Spec 覆盖:**
- 3.1 cropUrl → F2 ✅
- 3.2 ImageCropper → F4 ✅;CroppedImage → F5 ✅;cropToStyle → F3 ✅
- 3.3 crop-image → F7 ✅;CropUploadDialog → F8 ✅
- 3.4 avatarUrl GIF → F6 ✅
- 3.5 AvatarUploader → F9 ✅;Cover → F10 ✅;MediaGrid 裁剪 icon → F12 ✅
- 3.6 /uploads/replace → B1(实体)+B2(service)+B3(handler/路由/openapi) ✅;前端 mutation → F11 ✅
- 秒传安全(file_hash 更新)→ B2 Step 4 sha256 + ReplaceStoredFile ✅
- owner 校验 → B2 Step 4 owner 检查 + B2 测试 ✅

**Placeholder 扫描:**
- F12 Step 3 提到 `Checkbox` 组件「若无用 input」,给了 fallback 具体方案
- F12 Step 2 `crop-url-fallback` 笔误已标注修正为 cropUrl
- B3 Step 4 OpenAPI helper 函数名「按实际命名调整」——给了定位命令,非 TBD
- B2 Step 2 `domainuploadResult` 别名引用已说明改法
- 无其他 TBD/TODO/未定义引用

**类型一致性:**
- `CropRect {x,y,w,h}` 全程一致 ✅
- `CropUploadResult {kind:"static"|"gif", url}` F8 定义,F9/F10 消费 ✅
- `ReplaceMediaFileInput {FileID,FileName,MimeType,Content}` B2 定义,B3 handler 消费 ✅
- `ReplaceMediaResult` F11 定义,与后端 FileDTO 字段对齐(url/thumbnail/mime_type/updated_at)✅
- `ReplaceStoredFile(path,url,size,mimeType,fileHash,width,height,thumbnail)` B1 定义,B2 调用签名一致 ✅

**已知 follow-up(不在本计划范围):**
1. 外部 `cover_image`/`avatar_url` 渲染点(PostCard/blog/CommentItem/AvatarGroup)替换 `CroppedImage`
2. 覆盖后旧物理文件的 GC
3. GIF 素材裁剪在素材库场景的回填语义(当前仅复制 URL,可能需要「另存为新引用」)
