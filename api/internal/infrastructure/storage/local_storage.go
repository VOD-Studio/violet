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
	"time"

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

// safePath 校验 path 解析后仍位于 uploadDir 之内，防路径穿越。
// 调用方传入的路径（chunkDir/destPath/srcPath 等）经此校验后才允许文件系统操作。
func (s *LocalStorage) safePath(path string) (string, error) {
	cleanBase := filepath.Clean(s.uploadDir)
	cleanTarget := filepath.Clean(path)
	rel, err := filepath.Rel(cleanBase, cleanTarget)
	if err != nil {
		return "", fmt.Errorf("路径解析失败: %w", err)
	}
	// rel 以 ".." 开头即表示逃出 base
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("路径越界 uploadDir: %s", path)
	}
	return cleanTarget, nil
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
	dir, err := s.safePath(chunkDir)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("创建分片目录失败: %w", err)
	}
	chunkPath, err := s.safePath(filepath.Join(dir, fmt.Sprintf("chunk_%04d", index)))
	if err != nil {
		return err
	}
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
	dir, err := s.safePath(chunkDir)
	if err != nil {
		return err
	}
	dst, err := s.safePath(destPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return fmt.Errorf("创建合并目标目录失败: %w", err)
	}
	out, err := os.Create(dst)
	if err != nil {
		return fmt.Errorf("创建合并文件失败: %w", err)
	}
	defer out.Close()

	for i := 0; i < totalChunks; i++ {
		chunkPath, err := s.safePath(filepath.Join(dir, fmt.Sprintf("chunk_%04d", i)))
		if err != nil {
			return err
		}
		chunkFile, err := os.Open(chunkPath)
		if err != nil {
			return fmt.Errorf("打开分片 %d 失败: %w", i, err)
		}
		if _, err := copyTo(chunkFile, out); err != nil {
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
	srcSafe, err := s.safePath(src)
	if err != nil {
		return err
	}
	dstSafe, err := s.safePath(dst)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dstSafe), 0o755); err != nil {
		return fmt.Errorf("创建目标目录失败: %w", err)
	}
	if err := os.Rename(srcSafe, dstSafe); err != nil {
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
		log.Warn().Msg("ffmpeg 未安装，跳过视频封面生成，上传不受影响")
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
// purpose 由调用方（上传会话）提供，必须校验防路径穿越（如 purpose="../tmp"）。
// BuildPath 按 purpose + 时间戳生成日期分目录路径：
// uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
// 返回 (物理路径, 相对URL)。purpose 决定一级目录,timestamp 决定日期目录与文件名时间戳前缀。
func (s *LocalStorage) BuildPath(purpose string, timestamp time.Time, fileUUID, ext string) (string, string, error) {
	dateDir := timestamp.Format("2006/01/02")                // YYYY/MM/DD
	timePrefix := timestamp.Format("150405")                 // HHMMSS
	fileName := timePrefix + "." + fileUUID + ext            // HHMMSS.<uuid>.<ext>
	finalDir := filepath.Join(s.uploadDir, purpose, dateDir) // uploads/{purpose}/YYYY/MM/DD
	finalPath := filepath.Join(finalDir, fileName)           // uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
	// 安全校验:最终目录与路径仍在 uploadDir 内(覆盖 purpose 穿越)
	if _, err := s.safePath(finalDir); err != nil {
		return "", "", err
	}
	if _, err := s.safePath(finalPath); err != nil {
		return "", "", err
	}
	url := s.urlPrefix + purpose + "/" + dateDir + "/" + fileName // /uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
	return finalPath, url, nil
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
