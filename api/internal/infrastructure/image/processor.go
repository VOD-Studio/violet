// Package image 实现受策略约束的图片解码、编码与缓存。
package image

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/rs/zerolog/log"

	domainimage "blog-api/internal/domain/image"
	domainsettings "blog-api/internal/domain/settings"
	domainupload "blog-api/internal/domain/upload"
)

// Processor 上传图片处理器。
type Processor struct {
	uploadDir string
	urlPrefix string
	policies  domainimage.PolicyProvider
	encoder   *Encoder
	ctx       context.Context
	policy    *domainsettings.ImagePolicy
}

// NewProcessor 创建图片处理器；encoder 必须与动态图片管线共用。
func NewProcessor(uploadDir, urlPrefix string, policies domainimage.PolicyProvider, encoder *Encoder) *Processor {
	return &Processor{uploadDir: uploadDir, urlPrefix: urlPrefix, policies: policies, encoder: encoder, ctx: context.Background()}
}

var _ domainupload.ImageProcessor = (*Processor)(nil)

// ForRequest 固定策略，后续校验、转码和缩略图使用同一份值。
func (p *Processor) ForRequest(ctx context.Context) domainupload.ImageProcessor {
	copy := *p
	policy := imagePolicy(p.policies)
	copy.ctx, copy.policy = ctx, &policy
	return &copy
}

func (p *Processor) currentPolicy() domainsettings.ImagePolicy {
	if p.policy != nil {
		return *p.policy
	}
	return imagePolicy(p.policies)
}

func (p *Processor) source(path string, policy domainsettings.ImagePolicy) (sourceImage, []byte, error) {
	data, err := readSource(path, policy)
	if err != nil {
		return sourceImage{}, nil, err
	}
	source, err := decodeSource(data, policy)
	return source, data, err
}

func (p *Processor) begin(policy domainsettings.ImagePolicy) (context.Context, func(), error) {
	ctx, cancel := context.WithTimeout(p.ctx, time.Duration(policy.EncodeTimeoutSeconds)*time.Second)
	release, err := p.encoder.acquire(ctx, policy.MaxConcurrent)
	if err != nil {
		cancel()
		return nil, nil, err
	}
	return ctx, func() { release(); cancel() }, nil
}

// Validate 先检查字节、尺寸和累计动画像素，再完整验证压缩内容。
func (p *Processor) Validate(path string) (string, error) {
	policy := p.currentPolicy()
	ctx, done, err := p.begin(policy)
	if err != nil {
		return "", err
	}
	defer done()
	source, _, err := p.source(path, policy)
	if err != nil {
		return "", err
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}
	return source.mime, nil
}

// Dimensions 读取经过相同安全检查的尺寸。
func (p *Processor) Dimensions(path string) (int, int) {
	policy := p.currentPolicy()
	_, done, err := p.begin(policy)
	if err != nil {
		return 0, 0
	}
	defer done()
	source, _, err := p.source(path, policy)
	if err != nil {
		return 0, 0
	}
	return source.width, source.height
}

// Transcode GIF/WebP 保留原文件；JPEG/PNG 使用真实质量和方法编码，只有体积更小时采用。
func (p *Processor) Transcode(srcPath, destDir, fileUUID, srcMime string) (domainupload.ProcessResult, error) {
	policy := p.currentPolicy()
	ctx, done, err := p.begin(policy)
	if err != nil {
		return domainupload.ProcessResult{}, err
	}
	defer done()
	source, original, err := p.source(srcPath, policy)
	if err != nil {
		return domainupload.ProcessResult{}, err
	}
	if source.mime != srcMime {
		return domainupload.ProcessResult{}, fmt.Errorf("图片 MIME 与文件内容不一致")
	}
	data, mime := original, source.mime
	if source.mime != "image/gif" && source.mime != "image/webp" {
		encoded, err := encodeWebP(ctx, source.image, policy)
		if err != nil {
			return domainupload.ProcessResult{}, err
		}
		if len(encoded) < len(original) {
			data, mime = encoded, "image/webp"
		}
	}
	if int64(len(data)) > policy.MaxOutputBytes {
		return domainupload.ProcessResult{}, fmt.Errorf("图片超过输出字节限制")
	}
	ext := extFromMime(mime)
	dst := filepath.Join(destDir, fileUUID+ext)
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return domainupload.ProcessResult{}, err
	}
	if err := os.WriteFile(dst, data, 0o644); err != nil {
		return domainupload.ProcessResult{}, err
	}
	return domainupload.ProcessResult{Path: dst, MimeType: mime, Ext: ext}, nil
}

// Thumbnail 保留动画和透明度；不透明静态图使用可配置的 JPEG 缩略图。
func (p *Processor) Thumbnail(srcPath, fileUUID, storageDir, mime string) string {
	policy := p.currentPolicy()
	ctx, done, err := p.begin(policy)
	if err != nil {
		return ""
	}
	defer done()
	if strings.HasPrefix(mime, "video/") {
		return p.videoThumbnail(ctx, srcPath, fileUUID, storageDir, policy)
	}
	if !strings.HasPrefix(mime, "image/") {
		return ""
	}
	source, _, err := p.source(srcPath, policy)
	if err != nil {
		return ""
	}
	if source.animated {
		rel, err := filepath.Rel(p.uploadDir, srcPath)
		if err != nil || !filepath.IsLocal(rel) {
			return ""
		}
		return strings.TrimSuffix(p.urlPrefix, "/") + "/" + filepath.ToSlash(rel)
	}
	img := source.image
	if img.Bounds().Dx() > policy.ThumbnailWidth {
		img = imaging.Resize(img, policy.ThumbnailWidth, 0, imaging.Lanczos)
	}
	format, ext := imaging.JPEG, ".jpg"
	if !opaque(img) {
		format, ext = imaging.PNG, ".png"
	}
	buffer := &boundedBuffer{limit: policy.MaxOutputBytes}
	if err := imaging.Encode(buffer, img, format, imaging.JPEGQuality(policy.ThumbnailQuality)); err != nil {
		return ""
	}
	if ctx.Err() != nil {
		return ""
	}
	thumbName := fileUUID + "_thumb" + ext
	thumbDir := filepath.Join(p.uploadDir, storageDir)
	if err := os.MkdirAll(thumbDir, 0o755); err != nil {
		return ""
	}
	if err := os.WriteFile(filepath.Join(thumbDir, thumbName), buffer.Bytes(), 0o644); err != nil {
		return ""
	}
	return strings.TrimSuffix(p.urlPrefix, "/") + "/" + filepath.ToSlash(storageDir) + "/" + thumbName
}

func (p *Processor) videoThumbnail(ctx context.Context, srcPath, fileUUID, storageDir string, policy domainsettings.ImagePolicy) string {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		log.Warn().Msg("ffmpeg 未安装，跳过视频封面生成")
		return ""
	}
	thumbName := fileUUID + "_thumb.jpg"
	thumbDir := filepath.Join(p.uploadDir, storageDir)
	if err := os.MkdirAll(thumbDir, 0o755); err != nil {
		return ""
	}
	// 经管道限制输出，避免抽帧进程向缓存目录写入不受控文件。
	cmd := exec.CommandContext(ctx, "ffmpeg", "-v", "error", "-i", srcPath, "-ss", "1", "-vframes", "1", "-vf", "scale="+strconv.Itoa(policy.ThumbnailWidth)+":-1", "-f", "image2pipe", "-vcodec", "mjpeg", "-")
	buffer := &boundedBuffer{limit: policy.MaxOutputBytes}
	cmd.Stdout = buffer
	if err := cmd.Run(); err != nil {
		log.Warn().Err(err).Msg("视频封面生成失败")
		return ""
	}
	if err := os.WriteFile(filepath.Join(thumbDir, thumbName), buffer.Bytes(), 0o644); err != nil {
		return ""
	}
	return strings.TrimSuffix(p.urlPrefix, "/") + "/" + filepath.ToSlash(storageDir) + "/" + thumbName
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
