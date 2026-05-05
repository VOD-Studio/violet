// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// FileStorageService 文件存储服务
// 负责文件的物理存储、缩略图生成、文件清理和路径管理
type FileStorageService struct {
	uploadDir string // 最终文件目录，如 "uploads"
	urlPrefix string // URL 前缀，如 "/uploads/"
}

// NewFileStorageService 创建文件存储服务实例
func NewFileStorageService(uploadDir, urlPrefix string) *FileStorageService {
	return &FileStorageService{
		uploadDir: uploadDir,
		urlPrefix: urlPrefix,
	}
}

// SaveFile 保存文件到指定路径
func (s *FileStorageService) SaveFile(path string, data []byte) error {
	// 确保目录存在
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建目录失败: %w", err)
	}

	// 写入文件
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %w", err)
	}

	return nil
}

// DeleteFile 删除指定路径的文件
func (s *FileStorageService) DeleteFile(path string) error {
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("删除文件失败: %w", err)
	}
	return nil
}

// MoveFile 移动文件从源路径到目标路径
func (s *FileStorageService) MoveFile(srcPath, dstPath string) error {
	// 确保目标目录存在
	dstDir := filepath.Dir(dstPath)
	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return fmt.Errorf("创建目标目录失败: %w", err)
	}

	// 移动文件
	if err := os.Rename(srcPath, dstPath); err != nil {
		return fmt.Errorf("移动文件失败: %w", err)
	}

	return nil
}

// CleanupDirectory 清理指定目录
func (s *FileStorageService) CleanupDirectory(dirPath string) error {
	if err := os.RemoveAll(dirPath); err != nil {
		return fmt.Errorf("清理目录失败: %w", err)
	}
	return nil
}

// EnsureDirectory 确保目录存在
func (s *FileStorageService) EnsureDirectory(dirPath string) error {
	if err := os.MkdirAll(dirPath, 0755); err != nil {
		return fmt.Errorf("创建目录失败: %w", err)
	}
	return nil
}

// GetFileSize 获取文件大小
func (s *FileStorageService) GetFileSize(path string) (int64, error) {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return 0, fmt.Errorf("获取文件信息失败: %w", err)
	}
	return fileInfo.Size(), nil
}

// GetImageDimensions 获取图片尺寸
// 返回宽度和高度，如果失败返回 0, 0
func (s *FileStorageService) GetImageDimensions(path string) (int, int) {
	img, err := imaging.Open(path)
	if err != nil {
		log.Warn().Err(err).Str("path", path).Msg("打开图片失败")
		return 0, 0
	}
	bounds := img.Bounds()
	return bounds.Dx(), bounds.Dy()
}

// FileExists 检查文件是否存在
func (s *FileStorageService) FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// BuildFilePath 构建文件存储路径
// purpose: 文件用途（avatar, post, material）
// mimeType: 文件 MIME 类型
// fileUUID: 文件 UUID
// ext: 文件扩展名
func (s *FileStorageService) BuildFilePath(purpose, mimeType string, fileUUID uuid.UUID, ext string) (string, string) {
	storageDir := purpose
	// material 按 MIME 类型分子目录：material/image, material/video, material/audio, material/file
	if storageDir == "material" {
		storageDir = filepath.Join(storageDir, fileTypeFromMime(mimeType))
	}

	finalName := fileUUID.String() + ext
	finalDir := filepath.Join(s.uploadDir, storageDir)
	finalPath := filepath.Join(finalDir, finalName)
	fileURL := s.urlPrefix + storageDir + "/" + finalName

	return finalPath, fileURL
}

// GenerateImageThumbnail 生成图片缩略图
// 最大宽度 300px，保持原始比例，保存为 JPEG 格式
// 返回缩略图的 URL
func (s *FileStorageService) GenerateImageThumbnail(filePath, fileUUID, fileType string) string {
	img, err := imaging.Open(filePath)
	if err != nil {
		log.Warn().Err(err).Str("path", filePath).Msg("打开图片失败")
		return ""
	}

	// 缩略图尺寸：最大宽 300px，保持比例
	thumb := imaging.Resize(img, 300, 0, imaging.Lanczos)

	// 缩略图文件名
	thumbName := fileUUID + "_thumb.jpg"
	thumbDir := filepath.Join(s.uploadDir, fileType)
	thumbPath := filepath.Join(thumbDir, thumbName)

	// 确保目录存在
	if err := os.MkdirAll(thumbDir, 0755); err != nil {
		log.Warn().Err(err).Str("dir", thumbDir).Msg("创建缩略图目录失败")
		return ""
	}

	// 保存为 JPEG，质量 80%
	if err := imaging.Save(thumb, thumbPath, imaging.JPEGQuality(80)); err != nil {
		log.Warn().Err(err).Str("path", thumbPath).Msg("保存缩略图失败")
		return ""
	}

	return s.urlPrefix + fileType + "/" + thumbName
}

// GenerateVideoThumbnail 使用 ffmpeg 提取视频第 1 秒帧作为缩略图
// 最大宽度 300px，保存为 JPEG 格式
// 返回缩略图的 URL
func (s *FileStorageService) GenerateVideoThumbnail(filePath, fileUUID, fileType string) string {
	// 检查 ffmpeg 是否可用
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		log.Debug().Msg("ffmpeg 不可用，跳过视频缩略图生成")
		return ""
	}

	// 缩略图文件名
	thumbName := fileUUID + "_thumb.jpg"
	thumbDir := filepath.Join(s.uploadDir, fileType)
	thumbPath := filepath.Join(thumbDir, thumbName)

	// 确保目录存在
	if err := os.MkdirAll(thumbDir, 0755); err != nil {
		log.Warn().Err(err).Str("dir", thumbDir).Msg("创建缩略图目录失败")
		return ""
	}

	// 使用 ffmpeg 提取第 1 秒的帧
	cmd := exec.Command("ffmpeg",
		"-i", filePath,
		"-ss", "1",
		"-vframes", "1",
		"-vf", "scale=300:-1",
		"-f", "image2",
		thumbPath,
		"-y",
	)
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Run(); err != nil {
		log.Warn().Err(err).Str("path", filePath).Msg("生成视频缩略图失败")
		return ""
	}

	// 检查缩略图是否生成成功
	if _, err := os.Stat(thumbPath); os.IsNotExist(err) {
		log.Warn().Str("path", thumbPath).Msg("视频缩略图文件不存在")
		return ""
	}

	return s.urlPrefix + fileType + "/" + thumbName
}

// fileTypeFromMime 根据 MIME 类型推断文件分类目录名
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
