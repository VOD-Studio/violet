package app

import (
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	appann "blog-api/internal/application/announcement"
	appproj "blog-api/internal/application/project"
	appreleases "blog-api/internal/application/releases"
	approadmap "blog-api/internal/application/roadmap"
	appshared "blog-api/internal/application/shared"
	infragithub "blog-api/internal/infrastructure/github"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	contenthttp "blog-api/internal/interfaces/http/handler/content"
)

// ContentContainer announcement + project 模块容器
type ContentContainer struct {
	ContentHandler *contenthttp.Handler
	ProjectService *appproj.Service
}

// NewContentContainer 装配 announcement + project DDD 模块
func NewContentContainer(db *gorm.DB, bus appshared.EventBus, rdb *redis.Client) *ContentContainer {
	annRepo := gormrepo.NewAnnouncementRepository(db)
	projRepo := gormrepo.NewProjectRepository(db)

	annSvc := appann.NewService(annRepo, bus)
	projSvc := appproj.NewService(projRepo).WithRoadmapSummaries(
		approadmap.NewProjectSummaryReader(gormrepo.NewRoadmapSummaryReader(db)),
	).WithReleaseSummaries(appreleases.NewPublicSummaryReader(infragithub.NewAdapter(), rdb))

	return &ContentContainer{
		ContentHandler: contenthttp.NewHandler(annSvc, projSvc),
		ProjectService: projSvc,
	}
}
