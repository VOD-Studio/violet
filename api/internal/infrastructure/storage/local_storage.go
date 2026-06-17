// Package storage 提供文件系统存储的基础设施实现。
//
// 实现 domain/upload.ChunkStorage 端口，封装分片读写、文件合并、
// 缩略图生成等文件系统操作。application 层通过端口接口依赖，不感知具体实现。
package storage

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/rs/zerolog/log"
)

// LocalStorage 本地文件系统存储实现
type LocalStorage struct {
	uploadDir string // 文件根目录，如 "uploads"
	urlPrefix string // URL 前缀，如 "/uploads/"
}

// NewLocalStorage 创建本地存储
func NewLocalStorage(uploadDir, urlPrefix string) *LocalStorage {
	return &LocalStorage{uploadDir: uploadDir, urlPrefix: urlPrefix}
}

// EnsureDir 确保目录存在
func (s *LocalStorage) EnsureDir(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("创建目录失败: %w", err)
	}
	return nil
}

// SaveChunk 保存单个分片到 chunkDir/chunk_NNNN
func (s *LocalStorage) SaveChunk(chunkDir string, index int, data []byte) error {
	if err := os.MkdirAll(chunkDir, 0o755); err != nil {
		return fmt.Errorf("创建分片目录失败: %w", err)
	}
	chunkPath := filepath.Join(chunkDir, fmt.Sprintf("chunk_%04d", index))
	if err := os.WriteFile(chunkPath, data, 0o644); err != nil {
		return fmt.Errorf("写入分片失败: %w", err)
	}
	return nil
}

// ReadChunk 读取分片内容
func (s *LocalStorage) ReadChunk(chunkDir string, index int) ([]byte, error) {
	chunkPath := filepath.Join(chunkDir, fmt.Sprintf("chunk_%04d", index))
	data, err := os.ReadFile(chunkPath)
	if err != nil {
		return nil, fmt.Errorf("读取分片失败: %w", err)
	}
	return data, nil
}

// MergeChunks 按 index 顺序合并所有分片到 destPath
func (s *LocalStorage) MergeChunks(chunkDir string, totalChunks int, destPath string) error {
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return fmt.Errorf("创建合并目标目录失败: %w", err)
	}
	dst, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("创建合并文件失败: %w", err)
	}
	defer dst.Close()

	for i := 0; i < totalChunks; i++ {
		chunkPath := filepath.Join(chunkDir, fmt.Sprintf("chunk_%04d", i))
		chunkFile, err := os.Open(chunkPath)
		if err != nil {
			return fmt.Errorf("打开分片 %d 失败: %w", i, err)
		}
		if _, err := copyTo(chunkFile, dst); err != nil {
			chunkFile.Close()
			return fmt.Errorf("合并分片 %d 失败: %w", i, err)
		}
		chunkFile.Close()
	}
	return nil
}

// CleanupDir 清理目录
func (s *LocalStorage) CleanupDir(dir string) error {
	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("清理目录失败: %w", err)
	}
	return nil
}

// FileSize 获取文件大小
func (s *LocalStorage) FileSize(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, fmt.Errorf("获取文件信息失败: %w", err)
	}
	return info.Size(), nil
}

// Move 移动文件
func (s *LocalStorage) Move(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return fmt.Errorf("创建目标目录失败: %w", err)
	}
	if err := os.Rename(src, dst); err != nil {
		return fmt.Errorf("移动文件失败: %w", err)
	}
	return nil
}

// ImageDimensions 获取图片宽高（非图片返回 0,0）
func (s *LocalStorage) ImageDimensions(path string) (int, int) {
	img, err := imaging.Open(path)
	if err != nil {
		log.Warn().Err(err).Str("path", path).Msg("打开图片失败")
		return 0, 0
	}
	bounds := img.Bounds()
	return bounds.Dx(), bounds.Dy()
}

// GenerateThumbnail 生成缩略图，返回 URL
func (s *LocalStorage) GenerateThumbnail(srcPath, fileUUID, storageDir, mimeType string) string {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return s.generateImageThumb(srcPath, fileUUID, storageDir)
	case strings.HasPrefix(mimeType, "video/"):
		return s.generateVideoThumb(srcPath, fileUUID, storageDir)
	default:
		return ""
	}
}

// generateImageThumb 图片缩略图（最大宽 300px，JPEG 80%）
func (s *LocalStorage) generateImageThumb(srcPath, fileUUID, storageDir string) string {
	img, err := imaging.Open(srcPath)
	if err != nil {
		log.Warn().Err(err).Str("path", srcPath).Msg("打开图片失败")
		return ""
	}
	thumb := imaging.Resize(img, 300, 0, imaging.Lanczos)
	thumbName := fileUUID + "_thumb.jpg"
	thumbDir := filepath.Join(s.uploadDir, storageDir)
	thumbPath := filepath.Join(thumbDir, thumbName)
	if err := os.MkdirAll(thumbDir, 0o755); err != nil {
		log.Warn().Err(err).Str("dir", thumbDir).Msg("创建缩略图目录失败")
		return ""
	}
	if err := imaging.Save(thumb, thumbPath, imaging.JPEGQuality(80)); err != nil {
		log.Warn().Err(err).Str("path", thumbPath).Msg("保存缩略图失败")
		return ""
	}
	return s.urlPrefix + storageDir + "/" + thumbName
}

// generateVideoThumb 视频缩略图（ffmpeg 提取第 1 秒帧）
func (s *LocalStorage) generateVideoThumb(srcPath, fileUUID, storageDir string) string {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		log.Debug().Msg("ffmpeg 不可用，跳过视频缩略图生成")
		return ""
	}
	thumbName := fileUUID + "_thumb.jpg"
	thumbDir := filepath.Join(s.uploadDir, storageDir)
	thumbPath := filepath.Join(thumbDir, thumbName)
	if err := os.MkdirAll(thumbDir, 0o755); err != nil {
		log.Warn().Err(err).Str("dir", thumbDir).Msg("创建缩略图目录失败")
		return ""
	}
	cmd := exec.Command("ffmpeg", "-i", srcPath, "-ss", "1", "-vframes", "1",
		"-vf", "scale=300:-1", "-f", "image2", thumbPath, "-y")
	cmd.Stdout = nil
	cmd.Stderr = nil
	if err := cmd.Run(); err != nil {
		log.Warn().Err(err).Str("path", srcPath).Msg("生成视频缩略图失败")
		return ""
	}
	if _, err := os.Stat(thumbPath); os.IsNotExist(err) {
		return ""
	}
	return s.urlPrefix + storageDir + "/" + thumbName
}

// BuildPath 构建最终文件存储路径与访问 URL
func (s *LocalStorage) BuildPath(purpose, mimeType, fileUUID, ext string) (string, string) {
	dir := purpose
	if dir == "material" {
		dir = filepath.Join(dir, fileTypeFromMime(mimeType))
	}
	finalName := fileUUID + ext
	finalDir := filepath.Join(s.uploadDir, dir)
	finalPath := filepath.Join(finalDir, finalName)
	url := s.urlPrefix + dir + "/" + finalName
	return finalPath, url
}

// fileTypeFromMime 根据 MIME 推断分类目录
func fileTypeFromMime(mimeType string) string {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return "image"
	case strings.HasPrefix(mimeType, "video/"):
		return "video"
	case strings.HasPrefix(mimeType, "audio/"):
		return "audio"
	default:
		return "file"
	}
}

// copyTo 复制 reader 到 writer
func copyTo(src *os.File, dst *os.File) (int64, error) {
	buf := make([]byte, 32*1024)
	var written int64
	for {
		n, err := src.Read(buf)
		if n > 0 {
			if _, werr := dst.Write(buf[:n]); werr != nil {
				return written, werr
			}
			written += int64(n)
		}
		if err != nil {
			if err.Error() == "EOF" {
				return written, nil
			}
			return written, err
		}
	}
}

// 编译期断言
var _ chunkStorageImpl = (*LocalStorage)(nil)

// chunkStorageImpl 占位接口，仅用于断言（实际端口在 domain/upload）
type chunkStorageImpl interface {
	EnsureDir(string) error
}
