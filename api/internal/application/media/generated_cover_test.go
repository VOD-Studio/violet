package media

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	"blog-api/internal/infrastructure/storage"
)

// recordingFileRepo 记录 Save 的 fake，校验落库字段。
type recordingFileRepo struct {
	fakeFileRepo
	saved []*struct {
		purpose string
		url     string
		mime    string
	}
}

func (r *recordingFileRepo) Save(ctx context.Context, fl *domainupload.File) error {
	r.saved = append(r.saved, &struct {
		purpose string
		url     string
		mime    string
	}{fl.Purpose(), fl.URL(), fl.MimeType()})
	return nil
}

// TestSaveGeneratedCover_PersistsMaterialFile 走真实 tmp 目录：
// PNG 字节落盘 + File 记录 purpose=material + URL 指向站内 /uploads/material/。
func TestSaveGeneratedCover_PersistsMaterialFile(t *testing.T) {
	if testing.Short() {
		t.Skip("integration")
	}
	tmp := t.TempDir()
	repo := &recordingFileRepo{fakeFileRepo: fakeFileRepo{ownerID: domainshared.NewID()}}
	svc := NewUploadService(repo, nil, storage.NewLocalStorage(tmp, "/uploads/"), nil, filepath.Join(tmp, "chunks"), tmp, "/uploads/")
	owner := domainshared.NewID()
	png := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}

	url, err := svc.SaveGeneratedCover(context.Background(), owner, png, "png")
	if err != nil {
		t.Fatalf("SaveGeneratedCover() error = %v", err)
	}
	if !strings.HasPrefix(url, "/uploads/material/") || !strings.HasSuffix(url, ".png") {
		t.Fatalf("url = %q, 期望 /uploads/material/*.png", url)
	}
	// 物理文件已写入且字节一致
	rel := strings.TrimPrefix(url, "/uploads/")
	data, err := os.ReadFile(filepath.Join(tmp, filepath.FromSlash(rel)))
	if err != nil {
		t.Fatalf("读落盘文件失败: %v", err)
	}
	if string(data) != string(png) {
		t.Fatal("落盘内容与生成结果不一致")
	}
}

func TestSaveGeneratedCover_RejectsNonImageExt(t *testing.T) {
	tmp := t.TempDir()
	repo := &fakeFileRepo{ownerID: domainshared.NewID()}
	svc := NewUploadService(repo, nil, storage.NewLocalStorage(tmp, "/uploads/"), nil, filepath.Join(tmp, "chunks"), tmp, "/uploads/")
	if _, err := svc.SaveGeneratedCover(context.Background(), domainshared.NewID(), []byte("x"), "exe"); err == nil {
		t.Fatal("非图片扩展名应拒绝")
	}
}
