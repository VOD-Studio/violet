package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerPostPaths 注册文章接口：前台公开（列表/详情/浏览）+ 后台管理 CRUD。
//
// 注意：同一 path 的多方法（如 /admin/posts/{id} 的 GET/PUT/DELETE）用
// get/put/del helper 注册，会合并到同一 PathItem，避免 Paths.Set 覆盖。
func registerPostPaths(t *openapi3.T) {
	// ---- schema ----
	registerSchema(t, "PostDTO", openapi3.Schemas{
		"id":              reqStr("文章 ID（UUID）"),
		"title":           reqStr("标题"),
		"slug":            reqStr("URL slug"),
		"content_md":      optStr("Markdown 原文"),
		"content_html":    optStr("渲染后 HTML"),
		"excerpt":         optStr("摘要"),
		"cover_image":     optStr("封面图 URL"),
		"status":          strEnum("状态", "draft", "published", "archived"),
		"author_id":       reqStr("作者 ID（UUID）"),
		"view_count":      optInt("浏览数"),
		"is_featured":     optBool("是否精选"),
		"seo_title":       optStr("SEO 标题"),
		"seo_description": optStr("SEO 描述"),
		"published_at":    optStr("发布时间（RFC3339，可空）"),
		"tags":            strArray("标签 slug 列表"),
		"created_at":      optStr("创建时间（RFC3339）"),
		"updated_at":      optStr("更新时间（RFC3339）"),
	})

	registerSchema(t, "CreatePostRequest", openapi3.Schemas{
		"title":           reqStr("标题"),
		"slug":            reqStr("URL slug"),
		"content_md":      optStr("Markdown 原文"),
		"content_html":    optStr("渲染后 HTML"),
		"excerpt":         optStr("摘要"),
		"cover_image":     optStr("封面图 URL"),
		"seo_title":       optStr("SEO 标题"),
		"seo_description": optStr("SEO 描述"),
		"tags":            strArray("标签 slug 列表"),
	}, "title", "slug")

	registerSchema(t, "UpdatePostStatusRequest", openapi3.Schemas{
		"status": strEnum("文章状态", "draft", "published", "archived"),
	}, "status")

	// ============ 前台公开 ============

	get(t, "/posts", &openapi3.Operation{
		Tags:    []string{"文章"},
		Summary: "已发布文章列表",
		Description: "获取已发布文章列表（offset 分页）。前台 limit 上限为 50。" +
			"可按 tag slug 过滤。",
		Parameters: openapi3.Parameters{
			pageParam(), limitParam(50), queryStrParam("tag", "按标签 slug 过滤"),
		},
		Responses: responses(
			200, dataArrayResponse("PostDTO", "已发布文章列表", 200, true),
		),
	})

	get(t, "/posts/{slug}", &openapi3.Operation{
		Tags:       []string{"文章"},
		Summary:    "按 slug 获取文章",
		Parameters: openapi3.Parameters{pathStrParam("slug", "文章 slug")},
		Responses: responses(
			200, dataResponse("PostDTO", "文章详情", 200),
			404, errorResponse("文章不存在"),
		),
	})

	post(t, "/posts/{id}/view", &openapi3.Operation{
		Tags:        []string{"文章"},
		Summary:     "增加浏览次数",
		Description: "记录一次文章浏览（IP 取自 X-Real-IP / X-Forwarded-For / RemoteAddr）。返回 204 无响应体。",
		Parameters: openapi3.Parameters{
			pathStrParam("id", "文章 ID（UUID）"), csrfHeaderParam(),
		},
		Responses: responses(
			204, noContentResponse("浏览次数已记录"),
		),
	})

	// ============ 后台管理（管理员）============

	get(t, "/admin/posts", &openapi3.Operation{
		Tags:        []string{"文章管理"},
		Summary:     "所有文章列表",
		Description: "管理员查看所有文章（含草稿/归档），可按 status 过滤。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pageParam(), limitParam(100),
			&openapi3.ParameterRef{Value: &openapi3.Parameter{
				Name: "status", In: openapi3.ParameterInQuery,
				Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
					Type: &openapi3.Types{openapi3.TypeString}, Enum: []any{"draft", "published", "archived"},
				}},
				Description: "按状态过滤",
			}},
		},
		Responses: responses(
			200, dataArrayResponse("PostDTO", "文章列表", 200, true),
		),
	})

	get(t, "/admin/posts/{id}", &openapi3.Operation{
		Tags:        []string{"文章管理"},
		Summary:     "文章详情",
		Description: "按 ID 获取文章（后台）。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "文章 ID（UUID）")},
		Responses: responses(
			200, dataResponse("PostDTO", "文章详情", 200),
			404, errorResponse("文章不存在"),
		),
	})

	post(t, "/admin/posts", &openapi3.Operation{
		Tags:        []string{"文章管理"},
		Summary:     "创建文章",
		Description: "创建文章，作者为当前登录用户。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreatePostRequest", true, "文章内容"),
		Responses: responses(
			201, dataResponse("PostDTO", "新建文章", 201),
			400, errorResponse("请求参数错误"),
		),
	})

	put(t, "/admin/posts/{id}", &openapi3.Operation{
		Tags:        []string{"文章管理"},
		Summary:     "更新文章",
		Description: "更新文章内容。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "文章 ID（UUID）"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("CreatePostRequest", true, "文章内容"),
		Responses: responses(
			200, messageResponse("文章已更新"),
			404, errorResponse("文章不存在"),
		),
	})

	patch(t, "/admin/posts/{id}/status", &openapi3.Operation{
		Tags:        []string{"文章管理"},
		Summary:     "更新文章状态",
		Description: "切换文章状态（draft/published/archived）。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "文章 ID（UUID）"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("UpdatePostStatusRequest", true, "目标状态"),
		Responses: responses(
			200, dataResponse("PostDTO", "更新后的文章", 200),
			404, errorResponse("文章不存在"),
		),
	})

	del(t, "/admin/posts/{id}", &openapi3.Operation{
		Tags:        []string{"文章管理"},
		Summary:     "删除文章",
		Description: "删除文章。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "文章 ID（UUID）"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("文章已删除"),
			404, errorResponse("文章不存在"),
		),
	})
}
