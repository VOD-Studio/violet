package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminStatsPaths 注册后台统计接口（/admin/stats）。
func registerAdminStatsPaths(t *openapi3.T) {
	// PostSummary：统计内的文章摘要
	registerSchema(t, "PostSummary", openapi3.Schemas{
		"id":           reqStr("文章 ID（UUID）"),
		"title":        reqStr("标题"),
		"slug":         reqStr("slug"),
		"status":       optStr("状态（popular 列表不填充）"),
		"view_count":   optInt("浏览数"),
		"published_at": optStr("发布时间（RFC3339，可空）"),
	})

	registerSchema(t, "DashboardStats", openapi3.Schemas{
		"total_posts":      optInt64("文章总数"),
		"total_comments":   optInt64("评论总数"),
		"pending_comments": optInt64("待审核评论数"),
		"total_views":      optInt64("总浏览量"),
		"total_users":      optInt64("用户总数"),
		"recent_posts":     refArray("最近文章", "PostSummary"),
		"popular_posts":    refArray("热门文章", "PostSummary"),
	})

	registerSchema(t, "ViewPoint", openapi3.Schemas{
		"label": reqStr("时间标签（YYYY-MM-DD 或 YYYY-MM）"),
		"count": optInt64("浏览量"),
	})

	registerSchema(t, "ViewTrends", openapi3.Schemas{
		"daily":   refArray("近 30 天每日浏览量", "ViewPoint"),
		"monthly": refArray("近 12 个月每月浏览量", "ViewPoint"),
	})

	// ---- GET /admin/stats ----
	get(t, "/admin/stats", &openapi3.Operation{
		Tags:        []string{"统计"},
		Summary:     "仪表盘总览统计",
		Description: "返回仪表盘总览统计数据。需管理员权限。",
		Security:    securityAdmin(),
		Responses: responses(
			200, dataResponse("DashboardStats", "总览统计", 200),
		),
	})

	// ---- GET /admin/stats/views ----
	get(t, "/admin/stats/views", &openapi3.Operation{
		Tags:        []string{"统计"},
		Summary:     "浏览量趋势",
		Description: "返回近 30 天每日与近 12 个月每月的浏览量趋势。需管理员权限。",
		Security:    securityAdmin(),
		Responses: responses(
			200, dataResponse("ViewTrends", "浏览量趋势", 200),
		),
	})
}
