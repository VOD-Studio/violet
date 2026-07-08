package app

import (
	"path/filepath"
	"time"

	appimage "blog-api/internal/application/image"
	infrapimage "blog-api/internal/infrastructure/image"
	imagehttp "blog-api/internal/interfaces/http/handler/image"
)

// ImageContainer 图片服务容器(装配 transformer + 二级缓存 + service)
type ImageContainer struct {
	ImageHandler *imagehttp.Handler
}

// NewImageContainer 装配图片服务模块
// uploadDir 为静态文件根目录(如 "uploads")，urlPrefix 为 URL 前缀(如 "/uploads")。
func NewImageContainer(uploadDir, urlPrefix string) *ImageContainer {
	transformer := infrapimage.NewTransformer()
	memCache := infrapimage.NewMemoryCache(100, 300*time.Second) // 100 条,TTI 300s
	diskCache := infrapimage.NewDiskCache(filepath.Join(uploadDir, ".cache"))
	composite := infrapimage.NewCompositeCache(memCache, diskCache)
	svc := appimage.NewService(transformer, composite, uploadDir, urlPrefix)
	return &ImageContainer{ImageHandler: imagehttp.NewHandler(svc, uploadDir, urlPrefix)}
}
