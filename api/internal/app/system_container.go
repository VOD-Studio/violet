package app

import (
	"context"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	appsystem "blog-api/internal/application/system"
	infrasystem "blog-api/internal/infrastructure/system"
	systemhttp "blog-api/internal/interfaces/http/handler/system"
)

// SystemContainer 服务器监控模块容器
type SystemContainer struct {
	SystemHandler *systemhttp.Handler
	Service       *appsystem.Service
}

// NewSystemContainer 装配监控模块并启动采样 goroutine。
// ctx 用于优雅退出（随 HTTP server shutdown 取消）。
func NewSystemContainer(db *gorm.DB, rdb *redis.Client, ctx context.Context) *SystemContainer {
	collector := infrasystem.NewCollector()
	svc := appsystem.NewService(db, rdb, collector)
	sampler := appsystem.NewSampler(ctx, collector, svc)
	go sampler.Run()
	return &SystemContainer{
		SystemHandler: systemhttp.NewHandler(svc),
		Service:       svc,
	}
}
