package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminSettingsPaths 注册后台站点设置与操作日志接口。
func registerAdminSettingsPaths(t *openapi3.T) {
	// SiteSettings：完整站点配置（含敏感字段 github_token/admin_email）
	registerSchema(t, "SiteSettings", openapi3.Schemas{
		"site_name":           optStr("站点名称"),
		"site_description":    optStr("站点描述"),
		"site_url":            optStr("站点 URL"),
		"admin_email":         optStr("管理员邮箱"),
		"posts_per_page":      optInt("每页文章数"),
		"comments_enabled":    optBool("是否开启评论"),
		"comments_moderation": optBool("评论是否需要审核"),
		"github_username":     optStr("GitHub 用户名"),
		"github_token":        optStr("GitHub Token（敏感）"),
		"tech_stack":          optStr("技术栈"),
		"bio":                 optStr("个人简介"),
		"footer_text":         optStr("页脚文案"),
	})

	// UpdateSettingsRequest：全指针部分更新
	registerSchema(t, "UpdateSettingsRequest", openapi3.Schemas{
		"site_name":           optStr("站点名称"),
		"site_description":    optStr("站点描述"),
		"site_url":            optStr("站点 URL"),
		"admin_email":         optStr("管理员邮箱"),
		"posts_per_page":      optInt("每页文章数"),
		"comments_enabled":    optBool("是否开启评论"),
		"comments_moderation": optBool("评论是否需要审核"),
		"github_username":     optStr("GitHub 用户名"),
		"github_token":        optStr("GitHub Token"),
		"tech_stack":          optStr("技术栈"),
		"bio":                 optStr("个人简介"),
		"footer_text":         optStr("页脚文案"),
	})

	// AuditLog：操作日志（domain 无 json tag，字段名为 PascalCase）
	registerSchema(t, "AuditLog", openapi3.Schemas{
		"ID":         optInt64("日志 ID"),
		"UserID":     optStr("操作用户 ID（UUID，可空）"),
		"Action":     reqStr("操作动作"),
		"Resource":   optStr("操作资源类型"),
		"ResourceID": optStr("操作资源 ID"),
		"Detail": {Value: &openapi3.Schema{
			Type:                 &openapi3.Types{openapi3.TypeObject},
			AdditionalProperties: openapi3.AdditionalProperties{Has: openapi3.BoolPtr(true)},
			Description:          "操作详情（动态字段）",
		}},
		"IPAddress": optStr("操作 IP"),
		"CreatedAt": optStr("操作时间（RFC3339）"),
	})

	// ---- GET /admin/settings ----
	get(t, "/admin/settings", &openapi3.Operation{
		Tags:        []string{"站点设置"},
		Summary:     "获取站点设置",
		Description: "获取全部站点设置（含敏感字段）。需管理员权限。",
		Security:    securityAdmin(),
		Responses: responses(
			200, dataResponse("SiteSettings", "站点设置", 200),
		),
	})

	// ---- PUT /admin/settings ----
	put(t, "/admin/settings", &openapi3.Operation{
		Tags:        []string{"站点设置"},
		Summary:     "更新站点设置",
		Description: "部分更新站点设置（全指针字段）。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("UpdateSettingsRequest", true, "待更新字段"),
		Responses: responses(
			200, dataResponse("SiteSettings", "更新后的站点设置", 200),
		),
	})

	// ---- GET /admin/logs ----
	get(t, "/admin/logs", &openapi3.Operation{
		Tags:        []string{"操作日志"},
		Summary:     "操作日志列表",
		Description: "分页查询操作日志。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pageParam(), limitParam(100)},
		Responses: responses(
			200, dataArrayResponse("AuditLog", "操作日志列表", 200, true),
		),
	})

	// ---- GET /admin/logs/user/{id} ----
	get(t, "/admin/logs/user/{id}", &openapi3.Operation{
		Tags:        []string{"操作日志"},
		Summary:     "用户操作日志",
		Description: "查询指定用户的操作日志。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "用户 ID（UUID）"), pageParam(), limitParam(100),
		},
		Responses: responses(
			200, dataArrayResponse("AuditLog", "用户操作日志列表", 200, true),
		),
	})
}
