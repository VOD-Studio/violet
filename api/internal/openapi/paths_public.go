package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerPublicPaths 注册公开接口（无需鉴权）：
//   - GET /settings, /github/contributions, /github/repos
//   - GET /projects, /projects/{id}
//   - GET /announcements
//   - GET /emojis, /emojis/groups/{name}
//
// 注：/api/health 位于 /api/v1 之外，单独处理（此处不注册到 v1 Paths）。
func registerPublicPaths(t *openapi3.T) {
	// ---- 公共 schema ----
	// PublicSettings：公开站点配置（不含敏感字段）
	registerSchema(t, "PublicSettings", openapi3.Schemas{
		"site_name":            optStr("站点名称"),
		"site_description":     optStr("站点描述"),
		"site_url":             optStr("站点 URL"),
		"posts_per_page":       optInt("每页文章数"),
		"comments_enabled":     optBool("是否开启评论"),
		"comments_moderation":  optBool("评论是否需要审核"),
		"google_login_enabled": optBool("是否启用 Google 登录"),
		"github_login_enabled": optBool("是否启用 GitHub 登录"),
		"github_username":      optStr("GitHub 用户名"),
		"tech_stack":           optStr("技术栈"),
		"bio":                  optStr("个人简介"),
		"footer_text":          optStr("页脚文案"),
	})

	// ProjectDTO
	registerSchema(t, "ProjectDTO", openapi3.Schemas{
		"id":          reqStr("项目 ID（UUID）"),
		"title":       reqStr("项目标题"),
		"description": optStr("项目描述"),
		"url":         optStr("项目链接"),
		"github_url":  optStr("GitHub 仓库链接"),
		"image_url":   optStr("项目封面图链接"),
		"tech_stack":  strArray("技术栈"),
		"sort_order":  optInt("排序权重"),
		"created_at":  optStr("创建时间（RFC3339）"),
	})

	// AnnouncementDTO
	registerSchema(t, "AnnouncementDTO", openapi3.Schemas{
		"id":           optInt32("公告 ID"),
		"title":        reqStr("标题"),
		"content":      reqStr("内容"),
		"type":         strEnum("公告类型（severity 同义冗余，前端读 severity）", "info", "warning", "success", "error"),
		"severity":     strEnum("严重程度（视觉语义：配色/图标/标签）", "info", "warning", "success", "error"),
		"display":      strEnum("展示形态（banner/card/article）", "banner", "card", "article"),
		"is_active":    optBool("是否启用"),
		"start_time":   optStr("生效时间（RFC3339，可空）"),
		"end_time":     optStr("失效时间（RFC3339，可空）"),
		"sort_order":   optInt("排序权重（越小越靠前）"),
		"affects":      strArray("影响范围（功能模块枚举数组）"),
		"content_md":   optStr("Markdown 源（article 形态）"),
		"content_html": optStr("渲染后 HTML（article 形态）"),
		"cover_image":  optStr("封面图 URL（article 形态）"),
		"excerpt":      optStr("摘要（card/article 形态）"),
		"created_at":   optStr("创建时间（RFC3339）"),
	})

	// EmojiDTO
	registerSchema(t, "EmojiDTO", openapi3.Schemas{
		"id":           optInt32("表情 ID"),
		"group_id":     optInt32("所属分组 ID"),
		"name":         reqStr("表情名称"),
		"url":          reqStr("表情图片 URL"),
		"source_url":   optStr("来源 URL"),
		"gif_url":      optStr("GIF 动图 URL"),
		"text_content": optStr("文字内容（文字表情）"),
		"sort_order":   optInt("排序权重"),
	})

	// EmojiGroupDTO
	registerSchema(t, "EmojiGroupDTO", openapi3.Schemas{
		"id":         optInt32("分组 ID"),
		"name":       reqStr("分组名称"),
		"source":     optStr("来源"),
		"sort_order": optInt("排序权重"),
		"is_enabled": optBool("是否启用"),
		"emojis":     refArray("分组内表情", "EmojiDTO"),
	})

	// ---- GET /settings ----
	t.Paths.Set("/settings", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"站点配置"},
			Summary:     "获取公开站点配置",
			Description: "返回站点公开配置（不含 github_token 等敏感字段）。",
			Responses: responses(
				200, dataResponse("PublicSettings", "公开站点配置", 200),
			),
		},
	})

	// ---- GET /github/contributions ----
	t.Paths.Set("/github/contributions", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"GitHub"},
			Summary:     "GitHub 贡献数据",
			Description: "获取 GitHub 贡献日历数据（绿色方块图）。Token 在后端管理，由站点设置里的 github_username 配置。",
			Responses: responses(
				200, &openapi3.ResponseRef{Value: &openapi3.Response{
					Description: strPtr("GitHub 贡献数据（透传 GitHub API，结构以实际为准）"),
					Content: openapi3.Content{
						"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
							Type: &openapi3.Types{openapi3.TypeObject},
							Properties: openapi3.Schemas{
								"data": {Value: &openapi3.Schema{
									Type:                 &openapi3.Types{openapi3.TypeObject},
									AdditionalProperties: openapi3.AdditionalProperties{Has: openapi3.Ptr(true)},
									Description:          "GitHub 贡献数据（结构由 GitHub API 决定）",
								}},
								"meta": {Ref: "#/components/schemas/" + compMeta},
							},
						}}},
					},
				}},
			),
		},
	})

	// ---- GET /github/repos ----
	t.Paths.Set("/github/repos", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"GitHub"},
			Summary:     "GitHub 仓库数据",
			Description: "获取 GitHub 公开仓库列表。Token 在后端管理。",
			Responses: responses(
				200, dataArrayResponse("ProjectDTO", "GitHub 仓库列表（透传 GitHub API，结构以实际为准）", 200, false),
			),
		},
	})

	// ---- GET /projects ----
	t.Paths.Set("/projects", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"项目"},
			Summary:     "项目列表",
			Description: "获取项目列表（非分页，返回全部）。",
			Responses: responses(
				200, dataArrayResponse("ProjectDTO", "项目列表", 200, false),
			),
		},
	})

	// ---- GET /projects/{id} ----
	t.Paths.Set("/projects/{id}", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:       []string{"项目"},
			Summary:    "项目详情",
			Parameters: openapi3.Parameters{pathStrParam("id", "项目 ID（UUID）")},
			Responses: responses(
				200, dataResponse("ProjectDTO", "项目详情", 200),
			),
		},
	})

	// ---- GET /announcements ----
	t.Paths.Set("/announcements", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"公告"},
			Summary:     "生效公告列表",
			Description: "获取当前生效的公告列表（非分页）。",
			Responses: responses(
				200, dataArrayResponse("AnnouncementDTO", "生效公告列表", 200, false),
			),
		},
	})

	// ---- GET /emojis ----
	t.Paths.Set("/emojis", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"表情"},
			Summary:     "获取所有启用表情分组",
			Description: "返回所有启用（is_enabled=true）的表情分组及其表情（非分页）。",
			Responses: responses(
				200, dataArrayResponse("EmojiGroupDTO", "启用的表情分组列表", 200, false),
			),
		},
	})

	// ---- GET /emojis/groups/{name} ----
	t.Paths.Set("/emojis/groups/{name}", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:       []string{"表情"},
			Summary:    "按名称获取指定表情分组",
			Parameters: openapi3.Parameters{pathStrParam("name", "分组名称")},
			Responses: responses(
				200, dataResponse("EmojiGroupDTO", "指定名称的表情分组", 200),
			),
		},
	})
}
