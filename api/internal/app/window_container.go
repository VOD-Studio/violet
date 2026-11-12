package app

import (
	"github.com/redis/go-redis/v9"

	appshared "blog-api/internal/application/shared"
	appwindow "blog-api/internal/application/window"
	domainsettings "blog-api/internal/domain/settings"
	infraopenmeteo "blog-api/internal/infrastructure/openmeteo"
	windowhttp "blog-api/internal/interfaces/http/handler/window"
)

type WindowContainer struct {
	Handler *windowhttp.Handler
}

func NewWindowContainer(settingsStore domainsettings.SettingsStore, rdb *redis.Client, bus appshared.EventBus) *WindowContainer {
	svc := appwindow.NewService(settingsStore, infraopenmeteo.NewClient(), rdb, bus)
	return &WindowContainer{Handler: windowhttp.NewHandler(svc)}
}
