package app

import (
	"crypto/hmac"
	"crypto/sha256"
	"net/http"

	"blog-api/config"
	appsiteimpression "blog-api/internal/application/siteimpression"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	siteimpressionhttp "blog-api/internal/interfaces/http/handler/siteimpression"
	"blog-api/internal/middleware"

	"gorm.io/gorm"
)

const (
	siteImpressionTokenPurpose     = "device-token"
	siteImpressionRateLimitPurpose = "ip-rate-limit"
)

// SiteImpressionContainer 将令牌摘要与 IP 限流隔离到不同 HMAC 子密钥。
type SiteImpressionContainer struct {
	Handler  *siteimpressionhttp.Handler
	Identity func(*http.Request) string
}

// NewSiteImpressionContainer 派生后的密钥只进入各自的运行时边界。
func NewSiteImpressionContainer(db *gorm.DB, rootKey []byte, cookieCfg config.CookieConfig) *SiteImpressionContainer {
	tokenKey := deriveSiteImpressionKey(rootKey, siteImpressionTokenPurpose)
	rateLimitKey := deriveSiteImpressionKey(rootKey, siteImpressionRateLimitPurpose)
	service := appsiteimpression.NewService(gormrepo.NewSiteImpressionRepository(db), tokenKey)
	return &SiteImpressionContainer{
		Handler:  siteimpressionhttp.NewHandler(service, cookieCfg),
		Identity: middleware.HashedIPIdentity(rateLimitKey),
	}
}

func deriveSiteImpressionKey(rootKey []byte, purpose string) []byte {
	mac := hmac.New(sha256.New, rootKey)
	_, _ = mac.Write([]byte("violet/site-impressions/" + purpose + "/v1"))
	return mac.Sum(nil)
}
