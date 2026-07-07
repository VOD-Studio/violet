package media

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
)

// 复用 upload_security_test.go 的 fakeFileRepo 与 noopStorage。

// noopProcessor ImageProcessor 的 no-op 实现,让放行用例走完转码流程。
type noopProcessor struct{}

func (noopProcessor) Validate(path string) (string, error) { return "image/webp", nil }
func (noopProcessor) Transcode(srcPath, destDir, fileUUID, srcMime string) (domainupload.ProcessResult, error) {
	return domainupload.ProcessResult{Path: srcPath, MimeType: "image/webp", Ext: ".webp"}, nil
}
func (noopProcessor) Dimensions(path string) (int, int) { return 1, 1 }
func (noopProcessor) Thumbnail(srcPath, fileUUID, storageDir, mime string) string {
	return "/uploads/thumb.jpg"
}

// realDirStorage 包装 noopStorage,但 EnsureDir/CleanupDir/FileSize 走真实文件系统。
type realDirStorage struct{ noopStorage }

func (realDirStorage) EnsureDir(dir string) error      { return os.MkdirAll(dir, 0o755) }
func (realDirStorage) CleanupDir(dir string) error     { return os.RemoveAll(dir) }
func (realDirStorage) FileSize(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
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

// TestReplaceMediaFile_OwnerOK owner 一致应走完流程返回更新后 DTO
func TestReplaceMediaFile_OwnerOK(t *testing.T) {
	owner := domainshared.NewID()
	fileRepo := &fakeFileRepo{ownerID: owner}
	uploadDir := t.TempDir()
	svc := NewUploadService(fileRepo, nil, realDirStorage{}, noopProcessor{}, uploadDir, uploadDir, "/uploads/")
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
	// 临时工作目录(含 src 文件)应被清理;父级 .replace-tmp 容器目录可能留存无害
	fidDir := filepath.Join(uploadDir, ".replace-tmp", "00000000-0000-0000-0000-000000000001")
	if _, statErr := os.Stat(fidDir); statErr == nil {
		t.Error("临时工作目录未清理")
	}
}

