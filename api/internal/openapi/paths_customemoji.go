package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerCustomEmojiPaths 注册自定义表情自助上传、收藏与软删除契约。
func registerCustomEmojiPaths(t *openapi3.T) {
	registerSchema(t, "CustomEmojiDTO", openapi3.Schemas{
		"id":   reqStr("自定义表情 ID"),
		"name": reqStr("表情展示名"),
		"url":  reqStr("图片 URL"),
	})
	customEmojiArray := &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:  &openapi3.Types{openapi3.TypeArray},
		Items: &openapi3.SchemaRef{Ref: "#/components/schemas/CustomEmojiDTO"},
	}}
	registerSchema(t, "CustomEmojiMineDTO", openapi3.Schemas{
		"owned":     customEmojiArray,
		"favorited": customEmojiArray,
	})
	t.Components.Schemas["CustomEmojiRefMap"] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:                 &openapi3.Types{openapi3.TypeObject},
		AdditionalProperties: openapi3.AdditionalProperties{Has: openapi3.Ptr(true)},
		Description:          "token 到自定义表情 URL、ID 与 viewer 关系的映射",
	}}
	registerSchema(t, "CustomEmojiCreateRequest", openapi3.Schemas{
		"name": reqStr("表情展示名，同一用户下唯一"),
		"url":  reqStr("已有 /uploads/emoji 上传端点返回的图片 URL"),
	}, "name", "url")

	secure := securityCookie()
	post(t, "/custom-emojis", &openapi3.Operation{
		Tags:        []string{"自定义表情"},
		Summary:     "上传自定义表情",
		Security:    secure,
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CustomEmojiCreateRequest", true, "自定义表情参数"),
		Responses:   responses(201, dataResponse("CustomEmojiDTO", "自定义表情已创建", 201), 400, errorResponse("参数或份额无效"), 401, errorResponse("未登录"), 409, errorResponse("名称已存在")),
	})
	get(t, "/custom-emojis/mine", &openapi3.Operation{
		Tags:      []string{"自定义表情"},
		Summary:   "我的自定义表情",
		Security:  secure,
		Responses: responses(200, dataResponse("CustomEmojiMineDTO", "我的表情", 200), 401, errorResponse("未登录")),
	})
	del(t, "/custom-emojis/{id}", &openapi3.Operation{
		Tags:        []string{"自定义表情"},
		Summary:     "删除自定义表情",
		Description: "上传者本人或持 customemoji:manage 权限的管理员可执行软删除。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("id", "自定义表情 ID"), csrfHeaderParam()},
		Responses:   responses(200, messageResponse("自定义表情已删除"), 400, errorResponse("ID 格式非法"), 401, errorResponse("未登录"), 403, errorResponse("无权删除"), 404, errorResponse("表情不存在")),
	})
	post(t, "/custom-emojis/{id}/favorite", &openapi3.Operation{
		Tags:       []string{"自定义表情"},
		Summary:    "收藏自定义表情",
		Security:   secure,
		Parameters: openapi3.Parameters{pathStrParam("id", "自定义表情 ID"), csrfHeaderParam()},
		Responses:  responses(200, messageResponse("已收藏"), 400, errorResponse("不能收藏或份额已满"), 401, errorResponse("未登录"), 404, errorResponse("表情不存在")),
	})
	del(t, "/custom-emojis/{id}/favorite", &openapi3.Operation{
		Tags:       []string{"自定义表情"},
		Summary:    "移出自定义表情收藏",
		Security:   secure,
		Parameters: openapi3.Parameters{pathStrParam("id", "自定义表情 ID"), csrfHeaderParam()},
		Responses:  responses(200, messageResponse("已移出收藏"), 400, errorResponse("ID 格式非法"), 401, errorResponse("未登录")),
	})
}
