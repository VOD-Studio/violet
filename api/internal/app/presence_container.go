package app

import (
	"gorm.io/gorm"

	apppresence "blog-api/internal/application/presence"
	appshared "blog-api/internal/application/shared"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	presencehttp "blog-api/internal/interfaces/http/handler/presence"
)

type PresenceContainer struct {
	Service       *apppresence.Service
	Handler       *presencehttp.Handler
	IngestHandler *presencehttp.IngestHandler
}

func NewPresenceContainer(db *gorm.DB, bus appshared.EventBus) *PresenceContainer {
	repo := gormrepo.NewPresenceRepository(db)
	registry := apppresence.NewRegistry(repo, nil)
	service := apppresence.NewService(repo, registry, bus, nil)
	return &PresenceContainer{
		Service:       service,
		Handler:       presencehttp.NewHandler(service),
		IngestHandler: presencehttp.NewIngestHandler(registry),
	}
}
