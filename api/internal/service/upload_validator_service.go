package service

import (
	"crypto/md5"
	"encoding/hex"
	"io"
	"path/filepath"
	"strings"
)

// detectMimeType 根据文件扩展名推断 MIME 类型
func detectMimeType(ext string) string {
	if mt, ok := allowedUploadTypes[strings.ToLower(ext)]; ok {
		return mt
	}
	return "application/octet-stream"
}

// ValidateFileType 验证文件类型是否支持
func (s *UploadService) ValidateFileType(filename string) error {
	ext := strings.ToLower(filepath.Ext(filename))
	if _, ok := allowedUploadTypes[ext]; !ok {
		return ErrInvalidImageType
	}
	return nil
}

// ValidateFileSize 验证文件大小是否在限制内
func (s *UploadService) ValidateFileSize(size int64) error {
	if size > s.maxFileSize {
		return ErrImageTooLarge
	}
	return nil
}

// ComputeMD5 计算文件的 MD5 哈希值
func ComputeMD5(reader io.Reader) (string, error) {
	h := md5.New()
	if _, err := io.Copy(h, reader); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
