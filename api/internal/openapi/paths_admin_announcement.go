package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminAnnouncementPaths 注册公告管理后台接口（/admin/announcements）。
// AnnouncementDTO 已在 paths_public.go 注册，此处复用。
func registerAdminAnnouncementPaths(t *openapi3.T) {
	registerSchema(t, "AdminAnnouncementRequest", openapi3.Schemas{
		"title":      reqStr("标题"),
		"content":    reqStr("内容"),
		"type":       strEnum("公告类型", "info", "warning", "success", "error"),
		"is_active":  optBool("是否启用（仅更新生效）"),
		"start_time": optStr("生效时间（RFC3339）"),
		"end_time":   optStr("失效时间（RFC3339）"),
	}, "title", "content", "type")

	idResp := func(desc string) *openapi3.ResponseRef {
		return &openapi3.ResponseRef{Value: &openapi3.Response{
			Description: strPtr(desc),
			Content: openapi3.Content{
				"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
					Type: &openapi3.Types{openapi3.TypeObject},
					Properties: openapi3.Schemas{
						"data": {Value: &openapi3.Schema{
							Type:       &openapi3.Types{openapi3.TypeObject},
							Properties: openapi3.Schemas{"id": optInt32("新建公告 ID")},
						}},
						"meta": {Ref: "#/components/schemas/" + compMeta},
					},
				}}},
			},
		}}
	}

	// GET /admin/announcements
	get(t, "/admin/announcements", &openapi3.Operation{
		Tags:        []string{"公告管理"},
		Summary:     "公告列表",
		Description: "获取所有公告（含未激活，非分页）。需管理员权限。",
		Security:    securityAdmin(),
		Responses: responses(
			200, dataArrayResponse("AnnouncementDTO", "公告列表", 200, false),
		),
	})

	post(t, "/admin/announcements", &openapi3.Operation{
		Tags:        []string{"公告管理"},
		Summary:     "创建公告",
		Description: "创建公告。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("AdminAnnouncementRequest", true, "公告信息"),
		Responses: responses(
			201, idResp("新建公告 ID"),
			400, errorResponse("请求参数错误"),
		),
	})

	get(t, "/admin/announcements/{id}", &openapi3.Operation{
		Tags:        []string{"公告管理"},
		Summary:     "公告详情",
		Description: "按 ID 获取公告。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathIntParam("id", "公告 ID")},
		Responses: responses(
			200, dataResponse("AnnouncementDTO", "公告详情", 200),
			404, errorResponse("公告不存在"),
		),
	})

	patch(t, "/admin/announcements/{id}", &openapi3.Operation{
		Tags:        []string{"公告管理"},
		Summary:     "更新公告",
		Description: "更新公告。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "公告 ID"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("AdminAnnouncementRequest", true, "待更新字段"),
		Responses: responses(
			200, messageResponse("公告已更新"),
			404, errorResponse("公告不存在"),
		),
	})

	del(t, "/admin/announcements/{id}", &openapi3.Operation{
		Tags:        []string{"公告管理"},
		Summary:     "删除公告",
		Description: "删除公告。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "公告 ID"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("公告已删除"),
			404, errorResponse("公告不存在"),
		),
	})
}
