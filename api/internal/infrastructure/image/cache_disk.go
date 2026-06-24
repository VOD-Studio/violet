// cache_disk.go 磁盘缓存:SHA-256 命名 + 原子写(tmp + rename)。
package image

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"

	domainimage "blog-api/internal/domain/image"
)

// DiskCache 磁盘缓存
type DiskCache struct {
	dir string
}

// NewDiskCache 创建磁盘缓存。dir 为缓存目录(如 uploads/.cache)。
func NewDiskCache(dir string) *DiskCache {
	return &DiskCache{dir: dir}
}

// mimeToExt 缓存文件扩展名(磁盘文件需有扩展名以便回读时推断 mime)
func mimeToExt(mime string) string {
	switch mime {
	case "image/webp":
		return ".webp"
	case "image/png":
		return ".png"
	default:
		return ".jpg"
	}
}

// extToMime 由扩展名反推 mime
func extToMime(ext string) string {
	switch ext {
	case ".webp":
		return "image/webp"
	case ".png":
		return "image/png"
	default:
		return "image/jpeg"
	}
}

func (d *DiskCache) Get(key string) (domainimage.TransformResult, error) {
	sum := sha256.Sum256([]byte(key))
	name := hex.EncodeToString(sum[:])
	// 不知 mime,尝试常见扩展
	for _, ext := range []string{".webp", ".jpg", ".png"} {
		p := filepath.Join(d.dir, name+ext)
		if data, err := os.ReadFile(p); err == nil {
			etagSum := sha256.Sum256(data)
			return domainimage.TransformResult{
				Bytes:    data,
				MimeType: extToMime(ext),
				ETag:     hex.EncodeToString(etagSum[:16]),
			}, nil
		}
	}
	return domainimage.TransformResult{}, nil
}

func (d *DiskCache) Set(key string, result domainimage.TransformResult) error {
	if err := os.MkdirAll(d.dir, 0o755); err != nil {
		return err
	}
	sum := sha256.Sum256([]byte(key))
	final := filepath.Join(d.dir, hex.EncodeToString(sum[:])+mimeToExt(result.MimeType))
	tmp := final + ".tmp"
	if err := os.WriteFile(tmp, result.Bytes, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, final) // 原子写
}

var _ domainimage.ImageCache = (*DiskCache)(nil)
