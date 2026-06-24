// transformer.go 图片动态处理实现:resize/thumb/rotate/转码。
//
// 处理顺序:decode → rotate → resize(保比例,只缩不放)→ thumbnail(强制裁剪)→ encode。
package image

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/disintegration/imaging"
	webp "github.com/HugoSmits86/nativewebp"

	domainimage "blog-api/internal/domain/image"
)

// Transformer 图片动态处理实现
type Transformer struct{}

// NewTransformer 创建图片动态处理器
func NewTransformer() *Transformer { return &Transformer{} }

// 编译期断言
var _ domainimage.ImageTransformer = (*Transformer)(nil)

// Transform 按参数处理图片
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
			return domainimage.TransformResult{}, fmt.Errorf("WebP 编码失败: %w", err)
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

	// ETag = sha256(结果字节)前 16 字节
	sum := sha256.Sum256(buf.Bytes())
	etag := hex.EncodeToString(sum[:16])
	return domainimage.TransformResult{Bytes: buf.Bytes(), MimeType: mime, ETag: etag}, nil
}
