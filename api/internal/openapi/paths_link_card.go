package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerLinkCardPaths 注册链接卡片通用端点（PRD-0038）。
//
// POST /link-cards/lookup：批量取 OG 卡片快照（公开 + IP 限流）。
// 返回当前可展示的卡片；miss/过期由服务端后台异步抓取，下次请求生效。
func registerLinkCardPaths(t *openapi3.T) {
	registerSchema(t, "LinkCardDTO", openapi3.Schemas{
		"url":         reqStr("规范化后的原文链接（卡片点击目标）"),
		"title":       optStr("卡片标题（og:title 等逐级回退），空串由前端用域名兜底"),
		"description": optStr("摘要，可空"),
		"site_name":   optStr("来源站点名，可空"),
		"image_url":   optStr("封面本站访问路径，无封面为空串"),
	}, "url")

	registerSchema(t, "LinkCardLookupRequest", openapi3.Schemas{
		"urls": &openapi3.SchemaRef{Value: &openapi3.Schema{
			Type:        &openapi3.Types{openapi3.TypeArray},
			Description: "原文链接列表；非法项由服务端规范化丢弃",
			MinItems:    1,
			MaxItems:    new(uint64(10)),
			Items:       &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeString}}},
		}},
	}, "urls")

	// key 为规范化 URL、value 为 LinkCardDTO 的开放映射。
	t.Components.Schemas["LinkCardMap"] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:                 &openapi3.Types{openapi3.TypeObject},
		Description:          "可展示卡片的映射（key 为规范化 URL；不可展示的 URL 不出现）",
		AdditionalProperties: openapi3.AdditionalProperties{Schema: &openapi3.SchemaRef{Ref: "#/components/schemas/LinkCardDTO"}},
	}}

	registerSchema(t, "LinkCardLookupData", openapi3.Schemas{
		"cards":       {Ref: "#/components/schemas/LinkCardMap"},
		"pending":     strArray("尚未完成的规范化 URL；非空时客户端继续查询，完成后停止"),
		"unavailable": strArray("已经结束且没有可展示快照的规范化 URL；403 等失败仅保留正文链接"),
	}, "cards", "pending", "unavailable")

	post(t, "/link-cards/lookup", &openapi3.Operation{
		Tags:        []string{"链接卡片"},
		Summary:     "批量取链接卡片",
		Description: "返回缓存快照与 pending、unavailable 状态。pending 尚未完成，可继续查询；成功或失败后停止。过期快照可先展示，刷新结果在后续查询中替换。",
		Security:    &openapi3.SecurityRequirements{},
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("LinkCardLookupRequest", true, "URL 列表"),
		Responses: responses(
			200, dataResponse("LinkCardLookupData", "卡片映射", 200),
			400, errorResponse("请求体非法或链接数量超上限"),
			429, errorResponse("请求过于频繁"),
		),
	})
}
