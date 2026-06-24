package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminFilePaths 注册文件管理后台接口（/admin/files）。
// FileDTO 已在 paths_media.go 注册，此处复用。
func registerAdminFilePaths(t *openapi3.T) {
	// GET /admin/files
	get(t, "/admin/files", &openapi3.Operation{
		Tags:        []string{"文件管理"},
		Summary:     "文件列表",
		Description: "分页查询文件列表，可按 purpose 筛选。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			queryStrParam("purpose", "按用途筛选"), pageParam(), limitParam(100),
		},
		Responses: responses(
			200, dataArrayResponse("FileDTO", "文件列表", 200, true),
		),
	})

	// GET /admin/files/instant
	get(t, "/admin/files/instant", &openapi3.Operation{
		Tags:        []string{"文件管理"},
		Summary:     "秒传检查",
		Description: "按文件哈希检查是否已存在（秒传）。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			&openapi3.ParameterRef{Value: &openapi3.Parameter{
				Name: "hash", In: openapi3.ParameterInQuery, Required: true,
				Schema:      &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeString}}},
				Description: "文件哈希（必填）",
			}},
		},
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("秒传检查结果"),
				Content: openapi3.Content{
					"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeObject},
						Properties: openapi3.Schemas{
							"data": {Value: &openapi3.Schema{
								Type: &openapi3.Types{openapi3.TypeObject},
								Properties: openapi3.Schemas{
									"file":   {Ref: "#/components/schemas/FileDTO", Value: &openapi3.Schema{Description: "命中的文件（存在时）"}},
									"exists": optBool("是否已存在"),
								},
							}},
							"meta": {Ref: "#/components/schemas/" + compMeta},
						},
					}}},
				},
			}},
			400, errorResponse("缺少 hash"),
		),
	})

	// DELETE /admin/files/{id}
	del(t, "/admin/files/{id}", &openapi3.Operation{
		Tags:        []string{"文件管理"},
		Summary:     "删除文件",
		Description: "删除文件。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "文件 ID（UUID）"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("文件已删除"),
			404, errorResponse("文件不存在"),
		),
	})
}
