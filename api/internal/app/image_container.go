package app

import (
	"context"
	"path/filepath"

	appimage "blog-api/internal/application/image"
	domainimage "blog-api/internal/domain/image"
	infrapimage "blog-api/internal/infrastructure/image"
	imagehttp "blog-api/internal/interfaces/http/handler/image"
)

// ImageContainer 图片服务容器(装配 transformer + 二级缓存 + service)
type ImageContainer struct {
	ImageHandler *imagehttp.Handler
	DiskCache    *infrapimage.DiskCache
	MemoryCache  *infrapimage.MemoryCache
	service      *appimage.Service
}

// NewImageContainer 装配图片服务模块
// uploadDir 为静态文件根目录(如 "uploads")，urlPrefix 为 URL 前缀(如 "/uploads")。
func NewImageContainer(uploadDir, urlPrefix string, policies domainimage.PolicyProvider, encoder *infrapimage.Encoder) *ImageContainer {
	transformer := infrapimage.NewTransformer(encoder)
	memCache := infrapimage.NewMemoryCache(policies)
	diskCache := infrapimage.NewDiskCache(filepath.Join(uploadDir, ".cache"), policies)
	composite := infrapimage.NewCompositeCache(memCache, diskCache)
	svc := appimage.NewService(transformer, composite, uploadDir, urlPrefix, policies)
	return &ImageContainer{
		ImageHandler: imagehttp.NewHandler(svc, uploadDir, urlPrefix),
		DiskCache:    diskCache,
		MemoryCache:  memCache,
		service:      svc,
	}
}

// RunMaintenance 启动仅管理图片派生缓存的维护任务，随应用上下文退出。
func (c *ImageContainer) RunMaintenance(ctx context.Context) {
	c.DiskCache.RunMaintenance(ctx, c.MemoryCache)
}

// Close 取消本实例仍在运行的共享图片编码任务。
func (c *ImageContainer) Close() {
	c.service.Close()
}
