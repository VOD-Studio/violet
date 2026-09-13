package response

import (
	"sync/atomic"

	"blog-api/config"
)

// cookiePolicy 动态 Cookie 属性（安全组生效路径注入）。
// 只允许收紧：Secure 只升不降，SameSite 显式设置时覆盖启动值。
type cookiePolicy struct {
	secure   bool
	sameSite string
}

var activeCookiePolicy atomic.Pointer[cookiePolicy]

// SetCookiePolicy 注入动态 Cookie 策略（安全组生效时由容器回调）。
// secure=false 与空 sameSite 表示不覆盖对应属性。
func SetCookiePolicy(secure bool, sameSite string) {
	activeCookiePolicy.Store(&cookiePolicy{secure: secure, sameSite: sameSite})
}

// EffectiveCookieConfig 在启动配置之上应用动态策略与部署底线：
//   - Secure：动态开启或部署基线开启时一律开启（数据库值不可降低部署底线）
//   - SameSite：动态策略显式设置时覆盖，否则保持启动值
func EffectiveCookieConfig(base config.CookieConfig) config.CookieConfig {
	policy := activeCookiePolicy.Load()
	if policy == nil {
		return base
	}
	effective := base
	if policy.secure {
		effective.Secure = true
	}
	if policy.sameSite != "" {
		effective.SameSite = policy.sameSite
	}
	return effective
}
