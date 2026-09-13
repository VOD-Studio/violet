package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminSubscriptionPaths 订阅源管理接口：RSS/Atom 订阅的 CRUD 与
// 抓取控制。
func registerAdminSubscriptionPaths(t *openapi3.T) {
	secure := securityAdmin()

	registerSchema(t, "SubscriptionDTO", openapi3.Schemas{
		"id":                  reqStr("订阅 ID"),
		"user_id":             optStr("创建者用户 ID"),
		"feed_url":            reqStr("订阅源 URL"),
		"title":               reqStr("标题"),
		"source_type":         optStr("来源类型（rss/page）"),
		"interval":            optStr("抓取间隔（如 daily）"),
		"auto_publish":        optBool("抓到新文章是否自动发布"),
		"canonical_override":  optStr("转载源 canonical 覆盖（缺省=原创）"),
		"tags":                strArray("自动打标"),
		"status":              strEnum("订阅状态", "active", "paused"),
		"consecutive_failures": optInt("连续失败次数"),
		"last_error":          optStr("最近一次错误（缺省=无）"),
		"last_fetched_at":     optStr("最近抓取时间（RFC3339，缺省=从未）"),
		"next_fetch_at":       optStr("下次抓取时间（RFC3339）"),
		"retry_after_until":   optStr("退避重试截止（RFC3339）"),
		"created_at":          reqStr("创建时间（RFC3339）"),
		"updated_at":          reqStr("更新时间（RFC3339）"),
	})

	registerSchema(t, "CreateSubscriptionRequest", openapi3.Schemas{
		"feed_url":           reqStr("订阅源 URL"),
		"title":              optStr("标题"),
		"interval":           optStr("抓取间隔（空=daily）"),
		"auto_publish":       optBool("自动发布"),
		"canonical_override": optStr("canonical 覆盖"),
		"tags":               strArray("自动打标"),
	}, "feed_url")

	registerSchema(t, "UpdateSubscriptionRequest", openapi3.Schemas{
		"title":              optStr("新标题（PATCH 语义，缺省=不改）"),
		"interval":           optStr("新间隔（缺省=不改）"),
		"auto_publish":       optBool("自动发布（缺省=不改）"),
		"canonical_override": optStr("canonical 覆盖（缺省=不改）"),
		"tags":               strArray("自动打标（缺省=不改）"),
	})

	get(t, "/admin/subscriptions", &openapi3.Operation{
		Tags:        []string{"订阅管理"},
		Summary:     "订阅列表",
		Description: "需 subscription:manage 权限。status 过滤（active/paused，空=全部），offset 分页。",
		Security:    secure,
		Parameters: append(
			openapi3.Parameters{queryStrParam("status", "过滤状态（active/paused，空=全部）")},
			pageParam(), limitParam(100),
		),
		Responses: responses(
			200, dataArrayResponse("SubscriptionDTO", "订阅列表", 200, true),
		),
	})

	get(t, "/admin/subscriptions/{id}", &openapi3.Operation{
		Tags:       []string{"订阅管理"},
		Summary:    "订阅详情",
		Security:   secure,
		Parameters: openapi3.Parameters{pathStrParam("id", "订阅 ID")},
		Responses: responses(
			200, dataResponse("SubscriptionDTO", "订阅详情", 200),
			404, errorResponse("订阅不存在"),
		),
	})

	post(t, "/admin/subscriptions", &openapi3.Operation{
		Tags:        []string{"订阅管理"},
		Summary:     "创建订阅",
		Description: "需 subscription:manage 权限。",
		Security:    secure,
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreateSubscriptionRequest", true, "订阅参数"),
		Responses: responses(
			201, dataResponse("SubscriptionDTO", "新建订阅", 201),
			400, errorResponse("feed_url 非法"),
		),
	})

	put(t, "/admin/subscriptions/{id}", &openapi3.Operation{
		Tags:        []string{"订阅管理"},
		Summary:     "更新订阅",
		Description: "需 subscription:manage 权限。PATCH 语义：缺省字段不改。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("id", "订阅 ID"), csrfHeaderParam()},
		RequestBody: jsonBody("UpdateSubscriptionRequest", true, "可更新字段"),
		Responses: responses(
			200, dataResponse("SubscriptionDTO", "更新后的订阅", 200),
			404, errorResponse("订阅不存在"),
		),
	})

	del(t, "/admin/subscriptions/{id}", &openapi3.Operation{
		Tags:        []string{"订阅管理"},
		Summary:     "删除订阅",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("id", "订阅 ID"), csrfHeaderParam()},
		Responses: responses(
			200, messageResponse("订阅已删除"),
			404, errorResponse("订阅不存在"),
		),
	})

	post(t, "/admin/subscriptions/{id}/fetch", &openapi3.Operation{
		Tags:        []string{"订阅管理"},
		Summary:     "立即抓取",
		Description: "需 subscription:manage 权限。异步执行（202），完成后经通知中心推送结果。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("id", "订阅 ID"), csrfHeaderParam()},
		Responses: responses(
			202, messageResponse("抓取已开始，完成后会通知你"),
			404, errorResponse("订阅不存在"),
		),
	})

	post(t, "/admin/subscriptions/{id}/pause", &openapi3.Operation{
		Tags:        []string{"订阅管理"},
		Summary:     "暂停订阅",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("id", "订阅 ID"), csrfHeaderParam()},
		Responses: responses(
			200, dataResponse("SubscriptionDTO", "暂停后的订阅", 200),
			404, errorResponse("订阅不存在"),
		),
	})

	post(t, "/admin/subscriptions/{id}/resume", &openapi3.Operation{
		Tags:        []string{"订阅管理"},
		Summary:     "恢复订阅",
		Description: "恢复时清零连续失败计数。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("id", "订阅 ID"), csrfHeaderParam()},
		Responses: responses(
			200, dataResponse("SubscriptionDTO", "恢复后的订阅", 200),
			404, errorResponse("订阅不存在"),
		),
	})
}
