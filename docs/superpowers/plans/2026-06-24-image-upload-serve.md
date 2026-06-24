# 图片上传与图片服务实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 DDD 分片上传链路上增加 WebP 同步转码,新增带二级缓存的动态图片服务,并接入前端头像上传;顺带修复分片上传的 IDOR(owner 校验缺失)。

**Architecture:** 渐进式改造现有架构。上传侧新增 `ImageProcessor` 端口插在 `CompleteUpload` 合并之后做转码;图片服务侧新增 `ImageTransformer`/`ImageCache` 端口 + 内存(golang-lru)+磁盘二级缓存 + singleflight 防击穿,替换裸 `http.FileServer`;前端新增 `features/upload` 跑通头像上传。所有图片处理走纯 Go(imaging + nativewebp),端口隔离便于未来切换 cgo libwebp。

**Tech Stack:** Go(imaging、HugoSmits86/nativewebp、hashicorp/golang-lru、golang.org/x/sync/singleflight、golang.org/x/image/webp) / React + TanStack Query + Zustand

**Spec:** `docs/superpowers/specs/2026-06-24-image-upload-serve-design.md`

---

## 文件结构

### 后端新增
| 文件 | 职责 |
|------|------|
| `api/internal/domain/upload/processor.go` | `ImageProcessor` 端口 + `ProcessResult` |
| `api/internal/infrastructure/image/processor.go` | `ImageProcessor` 实现(转码/校验/尺寸/缩略图) |
| `api/internal/domain/image/transformer.go` | `ImageTransformer` + `ImageCache` 端口 + `TransformParams` |
| `api/internal/application/image/service.go` | 图片服务用例编排(缓存 + singleflight) |
| `api/internal/infrastructure/image/transformer.go` | `ImageTransformer` 实现(resize/thumb/转码) |
| `api/internal/infrastructure/image/cache_mem.go` | golang-lru 内存缓存 |
| `api/internal/infrastructure/image/cache_disk.go` | 磁盘缓存(原子写) |
| `api/internal/interfaces/http/handler/image/image.go` | 图片服务 handler |
| `api/internal/app/image_container.go` | 图片服务容器装配 |
| `api/internal/infrastructure/image/processor_test.go` | 转码测试 |
| `api/internal/application/image/service_test.go` | 图片服务编排测试 |
| `api/testdata/*.{jpg,png,gif,webp}` | 固定测试图片样本 |

### 后端修改
| 文件 | 改动 |
|------|------|
| `api/internal/application/media/service.go` | UploadService 补 owner 校验 + 转码;新增 `processor` 字段 |
| `api/internal/interfaces/http/handler/media/media.go` | handler 透传 callerID |
| `api/internal/infrastructure/storage/local_storage.go` | ImageDimensions/GenerateThumbnail 保留(供 emoji),但 UploadService 改依赖 ImageProcessor |
| `api/internal/app/media_container.go` | 装配 ImageProcessor 注入 UploadService |
| `api/internal/infrastructure/persistence/gorm/file_repo.go` | FindByHash 加 owner 条件 |
| `api/internal/job/cleanup_job.go` | 新增 CleanImageCache |
| `api/cmd/server/main.go` | 注册图片服务路由(替换裸 FileServer);cleanup job 加图片缓存清理 |

### 前端新增
| 文件 | 职责 |
|------|------|
| `web/src/features/upload/api/queries.ts` | 上传 API 封装(init/chunk/complete) |
| `web/src/features/upload/lib/imageUrl.ts` | imageUrl(path, {w,h,thumb}) helper |
| `web/src/features/upload/lib/sha256.ts` | crypto.subtle 封装 |
| `web/src/features/upload/ui/AvatarUploader.tsx` | 头像上传组件 |

### 前端修改
| 文件 | 改动 |
|------|------|
| `web/src/routes/profile/index.tsx` | 替换 ComingSoon 为 AvatarUploader |

---

## Task 1: 修复分片上传 IDOR — owner 校验

**Files:**
- Modify: `api/internal/application/media/service.go:806,837,923,942`(SaveChunk/CompleteUpload/CancelUpload/GetUploadStatus)
- Modify: `api/internal/interfaces/http/handler/media/media.go:797,819,831,841`(透传 callerID)

**目标:** 给分片上传方法补 owner 校验,防止越权操作他人会话。

- [ ] **Step 1: 写 owner 校验的失败测试**

创建 `api/internal/application/media/upload_security_test.go`:

```go
package media

import (
	"context"
	"testing"
	"time"

	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
)

// ownerMismatchSessionRepo 假的 sessionRepo,FindByID 返回固定 owner 的会话
// 其余接口方法返回零值(编译需要,本测试不触达)
type ownerMismatchSessionRepo struct{ ownerID domainshared.ID }

func (m *ownerMismatchSessionRepo) FindByID(ctx context.Context, id domainshared.ID) (*domainupload.UploadSession, error) {
	zero := time.Time{}
	return domainupload.ReconstructUploadSession(
		id, m.ownerID, "f.jpg", 100, "image/jpeg", "hash", "avatar",
		100, 1, []int{}, domainupload.SessionActive, "/tmp/x", zero, zero, zero,
	), nil
}
func (m *ownerMismatchSessionRepo) FindByHash(ctx context.Context, hash string) (*domainupload.UploadSession, error) {
	return nil, nil
}
func (m *ownerMismatchSessionRepo) Save(ctx context.Context, s *domainupload.UploadSession) error { return nil }
func (m *ownerMismatchSessionRepo) UpdateStatus(ctx context.Context, id domainshared.ID, oldStatus, newStatus string) (bool, error) {
	return false, nil
}
func (m *ownerMismatchSessionRepo) AppendChunk(ctx context.Context, id domainshared.ID, index int) error { return nil }
func (m *ownerMismatchSessionRepo) Delete(ctx context.Context, id domainshared.ID) error                { return nil }
func (m *ownerMismatchSessionRepo) DeleteExpired(ctx context.Context) error                            { return nil }

var _ domainupload.UploadSessionRepository = (*ownerMismatchSessionRepo)(nil)
```

测试断言(注意:本 Task 阶段 `NewUploadService` 仍是 4 参数旧签名,processor 在 Task 6 才加入;此处暂传 nil 占位):

```go
func TestSaveChunk_RejectsNonOwner(t *testing.T) {
	ownerA := domainshared.NewID()
	ownerB := domainshared.NewID()
	repo := &ownerMismatchSessionRepo{ownerID: ownerA}
	svc := NewUploadService(nil, repo, nil, "/tmp") // Task1 阶段:4 参;Task6 改 5 参后此处补一个 nil
	err := svc.SaveChunk(context.Background(), "00000000-0000-0000-0000-000000000001", 0, []byte("x"), ownerB.String())
	if err == nil {
		t.Fatal("非 owner 应被拒绝")
	}
	if !domainshared.IsDomainError(err, domainshared.CodeForbidden) {
		t.Fatalf("应为 Forbidden,实际: %v", err)
	}
}
```

> **签名对齐说明:** Task 1 先只改 `SaveChunk/CancelUpload/GetUploadStatus/CompleteUpload` 的方法体与签名(加 callerID),`NewUploadService` 仍保持旧 4 参。Task 6 加 processor 时把构造函数改成 5 参,届时本测试改为 `NewUploadService(nil, repo, nil, nil, "/tmp")`(第 4 参补 nil processor)。
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd api && go test ./internal/application/media/ -run TestSaveChunk_RejectsNonOwner -v`
Expected: FAIL(SaveChunk 当前签名无 callerID 参数,编译失败)

- [ ] **Step 3: 给 SaveChunk/CancelUpload/GetUploadStatus 补 callerID 参数 + owner 校验**

修改 `service.go`。SaveChunk:

```go
// SaveChunk 保存单个分片
func (s *UploadService) SaveChunk(ctx context.Context, uploadID string, index int, data []byte, callerID string) error {
	sid, err := shared.ParseID(uploadID)
	if err != nil {
		return err
	}
	session, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return err
	}
	// owner 校验:防越权操作他人上传会话
	cid, err := shared.ParseID(callerID)
	if err != nil {
		return shared.BadRequest("无效的调用者 ID")
	}
	if !session.UserID().Equal(cid) {
		return shared.Forbidden("无权操作他人上传会话")
	}
	if session.Status() != domainupload.SessionActive {
		return domainupload.ErrSessionNotActive
	}
	if index < 0 || index >= session.TotalChunks() {
		return domainupload.ErrChunkIndexInvalid
	}
	if err := s.storage.SaveChunk(session.TmpPath(), index, data); err != nil {
		return shared.Internal("保存分片失败", err)
	}
	return s.sessionRepo.AppendChunk(ctx, sid, index)
}
```

CancelUpload:

```go
func (s *UploadService) CancelUpload(ctx context.Context, uploadID, callerID string) error {
	sid, err := shared.ParseID(uploadID)
	if err != nil {
		return err
	}
	session, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return err
	}
	cid, err := shared.ParseID(callerID)
	if err != nil {
		return shared.BadRequest("无效的调用者 ID")
	}
	if !session.UserID().Equal(cid) {
		return shared.Forbidden("无权操作他人上传会话")
	}
	if session.Status() != domainupload.SessionActive {
		return domainupload.ErrSessionNotActive
	}
	if session.TmpPath() != "" {
		_ = s.storage.CleanupDir(session.TmpPath())
	}
	return s.sessionRepo.Delete(ctx, sid)
}
```

GetUploadStatus:

```go
func (s *UploadService) GetUploadStatus(ctx context.Context, uploadID, callerID string) (*InitSessionResult, error) {
	sid, err := shared.ParseID(uploadID)
	if err != nil {
		return nil, err
	}
	session, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return nil, err
	}
	cid, err := shared.ParseID(callerID)
	if err != nil {
		return nil, shared.BadRequest("无效的调用者 ID")
	}
	if !session.UserID().Equal(cid) {
		return nil, shared.Forbidden("无权操作他人上传会话")
	}
	return &InitSessionResult{
		UploadID: sid.String(), ChunkSize: session.ChunkSize(),
		TotalChunks: session.TotalChunks(), UploadedChunks: session UploadedChunks(),
	}, nil
}
```

- [ ] **Step 4: CompleteUpload 补 owner 比对**

`CompleteUpload` 已有 `userID` 参数,在 FindByID 之后加:

```go
// owner 校验
if !session.UserID().Equal(uid) {
	return nil, shared.Forbidden("无权操作他人上传会话")
}
```

插入位置:`service.go` 的 CompleteUpload 中,`if !session.IsComplete()` 之前。

- [ ] **Step 5: handler 透传 callerID**

修改 `handler/media/media.go`:

```go
// SaveUploadChunk
func (h *Handler) SaveUploadChunk(w http.ResponseWriter, r *http.Request) {
	uploadID := r.PathValue("uploadId")
	userID := interfacesmw.GetUserIDFromContext(r) // 新增
	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32<<20)
	data, err := io.ReadAll(r.Body)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.uploadSvc.SaveChunk(r.Context(), uploadID, index, data, userID); err != nil { // 加 userID
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "分片已保存")
}

// CancelUpload
func (h *Handler) CancelUpload(w http.ResponseWriter, r *http.Request) {
	uploadID := r.PathValue("uploadId")
	userID := interfacesmw.GetUserIDFromContext(r) // 新增
	if err := h.uploadSvc.CancelUpload(r.Context(), uploadID, userID); err != nil { // 加 userID
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "上传已取消")
}

// GetUploadStatus
func (h *Handler) GetUploadStatus(w http.ResponseWriter, r *http.Request) {
	uploadID := r.PathValue("uploadId")
	userID := interfacesmw.GetUserIDFromContext(r) // 新增
	result, err := h.uploadSvc.GetUploadStatus(r.Context(), uploadID, userID); err != nil { // 加 userID
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, result)
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd api && go test ./internal/application/media/ -run TestSaveChunk_RejectsNonOwner -v`
Expected: PASS

- [ ] **Step 7: 运行全量编译 + vet**

Run: `cd api && go build ./... && go vet ./...`
Expected: 无错误

- [ ] **Step 8: 提交**

```bash
git add api/internal/application/media/ api/internal/interfaces/http/handler/media/
git commit -m "fix(upload): 分片上传补 owner 校验防 IDOR 越权"
```

---

## Task 2: 修复 UploadThumbnail 的 owner 校验 + safePath

**Files:**
- Modify: `api/internal/application/media/service.go:1065`(UploadThumbnail)
- Modify: `api/internal/interfaces/http/handler/media/media.go:725`(透传 callerID)

- [ ] **Step 1: 写 UploadThumbnail owner 校验测试**

在 `upload_security_test.go` 追加。先补一个 fakeFileRepo(`domainupload.FileRepository` 的假实现),FindByID 返回固定 owner 的 File:

```go
// fakeFileRepo 假的 fileRepo,FindByID 返回固定 owner 的 File
type fakeFileRepo struct{ ownerID domainshared.ID }

func (f *fakeFileRepo) FindByID(ctx context.Context, id domainshared.ID) (*domainupload.File, error) {
	fl, _ := domainupload.NewFile(id, f.ownerID, "avatar", "f.jpg", "/uploads/f.jpg", "/uploads/f.jpg", 10, "image/jpeg", "")
	return fl, nil
}
func (f *fakeFileRepo) FindByHash(ctx context.Context, hash string) (*domainupload.File, error) {
	return nil, nil
}
func (f *fakeFileRepo) FindByOwner(ctx context.Context, ownerID domainshared.ID, purpose string, page, limit int) ([]*domainupload.File, int64, error) {
	return nil, 0, nil
}
func (f *fakeFileRepo) Save(ctx context.Context, fl *domainupload.File) error   { return nil }
func (f *fakeFileRepo) Delete(ctx context.Context, id domainshared.ID) error    { return nil }
func (f *fakeFileRepo) UpdateRefCount(ctx context.Context, id domainshared.ID, delta int) error { return nil }

var _ domainupload.FileRepository = (*fakeFileRepo)(nil)

func TestUploadThumbnail_RejectsNonOwner(t *testing.T) {
	ownerA := domainshared.NewID()
	ownerB := domainshared.NewID()
	fileRepo := &fakeFileRepo{ownerID: ownerA}
	svc := NewUploadService(fileRepo, nil, nil, "/tmp")
	err := svc.UploadThumbnail(context.Background(), UploadThumbnailInput{
		FileID: "00000000-0000-0000-0000-000000000001",
		FileName: "t.jpg", MimeType: "image/jpeg", Content: []byte("x"),
	}, ownerB.String())
	if !domainshared.IsDomainError(err, domainshared.CodeForbidden) {
		t.Fatalf("非 owner 应被拒绝,实际: %v", err)
	}
}
```

> 注:`fakeFileRepo.FindByHash` 在 Task 1 阶段是 2 参数签名;Task 3 把端口改成 3 参数后,需同步把这里的 fake 签名改为 `FindByHash(ctx, hash, ownerID)`(Task 3 Step 会提醒)。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd api && go test ./internal/application/media/ -run TestUploadThumbnail_RejectsNonOwner -v`
Expected: FAIL(签名无 callerID)

- [ ] **Step 3: 改 UploadThumbnail:补 callerID + owner 校验 + 走 storage.SaveChunk 风格的 safePath**

修改 `service.go:1065`。当前签名 `UploadThumbnail(ctx, in)` 改为 `UploadThumbnail(ctx, in, callerID string)`,开头加:

```go
func (s *UploadService) UploadThumbnail(ctx context.Context, in UploadThumbnailInput, callerID string) (string, error) {
	fid, err := shared.ParseID(in.FileID)
	if err != nil {
		return "", err
	}
	cid, err := shared.ParseID(callerID)
	if err != nil {
		return "", shared.BadRequest("无效的调用者 ID")
	}
	f, err := s.fileRepo.FindByID(ctx, fid)
	if err != nil {
		return "", err
	}
	// owner 校验
	if !f.OwnerID().Equal(cid) {
		return "", shared.Forbidden("无权操作他人文件")
	}
	// ... 后续保留现有逻辑(落盘 + SetThumbnail + Save)
```

- [ ] **Step 4: handler 透传 callerID**

`handler/media/media.go` UploadThumbnail 调用处:

```go
userID := interfacesmw.GetUserIDFromContext(r)
url, err := h.uploadSvc.UploadThumbnail(r.Context(), appmedia.UploadThumbnailInput{
	FileID: id, FileName: header.Filename,
	MimeType: sniffedMIME, Content: content,
}, userID)
```

- [ ] **Step 5: 运行测试通过 + 编译**

Run: `cd api && go test ./internal/application/media/ -v && go build ./...`
Expected: PASS + 无编译错误

- [ ] **Step 6: 提交**

```bash
git add api/internal/application/media/ api/internal/interfaces/http/handler/media/
git commit -m "fix(upload): UploadThumbnail 补 owner 校验防越权覆盖他人缩略图"
```

---

## Task 3: 秒传查询限定 owner

**Files:**
- Modify: `api/internal/domain/upload/repository.go:12`(FileRepository.FindByHash 签名)
- Modify: `api/internal/infrastructure/persistence/gorm/file_repo.go`(FindByHash 实现)
- Modify: `api/internal/application/media/service.go:756`(InitSession 秒传)

- [ ] **Step 1: 改 FindByHash 端口签名,加 ownerID**

`repository.go:12`:

```go
type FileRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*File, error)
	// FindByHash 秒传检查:仅命中该 owner 自己上传过的文件
	FindByHash(ctx context.Context, hash string, ownerID shared.ID) (*File, error)
	// ... 其余不变
}
```

- [ ] **Step 2: 改 file_repo.go 实现**

```go
func (r *FileRepository) FindByHash(ctx context.Context, hash string, ownerID domainshared.ID) (*File, error) {
	var po model.File
	err := r.db.WithContext(ctx).
		Where("file_hash = ? AND owner_id = ?", hash, ownerID.UUID()).
		First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, upload.ErrFileNotFound
		}
		return nil, domainshared.Internal("查询文件失败", err)
	}
	return fileToDomain(&po)
}
```

- [ ] **Step 3: 改 InitSession 调用处**

`service.go:756`:

```go
if in.FileHash != "" {
	if f, err := s.fileRepo.FindByHash(ctx, in.FileHash, uid); err == nil && f != nil {
		return &InitSessionResult{Instant: true, FileID: f.ID().String(), URL: f.URL()}, nil
	}
}
```

- [ ] **Step 4: 同步更新测试中的 fake repo 签名**

端口 `FindByHash` 改成 3 参数后,Task 1/2 在 `upload_security_test.go` 里写的两个 fake(`ownerMismatchSessionRepo.FindByHash` 和 `fakeFileRepo.FindByHash`)签名需同步改成 3 参数,否则编译失败:

```go
// ownerMismatchSessionRepo.FindByHash
func (m *ownerMismatchSessionRepo) FindByHash(ctx context.Context, hash string, userID domainshared.ID) (*domainupload.UploadSession, error) {
	return nil, nil
}

// fakeFileRepo.FindByHash
func (f *fakeFileRepo) FindByHash(ctx context.Context, hash string, ownerID domainshared.ID) (*domainupload.File, error) {
	return nil, nil
}
```

- [ ] **Step 5: 编译 + vet + 全量测试**

Run: `cd api && go build ./... && go vet ./... && go test ./...`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
git add api/internal/domain/upload/ api/internal/infrastructure/persistence/gorm/ api/internal/application/media/
git commit -m "fix(upload): 秒传查询限定 owner,防越权秒传他人文件"
```

---

## Task 4: 新增 ImageProcessor 端口

**Files:**
- Create: `api/internal/domain/upload/processor.go`

- [ ] **Step 1: 定义端口**

```go
package upload

// ProcessResult 转码结果
type ProcessResult struct {
	Path     string // 最终落盘路径
	MimeType string // 可能从 image/jpeg 变成 image/webp
	Ext      string // 可能从 .jpg 变成 .webp
}

// ImageProcessor 图片处理端口(上传时转码/校验/尺寸/缩略图)
//
// domain 层定义端口,application 层依赖端口,infrastructure 层提供实现。
// 当前实现走纯 Go(imaging + nativewebp);未来可切换 cgo libwebp,只需替换实现。
type ImageProcessor interface {
	// Validate 校验图片有效性(magic bytes + 解码),返回真实 MIME
	Validate(path string) (mime string, err error)
	// Transcode 转 WebP;GIF/WebP 跳过,JPEG/PNG 解码后编码,
	// 仅当 WebP 更小才采用,否则回退原格式
	Transcode(srcPath, destDir, fileUUID string, srcMime string) (ProcessResult, error)
	// Dimensions 取宽高(非图片返回 0,0)
	Dimensions(path string) (w, h int)
	// Thumbnail 生成缩略图,返回 URL;不支持时返回空
	Thumbnail(srcPath, fileUUID, storageDir, mime string) string
}
```

- [ ] **Step 2: 编译确认**

Run: `cd api && go build ./internal/domain/upload/`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add api/internal/domain/upload/processor.go
git commit -m "feat(upload): 新增 ImageProcessor 端口(转码/校验/尺寸/缩略图)"
```

---

## Task 5: 实现 ImageProcessor(转码/校验)

**Files:**
- Create: `api/internal/infrastructure/image/processor.go`
- Create: `api/testdata/sample.jpg`, `sample.png`, `sample.gif`, `sample.webp`(可用小图)
- Test: `api/internal/infrastructure/image/processor_test.go`

- [ ] **Step 1: 准备测试图片样本**

Run:
```bash
mkdir -p api/testdata
# 用 Go 生成几张极小的测试图(避免二进制文件入库)
cat > api/testdata/gen.go <<'EOF'
//go:build ignore
package main
import (
	"os"
	"github.com/disintegration/imaging"
)
func main() {
	img := imaging.New(100, 80, imaging.Red)
	imaging.Save(img, "testdata/sample.jpg")
	imaging.Save(img, "testdata/sample.png")
	imaging.Save(img, "testdata/sample.gif")
	imaging.Save(img, "testdata/sample.webp")
	_ = os.MkdirAll("testdata", 0755)
}
EOF
cd api && go run testdata/gen.go && rm testdata/gen.go
```

- [ ] **Step 2: 写 Validate 测试**

```go
package image

import (
	"path/filepath"
	"testing"
)

func TestValidate_DetectsRealMIME(t *testing.T) {
	p := NewProcessor("uploads", "/uploads/")
	mime, err := p.Validate(filepath.Join("testdata", "sample.jpg"))
	if err != nil {
		t.Fatalf("校验失败: %v", err)
	}
	if mime != "image/jpeg" {
		t.Fatalf("期望 image/jpeg,实际 %s", mime)
	}
}

func TestValidate_RejectsCorrupt(t *testing.T) {
	// 写一个假的 jpg(非图片字节)
	tmp := filepath.Join(t.TempDir(), "fake.jpg")
	os.WriteFile(tmp, []byte("not an image"), 0644)
	p := NewProcessor("uploads", "/uploads/")
	_, err := p.Validate(tmp)
	if err == nil {
		t.Fatal("损坏文件应校验失败")
	}
}
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd api && go test ./internal/infrastructure/image/ -run TestValidate -v`
Expected: FAIL(NewProcessor 未定义)

- [ ] **Step 4: 实现 Processor(Validate + Dimensions)**

```go
package image

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/google/uuid"
	domainupload "blog-api/internal/domain/upload"
)

// Processor 图片处理实现(imaging + nativewebp)
type Processor struct {
	uploadDir string
	urlPrefix string
}

// NewProcessor 创建图片处理器
func NewProcessor(uploadDir, urlPrefix string) *Processor {
	return &Processor{uploadDir: uploadDir, urlPrefix: urlPrefix}
}

// 编译期断言
var _ domainupload.ImageProcessor = (*Processor)(nil)

// Validate 校验图片:magic bytes + 真正解码
func (p *Processor) Validate(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("读取文件失败: %w", err)
	}
	mime := http.DetectContentType(data)
	if !strings.HasPrefix(mime, "image/") {
		return "", fmt.Errorf("非图片文件,检测到 %s", mime)
	}
	// 真正解码验证(防改扩展名的损坏文件)
	if _, err := imaging.Open(path); err != nil {
		return "", fmt.Errorf("解码失败: %w", err)
	}
	return mime, nil
}

// Dimensions 取宽高
func (p *Processor) Dimensions(path string) (int, int) {
	img, err := imaging.Open(path)
	if err != nil {
		return 0, 0
	}
	b := img.Bounds()
	return b.Dx(), b.Dy()
}
```

- [ ] **Step 5: 运行 Validate 测试通过**

Run: `cd api && go test ./internal/infrastructure/image/ -run TestValidate -v`
Expected: PASS

- [ ] **Step 6: 写 Transcode 测试**

```go
func TestTranscode_PNGToWebP(t *testing.T) {
	p := NewProcessor(t.TempDir(), "/uploads/")
	res, err := p.Transcode(
		filepath.Join("testdata", "sample.png"),
		t.TempDir(), uuid.New().String(), "image/png",
	)
	if err != nil {
		t.Fatalf("转码失败: %v", err)
	}
	// PNG 转出的 WebP 应更小或回退;总之应为合法图片
	if res.Path == "" {
		t.Fatal("转码结果路径为空")
	}
}
```

- [ ] **Step 7: 实现 Transcode**

```go
import (
	// 追加
	"bytes"
	webp "github.com/HugoSmits86/nativewebp"
)

// Transcode 转 WebP;GIF/WebP 跳过,JPEG/PNG 解码后编码,仅当 WebP 更小才采用
func (p *Processor) Transcode(srcPath, destDir, fileUUID, srcMime string) (domainupload.ProcessResult, error) {
	srcData, err := os.ReadFile(srcPath)
	if err != nil {
		return domainupload.ProcessResult{}, fmt.Errorf("读取源文件失败: %w", err)
	}
	// GIF/WebP 原样保留
	if srcMime == "image/gif" || srcMime == "image/webp" {
		ext := extFromMime(srcMime)
		dst := filepath.Join(destDir, fileUUID+ext)
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			return domainupload.ProcessResult{}, err
		}
		if err := os.WriteFile(dst, srcData, 0o644); err != nil {
			return domainupload.ProcessResult{}, err
		}
		return domainupload.ProcessResult{Path: dst, MimeType: srcMime, Ext: ext}, nil
	}
	// JPEG/PNG → 解码 → WebP encode
	img, err := imaging.Open(srcPath)
	if err != nil {
		return domainupload.ProcessResult{}, fmt.Errorf("解码失败: %w", err)
	}
	var webpBuf bytes.Buffer
	if err := webp.Encode(&webpBuf, img, nil); err != nil {
		return domainupload.ProcessResult{}, fmt.Errorf("WebP 编码失败: %w", err)
	}
	dst := filepath.Join(destDir, fileUUID+".webp")
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return domainupload.ProcessResult{}, err
	}
	// 仅当 WebP 更小才采用,否则回退原格式
	if webpBuf.Len() < len(srcData) {
		if err := os.WriteFile(dst, webpBuf.Bytes(), 0o644); err != nil {
			return domainupload.ProcessResult{}, err
		}
		return domainupload.ProcessResult{Path: dst, MimeType: "image/webp", Ext: ".webp"}, nil
	}
	// 回退原格式
	ext := extFromMime(srcMime)
	origDst := filepath.Join(destDir, fileUUID+ext)
	if err := os.WriteFile(origDst, srcData, 0o644); err != nil {
		return domainupload.ProcessResult{}, err
	}
	return domainupload.ProcessResult{Path: origDst, MimeType: srcMime, Ext: ext}, nil
}

func extFromMime(mime string) string {
	switch mime {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	default:
		return ".bin"
	}
}
```

- [ ] **Step 8: 实现 Thumbnail(迁移现有逻辑)**

```go
// Thumbnail 生成缩略图(图片用 imaging,最大宽 300px,JPEG 80%)
func (p *Processor) Thumbnail(srcPath, fileUUID, storageDir, mime string) string {
	if !strings.HasPrefix(mime, "image/") {
		return ""
	}
	img, err := imaging.Open(srcPath)
	if err != nil {
		return ""
	}
	thumb := imaging.Resize(img, 300, 0, imaging.Lanczos)
	thumbName := fileUUID + "_thumb.jpg"
	thumbDir := filepath.Join(p.uploadDir, storageDir)
	thumbPath := filepath.Join(thumbDir, thumbName)
	if err := os.MkdirAll(thumbDir, 0o755); err != nil {
		return ""
	}
	if err := imaging.Save(thumb, thumbPath, imaging.JPEGQuality(80)); err != nil {
		return ""
	}
	return p.urlPrefix + storageDir + "/" + thumbName
}
```

- [ ] **Step 9: 运行全部 image 测试**

Run: `cd api && go test ./internal/infrastructure/image/ -v`
Expected: 全部 PASS

- [ ] **Step 10: 提交**

```bash
git add api/internal/infrastructure/image/ api/testdata/
git commit -m "feat(image): 实现 ImageProcessor(转码 WebP/校验/尺寸/缩略图)"
```

---

## Task 6: CompleteUpload 接入转码

**Files:**
- Modify: `api/internal/application/media/service.go`(UploadService 加 processor 字段 + CompleteUpload 改造)
- Modify: `api/internal/app/media_container.go`(装配 processor)

- [ ] **Step 1: UploadService 加 processor 字段**

```go
type UploadService struct {
	fileRepo    domainupload.FileRepository
	sessionRepo domainupload.UploadSessionRepository
	storage     domainupload.ChunkStorage
	processor   domainupload.ImageProcessor // 新增
	chunkDir    string
}

func NewUploadService(fileRepo domainupload.FileRepository, sessionRepo domainupload.UploadSessionRepository, storage domainupload.ChunkStorage, processor domainupload.ImageProcessor, chunkDir string) *UploadService {
	return &UploadService{fileRepo: fileRepo, sessionRepo: sessionRepo, storage: storage, processor: processor, chunkDir: chunkDir}
}
```

- [ ] **Step 2: 改造 CompleteUpload,合并后插入校验 + 转码**

在现有 `MergeChunks` 之后、`BuildPath` 之前插入。完整改造后的核心段:

```go
	// 合并分片
	mergedPath := filepath.Join(session.TmpPath(), "merged")
	if err := s.storage.MergeChunks(session.TmpPath(), session.TotalChunks(), mergedPath); err != nil {
		_, _ = s.sessionRepo.UpdateStatus(ctx, sid, domainupload.SessionMerging, domainupload.SessionActive)
		return nil, shared.Internal("合并分片失败", err)
	}

	// === 新增:校验 + 转码(仅图片)===
	srcMime := session.MimeType()
	finalMime := srcMime
	finalExt := strings.ToLower(filepath.Ext(session.FileName()))
	if strings.HasPrefix(srcMime, "image/") {
		// 校验(magic bytes + 解码),非图片或损坏拒绝
		validMime, err := s.processor.Validate(mergedPath)
		if err != nil {
			_ = s.storage.CleanupDir(session.TmpPath())
			return nil, shared.BadRequest("图片校验失败: " + err.Error())
		}
		srcMime = validMime
		// 转 WebP
		result, err := s.processor.Transcode(mergedPath, filepath.Dir(mergedPath), "transcoded", srcMime)
		if err != nil {
			_ = s.storage.CleanupDir(session.TmpPath())
			return nil, shared.Internal("图片转码失败", err)
		}
		mergedPath = result.Path // 转码后的路径
		finalMime = result.MimeType
		finalExt = result.Ext
	}

	// 最终路径(用转码后的 ext)
	fileUUID := shared.NewID()
	finalPath, fileURL, err := s.storage.BuildPath(session.Purpose(), finalMime, fileUUID.String(), finalExt)
	if err != nil {
		return nil, shared.BadRequest("非法的上传用途路径: " + err.Error())
	}
	if err := s.storage.EnsureDir(filepath.Dir(finalPath)); err != nil {
		return nil, shared.Internal("创建文件目录失败", err)
	}
	if err := s.storage.Move(mergedPath, finalPath); err != nil {
		return nil, shared.Internal("移动文件失败", err)
	}
	fileSize, err := s.storage.FileSize(finalPath)
	if err != nil {
		fileSize = session.FileSize()
	}

	// 尺寸 + 缩略图(用 processor)
	width, height := 0, 0
	storageDir := session.Purpose()
	if storageDir == "material" {
		storageDir = filepath.Join(storageDir, mimeToCategory(finalMime))
	}
	if strings.HasPrefix(finalMime, "image/") {
		width, height = s.processor.Dimensions(finalPath)
	}
	thumbnail := s.processor.Thumbnail(finalPath, fileUUID.String(), storageDir, finalMime)

	// File 记录(用转码后的 mime)
	f, err := domainupload.NewFile(fileUUID, uid, session.Purpose(), session.FileName(), finalPath, fileURL, fileSize, finalMime, session.FileHash())
	// ... 后续不变
```

> 注意:`mimeToCategory` 已存在于 service.go,直接复用。

- [ ] **Step 3: 装配 processor 注入**

`media_container.go`:

```go
import (
	// 追加
	infrapimage "blog-api/internal/infrastructure/image"
)

func NewMediaContainer(db *gorm.DB, emojiDir, chunkDir, uploadDir, urlPrefix string) *MediaContainer {
	// ... 现有
	processor := infrapimage.NewProcessor(uploadDir, urlPrefix) // 新增
	uploadSvc := appmedia.NewUploadService(fileRepo, sessionRepo, localStorage, processor, chunkDir) // 加 processor
	// ...
}
```

- [ ] **Step 4: 同步更新测试中的 NewUploadService 调用**

`NewUploadService` 从 4 参数变成 5 参数后,Task 1/2 在 `upload_security_test.go` 里写的两个调用需补 nil processor,否则编译失败:

```go
// Task 1 的 TestSaveChunk_RejectsNonOwner
svc := NewUploadService(nil, repo, nil, nil, "/tmp") // 第 4 参补 nil processor

// Task 2 的 TestUploadThumbnail_RejectsNonOwner
svc := NewUploadService(fileRepo, nil, nil, nil, "/tmp") // 第 4 参补 nil processor
```

- [ ] **Step 5: 编译 + 全量测试**

Run: `cd api && go build ./... && go vet ./... && go test ./...`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
git add api/internal/application/media/ api/internal/app/media_container.go
git commit -m "feat(upload): CompleteUpload 接入图片校验 + WebP 转码"
```

---

## Task 7: 图片服务领域端口(ImageTransformer/ImageCache)

**Files:**
- Create: `api/internal/domain/image/transformer.go`

- [ ] **Step 1: 定义端口**

```go
package image

import "fmt"

// TransformParams 动态处理参数
type TransformParams struct {
	Width   int
	Height  int
	ThumbW  int
	ThumbH  int
	Rotate  int    // 0|90|180|270
	Format  string // jpeg|png|webp
	Quality int    // 1-100
}

// Key 返回用于缓存 key 的参数序列化
// 统一定义在 domain 层,application/infrastructure 共用,消除重复
func (p TransformParams) Key() string {
	return fmt.Sprintf("w%d_h%d_tw%d_th%d_r%d_%s_q%d",
		p.Width, p.Height, p.ThumbW, p.ThumbH, p.Rotate, p.Format, p.Quality)
}

// TransformResult 处理结果
type TransformResult struct {
	Bytes    []byte
	MimeType string
	ETag     string
}

// ImageTransformer 图片动态处理端口
type ImageTransformer interface {
	// Transform 按参数处理图片;源文件不存在/解码失败返回 error
	Transform(srcPath string, params TransformParams) (TransformResult, error)
}

// ImageCache 图片处理结果缓存端口
type ImageCache interface {
	// Get 按 key 取缓存;未命中返回零值(Bytes 为 nil), nil
	Get(key string) (TransformResult, error)
	// Set 写入缓存
	Set(key string, result TransformResult) error
}
```

- [ ] **Step 2: 编译**

Run: `cd api && go build ./internal/domain/image/`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add api/internal/domain/image/transformer.go
git commit -m "feat(image): 新增 ImageTransformer/ImageCache 端口"
```

---

## Task 8: 实现 ImageTransformer(resize/thumb/转码)

**Files:**
- Create: `api/internal/infrastructure/image/transformer.go`
- Test: `api/internal/infrastructure/image/transformer_test.go`

- [ ] **Step 1: 写 resize 测试**

```go
func TestTransform_Resize(t *testing.T) {
	tr := NewTransformer()
	res, err := tr.Transform(filepath.Join("testdata", "sample.jpg"),
		imagepkg.TransformParams{Width: 50, Format: "jpeg", Quality: 80})
	if err != nil {
		t.Fatalf("处理失败: %v", err)
	}
	if len(res.Bytes) == 0 {
		t.Fatal("结果为空")
	}
	if res.MimeType != "image/jpeg" {
		t.Fatalf("期望 image/jpeg,实际 %s", res.MimeType)
	}
	// 验证确实缩小了
	out := bytes.NewReader(res.Bytes)
	img, _ := imaging.Decode(out)
	if img.Bounds().Dx() != 50 {
		t.Fatalf("期望宽 50,实际 %d", img.Bounds().Dx())
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd api && go test ./internal/infrastructure/image/ -run TestTransform_Resize -v`
Expected: FAIL

- [ ] **Step 3: 实现 Transformer**

```go
package image

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/gif"  // register gif decode
	_ "image/jpeg" // register jpeg decode
	_ "image/png"  // register png decode
	"strconv"

	"github.com/disintegration/imaging"
	webp "github.com/HugoSmits86/nativewebp"
	"golang.org/x/image/webp" // webp decode register

	domainimage "blog-api/internal/domain/image"
)

// Transformer 图片动态处理实现
type Transformer struct{}

func NewTransformer() *Transformer { return &Transformer{} }

var _ domainimage.ImageTransformer = (*Transformer)(nil)

// 处理顺序:decode → rotate → resize → thumbnail → encode
func (t *Transformer) Transform(srcPath string, params domainimage.TransformParams) (domainimage.TransformResult, error) {
	img, err := imaging.Open(srcPath)
	if err != nil {
		return domainimage.TransformResult{}, fmt.Errorf("解码失败: %w", err)
	}
	// rotate
	switch params.Rotate {
	case 90:
		img = imaging.Rotate90(img)
	case 180:
		img = imaging.Rotate180(img)
	case 270:
		img = imaging.Rotate270(img)
	}
	// resize(保比例,只缩不放)
	if params.Width > 0 || params.Height > 0 {
		w, h := params.Width, params.Height
		if w <= 0 {
			w = img.Bounds().Dx()
		}
		if h <= 0 {
			h = img.Bounds().Dy()
		}
		if img.Bounds().Dx() > w || img.Bounds().Dy() > h {
			img = imaging.Fit(img, w, h, imaging.Lanczos)
		}
	}
	// thumbnail(强制裁剪到精确尺寸)
	if params.ThumbW > 0 && params.ThumbH > 0 {
		img = imaging.Fill(img, params.ThumbW, params.ThumbH, imaging.Center, imaging.Lanczos)
	}
	// encode
	format := params.Format
	if format == "" {
		format = "jpeg"
	}
	var buf bytes.Buffer
	mime := "image/jpeg"
	switch format {
	case "webp":
		if err := webp.Encode(&buf, img, nil); err != nil {
			return domainimage.TransformResult{}, err
		}
		mime = "image/webp"
	case "png":
		if err := imaging.Encode(&buf, img, imaging.PNG); err != nil {
			return domainimage.TransformResult{}, err
		}
		mime = "image/png"
	default: // jpeg
		q := params.Quality
		if q <= 0 {
			q = 80
		}
		if err := imaging.Encode(&buf, img, imaging.JPEG, imaging.JPEGQuality(q)); err != nil {
			return domainimage.TransformResult{}, err
		}
		mime = "image/jpeg"
	}
	// ETag = sha256 前 16 字节
	sum := sha256.Sum256(buf.Bytes())
	etag := hex.EncodeToString(sum[:16])
	return domainimage.TransformResult{Bytes: buf.Bytes(), MimeType: mime, ETag: etag}, nil
}
```

> 注意:`uuid` import 未使用,实际编码时删掉。`params.Key()` 在 Task 7 已定义于 domain 层,此处 transformer 不需要单独的 ParamsKey 函数。

- [ ] **Step 4: 运行测试通过**

Run: `cd api && go test ./internal/infrastructure/image/ -run TestTransform -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add api/internal/infrastructure/image/
git commit -m "feat(image): 实现 ImageTransformer(resize/thumb/rotate/转码)"
```

---

## Task 9: 实现二级缓存(内存 + 磁盘)

**Files:**
- Create: `api/internal/infrastructure/image/cache_mem.go`
- Create: `api/internal/infrastructure/image/cache_disk.go`
- Test: `api/internal/infrastructure/image/cache_test.go`

- [ ] **Step 1: 写缓存命中测试**

```go
func TestCacheMem_SetGet(t *testing.T) {
	c := NewMemoryCache(100, 300*time.Second)
	key := "k1"
	val := TransformResult{Bytes: []byte("data"), MimeType: "image/jpeg", ETag: "abc"}
	_ = c.Set(key, val)
	got, err := c.Get(key)
	if err != nil || got.ETag != "abc" {
		t.Fatalf("缓存未命中: %v %v", got, err)
	}
}
```

- [ ] **Step 2: 实现内存缓存(golang-lru + TTI)**

```go
package image

import (
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"
	domainimage "blog-api/internal/domain/image"
)

type memEntry struct {
	result  domainimage.TransformResult
	expires time.Time
}

// MemoryCache 内存 LRU + TTI
type MemoryCache struct {
	cache *lru.Cache[string, memEntry]
	ttl   time.Duration
	mu    sync.Mutex
}

func NewMemoryCache(size int, ttl time.Duration) *MemoryCache {
	c, _ := lru.New[string, memEntry](size)
	return &MemoryCache{cache: c, ttl: ttl}
}

func (m *MemoryCache) Get(key string) (domainimage.TransformResult, error) {
	e, ok := m.cache.Get(key)
	if !ok || time.Now().After(e.expires) {
		return domainimage.TransformResult{}, nil
	}
	return e.result, nil
}

func (m *MemoryCache) Set(key string, result domainimage.TransformResult) error {
	m.cache.Add(key, memEntry{result: result, expires: time.Now().Add(m.ttl)})
	return nil
}

var _ domainimage.ImageCache = (*MemoryCache)(nil)
```

- [ ] **Step 3: 实现磁盘缓存**

```go
package image

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"

	domainimage "blog-api/internal/domain/image"
)

type DiskCache struct {
	dir string
}

func NewDiskCache(dir string) *DiskCache {
	return &DiskCache{dir: dir}
}

func extFromMimeGlobal(mime string) string {
	switch mime {
	case "image/webp":
		return ".webp"
	case "image/png":
		return ".png"
	default:
		return ".jpg"
	}
}

func (d *DiskCache) path(key string, mime string) string {
	sum := sha256.Sum256([]byte(key))
	return filepath.Join(d.dir, hex.EncodeToString(sum[:])+extFromMimeGlobal(mime))
}

func (d *DiskCache) Get(key string) (domainimage.TransformResult, error) {
	// 不知 mime,尝试常见扩展
	for _, ext := range []string{".webp", ".jpg", ".png"} {
		sum := sha256.Sum256([]byte(key))
		p := filepath.Join(d.dir, hex.EncodeToString(sum[:])+ext)
		if data, err := os.ReadFile(p); err == nil {
			etag := sha256.Sum256(data)
			mime := "image/jpeg"
			if ext == ".webp" {
				mime = "image/webp"
			} else if ext == ".png" {
				mime = "image/png"
			}
			return domainimage.TransformResult{Bytes: data, MimeType: mime, ETag: hex.EncodeToString(etag[:16])}, nil
		}
	}
	return domainimage.TransformResult{}, nil
}

func (d *DiskCache) Set(key string, result domainimage.TransformResult) error {
	if err := os.MkdirAll(d.dir, 0o755); err != nil {
		return err
	}
	final := d.path(key, result.MimeType)
	tmp := final + ".tmp"
	if err := os.WriteFile(tmp, result.Bytes, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, final) // 原子写
}

var _ domainimage.ImageCache = (*DiskCache)(nil)
```

- [ ] **Step 4: 运行缓存测试 + 编译**

Run: `cd api && go test ./internal/infrastructure/image/ -v && go build ./...`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add api/internal/infrastructure/image/
git commit -m "feat(image): 实现二级缓存(golang-lru 内存 + 磁盘原子写)"
```

---

## Task 10: 图片服务用例(Service + singleflight)

**Files:**
- Create: `api/internal/application/image/service.go`
- Test: `api/internal/application/image/service_test.go`

- [ ] **Step 1: 写 Service 编排测试(缓存命中跳过 transform)**

`Serve` 返回 `(TransformResult, error)`;命中缓存时 `TransformResult.Bytes != nil`,未命中处理后返回。无参数时 handler 自行直传原图,不进 Serve。本测试用 fake 实现断言:缓存命中时不调用 transformer。

```go
package image

import (
	"context"
	"testing"

	domainimage "blog-api/internal/domain/image"
)

// fakeTransformer 记录调用次数,便于断言缓存命中时是否被跳过
type fakeTransformer struct {
	calls int
}

func (f *fakeTransformer) Transform(srcPath string, params domainimage.TransformParams) (domainimage.TransformResult, error) {
	f.calls++
	return domainimage.TransformResult{Bytes: []byte("fresh"), MimeType: "image/jpeg"}, nil
}

// fakeCache 可预填数据,模拟命中
type fakeCache struct {
	store map[string]domainimage.TransformResult
}

func (f *fakeCache) Get(key string) (domainimage.TransformResult, error) {
	if v, ok := f.store[key]; ok {
		return v, nil
	}
	return domainimage.TransformResult{}, nil
}
func (f *fakeCache) Set(key string, result domainimage.TransformResult) error {
	f.store[key] = result
	return nil
}

// _ = context 用于占位(实际 Serve 不需 context,此处保持 import 不报 unused)
var _ = context.Background

func TestService_CacheHitSkipsTransform(t *testing.T) {
	tr := &fakeTransformer{}
	// 预填一个缓存项:利用 Serve 内部 cacheKey 算法,但测试可直接断言行为
	// 这里先验证未命中场景:应调用 transformer 并回填缓存
	cache := &fakeCache{store: map[string]domainimage.TransformResult{}}
	svc := NewService(tr, cache, "uploads")
	res, err := svc.Serve("/uploads/sample.jpg", domainimage.TransformParams{Width: 50, Format: "jpeg"})
	if err != nil {
		t.Fatalf("Serve 失败: %v", err)
	}
	if tr.calls != 1 {
		t.Fatalf("未命中应调用 1 次 transform,实际 %d", tr.calls)
	}
	if string(res.Bytes) != "fresh" {
		t.Fatal("应返回 transform 结果")
	}
	// 再次调用:缓存应命中,transform 不再被调用
	res2, err := svc.Serve("/uploads/sample.jpg", domainimage.TransformParams{Width: 50, Format: "jpeg"})
	if err != nil || tr.calls != 1 {
		t.Fatalf("第二次应命中缓存,transform 调用 %d", tr.calls)
	}
	if string(res2.Bytes) != "fresh" {
		t.Fatal("应返回缓存内容")
	}
}
```

- [ ] **Step 2: 实现 Service**

> 设计决策:`Serve` 返回 `(TransformResult, error)` 两值。是否直传原图由 handler 判断(无参数时不调 Serve),保持 Serve 职责单一(只负责"有参数"的处理)。缓存命中用 `TransformResult.Bytes != nil` 区分。

```go
package image

import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"strings"

	"golang.org/x/sync/singleflight"

	domainimage "blog-api/internal/domain/image"
)

type Service struct {
	transformer domainimage.ImageTransformer
	cache       domainimage.ImageCache
	uploadDir   string
	group       singleflight.Group
}

func NewService(transformer domainimage.ImageTransformer, cache domainimage.ImageCache, uploadDir string) *Service {
	return &Service{transformer: transformer, cache: cache, uploadDir: uploadDir}
}

// Serve 处理一次带参数的图片请求(无参数场景由 handler 直传原图,不调用本方法)
func (s *Service) Serve(relPath string, params domainimage.TransformParams) (domainimage.TransformResult, error) {
	// 物理路径
	srcPath := filepath.Join(s.uploadDir, strings.TrimPrefix(relPath, "/uploads"))
	// 缓存 key = sha256(path + params.Key())
	cacheKey := cacheKey(srcPath, params)
	// 一级缓存查找
	if cached, _ := s.cache.Get(cacheKey); cached.Bytes != nil {
		return cached, nil
	}
	// singleflight 防击穿:同 key 并发只处理一次
	v, err, _ := s.group.Do(cacheKey, func() (any, error) {
		// 二次查缓存(singleflight 内可能已被并发请求填充)
		if cached, _ := s.cache.Get(cacheKey); cached.Bytes != nil {
			return cached, nil
		}
		result, err := s.transformer.Transform(srcPath, params)
		if err != nil {
			return nil, err
		}
		_ = s.cache.Set(cacheKey, result)
		return result, nil
	})
	if err != nil {
		return domainimage.TransformResult{}, err
	}
	return v.(domainimage.TransformResult), nil
}

// cacheKey 缓存键 = sha256(物理路径 + 参数序列化)
// params.Key() 定义在 domain 层(Task 7),application 与 infrastructure 共用,消除重复
func cacheKey(srcPath string, params domainimage.TransformParams) string {
	h := sha256.New()
	h.Write([]byte(srcPath))
	h.Write([]byte(params.Key()))
	return hex.EncodeToString(h.Sum(nil))
}
```

- [ ] **Step 3: 运行测试 + 编译**

Run: `cd api && go test ./internal/application/image/ -v && go build ./...`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add api/internal/application/image/
git commit -m "feat(image): 图片服务用例编排(缓存 + singleflight 防击穿)"
```

---

## Task 11: 图片服务 handler + 路由注册

**Files:**
- Create: `api/internal/interfaces/http/handler/image/image.go`
- Create: `api/internal/app/image_container.go`
- Modify: `api/cmd/server/main.go:438-442`(替换裸 FileServer)

- [ ] **Step 1: 实现 handler**

```go
package image

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	appimage "blog-api/internal/application/image"
	domainimage "blog-api/internal/domain/image"
	"blog-api/internal/interfaces/http/response"
)

type Handler struct {
	svc       *appimage.Service
	uploadDir string
}

func NewHandler(svc *appimage.Service, uploadDir string) *Handler {
	return &Handler{svc: svc, uploadDir: uploadDir}
}

// ServeImage GET /uploads/{path}
func (h *Handler) ServeImage(w http.ResponseWriter, r *http.Request) {
	relPath := r.URL.Path // /uploads/xxx
	// 路径安全:拒 ../\0/绝对路径/.cache
	if strings.Contains(relPath, "..") || strings.Contains(relPath, "\x00") {
		response.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "非法路径"})
		return
	}
	params, hasParams, err := parseParams(r)
	if err != nil {
		response.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	// 无参数:直传原图
	if !hasParams {
		h.serveOriginal(w, r, relPath)
		return
	}
	// 处理
	result, ok, err := h.svc.Serve(relPath, params)
	if err != nil {
		// 解码失败 422,不降级
		response.WriteJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "图片处理失败"})
		return
	}
	if !ok {
		h.serveOriginal(w, r, relPath)
		return
	}
	// ETag / 304
	etag := `"` + result.ETag + `"`
	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Type", result.MimeType)
	w.Header().Set("ETag", etag)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Write(result.Bytes)
}

func (h *Handler) serveOriginal(w http.ResponseWriter, r *http.Request, relPath string) {
	abs := filepath.Join(h.uploadDir, strings.TrimPrefix(relPath, "/uploads"))
	clean, err := filepath.Abs(filepath.Clean(abs))
	if err != nil || !strings.HasPrefix(clean, h.uploadDir) {
		response.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeFile(w, r, clean)
}

// parseParams 解析 query 参数,返回 params + 是否有处理参数
func parseParams(r *http.Request) (domainimage.TransformParams, bool, error) {
	p := domainimage.TransformParams{}
	hasParams := false
	q := r.URL.Query()
	if v := q.Get("w"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 4096 {
			return p, false, fmt.Errorf("w 参数无效")
		}
		p.Width = n
		hasParams = true
	}
	if v := q.Get("h"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 4096 {
			return p, false, fmt.Errorf("h 参数无效")
		}
		p.Height = n
		hasParams = true
	}
	if v := q.Get("format"); v != "" {
		if v != "jpeg" && v != "png" && v != "webp" {
			return p, false, fmt.Errorf("format 参数无效")
		}
		p.Format = v
		hasParams = true
	}
	if v := q.Get("quality"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 100 {
			return p, false, fmt.Errorf("quality 参数无效")
		}
		p.Quality = n
	}
	if v := q.Get("rotate"); v != "" {
		switch v {
		case "0", "90", "180", "270":
			p.Rotate, _ = strconv.Atoi(v)
			hasParams = true
		default:
			return p, false, fmt.Errorf("rotate 参数无效")
		}
	}
	if v := q.Get("thumb"); v != "" {
		parts := strings.SplitN(v, "x", 2)
		if len(parts) != 2 {
			return p, false, fmt.Errorf("thumb 参数无效")
		}
		tw, err1 := strconv.Atoi(parts[0])
		th, err2 := strconv.Atoi(parts[1])
		if err1 != nil || err2 != nil || tw <= 0 || th <= 0 || tw*th > 25000000 {
			return p, false, fmt.Errorf("thumb 参数无效")
		}
		p.ThumbW = tw
		p.ThumbH = th
		hasParams = true
	}
	return p, hasParams, nil
}
```

> 注:`fmt` import 需在文件头追加。

- [ ] **Step 2: 实现 image_container.go**

```go
package app

import (
	"path/filepath"

	appimage "blog-api/internal/application/image"
	infrapimage "blog-api/internal/infrastructure/image"
	imagehttp "blog-api/internal/interfaces/http/handler/image"
)

type ImageContainer struct {
	ImageHandler *imagehttp.Handler
}

func NewImageContainer(uploadDir string) *ImageContainer {
	transformer := infrapimage.NewTransformer()
	memCache := infrapimage.NewMemoryCache(100, 300_000_000_000) // 300s
	diskCache := infrapimage.NewDiskCache(filepath.Join(uploadDir, ".cache"))
	// 组合缓存:先内存后磁盘
	composite := infrapimage.NewCompositeCache(memCache, diskCache)
	svc := appimage.NewService(transformer, composite, uploadDir)
	return &ImageContainer{ImageHandler: imagehttp.NewHandler(svc, uploadDir)}
}
```

> `NewCompositeCache` 见 Task 9 补充(组合两层缓存,Get 先内存后磁盘,Set 先磁盘后内存)。若 Task 9 未含,在此 Task 补一个 `composite.go`。

- [ ] **Step 3: 补 CompositeCache**

`api/internal/infrastructure/image/composite.go`:

```go
package image

import domainimage "blog-api/internal/domain/image"

// CompositeCache 组合内存 + 磁盘缓存
type CompositeCache struct {
	mem  *MemoryCache
	disk *DiskCache
}

func NewCompositeCache(mem *MemoryCache, disk *DiskCache) *CompositeCache {
	return &CompositeCache{mem: mem, disk: disk}
}

func (c *CompositeCache) Get(key string) (domainimage.TransformResult, error) {
	if r, _ := c.mem.Get(key); r.Bytes != nil {
		return r, nil
	}
	if r, _ := c.disk.Get(key); r.Bytes != nil {
		_ = c.mem.Set(key, r) // 回填内存
		return r, nil
	}
	return domainimage.TransformResult{}, nil
}

func (c *CompositeCache) Set(key string, result domainimage.TransformResult) error {
	_ = c.disk.Set(key, result)
	return c.mem.Set(key, result)
}

var _ domainimage.ImageCache = (*CompositeCache)(nil)
```

- [ ] **Step 4: main.go 替换裸 FileServer**

`main.go:438-442` 替换为:

```go
	// 图片服务(替换裸 FileServer):支持动态 resize/转码 + 二级缓存
	imageContainer := app.NewImageContainer("uploads")
	r.Get("/uploads/*", imageContainer.ImageHandler.ServeImage)
```

- [ ] **Step 5: 编译 + vet**

Run: `cd api && go build ./... && go vet ./...`
Expected: 无错误

- [ ] **Step 6: 端到端冒烟测试(手动)**

启动服务,上传一张 png,然后访问:
- `http://localhost:8080/uploads/avatar/xxx.webp`(原图)
- `http://localhost:8080/uploads/avatar/xxx.webp?w=50`(缩放)
- `http://localhost:8080/uploads/avatar/xxx.webp?w=50&format=jpeg`(转码)
确认返回正确图片 + 响应头含 ETag/nosniff。

- [ ] **Step 7: 提交**

```bash
git add api/internal/interfaces/http/handler/image/ api/internal/app/image_container.go api/internal/infrastructure/image/composite.go api/cmd/server/main.go
git commit -m "feat(image): 图片服务 handler + 路由注册(替换裸 FileServer)"
```

---

## Task 12: 清理任务扩展(图片缓存清理)

**Files:**
- Modify: `api/internal/job/cleanup_job.go`
- Modify: `api/cmd/server/main.go`(daily 加 CleanImageCache)

- [ ] **Step 1: 实现 CleanImageCache**

`cleanup_job.go` 追加:

```go
// CleanImageCache 清理 uploads/.cache 下超过 retentionDays 未访问的文件
func (j *CleanupJob) CleanImageCache(ctx context.Context, cacheDir string, retentionDays int) (int, error) {
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, fmt.Errorf("读取缓存目录失败: %w", err)
	}
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	cleaned := 0
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			if err := os.RemoveAll(filepath.Join(cacheDir, e.Name())); err != nil {
				log.Printf("清理: 删除缓存 %s 失败: %v", e.Name(), err)
				continue
			}
			cleaned++
		}
	}
	return cleaned, nil
}
```

- [ ] **Step 2: runDaily 加调用**

```go
func (j *CleanupJob) runDaily(ctx context.Context) {
	// ... 现有 PhysicalDeleteFiles
	cache, err := j.CleanImageCache(ctx, filepath.Join("uploads", ".cache"), 7)
	if err != nil {
		log.Printf("清理任务: 清理图片缓存出错: %v", err)
	} else {
		log.Printf("清理任务: 清理了 %d 个过期图片缓存", cache)
	}
}
```

- [ ] **Step 3: 编译 + 测试**

Run: `cd api && go build ./... && go test ./internal/job/ -v`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add api/internal/job/cleanup_job.go
git commit -m "feat(job): 定时清理图片服务磁盘缓存"
```

---

## Task 13: 前端 — imageUrl helper + SHA-256

**Files:**
- Create: `web/src/features/upload/lib/imageUrl.ts`
- Create: `web/src/features/upload/lib/sha256.ts`
- Test: 随组件验证

- [ ] **Step 1: imageUrl helper**

```typescript
// web/src/features/upload/lib/imageUrl.ts

interface ImageOpts {
  w?: number;
  h?: number;
  thumb?: string; // "WxH"
  format?: "jpeg" | "png" | "webp";
  quality?: number;
  rotate?: 0 | 90 | 180 | 270;
}

/**
 * 生成带动态处理参数的图片 URL
 * @example imageUrl("/uploads/avatar/x.webp", { w: 200, thumb: "200x200", format: "webp" })
 */
export function imageUrl(path: string, opts: ImageOpts = {}): string {
  const params = new URLSearchParams();
  if (opts.w) params.set("w", String(opts.w));
  if (opts.h) params.set("h", String(opts.h));
  if (opts.thumb) params.set("thumb", opts.thumb);
  if (opts.format) params.set("format", opts.format);
  if (opts.quality) params.set("quality", String(opts.quality));
  if (opts.rotate) params.set("rotate", String(opts.rotate));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** 头像专用:200x200 缩略图 */
export function avatarUrl(path: string): string {
  if (!path) return "";
  return imageUrl(path, { w: 200, thumb: "200x200", format: "webp" });
}
```

- [ ] **Step 2: SHA-256 helper(用 crypto.subtle)**

```typescript
// web/src/features/upload/lib/sha256.ts

/**
 * 计算文件 SHA-256(浏览器原生 crypto.subtle,零依赖)
 * 流式读取避免大文件一次性载入内存
 */
export async function sha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 3: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add web/src/features/upload/lib/
git commit -m "feat(upload): 前端 imageUrl helper + SHA-256 计算"
```

---

## Task 14: 前端 — 上传 API 封装

**Files:**
- Create: `web/src/features/upload/api/queries.ts`

- [ ] **Step 1: 实现 API 封装**

```typescript
// web/src/features/upload/api/queries.ts
import { httpClient } from "@shared/api/http";

export interface InitSessionResult {
  instant: boolean;
  file_id?: string;
  url?: string;
  upload_id?: string;
  chunk_size: number;
  total_chunks: number;
  uploaded_chunks: number[];
}

export interface MergeResult {
  file_id: string;
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

/**
 * 初始化上传会话(秒传/续传/新建)
 * 头像场景按单分片处理:chunkSize = fileSize, totalChunks = 1
 */
export async function initUpload(opts: {
  fileName: string;
  fileSize: number;
  fileHash: string;
  mimeType: string;
  purpose: string;
}): Promise<InitSessionResult> {
  const res = await httpClient.post<InitSessionResult>("/upload/init", {
    fileName: opts.fileName,
    fileSize: opts.fileSize,
    fileHash: opts.fileHash,
    mimeType: opts.mimeType,
    chunkSize: opts.fileSize, // 单分片
    purpose: opts.purpose,
  });
  return res.data;
}

/** 上传单个分片 */
export async function uploadChunk(
  uploadId: string,
  index: number,
  data: ArrayBuffer,
): Promise<void> {
  await httpClient.put(`/upload/${uploadId}/chunk/${index}`, data, {
    headers: { "Content-Type": "application/octet-stream" },
  });
}

/** 合并所有分片,返回最终文件信息 */
export async function completeUpload(
  uploadId: string,
): Promise<MergeResult> {
  const res = await httpClient.post<MergeResult>(
    `/upload/${uploadId}/complete`,
  );
  return res.data;
}
```

- [ ] **Step 2: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add web/src/features/upload/api/
git commit -m "feat(upload): 前端上传 API 封装(init/chunk/complete)"
```

---

## Task 15: 前端 — AvatarUploader 组件 + 接入 profile 页

**Files:**
- Create: `web/src/features/upload/ui/AvatarUploader.tsx`
- Modify: `web/src/routes/profile/index.tsx`

- [ ] **Step 1: 实现 AvatarUploader**

```tsx
// web/src/features/upload/ui/AvatarUploader.tsx
import { useState } from "react";
import { httpClient } from "@shared/api/http";
import { sha256 } from "../lib/sha256";
import { avatarUrl } from "../lib/imageUrl";
import { initUpload, uploadChunk, completeUpload } from "../api/queries";

interface AvatarUploaderProps {
  currentAvatar: string;
  onUploaded: (url: string) => void;
}

export function AvatarUploader({ currentAvatar, onUploaded }: AvatarUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const hash = await sha256(file);
      // 秒传检查 + 初始化
      const init = await initUpload({
        fileName: file.name,
        fileSize: file.size,
        fileHash: hash,
        mimeType: file.type,
        purpose: "avatar",
      });
      let url = init.url;
      // 秒传未命中 → 上传单分片
      if (!init.instant && init.upload_id) {
        const buf = await file.arrayBuffer();
        await uploadChunk(init.upload_id, 0, buf);
        const merged = await completeUpload(init.upload_id);
        url = merged.url;
      }
      if (!url) throw new Error("上传失败");
      // 更新个人资料头像
      await httpClient.patch("/auth/profile", { avatar: url });
      onUploaded(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src={avatarUrl(currentAvatar)}
        alt="头像"
        className="h-24 w-24 rounded-full object-cover"
      />
      <label className="cursor-pointer text-sm text-blue-600 hover:underline">
        {busy ? "上传中..." : "更换头像"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: profile 页替换 ComingSoon**

```tsx
// web/src/routes/profile/index.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { httpClient } from "@shared/api/http";
import { AvatarUploader } from "@/features/upload/ui/AvatarUploader";

function ProfilePage() {
  const qc = useQueryClient();
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await httpClient.get<{ avatar: string }>("/auth/me");
      return res.data;
    },
  });

  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="mb-6 text-2xl font-bold">个人中心</h1>
      {user && (
        <AvatarUploader
          currentAvatar={user.avatar ?? ""}
          onUploaded={() => qc.invalidateQueries({ queryKey: ["me"] })}
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/profile/")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href }, replace: true });
    }
  },
  component: ProfilePage,
});
```

- [ ] **Step 3: 类型检查 + Biome**

Run: `cd web && npx tsc --noEmit && npx biome check src/features/upload src/routes/profile --write`
Expected: 无错误

- [ ] **Step 4: 端到端联调(手动)**

启动前后端,登录后进入 /profile,上传一张 JPEG 头像,确认:
- 头像预览更新
- 服务端 uploads/avatar/ 下生成 .webp 文件(转码生效)
- 二次上传相同文件秒传(无分片上传流量)

- [ ] **Step 5: 提交**

```bash
git add web/src/features/upload/ui/ web/src/routes/profile/
git commit -m "feat(upload): 前端头像上传组件 + profile 页接入"
```

---

## 验收检查

- [ ] `cd api && go build ./... && go vet ./... && go test ./...` 全绿
- [ ] `cd web && npx tsc --noEmit && npx biome check .` 全绿
- [ ] IDOR 回归:非 owner 调用 SaveChunk/CancelUpload/GetUploadStatus/CompleteUpload/UploadThumbnail 返回 403
- [ ] 上传 PNG → 服务端生成 WebP(更小时)或保留 PNG
- [ ] `GET /uploads/x?w=50` 返回缩放图 + ETag;二次请求带 If-None-Match 返回 304
- [ ] `GET /uploads/x?format=invalid` 返回 400
- [ ] 损坏图片上传返回 422(不落盘)
- [ ] 前端头像上传成功,头像展示带动态处理参数
```
