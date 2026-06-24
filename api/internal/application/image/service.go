// Package image 图片服务用例编排:查缓存 → singleflight 防击穿 → miss 调 transformer → 写缓存。
package image

import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"strings"

	"golang.org/x/sync/singleflight"

	domainimage "blog-api/internal/domain/image"
)

// Service 图片服务用例
type Service struct {
	transformer domainimage.ImageTransformer
	cache       domainimage.ImageCache
	uploadDir   string
	group       singleflight.Group
}

// NewService 创建图片服务用例。uploadDir 为静态文件根目录(如 "uploads")。
func NewService(transformer domainimage.ImageTransformer, cache domainimage.ImageCache, uploadDir string) *Service {
	return &Service{transformer: transformer, cache: cache, uploadDir: uploadDir}
}

// Serve 处理一次带参数的图片请求。
// relPath 形如 "/uploads/avatar/x.webp";params 为处理参数。
// 返回处理结果(Bytes 非空表示命中或处理成功)。
func (s *Service) Serve(relPath string, params domainimage.TransformParams) (domainimage.TransformResult, error) {
	// 物理路径:剥掉 /uploads 前缀,接到 uploadDir
	srcPath := filepath.Join(s.uploadDir, strings.TrimPrefix(relPath, "/uploads"))
	cacheKey := cacheKey(srcPath, params)

	// 一级缓存查找
	if cached, _ := s.cache.Get(cacheKey); cached.Bytes != nil {
		return cached, nil
	}

	// singleflight 防击穿:同 key 并发只处理一次
	v, err, _ := s.group.Do(cacheKey, func() (any, error) {
		// 二次查缓存(singleflight 内可能已被并发请求填充)
		if cached, _ := s.cache.Get(cacheKey); cached.Bytes != nil {
			return cached, nil
		}
		result, err := s.transformer.Transform(srcPath, params)
		if err != nil {
			return nil, err
		}
		_ = s.cache.Set(cacheKey, result)
		return result, nil
	})
	if err != nil {
		return domainimage.TransformResult{}, err
	}
	return v.(domainimage.TransformResult), nil
}

// cacheKey 缓存键 = sha256(物理路径 + 参数序列化)。
// params.Key() 定义在 domain 层,application/infrastructure 共用,消除重复。
func cacheKey(srcPath string, params domainimage.TransformParams) string {
	h := sha256.New()
	h.Write([]byte(srcPath))
	h.Write([]byte(params.Key()))
	return hex.EncodeToString(h.Sum(nil))
}
