// Package siteimpression 提供匿名设备印记的公开 HTTP 接口。
package siteimpression

import (
	"net/http"

	appsiteimpression "blog-api/internal/application/siteimpression"
	"blog-api/internal/interfaces/http/response"
)

const (
	impressionCookieName   = "violet_impression"
	impressionCookieMaxAge = 365 * 24 * 60 * 60
	privateCacheControl    = "private, no-cache"
)

// Handler 在 HttpOnly Cookie 与应用用例之间转换设备身份。
type Handler struct {
	service      *appsiteimpression.Service
	cookieDomain string
}

// NewHandler 绑定应用服务与可选 Cookie 域名。
func NewHandler(service *appsiteimpression.Service, cookieDomain string) *Handler {
	return &Handler{service: service, cookieDomain: cookieDomain}
}

// Get 返回去重设备总数与当前设备状态，不允许共享缓存复用其他设备的结果。
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	state, err := h.service.Get(r.Context(), readImpressionCookie(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", privateCacheControl)
	w.Header().Add("Vary", "Cookie")
	response.RespondOK(w, state)
}

// Post 幂等登记当前设备，并在缺少有效令牌时下发一年期 Cookie。
func (h *Handler) Post(w http.ResponseWriter, r *http.Request) {
	state, issuedToken, err := h.service.Impress(r.Context(), readImpressionCookie(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if issuedToken != "" {
		http.SetCookie(w, &http.Cookie{
			Name:     impressionCookieName,
			Value:    issuedToken,
			Path:     "/",
			Domain:   h.cookieDomain,
			MaxAge:   impressionCookieMaxAge,
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteLaxMode,
		})
	}
	response.RespondOK(w, state)
}

func readImpressionCookie(r *http.Request) string {
	cookie, err := r.Cookie(impressionCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}
