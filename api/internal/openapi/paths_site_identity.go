package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerSiteIdentityPaths(t *openapi3.T) {
	registerSchema(t, "SiteIdentityLinkDTO", openapi3.Schemas{
		"kind":  reqStr("链接类型"),
		"label": reqStr("展示标签"),
		"href":  reqStr("已校验且可直接访问的链接"),
	}, "kind", "label", "href")
	registerSchema(t, "SiteIdentityHeroDTO", openapi3.Schemas{
		"banner_url":        nullableStr("首页背景图 URL；未配置时为 null"),
		"quote":             reqStr("首页引语原文"),
		"quote_translation": reqStr("首页引语译文"),
		"quote_author":      reqStr("首页引语作者"),
	}, "banner_url", "quote", "quote_translation", "quote_author")
	registerSchema(t, "SiteIdentityHomeDTO", openapi3.Schemas{
		"footprint_enabled":          optBool("是否显示发布足迹"),
		"footprint_aggregation_days": optInt("单个足迹节点聚合天数，范围 1–31"),
	}, "footprint_enabled", "footprint_aggregation_days")
	registerSchema(t, "SiteIdentityDTO", openapi3.Schemas{
		"site_name":             reqStr("归一后的站点名称"),
		"site_url":              reqStr("归一后的站点公开根 URL"),
		"owner_name":            reqStr("站主展示名"),
		"bio":                   reqStr("首页简介"),
		"avatar_url":            reqStr("站主头像 URL；未配置时为空字符串"),
		"location":              reqStr("站主所在地；未配置时为空字符串"),
		"hero":                  optRef("首页视觉与引语", "SiteIdentityHeroDTO"),
		"social_links":          refArray("当前有效的社交链接", "SiteIdentityLinkDTO"),
		"subscription_channels": refArray("当前已实现且有效的订阅渠道", "SiteIdentityLinkDTO"),
		"home":                  optRef("首页足迹配置", "SiteIdentityHomeDTO"),
	}, "site_name", "site_url", "owner_name", "bio", "avatar_url", "location", "hero", "social_links", "subscription_channels", "home")

	get(t, "/site-identity", &openapi3.Operation{
		Tags:        []string{"站点身份"},
		Summary:     "读取公开站点身份",
		Description: "匿名读取首页直接消费的站点身份、视觉配置、有效社交链接和订阅渠道，不暴露管理设置与敏感凭据。",
		Responses: responses(
			200, dataResponse("SiteIdentityDTO", "公开站点身份", 200),
			304, noContentResponse("缓存仍有效"),
			500, errorResponse("站点设置读取失败"),
		),
	})
}
