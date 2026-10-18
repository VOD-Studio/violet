package app

import (
	approadmap "blog-api/internal/application/roadmap"
	appshared "blog-api/internal/application/shared"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	roadmaphttp "blog-api/internal/interfaces/http/handler/roadmap"
	"blog-api/internal/middleware"

	"gorm.io/gorm"
)

type RoadmapContainer struct {
	Handler   *roadmaphttp.Handler
	Service   *approadmap.Service
	Relations *roadmaphttp.RelationHandler
}

func NewRoadmapContainer(db *gorm.DB, checker middleware.PermissionChecker, bus appshared.EventBus) *RoadmapContainer {
	repo := gormrepo.NewRoadmapRepository(db)
	relations := approadmap.NewRelationService(gormrepo.NewRoadmapRelationRepository(db), checker, bus)
	service := approadmap.NewService(repo, gormrepo.NewProjectRepository(db), checker, bus, approadmap.WithRelations(relations))
	return &RoadmapContainer{Handler: roadmaphttp.NewHandler(service), Service: service, Relations: roadmaphttp.NewRelationHandler(relations)}
}
