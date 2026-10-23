package image

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/disintegration/imaging"

	domainimage "blog-api/internal/domain/image"
	domainsettings "blog-api/internal/domain/settings"
)

// Transformer 动态图片处理器，与上传共享编码并发预算。
type Transformer struct{ encoder *Encoder }

// NewTransformer 创建动态处理器。
func NewTransformer(encoder *Encoder) *Transformer { return &Transformer{encoder: encoder} }

var _ domainimage.ImageTransformer = (*Transformer)(nil)

// Transform 在完整解码前检查源尺寸，动画保持原样，透明图片不隐式转为不透明 JPEG。
func (t *Transformer) Transform(ctx context.Context, data []byte, params domainimage.TransformParams, policy domainsettings.ImagePolicy) (domainimage.TransformResult, error) {
	ctx, cancel := context.WithTimeout(ctx, time.Duration(policy.EncodeTimeoutSeconds)*time.Second)
	defer cancel()
	release, err := t.encoder.acquire(ctx, policy.MaxConcurrent)
	if err != nil {
		return domainimage.TransformResult{}, err
	}
	defer release()
	source, err := decodeSource(data, policy)
	if err != nil {
		return domainimage.TransformResult{}, err
	}
	if source.animated {
		if int64(len(data)) > policy.MaxOutputBytes {
			return domainimage.TransformResult{}, fmt.Errorf("动画原图超过输出限制")
		}
		return transformResult(data, source.mime), nil
	}
	img := source.image
	switch params.Rotate {
	case 90:
		img = imaging.Rotate90(img)
	case 180:
		img = imaging.Rotate180(img)
	case 270:
		img = imaging.Rotate270(img)
	}
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
	if params.ThumbW > 0 && params.ThumbH > 0 {
		if err := checkDimensions(params.ThumbW, params.ThumbH, policy); err != nil {
			return domainimage.TransformResult{}, err
		}
		img = imaging.Fill(img, params.ThumbW, params.ThumbH, imaging.Center, imaging.Lanczos)
	}
	format := params.Format
	if format == "" {
		format = "jpeg"
	}
	if format == "jpeg" && !opaque(img) {
		format = "png"
	}
	var output []byte
	mime := "image/" + format
	if format == "webp" {
		output, err = encodeWebP(ctx, img, policy)
	} else {
		buf := &boundedBuffer{limit: policy.MaxOutputBytes}
		switch format {
		case "png":
			err = imaging.Encode(buf, img, imaging.PNG)
		case "jpeg":
			quality := params.Quality
			if quality <= 0 {
				quality = policy.ThumbnailQuality
			}
			err = imaging.Encode(buf, img, imaging.JPEG, imaging.JPEGQuality(quality))
		default:
			return domainimage.TransformResult{}, fmt.Errorf("不支持的图片输出格式")
		}
		output = buf.Bytes()
	}
	if err != nil {
		return domainimage.TransformResult{}, err
	}
	if err := ctx.Err(); err != nil {
		return domainimage.TransformResult{}, err
	}
	return transformResult(output, mime), nil
}

func transformResult(data []byte, mime string) domainimage.TransformResult {
	sum := sha256.Sum256(data)
	return domainimage.TransformResult{Bytes: data, MimeType: mime, ETag: hex.EncodeToString(sum[:16])}
}
