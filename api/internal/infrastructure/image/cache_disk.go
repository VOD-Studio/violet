package image

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"

	domainimage "blog-api/internal/domain/image"
	domainsettings "blog-api/internal/domain/settings"
)

// DiskCache 只管理图片派生缓存，不遍历素材或分片目录。
type DiskCache struct {
	dir      string
	policies domainimage.PolicyProvider
	mu       sync.Mutex
	statusMu sync.RWMutex
	status   domainsettings.ImageCacheMaintenance
}

// NewDiskCache 创建专用磁盘缓存。
func NewDiskCache(dir string, policies domainimage.PolicyProvider) *DiskCache {
	return &DiskCache{dir: dir, policies: policies}
}

func mimeToExt(mime string) string {
	switch mime {
	case "image/webp":
		return ".webp"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	default:
		return ".jpg"
	}
}
func extToMime(ext string) string {
	switch ext {
	case ".webp":
		return "image/webp"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	default:
		return "image/jpeg"
	}
}
func diskName(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}

func (d *DiskCache) lock() (func(), error) {
	d.mu.Lock()
	if err := os.MkdirAll(d.dir, 0o755); err != nil {
		d.mu.Unlock()
		return nil, err
	}
	file, err := os.OpenFile(filepath.Join(d.dir, ".lock"), os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		d.mu.Unlock()
		return nil, err
	}
	if err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX); err != nil {
		file.Close()
		d.mu.Unlock()
		return nil, err
	}
	return func() { _ = syscall.Flock(int(file.Fd()), syscall.LOCK_UN); file.Close(); d.mu.Unlock() }, nil
}

func (d *DiskCache) Get(key string) (domainimage.TransformResult, error) {
	policy := imagePolicy(d.policies)
	unlock, err := d.lock()
	if err != nil {
		return domainimage.TransformResult{}, err
	}
	defer unlock()
	for _, ext := range []string{".webp", ".jpg", ".png", ".gif"} {
		path := filepath.Join(d.dir, diskName(key)+ext)
		info, err := os.Lstat(path)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return domainimage.TransformResult{}, err
		}
		if !info.Mode().IsRegular() {
			continue
		}
		if time.Since(info.ModTime()) >= time.Duration(policy.DiskTTLSeconds)*time.Second || info.Size() > policy.MaxOutputBytes || info.Size() > policy.DiskMaxBytes {
			if err := os.Remove(path); err != nil {
				return domainimage.TransformResult{}, err
			}
			continue
		}
		file, err := os.Open(path)
		if err != nil {
			return domainimage.TransformResult{}, err
		}
		data, err := io.ReadAll(io.LimitReader(file, policy.MaxOutputBytes+1))
		file.Close()
		if err != nil {
			return domainimage.TransformResult{}, err
		}
		if int64(len(data)) > policy.MaxOutputBytes {
			return domainimage.TransformResult{}, fmt.Errorf("磁盘缓存超过输出限制")
		}
		return transformResult(data, extToMime(ext)), nil
	}
	return domainimage.TransformResult{}, nil
}

func (d *DiskCache) Set(key string, result domainimage.TransformResult) error {
	policy := imagePolicy(d.policies)
	if int64(len(result.Bytes)) > policy.DiskMaxBytes || int64(len(result.Bytes)) > policy.MaxOutputBytes || len(result.Bytes) == 0 {
		return nil
	}
	unlock, err := d.lock()
	if err != nil {
		return err
	}
	defer unlock()
	// 跨进程写入同一目录时也先为新文件预留容量。
	if _, err := d.cleanLocked(policy, policy.DiskMaxBytes-int64(len(result.Bytes))); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(d.dir, ".image-cache-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(result.Bytes); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), filepath.Join(d.dir, diskName(key)+mimeToExt(result.MimeType)))
}

type diskEntry struct {
	path     string
	size     int64
	modified time.Time
}

func managedCacheFile(name string) bool {
	if strings.HasPrefix(name, ".image-cache-") {
		return true
	}
	name = strings.TrimSuffix(name, ".tmp")
	ext := filepath.Ext(name)
	if ext != ".webp" && ext != ".jpg" && ext != ".png" && ext != ".gif" {
		return false
	}
	base := strings.TrimSuffix(name, ext)
	if len(base) != 64 {
		return false
	}
	_, err := hex.DecodeString(base)
	return err == nil
}

func (d *DiskCache) cleanLocked(policy domainsettings.ImagePolicy, budget int64) (domainsettings.ImageCacheMaintenance, error) {
	var result domainsettings.ImageCacheMaintenance
	entries, err := os.ReadDir(d.dir)
	if err != nil {
		return result, err
	}
	files := make([]diskEntry, 0, len(entries))
	for _, entry := range entries {
		if !managedCacheFile(entry.Name()) || !entry.Type().IsRegular() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return result, err
		}
		path := filepath.Join(d.dir, entry.Name())
		if strings.HasPrefix(entry.Name(), ".image-cache-") || strings.HasSuffix(entry.Name(), ".tmp") || time.Since(info.ModTime()) >= time.Duration(policy.DiskTTLSeconds)*time.Second {
			if err := os.Remove(path); err != nil {
				return result, err
			}
			result.RemovedEntries++
			result.RemovedBytes += info.Size()
			continue
		}
		files = append(files, diskEntry{path: path, size: info.Size(), modified: info.ModTime()})
		result.RemainingBytes += info.Size()
	}
	sort.Slice(files, func(i, j int) bool {
		if files[i].modified.Equal(files[j].modified) {
			return files[i].path < files[j].path
		}
		return files[i].modified.Before(files[j].modified)
	})
	for _, file := range files {
		if result.RemainingBytes <= budget {
			break
		}
		if err := os.Remove(file.path); err != nil {
			return result, err
		}
		result.RemainingBytes -= file.size
		result.RemovedEntries++
		result.RemovedBytes += file.size
	}
	return result, nil
}

// Cleanup 记录真实开始、结束、删除量和错误，失败不伪装为成功。
func (d *DiskCache) Cleanup() error {
	started := time.Now().UTC()
	d.statusMu.Lock()
	d.status.Running, d.status.LastStartedAt = true, &started
	d.statusMu.Unlock()
	policy := imagePolicy(d.policies)
	unlock, err := d.lock()
	var result domainsettings.ImageCacheMaintenance
	if err == nil {
		result, err = d.cleanLocked(policy, policy.DiskMaxBytes)
		unlock()
	}
	finished := time.Now().UTC()
	result.LastStartedAt, result.LastFinishedAt = &started, &finished
	if err != nil {
		result.Error = err.Error()
		log.Error().Err(err).Msg("图片缓存维护失败")
	}
	d.statusMu.Lock()
	d.status = result
	d.statusMu.Unlock()
	return err
}

// Status 返回当前实例最近一次专用图片缓存维护结果。
func (d *DiskCache) Status() domainsettings.ImageCacheMaintenance {
	d.statusMu.RLock()
	defer d.statusMu.RUnlock()
	return d.status
}

// RunMaintenance 由应用生命周期启动并取消，间隔调整在下一秒检查生效。
func (d *DiskCache) RunMaintenance(ctx context.Context, memory *MemoryCache) {
	_ = d.Cleanup()
	last := time.Now()
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			memory.Cleanup()
			policy := imagePolicy(d.policies)
			if time.Since(last) >= time.Duration(policy.CleanupIntervalSeconds)*time.Second {
				_ = d.Cleanup()
				last = time.Now()
			}
		}
	}
}

var _ domainimage.ImageCache = (*DiskCache)(nil)
