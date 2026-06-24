package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminEmojiPaths 注册表情后台管理接口（/admin/emojis/*）。
// EmojiGroupDTO/EmojiDTO 已在 paths_public.go 注册，此处复用。
func registerAdminEmojiPaths(t *openapi3.T) {
	registerSchema(t, "CreateEmojiGroupRequest", openapi3.Schemas{
		"name":       reqStr("分组名称"),
		"source":     optStr("来源（缺省 system）"),
		"sort_order": optInt("排序权重"),
		"is_enabled": optBool("是否启用（缺省 true）"),
	}, "name")

	registerSchema(t, "UpdateEmojiGroupRequest", openapi3.Schemas{
		"name":       optStr("分组名称"),
		"source":     optStr("来源"),
		"sort_order": optInt("排序权重"),
		"is_enabled": optBool("是否启用"),
	})

	registerSchema(t, "BatchEmojiGroupStatusRequest", openapi3.Schemas{
		"ids":        intArray("分组 ID 列表（int32）"),
		"is_enabled": optBool("是否启用"),
	}, "ids")

	registerSchema(t, "CreateEmojiRequest", openapi3.Schemas{
		"name":         reqStr("表情名称"),
		"url":          optStr("表情图片 URL"),
		"text_content": optStr("文字内容"),
		"gif_url":      optStr("GIF 动图 URL"),
		"source_url":   optStr("来源 URL"),
		"sort_order":   optInt("排序权重"),
	}, "name")

	registerSchema(t, "UpdateEmojiRequest", openapi3.Schemas{
		"name":         optStr("表情名称"),
		"url":          optStr("表情图片 URL"),
		"text_content": optStr("文字内容"),
		"gif_url":      optStr("GIF 动图 URL"),
		"source_url":   optStr("来源 URL"),
		"sort_order":   optInt("排序权重"),
	})

	registerSchema(t, "EmojiUploadResult", openapi3.Schemas{
		"url":       reqStr("访问 URL"),
		"filename":  reqStr("文件名"),
		"size":      optInt64("字节数"),
		"mime_type": optStr("MIME 类型"),
	})

	affectedResp := func(desc string) *openapi3.ResponseRef {
		return &openapi3.ResponseRef{Value: &openapi3.Response{
			Description: strPtr(desc),
			Content: openapi3.Content{
				"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
					Type: &openapi3.Types{openapi3.TypeObject},
					Properties: openapi3.Schemas{
						"data": {Value: &openapi3.Schema{
							Type:       &openapi3.Types{openapi3.TypeObject},
							Properties: openapi3.Schemas{"affected": optInt64("受影响数量")},
						}},
						"meta": {Ref: "#/components/schemas/" + compMeta},
					},
				}}},
			},
		}}
	}

	// ---- 分组管理 ----
	get(t, "/admin/emojis/groups", &openapi3.Operation{
		Tags:        []string{"表情管理"},
		Summary:     "所有分组（含未启用）",
		Description: "获取所有表情分组（含禁用）。需管理员权限。",
		Security:    securityAdmin(),
		Responses: responses(
			200, dataArrayResponse("EmojiGroupDTO", "表情分组列表", 200, false),
		),
	})

	post(t, "/admin/emojis/groups", &openapi3.Operation{
		Tags:        []string{"表情管理"},
		Summary:     "创建分组",
		Description: "创建表情分组。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreateEmojiGroupRequest", true, "分组信息"),
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("新建分组 ID"),
				Content: openapi3.Content{
					"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeObject},
						Properties: openapi3.Schemas{
							"data": {Value: &openapi3.Schema{
								Type:       &openapi3.Types{openapi3.TypeObject},
								Properties: openapi3.Schemas{"id": optInt32("新建分组 ID")},
							}},
							"meta": {Ref: "#/components/schemas/" + compMeta},
						},
					}}},
				},
			}},
			400, errorResponse("请求参数错误"),
		),
	})

	patch(t, "/admin/emojis/groups/batch-status", &openapi3.Operation{
		Tags:        []string{"表情管理"},
		Summary:     "批量启用/禁用分组",
		Description: "批量修改分组启用状态。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("BatchEmojiGroupStatusRequest", true, "分组 ID 列表与目标状态"),
		Responses: responses(
			200, affectedResp("批量更新结果"),
		),
	})

	patch(t, "/admin/emojis/groups/{id}", &openapi3.Operation{
		Tags:        []string{"表情管理"},
		Summary:     "更新分组",
		Description: "更新表情分组。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "分组 ID"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("UpdateEmojiGroupRequest", true, "待更新字段"),
		Responses: responses(
			200, messageResponse("分组已更新"),
			404, errorResponse("分组不存在"),
		),
	})

	del(t, "/admin/emojis/groups/{id}", &openapi3.Operation{
		Tags:        []string{"表情管理"},
		Summary:     "删除分组",
		Description: "删除表情分组。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "分组 ID"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("分组已删除"),
			404, errorResponse("分组不存在"),
		),
	})

	// ---- 分组内表情 ----
	get(t, "/admin/emojis/groups/{id}/emojis", &openapi3.Operation{
		Tags:        []string{"表情管理"},
		Summary:     "分组内表情列表",
		Description: "获取指定分组内的表情。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathIntParam("id", "分组 ID")},
		Responses: responses(
			200, dataArrayResponse("EmojiDTO", "表情列表", 200, false),
			404, errorResponse("分组不存在"),
		),
	})

	post(t, "/admin/emojis/groups/{id}/emojis", &openapi3.Operation{
		Tags:        []string{"表情管理"},
		Summary:     "在分组内创建表情",
		Description: "在指定分组内创建表情。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "分组 ID"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("CreateEmojiRequest", true, "表情信息"),
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("新建表情 ID"),
				Content: openapi3.Content{
					"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeObject},
						Properties: openapi3.Schemas{
							"data": {Value: &openapi3.Schema{
								Type:       &openapi3.Types{openapi3.TypeObject},
								Properties: openapi3.Schemas{"id": optInt32("新建表情 ID")},
							}},
							"meta": {Ref: "#/components/schemas/" + compMeta},
						},
					}}},
				},
			}},
			400, errorResponse("请求参数错误"),
		),
	})

	// ---- 单个表情 ----
	post(t, "/admin/emojis/upload", &openapi3.Operation{
		Tags:        []string{"表情管理"},
		Summary:     "上传表情图片",
		Description: "上传表情图片（multipart/form-data，字段 file，≤10MB，扩展名白名单 jpg/jpeg/png/gif/webp/svg）。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: binaryBody("multipart/form-data", "表情图片（字段名 file）"),
		Responses: responses(
			200, dataResponse("EmojiUploadResult", "上传结果", 200),
			400, errorResponse("文件类型不允许"),
		),
	})

	patch(t, "/admin/emojis/emojis/{id}", &openapi3.Operation{
		Tags:        []string{"表情管理"},
		Summary:     "更新表情",
		Description: "更新单个表情。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "表情 ID"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("UpdateEmojiRequest", true, "待更新字段"),
		Responses: responses(
			200, messageResponse("表情已更新"),
			404, errorResponse("表情不存在"),
		),
	})

	del(t, "/admin/emojis/emojis/{id}", &openapi3.Operation{
		Tags:        []string{"表情管理"},
		Summary:     "删除表情",
		Description: "删除单个表情。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "表情 ID"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("表情已删除"),
			404, errorResponse("表情不存在"),
		),
	})
}
