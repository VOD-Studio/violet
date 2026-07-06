// Package image 提供图片处理的基础设施实现(转码/校验/尺寸/缩略图)。
//
// 实现 domain/upload.ImageProcessor 端口,供 application/media.UploadService 依赖。
// 当前走纯 Go:imaging(解码/resize)+ nativewebp(WebP 编码,VP8L 无损)。
package image

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	webp "github.com/HugoSmits86/nativewebp"
	"github.com/disintegration/imaging"
	_ "golang.org/x/image/webp"
	"github.com/rs/zerolog/log"

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

// 编译期断言:实现 domain 端口
var _ domainupload.ImageProcessor = (*Processor)(nil)

// Validate 校验图片:magic bytes(http.DetectContentType)+ 真正解码
func (p *Processor) Validate(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("读取文件失败: %w", err)
	}
	mime := http.DetectContentType(data)
	if !strings.HasPrefix(mime, "image/") {
		return "", fmt.Errorf("非图片文件,检测到 %s", mime)
	}

	// 对于 WebP，如果头部确认为 RIFF...WEBP，直接放行，避免因 VP8X 动图导致解码失败
	if mime == "image/webp" && len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return mime, nil
	}

	// 真正解码验证(防改扩展名的损坏文件)
	if _, err := imaging.Open(path); err != nil {
		return "", fmt.Errorf("解码失败: %w", err)
	}
	return mime, nil
}

// Dimensions 取宽高(非图片返回 0,0)
func (p *Processor) Dimensions(path string) (int, int) {
	img, err := imaging.Open(path)
	if err == nil {
		b := img.Bounds()
		return b.Dx(), b.Dy()
	}

	// 如果标准库解码失败（如 VP8X 动图），尝试手动解析 WebP 头部获取宽高
	data, err := os.ReadFile(path)
	if err == nil && len(data) >= 30 {
		if string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP" && string(data[12:16]) == "VP8X" {
			w := 1 + int(data[24]) + (int(data[25]) << 8) + (int(data[26]) << 16)
			h := 1 + int(data[27]) + (int(data[28]) << 8) + (int(data[29]) << 16)
			return w, h
		}
	}
	return 0, 0
}

// Transcode 转 WebP;GIF/WebP 跳过,JPEG/PNG 解码后编码,
// 仅当 WebP 更小才采用,否则回退原格式
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
	// JPEG/PNG → 解码 → WebP encode(VP8L 无损)
	img, err := imaging.Open(srcPath)
	if err != nil {
		return domainupload.ProcessResult{}, fmt.Errorf("解码失败: %w", err)
	}
	var webpBuf bytes.Buffer
	if err := webp.Encode(&webpBuf, img, nil); err != nil {
		return domainupload.ProcessResult{}, fmt.Errorf("WebP 编码失败: %w", err)
	}
	// 仅当 WebP 更小才采用,否则回退原格式
	if webpBuf.Len() < len(srcData) {
		dst := filepath.Join(destDir, fileUUID+".webp")
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			return domainupload.ProcessResult{}, err
		}
		if err := os.WriteFile(dst, webpBuf.Bytes(), 0o644); err != nil {
			return domainupload.ProcessResult{}, err
		}
		return domainupload.ProcessResult{Path: dst, MimeType: "image/webp", Ext: ".webp"}, nil
	}
	// 回退原格式
	ext := extFromMime(srcMime)
	origDst := filepath.Join(destDir, fileUUID+ext)
	if err := os.MkdirAll(filepath.Dir(origDst), 0o755); err != nil {
		return domainupload.ProcessResult{}, err
	}
	if err := os.WriteFile(origDst, srcData, 0o644); err != nil {
		return domainupload.ProcessResult{}, err
	}
	return domainupload.ProcessResult{Path: origDst, MimeType: srcMime, Ext: ext}, nil
}

// Thumbnail 生成缩略图(图片用 imaging,最大宽 300px,JPEG 80%；视频用 ffmpeg 抽第 1 秒帧)
func (p *Processor) Thumbnail(srcPath, fileUUID, storageDir, mime string) string {
	// 视频用 ffmpeg 抽第 1 秒帧作为缩略图
	if strings.HasPrefix(mime, "video/") {
		return p.videoThumbnail(srcPath, fileUUID, storageDir)
	}
	if !strings.HasPrefix(mime, "image/") {
		return ""
	}
	img, err := imaging.Open(srcPath)
	if err != nil {
		// 对于无法解码的动图 WebP (VP8X)，直接用原图作为缩略图
		if mime == "image/webp" {
			return p.urlPrefix + storageDir + "/" + fileUUID + ".webp"
		}
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

// videoThumbnail 用 ffmpeg 抽取视频第 1 秒帧生成缩略图
//
// ffmpeg 未安装或抽帧失败时降级返回空串并打 warn 日志，不阻断上传主流程。
// 命令：ffmpeg -i <src> -ss 1 -vframes 1 -vf scale=300:-1 -f image2 <thumb> -y
func (p *Processor) videoThumbnail(srcPath, fileUUID, storageDir string) string {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		log.Warn().Msg("ffmpeg 未安装，跳过视频封面生成，上传不受影响")
		return ""
	}
	thumbName := fileUUID + "_thumb.jpg"
	thumbDir := filepath.Join(p.uploadDir, storageDir)
	thumbPath := filepath.Join(thumbDir, thumbName)
	if err := os.MkdirAll(thumbDir, 0o755); err != nil {
		return ""
	}
	// -ss 1: 抽第 1 秒；-vframes 1: 只抽 1 帧；scale=300:-1: 宽 300px 等比缩放
	cmd := exec.Command("ffmpeg", "-i", srcPath, "-ss", "1", "-vframes", "1",
		"-vf", "scale=300:-1", "-f", "image2", thumbPath, "-y")
	if err := cmd.Run(); err != nil {
		log.Warn().Err(err).Str("path", srcPath).Msg("ffmpeg 抽取视频封面失败，跳过封面生成")
		return ""
	}
	return p.urlPrefix + storageDir + "/" + thumbName
}

// extFromMime MIME → 扩展名
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
