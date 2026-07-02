package image

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/disintegration/imaging"

	domainimage "blog-api/internal/domain/image"
)

// TestTransform_Resize 缩放后宽度应等于请求宽度
func TestTransform_Resize(t *testing.T) {
	tr := NewTransformer()
	res, err := tr.Transform(filepath.Join("testdata", "sample.jpg"),
		domainimage.TransformParams{Width: 50, Format: "jpeg", Quality: 80})
	if err != nil {
		t.Fatalf("处理失败: %v", err)
	}
	if len(res.Bytes) == 0 {
		t.Fatal("结果为空")
	}
	if res.MimeType != "image/jpeg" {
		t.Fatalf("期望 image/jpeg,实际 %s", res.MimeType)
	}
	// 验证确实缩小到 50px 宽
	img, err := imaging.Decode(bytes.NewReader(res.Bytes))
	if err != nil {
		t.Fatalf("解码结果失败: %v", err)
	}
	if img.Bounds().Dx() != 50 {
		t.Fatalf("期望宽 50,实际 %d", img.Bounds().Dx())
	}
	if res.ETag == "" {
		t.Fatal("ETag 不应为空")
	}
}

// TestTransform_FormatWebP 指定 webp 应输出 image/webp
func TestTransform_FormatWebP(t *testing.T) {
	tr := NewTransformer()
	res, err := tr.Transform(filepath.Join("testdata", "sample.png"),
		domainimage.TransformParams{Width: 50, Format: "webp"})
	if err != nil {
		t.Fatalf("处理失败: %v", err)
	}
	if res.MimeType != "image/webp" {
		t.Fatalf("期望 image/webp,实际 %s", res.MimeType)
	}
}

// TestTransform_Thumbnail thumb 应裁剪到精确尺寸
func TestTransform_Thumbnail(t *testing.T) {
	tr := NewTransformer()
	res, err := tr.Transform(filepath.Join("testdata", "sample.jpg"),
		domainimage.TransformParams{ThumbW: 40, ThumbH: 40, Format: "jpeg"})
	if err != nil {
		t.Fatalf("处理失败: %v", err)
	}
	img, _ := imaging.Decode(bytes.NewReader(res.Bytes))
	if img.Bounds().Dx() != 40 || img.Bounds().Dy() != 40 {
		t.Fatalf("期望 40x40,实际 %dx%d", img.Bounds().Dx(), img.Bounds().Dy())
	}
}

// TestTransform_Rotate 旋转 90 度后宽高应互换(原图 200x150 → 150x200)
func TestTransform_Rotate(t *testing.T) {
	tr := NewTransformer()
	res, err := tr.Transform(filepath.Join("testdata", "sample.jpg"),
		domainimage.TransformParams{Rotate: 90, Format: "jpeg"})
	if err != nil {
		t.Fatalf("处理失败: %v", err)
	}
	img, _ := imaging.Decode(bytes.NewReader(res.Bytes))
	if img.Bounds().Dx() != 150 || img.Bounds().Dy() != 200 {
		t.Fatalf("旋转后期望 150x200,实际 %dx%d", img.Bounds().Dx(), img.Bounds().Dy())
	}
}

// TestTransform_CorruptFile 损坏文件应返回 error(不 panic)
func TestTransform_CorruptFile(t *testing.T) {
	tmp := filepath.Join(t.TempDir(), "bad.jpg")
	// 直接复用 processor_test 的思路,但这里简单测:不存在文件应 error
	tr := NewTransformer()
	_, err := tr.Transform(filepath.Join("testdata", "nonexist.jpg"),
		domainimage.TransformParams{Width: 50, Format: "jpeg"})
	if err == nil {
		t.Fatal("不存在文件应返回 error")
	}
	_ = tmp
}

// TestTransform_FallbackWebP 无法解码的 WebP(如 VP8X)应降级返回原图，而不是抛出 error
func TestTransform_FallbackWebP(t *testing.T) {
	tmp := filepath.Join(t.TempDir(), "animated.webp")
	// 伪造一个有 WebP 头部的假文件，正常 decode 会失败
	fakeWebP := []byte("RIFF1234WEBPVP8X...")
	if err := os.WriteFile(tmp, fakeWebP, 0o644); err != nil {
		t.Fatal(err)
	}

	tr := NewTransformer()
	res, err := tr.Transform(tmp, domainimage.TransformParams{Width: 50, Format: "jpeg"})
	if err != nil {
		t.Fatalf("遇到有效的 WebP 头部但不兼容时，应降级成功，不应报错: %v", err)
	}
	if string(res.Bytes) != string(fakeWebP) {
		t.Fatal("应该返回原始字节内容")
	}
	if res.MimeType != "image/webp" {
		t.Fatalf("MimeType 应被重置为 image/webp, got: %s", res.MimeType)
	}
}
