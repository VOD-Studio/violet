// Package image 编排图片读取、内容寻址缓存与动态处理。
package image

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	domainimage "blog-api/internal/domain/image"
	domainsettings "blog-api/internal/domain/settings"
)

// Service 约束动态图片源缓冲、共享变换与内容寻址缓存。
type Service struct {
	transformer   domainimage.ImageTransformer
	cache         domainimage.ImageCache
	policies      domainimage.PolicyProvider
	uploadDir     string
	urlPrefix     string
	group         singleflight.Group
	workCtx       context.Context
	cancel        context.CancelFunc
	sourceMu      sync.Mutex
	activeSources int
	sourceChanged chan struct{}
}

// NewService 装配图片服务；策略仅在请求开始时读取一次。
func NewService(transformer domainimage.ImageTransformer, cache domainimage.ImageCache, uploadDir, urlPrefix string, policies domainimage.PolicyProvider) *Service {
	workCtx, cancel := context.WithCancel(context.Background())
	return &Service{
		transformer:   transformer,
		cache:         cache,
		policies:      policies,
		uploadDir:     uploadDir,
		urlPrefix:     strings.TrimSuffix(urlPrefix, "/"),
		workCtx:       workCtx,
		cancel:        cancel,
		sourceChanged: make(chan struct{}),
	}
}

// Close 在应用关停时取消全部共享编码任务；单个请求退出不会关闭服务。
func (s *Service) Close() {
	s.cancel()
}

// Serve 返回当前源文件对应的处理结果；删除和覆盖源文件都会立即使旧缓存不可达。
func (s *Service) Serve(ctx context.Context, relPath string, params domainimage.TransformParams) (domainimage.TransformResult, error) {
	if err := ctx.Err(); err != nil {
		return domainimage.TransformResult{}, err
	}
	if err := s.workCtx.Err(); err != nil {
		return domainimage.TransformResult{}, err
	}
	policy, version := domainsettings.DefaultImagePolicy(), uint64(0)
	if s.policies != nil {
		policy, version = s.policies.Image()
	}
	if !strings.HasPrefix(relPath, s.urlPrefix+"/") {
		return domainimage.TransformResult{}, os.ErrNotExist
	}
	rel := strings.TrimPrefix(relPath, s.urlPrefix+"/")
	if !filepath.IsLocal(rel) {
		return domainimage.TransformResult{}, os.ErrNotExist
	}
	if err := s.acquireSource(ctx, policy.MaxConcurrent); err != nil {
		return domainimage.TransformResult{}, err
	}
	releaseOnReturn := true
	defer func() {
		if releaseOnReturn {
			s.releaseSource()
		}
	}()
	srcPath := filepath.Join(s.uploadDir, rel)
	file, err := os.Open(srcPath)
	if err != nil {
		return domainimage.TransformResult{}, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return domainimage.TransformResult{}, err
	}
	if !info.Mode().IsRegular() || info.Size() > policy.MaxInputBytes {
		return domainimage.TransformResult{}, fmt.Errorf("图片源文件超过输入限制")
	}
	source, err := io.ReadAll(io.LimitReader(file, policy.MaxInputBytes+1))
	if err != nil {
		return domainimage.TransformResult{}, err
	}
	if int64(len(source)) > policy.MaxInputBytes {
		return domainimage.TransformResult{}, fmt.Errorf("图片源文件超过输入限制")
	}
	// 可撤回来源不缓存，避免撤回后继续暴露处理结果。
	if strings.HasPrefix(rel, "external-tweets/") {
		return s.transformer.Transform(ctx, source, params, policy)
	}
	key := cacheKey(source, params, policy, version)
	if cached, _ := s.cache.Get(key); cached.Bytes != nil {
		return cached, nil
	}
	pending := s.group.DoChan(key, func() (any, error) {
		if cached, _ := s.cache.Get(key); cached.Bytes != nil {
			return cached, nil
		}
		// 共享任务归应用生命周期所有，不随第一个等待者断开；即使全部等待者退出，
		// 也只运行到策略超时，完成的结果仍可供后续请求复用。
		workCtx, cancel := context.WithTimeout(s.workCtx, time.Duration(policy.EncodeTimeoutSeconds)*time.Second)
		defer cancel()
		result, err := s.transformer.Transform(workCtx, source, params, policy)
		if err != nil {
			return nil, err
		}
		_ = s.cache.Set(key, result)
		return result, nil
	})
	select {
	case <-ctx.Done():
		// 共享任务仍持有源缓冲，不能随客户端离开立即归还名额。
		releaseOnReturn = false
		go func() {
			<-pending
			s.releaseSource()
		}()
		return domainimage.TransformResult{}, ctx.Err()
	case completed := <-pending:
		if completed.Err != nil {
			return domainimage.TransformResult{}, completed.Err
		}
		return completed.Val.(domainimage.TransformResult), nil
	}
}

func (s *Service) acquireSource(ctx context.Context, max int) error {
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := s.workCtx.Err(); err != nil {
			return err
		}
		s.sourceMu.Lock()
		if s.activeSources < max {
			s.activeSources++
			s.sourceMu.Unlock()
			return nil
		}
		changed := s.sourceChanged
		s.sourceMu.Unlock()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-s.workCtx.Done():
			return s.workCtx.Err()
		case <-changed:
		}
	}
}

func (s *Service) releaseSource() {
	s.sourceMu.Lock()
	defer s.sourceMu.Unlock()
	s.activeSources--
	close(s.sourceChanged)
	s.sourceChanged = make(chan struct{})
}

func cacheKey(source []byte, params domainimage.TransformParams, policy domainsettings.ImagePolicy, version uint64) string {
	h := sha256.New()
	h.Write(source)
	fmt.Fprintf(h, "\x00%s\x00%d\x00%+v", params.Key(), version, policy)
	if params.Format == "webp" && params.Quality > 0 {
		// 旧缓存中的 WebP 忽略请求质量，不能复用为有损展示派生图。
		h.Write([]byte("\x00webp-request-quality-v1"))
	}
	return hex.EncodeToString(h.Sum(nil))
}
