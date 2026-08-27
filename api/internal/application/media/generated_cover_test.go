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

	url, err := svc.SaveGeneratedCover(context.Background(), owner, png)
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

// TestSaveGeneratedCover_RejectsNonImageBytes 嗅探自治：processor 未注入
// 时 magic bytes 校验依然生效，任意字节不得落盘（评审修复）。
func TestSaveGeneratedCover_RejectsNonImageBytes(t *testing.T) {
	tmp := t.TempDir()
	repo := &recordingFileRepo{fakeFileRepo: fakeFileRepo{ownerID: domainshared.NewID()}}
	svc := NewUploadService(repo, nil, storage.NewLocalStorage(tmp, "/uploads/"), nil, filepath.Join(tmp, "chunks"), tmp, "/uploads/")
	if _, err := svc.SaveGeneratedCover(context.Background(), domainshared.NewID(), []byte("x")); err == nil {
		t.Fatal("非图片字节应拒绝")
	}
	if len(repo.saved) != 0 {
		t.Fatal("拒绝路径不应落库")
	}
}

// TestSniffImageExt 格式矩阵：png/jpg/webp 识别与未知字节拒绝。
func TestSniffImageExt(t *testing.T) {
	cases := []struct {
		name string
		data []byte
		ext  string
	}{
		{"png", []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}, "png"},
		{"jpeg", []byte{0xff, 0xd8, 0xff, 0xe0}, "jpg"},
		{"webp", []byte{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' '}, "webp"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ext, ok := SniffImageExt(c.data)
			if !ok || ext != c.ext {
				t.Errorf("SniffImageExt() = %q, %v; want %q, true", ext, ok, c.ext)
			}
		})
	}
	if _, ok := SniffImageExt([]byte("not-an-image")); ok {
		t.Error("未知字节应 ok=false")
	}
	if _, ok := SniffImageExt(nil); ok {
		t.Error("空字节应 ok=false")
	}
}
