package app

import (
	appsiteidentity "blog-api/internal/application/siteidentity"
	siteidentityhttp "blog-api/internal/interfaces/http/handler/siteidentity"
)

// SiteIdentityContainer 持有站点身份的公开 HTTP 入口。
type SiteIdentityContainer struct {
	Handler *siteidentityhttp.Handler
}

// NewSiteIdentityContainer 复用设置只读端口，不向公开资源暴露管理用例。
func NewSiteIdentityContainer(settings appsiteidentity.SettingsReader) *SiteIdentityContainer {
	service := appsiteidentity.NewService(settings)
	return &SiteIdentityContainer{Handler: siteidentityhttp.NewHandler(service)}
}
