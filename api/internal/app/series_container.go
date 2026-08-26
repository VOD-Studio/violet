package app

import (
	"gorm.io/gorm"

	appseries "blog-api/internal/application/series"
	appshared "blog-api/internal/application/shared"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	serieshttp "blog-api/internal/interfaces/http/handler/series"
)

type SeriesContainer struct {
	SeriesHandler *serieshttp.Handler
	SeriesService *appseries.Service
}

// NewSeriesContainer 装配系列书模块（PRD-0021）。
//
// 章节归属直接落在 posts 三列（migration 102），仓储跨表读写，
// 不依赖 post 域应用层；bus 发布 series.* 事件（审计订阅者消费）。
func NewSeriesContainer(db *gorm.DB, bus appshared.EventBus) *SeriesContainer {
	repo := gormrepo.NewSeriesRepository(db)
	svc := appseries.NewService(repo, bus)
	return &SeriesContainer{
		SeriesHandler: serieshttp.NewHandler(svc),
		SeriesService: svc,
	}
}
