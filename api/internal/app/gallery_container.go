package app

import (
	appgallery "blog-api/internal/application/gallery"
	appshared "blog-api/internal/application/shared"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	galleryhttp "blog-api/internal/interfaces/http/handler/gallery"
	"blog-api/internal/middleware"

	"gorm.io/gorm"
)

type GalleryContainer struct {
	Handler *galleryhttp.Handler
	Service *appgallery.Service
}

func NewGalleryContainer(db *gorm.DB, bus appshared.EventBus, perm middleware.PermissionChecker) *GalleryContainer {
	repo := gormrepo.NewGalleryRepository(db)
	assets := gormrepo.NewGalleryAssetStore(db)
	users := gormrepo.NewGalleryUserDirectory(db)
	service := appgallery.NewService(repo, assets, gormrepo.NewGalleryUnitOfWork(db), bus, perm, users)
	return &GalleryContainer{Handler: galleryhttp.NewHandler(service), Service: service}
}
