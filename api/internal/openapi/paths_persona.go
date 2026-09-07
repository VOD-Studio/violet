package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerPersonaPaths(t *openapi3.T) {
	registerSchema(t, "PersonaFactRequest", openapi3.Schemas{
		"label": reqStr("资料项名称，最多 40 字符"),
		"value": reqStr("资料项内容，最多 300 字符"),
	}, "label", "value")
	registerSchema(t, "PersonaImageRequest", openapi3.Schemas{
		"file_id":           reqStr("素材文件 UUID"),
		"caption":           reqStr("当前人设语境下的图片说明，允许空串，最多 500 字符"),
		"alt_text_override": reqStr("当前人设语境下的无障碍文本覆盖，允许空串，最多 300 字符"),
	}, "file_id", "caption", "alt_text_override")
	registerSchema(t, "PersonaSaveRequest", openapi3.Schemas{
		"expected_version": optInt64("档案乐观锁版本，必须大于 0"),
		"name":             reqStr("人设名称，草稿允许空串，最多 120 字符"),
		"subtitle":         reqStr("一句角色定位，允许空串，最多 240 字符"),
		"summary":          reqStr("主视觉旁简介，草稿允许空串，最多 500 字符"),
		"content_md":       reqStr("完整设定文档 Markdown 源，草稿允许空串"),
		"facts":            refArray("完整有序资料项列表，最多 24 项", "PersonaFactRequest"),
		"images":           refArray("完整有序设定图列表，第一项是主视觉，最多 30 项", "PersonaImageRequest"),
	}, "expected_version", "name", "subtitle", "summary", "content_md", "facts", "images")
	registerSchema(t, "PersonaVersionRequest", openapi3.Schemas{
		"expected_version": optInt64("档案乐观锁版本，必须大于 0"),
	}, "expected_version")
	registerSchema(t, "PersonaFactDTO", openapi3.Schemas{
		"label": reqStr("资料项名称"),
		"value": reqStr("资料项内容"),
	}, "label", "value")
	registerSchema(t, "PersonaAdminImageDTO", openapi3.Schemas{
		"file_id":           reqStr("素材文件 UUID"),
		"url":               reqStr("原图 URL"),
		"thumbnail":         reqStr("缩略图 URL"),
		"mime_type":         reqStr("图片 MIME 类型"),
		"width":             optInt("图片宽度，未知为 0"),
		"height":            optInt("图片高度，未知为 0"),
		"caption":           reqStr("当前人设语境下的图片说明"),
		"alt_text":          reqStr("已解析的无障碍文本"),
		"alt_text_override": reqStr("当前人设语境下的无障碍文本覆盖"),
	}, "file_id", "url", "thumbnail", "mime_type", "width", "height", "caption", "alt_text", "alt_text_override")
	registerSchema(t, "PersonaPublicImageDTO", openapi3.Schemas{
		"url":       reqStr("原图 URL"),
		"thumbnail": reqStr("缩略图 URL"),
		"width":     optInt("图片宽度，未知为 0"),
		"height":    optInt("图片高度，未知为 0"),
		"caption":   reqStr("图片说明"),
		"alt_text":  reqStr("已解析的无障碍文本"),
	}, "url", "thumbnail", "width", "height", "caption", "alt_text")
	registerSchema(t, "PersonaSummaryDTO", openapi3.Schemas{
		"id":          reqStr("人设档案 UUID"),
		"name":        reqStr("人设名称"),
		"subtitle":    reqStr("一句角色定位"),
		"summary":     reqStr("角色简介"),
		"fact_count":  optInt("资料项数量"),
		"image_count": optInt("设定图数量"),
		"is_active":   optBool("是否为站点当前人设"),
		"is_complete": optBool("是否满足激活完整性"),
		"version":     optInt64("档案乐观锁版本"),
		"created_at":  reqStr("创建时间，RFC3339"),
		"updated_at":  reqStr("最近保存时间，RFC3339"),
	}, "id", "name", "subtitle", "summary", "fact_count", "image_count", "is_active", "is_complete", "version", "created_at", "updated_at")
	registerSchema(t, "PersonaDetailDTO", openapi3.Schemas{
		"id":           reqStr("人设档案 UUID"),
		"created_by":   reqStr("创建管理员 UUID"),
		"name":         reqStr("人设名称"),
		"subtitle":     reqStr("一句角色定位"),
		"summary":      reqStr("角色简介"),
		"content_md":   reqStr("完整设定文档 Markdown 源"),
		"content_html": reqStr("服务端生成的 HTML 阅读载体"),
		"facts":        refArray("完整有序资料项列表", "PersonaFactDTO"),
		"images":       refArray("完整有序设定图列表", "PersonaAdminImageDTO"),
		"is_active":    optBool("是否为站点当前人设"),
		"is_complete":  optBool("是否满足激活完整性"),
		"version":      optInt64("档案乐观锁版本"),
		"created_at":   reqStr("创建时间，RFC3339"),
		"updated_at":   reqStr("最近保存时间，RFC3339"),
	}, "id", "created_by", "name", "subtitle", "summary", "content_md", "content_html", "facts", "images", "is_active", "is_complete", "version", "created_at", "updated_at")
	registerSchema(t, "PublicPersonaDTO", openapi3.Schemas{
		"name":         reqStr("当前人设名称"),
		"subtitle":     reqStr("一句角色定位"),
		"summary":      reqStr("角色简介"),
		"content_html": reqStr("设定正文 HTML 阅读载体"),
		"facts":        refArray("有序资料项", "PersonaFactDTO"),
		"images":       refArray("有序设定图，第一项是主视觉", "PersonaPublicImageDTO"),
	}, "name", "subtitle", "summary", "content_html", "facts", "images")

	secure := securityAdmin()
	get(t, "/persona", &openapi3.Operation{
		Tags: []string{"人设档案"}, Summary: "读取当前人设",
		Description: "匿名读取站点唯一当前人设；未选择时返回 404。",
		Responses:   responses(200, dataResponse("PublicPersonaDTO", "当前人设", 200), 404, errorResponse("站点尚未选择当前人设")),
	})
	get(t, "/admin/personas", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "人设档案列表",
		Description: "当前人设优先，再按最近保存时间倒序分页。需 persona:view 权限。",
		Security:    secure, Parameters: openapi3.Parameters{
			pageParam(), limitParam(100), queryStrParam("q", "按人设名称模糊搜索"),
		},
		Responses: responses(200, dataArrayResponse("PersonaSummaryDTO", "人设档案列表", 200, true), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:view 权限")),
	})
	post(t, "/admin/personas", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "创建空人设档案",
		Description: "创建 version=1 的空档案，不自动公开。需 persona:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{csrfHeaderParam()},
		Responses: responses(201, dataResponse("PersonaDetailDTO", "空人设档案", 201), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:manage 权限")),
	})
	get(t, "/admin/personas/{id}", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "人设档案详情",
		Description: "读取完整编辑文档、素材投影和当前状态。需 persona:view 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "人设档案 UUID")},
		Responses: responses(200, dataResponse("PersonaDetailDTO", "人设档案详情", 200), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:view 权限"), 404, errorResponse("人设档案不存在")),
	})
	put(t, "/admin/personas/{id}", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "完整保存人设档案",
		Description: "完整替换身份摘要、资料项、设定正文和有序设定图；当前档案必须保持完整。需 persona:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "人设档案 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("PersonaSaveRequest", true, "完整 Persona document"),
		Responses:   responses(200, dataResponse("PersonaDetailDTO", "保存后的人设档案", 200), 400, errorResponse("文档或素材校验失败"), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:manage 权限"), 404, errorResponse("人设档案不存在"), 409, errorResponse("expected_version 已过期")),
	})
	post(t, "/admin/personas/{id}/activate", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "激活人设档案",
		Description: "校验档案完整性并原子替换站点当前人设。需 persona:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "人设档案 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("PersonaVersionRequest", true, "激活时的乐观锁版本"),
		Responses:   responses(200, dataResponse("PersonaDetailDTO", "当前人设档案", 200), 400, errorResponse("档案不符合激活约束"), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:manage 权限"), 404, errorResponse("人设档案不存在"), 409, errorResponse("expected_version 已过期")),
	})
	del(t, "/admin/personas/{id}", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "永久删除人设档案",
		Description: "删除非当前人设并释放素材引用；当前人设必须先切换。需 persona:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "人设档案 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("PersonaVersionRequest", true, "删除时的乐观锁版本"),
		Responses:   responses(204, noContentResponse("人设档案已删除"), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:manage 权限"), 404, errorResponse("人设档案不存在"), 409, errorResponse("expected_version 已过期或档案是当前人设")),
	})
}
