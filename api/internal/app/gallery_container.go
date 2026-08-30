package app

import (
	appgallery "blog-api/internal/application/gallery"
	appshared "blog-api/internal/application/shared"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	galleryhttp "blog-api/internal/interfaces/http/handler/gallery"

	"gorm.io/gorm"
)

type GalleryContainer struct {
	Handler *galleryhttp.Handler
	Service *appgallery.Service
}

func NewGalleryContainer(db *gorm.DB, bus appshared.EventBus) *GalleryContainer {
	repo := gormrepo.NewGalleryRepository(db)
	assets := gormrepo.NewGalleryAssetStore(db)
	service := appgallery.NewService(repo, assets, gormrepo.NewGalleryUnitOfWork(db), bus)
	return &GalleryContainer{Handler: galleryhttp.NewHandler(service), Service: service}
}
