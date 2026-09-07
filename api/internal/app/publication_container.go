package app

import (
	apppublication "blog-api/internal/application/publication"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	publicationhttp "blog-api/internal/interfaces/http/handler/publication"

	"gorm.io/gorm"
)

type PublicationContainer struct {
	Handler *publicationhttp.Handler
}

func NewPublicationContainer(db *gorm.DB, cursorKey []byte) *PublicationContainer {
	service := apppublication.NewService(gormrepo.NewPublicationRepository(db), cursorKey)
	return &PublicationContainer{Handler: publicationhttp.NewHandler(service)}
}
