package app

import (
	"gorm.io/gorm"

	appstats "blog-api/internal/application/stats"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	statshttp "blog-api/internal/interfaces/http/handler/stats"
)

// StatsContainer 仪表盘统计模块容器
type StatsContainer struct {
	StatsHandler *statshttp.Handler
}

// NewStatsContainer 装配统计模块
func NewStatsContainer(db *gorm.DB) *StatsContainer {
	store := gormrepo.NewStatsStore(db)
	svc := appstats.NewService(store)
	return &StatsContainer{StatsHandler: statshttp.NewHandler(svc)}
}
