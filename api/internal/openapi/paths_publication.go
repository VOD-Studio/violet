package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerPublicationPaths(t *openapi3.T) {
	registerSchema(t, "PublicationItemDTO", openapi3.Schemas{
		"id":           reqStr("类型与来源 UUID 组成的稳定标识"),
		"kind":         strEnum("发布物类型", "article", "note", "gallery"),
		"route_key":    reqStr("公开详情路由参数；文章和图集为 slug，笔记为 UUID"),
		"title":        reqStr("最终公开展示标题"),
		"published_at": reqStr("发布时间，RFC3339"),
		"featured":     optBool("是否精选；仅文章可能为 true"),
	}, "id", "kind", "route_key", "title", "published_at", "featured")
	get(t, "/publications", &openapi3.Operation{
		Tags:        []string{"发布物"},
		Summary:     "读取统一发布物流",
		Description: "匿名读取已发布文章、笔记和图集的轻量投影，严格按发布时间、类型和来源 ID 排序。",
		Parameters: openapi3.Parameters{
			queryStrParam("cursor", "服务端 HMAC 签名的不透明下一页游标"),
			limitParam(100),
			queryStrParam("from", "RFC3339 包含时间下界"),
			queryStrParam("to", "RFC3339 不包含时间上界"),
			&openapi3.ParameterRef{Value: &openapi3.Parameter{
				Name: "featured", In: openapi3.ParameterInQuery,
				Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
					Type: &openapi3.Types{openapi3.TypeBoolean}, Default: false,
				}},
				Description: "true 时只返回精选文章；false 或缺省不过滤",
			}},
		},
		Responses: responses(
			200, dataArrayResponse("PublicationItemDTO", "发布物列表", 200, true),
			304, noContentResponse("缓存仍有效"),
			400, errorResponse("游标、时间或筛选参数非法"),
		),
	})
}
