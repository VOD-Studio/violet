package app

import (
	"strings"

	"blog-api/internal/domain/settings"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)

// securityRuntime 持有部署基线：安全组清空（空串）语义为恢复部署默认，
// 与页面文案「留空沿用部署默认」一致，而不是退化为不信任任何代理。
type securityRuntime struct {
	baseProxies []string
}

// splitListString 拆分逗号/换行分隔列表并去空白（与设置组校验同构）。
func splitListString(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	fields := strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == '\n' || r == '\r' })
	items := make([]string, 0, len(fields))
	for _, f := range fields {
		if trimmed := strings.TrimSpace(f); trimmed != "" {
			items = append(items, trimmed)
		}
	}
	return items
}

// NewSecurityApplier 构造安全组热应用回调：把生效快照刷进可信代理解析器、
// CORS 来源与 Cookie 策略三个运行时消费者。启动加载完成后与每次确认生效时
// （settings.Service 锁内）调用。
//
// 约束：回调不得回读 settings.Service（调用点持有 Service 锁），只消费传入
// 快照与构造期注入的部署基线。Cookie 策略只收紧不放松（部署底线见
// response.EffectiveCookieConfig）。
func NewSecurityApplier(baseProxies []string) func(settings.SiteSettings) {
	runtime := &securityRuntime{baseProxies: baseProxies}
	return func(s settings.SiteSettings) {
		proxies := splitListString(s.TrustedProxies)
		if len(proxies) == 0 {
			proxies = runtime.baseProxies
		}
		middleware.SetTrustedProxies(proxies)
		middleware.SetCORSAllowedOrigins(splitListString(s.TrustedOrigins))
		response.SetCookiePolicy(s.CookieSecure, s.CookieSameSite)
	}
}
