package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerPersonaPaths(t *openapi3.T) {
	registerSchema(t, "PersonaFactRequest", openapi3.Schemas{
		"label": reqStr("资料项名称，最多 40 字符"),
		"value": reqStr("资料项内容，最多 300 字符"),
	}, "label", "value")
	registerSchema(t, "PersonaImageRequest", openapi3.Schemas{
		"file_id":           reqStr("素材文件 UUID"),
		"caption":           reqStr("当前语言语境下的图片说明，允许空串，最多 500 字符"),
		"alt_text_override": reqStr("当前语言语境下的无障碍文本覆盖，允许空串，最多 300 字符"),
	}, "file_id", "caption", "alt_text_override")
	registerSchema(t, "PersonaLocalizationRequest", openapi3.Schemas{
		"locale":     reqStr("BCP 47 语言代码"),
		"name":       reqStr("人设名称，草稿允许空串，最多 120 字符"),
		"subtitle":   reqStr("一句角色定位，允许空串，最多 240 字符"),
		"summary":    reqStr("主视觉旁简介，草稿允许空串，最多 500 字符"),
		"content_md": reqStr("完整设定文档 Markdown 源，草稿允许空串"),
		"facts":      refArray("该语言的完整有序资料项，最多 24 项", "PersonaFactRequest"),
		"images":     refArray("该语言的完整有序设定图，第一项是主视觉，最多 30 项", "PersonaImageRequest"),
	}, "locale", "name", "subtitle", "summary", "content_md", "facts", "images")
	registerSchema(t, "PersonaSaveRequest", openapi3.Schemas{
		"expected_version": optInt64("档案乐观锁版本，必须大于 0"),
		"default_locale":   reqStr("默认公开语言，必须存在于 localizations"),
		"avatar_file_id":   reqStr("跨语言共用头像素材 UUID；空串表示草稿未配置"),
		"localizations":    refArray("全部语言版本，1 至 8 项", "PersonaLocalizationRequest"),
	}, "expected_version", "default_locale", "avatar_file_id", "localizations")
	registerSchema(t, "PersonaVersionRequest", openapi3.Schemas{
		"expected_version": optInt64("档案乐观锁版本，必须大于 0"),
	}, "expected_version")
	registerSchema(t, "PersonaFactDTO", openapi3.Schemas{
		"label": reqStr("资料项名称"),
		"value": reqStr("资料项内容"),
	}, "label", "value")
	registerSchema(t, "PersonaAdminAssetDTO", openapi3.Schemas{
		"file_id":   reqStr("素材文件 UUID"),
		"url":       reqStr("原图 URL"),
		"thumbnail": reqStr("缩略图 URL"),
		"mime_type": reqStr("图片 MIME 类型"),
		"width":     optInt("图片宽度，未知为 0"),
		"height":    optInt("图片高度，未知为 0"),
		"alt_text":  reqStr("素材库无障碍文本"),
	}, "file_id", "url", "thumbnail", "mime_type", "width", "height", "alt_text")
	registerSchema(t, "PersonaAdminImageDTO", openapi3.Schemas{
		"file_id":           reqStr("素材文件 UUID"),
		"url":               reqStr("原图 URL"),
		"thumbnail":         reqStr("缩略图 URL"),
		"mime_type":         reqStr("图片 MIME 类型"),
		"width":             optInt("图片宽度，未知为 0"),
		"height":            optInt("图片高度，未知为 0"),
		"caption":           reqStr("当前语言语境下的图片说明"),
		"alt_text":          reqStr("已解析的无障碍文本"),
		"alt_text_override": reqStr("当前语言语境下的无障碍文本覆盖"),
	}, "file_id", "url", "thumbnail", "mime_type", "width", "height", "caption", "alt_text", "alt_text_override")
	registerSchema(t, "PersonaPublicAssetDTO", openapi3.Schemas{
		"url":       reqStr("原图 URL"),
		"thumbnail": reqStr("缩略图 URL"),
		"width":     optInt("图片宽度，未知为 0"),
		"height":    optInt("图片高度，未知为 0"),
		"alt_text":  reqStr("已解析的无障碍文本"),
	}, "url", "thumbnail", "width", "height", "alt_text")
	registerSchema(t, "PersonaPublicImageDTO", openapi3.Schemas{
		"url":       reqStr("原图 URL"),
		"thumbnail": reqStr("缩略图 URL"),
		"width":     optInt("图片宽度，未知为 0"),
		"height":    optInt("图片高度，未知为 0"),
		"caption":   reqStr("图片说明"),
		"alt_text":  reqStr("已解析的无障碍文本"),
	}, "url", "thumbnail", "width", "height", "caption", "alt_text")
	registerSchema(t, "PersonaLocalizationDTO", openapi3.Schemas{
		"locale":       reqStr("BCP 47 语言代码"),
		"name":         reqStr("人设名称"),
		"subtitle":     reqStr("一句角色定位"),
		"summary":      reqStr("角色简介"),
		"content_md":   reqStr("Markdown 源"),
		"content_html": reqStr("服务端生成的 HTML 阅读载体"),
		"facts":        refArray("有序资料项", "PersonaFactDTO"),
		"images":       refArray("有序设定图", "PersonaAdminImageDTO"),
		"is_complete":  optBool("该语言版本是否具备全部公开资料"),
	}, "locale", "name", "subtitle", "summary", "content_md", "content_html", "facts", "images", "is_complete")
	registerSchema(t, "PersonaSummaryDTO", openapi3.Schemas{
		"id":          reqStr("人设档案 UUID"),
		"name":        reqStr("默认语言的人设名称"),
		"subtitle":    reqStr("默认语言的一句角色定位"),
		"summary":     reqStr("默认语言的角色简介"),
		"locales":     strArray("已配置语言代码，默认语言排第一"),
		"fact_count":  optInt("默认语言资料项数量"),
		"image_count": optInt("默认语言设定图数量"),
		"is_active":   optBool("是否为站点当前人设"),
		"is_complete": optBool("默认语言与头像是否满足激活完整性"),
		"version":     optInt64("档案乐观锁版本"),
		"created_at":  reqStr("创建时间，RFC3339"),
		"updated_at":  reqStr("最近保存时间，RFC3339"),
	}, "id", "name", "subtitle", "summary", "locales", "fact_count", "image_count", "is_active", "is_complete", "version", "created_at", "updated_at")
	registerSchema(t, "PersonaDetailDTO", openapi3.Schemas{
		"id":             reqStr("人设档案 UUID"),
		"created_by":     reqStr("创建管理员 UUID"),
		"default_locale": reqStr("默认公开语言"),
		"avatar": {
			Value: &openapi3.Schema{
				Description: "跨语言共用头像；草稿未配置时为 null",
				Nullable:    true,
				AllOf:       openapi3.SchemaRefs{{Ref: "#/components/schemas/PersonaAdminAssetDTO"}},
			},
		},
		"localizations": refArray("全部可编辑语言版本", "PersonaLocalizationDTO"),
		"is_active":     optBool("是否为站点当前人设"),
		"is_complete":   optBool("默认语言与头像是否满足激活完整性"),
		"version":       optInt64("档案乐观锁版本"),
		"created_at":    reqStr("创建时间，RFC3339"),
		"updated_at":    reqStr("最近保存时间，RFC3339"),
	}, "id", "created_by", "default_locale", "avatar", "localizations", "is_active", "is_complete", "version", "created_at", "updated_at")
	registerSchema(t, "PublicPersonaDTO", openapi3.Schemas{
		"locale":            reqStr("本次实际返回的语言代码"),
		"default_locale":    reqStr("站点默认语言代码"),
		"available_locales": strArray("公开可切换的完整语言版本"),
		"avatar":            optRef("跨语言共用头像", "PersonaPublicAssetDTO"),
		"name":              reqStr("当前语言人设名称"),
		"subtitle":          reqStr("当前语言角色定位"),
		"summary":           reqStr("当前语言角色简介"),
		"content_html":      reqStr("当前语言设定正文 HTML 阅读载体"),
		"facts":             refArray("当前语言有序资料项", "PersonaFactDTO"),
		"images":            refArray("当前语言有序设定图，第一项是主视觉", "PersonaPublicImageDTO"),
	}, "locale", "default_locale", "available_locales", "avatar", "name", "subtitle", "summary", "content_html", "facts", "images")

	secure := securityAdmin()
	get(t, "/persona", &openapi3.Operation{
		Tags: []string{"人设档案"}, Summary: "读取当前人设",
		Description: "匿名读取站点唯一当前人设；可按 BCP 47 语言匹配完整版本，无匹配时回退默认语言；未选择时返回 404。",
		Parameters:  openapi3.Parameters{queryStrParam("locale", "期望语言的 BCP 47 代码；空值使用默认语言")},
		Responses:   responses(200, dataResponse("PublicPersonaDTO", "当前人设", 200), 400, errorResponse("语言代码无效"), 404, errorResponse("站点尚未选择当前人设")),
	})
	get(t, "/admin/personas", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "人设档案列表",
		Description: "当前人设优先，再按最近保存时间倒序分页。需 persona:view 权限。",
		Security:    secure, Parameters: openapi3.Parameters{
			pageParam(), limitParam(100), queryStrParam("q", "按任一语言的人设名称模糊搜索"),
		},
		Responses: responses(200, dataArrayResponse("PersonaSummaryDTO", "人设档案列表", 200, true), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:view 权限")),
	})
	post(t, "/admin/personas", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "创建空人设档案",
		Description: "创建 version=1、带空 zh-CN 版本的档案，不自动公开。需 persona:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{csrfHeaderParam()},
		Responses: responses(201, dataResponse("PersonaDetailDTO", "空人设档案", 201), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:manage 权限")),
	})
	get(t, "/admin/personas/{id}", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "人设档案详情",
		Description: "读取头像、默认语言、全部编辑文档与当前状态。需 persona:view 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "人设档案 UUID")},
		Responses: responses(200, dataResponse("PersonaDetailDTO", "人设档案详情", 200), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:view 权限"), 404, errorResponse("人设档案不存在")),
	})
	put(t, "/admin/personas/{id}", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "完整保存人设档案",
		Description: "完整替换头像、默认语言与全部语言版本；当前档案必须保持默认语言可公开。需 persona:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "人设档案 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("PersonaSaveRequest", true, "完整多语言 Persona document"),
		Responses:   responses(200, dataResponse("PersonaDetailDTO", "保存后的人设档案", 200), 400, errorResponse("文档、语言或素材校验失败"), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:manage 权限"), 404, errorResponse("人设档案不存在"), 409, errorResponse("expected_version 已过期")),
	})
	post(t, "/admin/personas/{id}/activate", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "激活人设档案",
		Description: "校验头像与默认语言完整性并原子替换站点当前人设。需 persona:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "人设档案 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("PersonaVersionRequest", true, "激活时的乐观锁版本"),
		Responses:   responses(200, dataResponse("PersonaDetailDTO", "当前人设档案", 200), 400, errorResponse("档案不符合激活约束"), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:manage 权限"), 404, errorResponse("人设档案不存在"), 409, errorResponse("expected_version 已过期")),
	})
	del(t, "/admin/personas/{id}", &openapi3.Operation{
		Tags: []string{"人设管理"}, Summary: "永久删除人设档案",
		Description: "删除非当前人设并释放头像与全部语言版本的素材引用；当前人设必须先切换。需 persona:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "人设档案 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("PersonaVersionRequest", true, "删除时的乐观锁版本"),
		Responses:   responses(204, noContentResponse("人设档案已删除"), 401, errorResponse("未认证"), 403, errorResponse("缺少 persona:manage 权限"), 404, errorResponse("人设档案不存在"), 409, errorResponse("expected_version 已过期或档案是当前人设")),
	})
}
