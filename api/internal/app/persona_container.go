package app

import (
	apppersona "blog-api/internal/application/persona"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	personahttp "blog-api/internal/interfaces/http/handler/persona"

	"gorm.io/gorm"
)

type PersonaContainer struct {
	Handler *personahttp.Handler
	Service *apppersona.Service
}

func NewPersonaContainer(db *gorm.DB) *PersonaContainer {
	repo := gormrepo.NewPersonaRepository(db)
	assets := gormrepo.NewPersonaAssetStore(db)
	service := apppersona.NewService(repo, assets, gormrepo.NewPersonaUnitOfWork(db))
	return &PersonaContainer{Handler: personahttp.NewHandler(service), Service: service}
}
