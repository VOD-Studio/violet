package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerTagPaths 注册标签接口。
func registerTagPaths(t *openapi3.T) {
	registerSchema(t, "TagDTO", openapi3.Schemas{
		"id":   optInt32("标签 ID"),
		"name": reqStr("标签名"),
		"slug": reqStr("URL slug"),
	})

	registerSchema(t, "CreateTagRequest", openapi3.Schemas{
		"name": reqStr("标签名"),
	}, "name")

	// GET /tags（公开，非分页）
	get(t, "/tags", &openapi3.Operation{
		Tags:    []string{"标签"},
		Summary: "标签列表",
		Responses: responses(
			200, dataArrayResponse("TagDTO", "标签列表", 200, false),
		),
	})

	// POST /tags（管理员）
	post(t, "/tags", &openapi3.Operation{
		Tags:        []string{"标签"},
		Summary:     "创建标签",
		Description: "需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreateTagRequest", true, "标签名"),
		Responses: responses(
			201, dataResponse("TagDTO", "新建标签", 201),
			400, errorResponse("请求参数错误或标签名重复"),
		),
	})

	// DELETE /tags/{id}（管理员）
	del(t, "/tags/{id}", &openapi3.Operation{
		Tags:        []string{"标签"},
		Summary:     "删除标签",
		Description: "需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "标签 ID"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("标签已删除"),
			404, errorResponse("标签不存在"),
		),
	})
}
