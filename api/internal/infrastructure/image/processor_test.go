package image

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
)

// TestValidate_DetectsRealMIME 校验真实图片应返回其 MIME
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

// TestValidate_RejectsCorrupt 损坏/非图片文件应校验失败
func TestValidate_RejectsCorrupt(t *testing.T) {
	tmp := filepath.Join(t.TempDir(), "fake.jpg")
	if err := os.WriteFile(tmp, []byte("not an image"), 0o644); err != nil {
		t.Fatal(err)
	}
	p := NewProcessor("uploads", "/uploads/")
	if _, err := p.Validate(tmp); err == nil {
		t.Fatal("损坏文件应校验失败")
	}
}

// TestDimensions 读取测试图宽高
func TestDimensions(t *testing.T) {
	p := NewProcessor("uploads", "/uploads/")
	w, h := p.Dimensions(filepath.Join("testdata", "sample.png"))
	if w != 200 || h != 150 {
		t.Fatalf("期望 200x150,实际 %dx%d", w, h)
	}
}

// TestTranscode_PNGToWebP PNG 转 WebP 应产出合法结果路径
func TestTranscode_PNGToWebP(t *testing.T) {
	p := NewProcessor("uploads", "/uploads/")
	res, err := p.Transcode(
		filepath.Join("testdata", "sample.png"),
		t.TempDir(), uuid.New().String(), "image/png",
	)
	if err != nil {
		t.Fatalf("转码失败: %v", err)
	}
	if res.Path == "" {
		t.Fatal("转码结果路径为空")
	}
	// 结果文件应存在
	if _, err := os.Stat(res.Path); err != nil {
		t.Fatalf("结果文件不存在: %v", err)
	}
}

// TestTranscode_GIFSkipped GIF 应原样保留(不转码)
func TestTranscode_GIFSkipped(t *testing.T) {
	p := NewProcessor("uploads", "/uploads/")
	res, err := p.Transcode(
		filepath.Join("testdata", "sample.gif"),
		t.TempDir(), uuid.New().String(), "image/gif",
	)
	if err != nil {
		t.Fatalf("转码失败: %v", err)
	}
	if res.MimeType != "image/gif" {
		t.Fatalf("GIF 应保留 image/gif,实际 %s", res.MimeType)
	}
	if res.Ext != ".gif" {
		t.Fatalf("GIF 扩展名应为 .gif,实际 %s", res.Ext)
	}
}
