package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerNotePaths(t *openapi3.T) {
	registerSchema(t, "NoteSaveRequest", openapi3.Schemas{
		"title":      optStr("笔记标题，可空；缺省视为空标题，最多 120 字符"),
		"content_md": reqStr("正文 Markdown 源，去空白后非空；content_html 由服务端渲染生成"),
		"tags":       strArray("标签名列表，最多 8 个；缺省视为清空标签（PUT 全量替换语义）"),
	}, "content_md")
	summaryFields := openapi3.Schemas{
		"id":           reqStr("笔记 UUID（公开地址即用 ID，标题可选故不设 slug）"),
		"author_id":    reqStr("作者 UUID"),
		"title":        reqStr("标题，空串表示无标题"),
		"status":       strEnum("笔记状态", "draft", "published"),
		"tags":         strArray("标签名列表"),
		"created_at":   reqStr("创建时间，RFC3339"),
		"updated_at":   reqStr("最近编辑时间，RFC3339"),
		"published_at": nullableStr("首次发布时间，RFC3339；从未发布为 null，发布后编辑不变"),
	}
	summaryRequired := []string{"id", "author_id", "title", "status", "tags", "created_at", "updated_at", "published_at"}
	registerSchema(t, "NoteSummaryDTO", summaryFields, summaryRequired...)
	detailFields := make(openapi3.Schemas, len(summaryFields)+2)
	for key, value := range summaryFields {
		detailFields[key] = value
	}
	detailFields["content_md"] = reqStr("正文 Markdown 源")
	detailFields["content_html"] = reqStr("阅读端权威渲染源")
	registerSchema(t, "NoteDTO", detailFields)
	registerSchema(t, "PublicNoteDTO", openapi3.Schemas{
		"id":           reqStr("笔记 UUID"),
		"title":        reqStr("标题，空串表示无标题"),
		"content_html": reqStr("阅读端权威渲染源"),
		"tags":         strArray("标签名列表"),
		"published_at": reqStr("首次发布时间，RFC3339"),
	}, "id", "title", "content_html", "tags", "published_at")

	secure := securityAdmin()
	get(t, "/admin/notes", &openapi3.Operation{
		Tags: []string{"笔记管理"}, Summary: "笔记管理列表",
		Description: "分页读取笔记管理列表（含草稿），支持按状态筛选。需 note:view 权限。",
		Security:    secure, Parameters: openapi3.Parameters{
			pageParam(), limitParam(100),
			queryStrParam("status", "状态筛选：draft 或 published，缺省返回全部状态"),
		},
		Responses: responses(200, dataArrayResponse("NoteSummaryDTO", "笔记列表", 200, true), 401, errorResponse("未认证"), 403, errorResponse("缺少 note:view 权限")),
	})
	post(t, "/admin/notes", &openapi3.Operation{
		Tags: []string{"笔记管理"}, Summary: "创建笔记",
		Description: "创建草稿笔记；content_html 由服务端经 markdown 管线生成。需 note:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("NoteSaveRequest", true, "笔记内容"),
		Responses:   responses(201, dataResponse("NoteDTO", "新建草稿笔记", 201), 400, errorResponse("内容或标签校验失败"), 401, errorResponse("未认证"), 403, errorResponse("缺少 note:manage 权限")),
	})
	get(t, "/admin/notes/{id}", &openapi3.Operation{
		Tags: []string{"笔记管理"}, Summary: "笔记详情",
		Description: "读取单条笔记（含草稿与 Markdown 源）。需 note:view 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "笔记 UUID")},
		Responses: responses(200, dataResponse("NoteDTO", "笔记详情", 200), 401, errorResponse("未认证"), 403, errorResponse("缺少 note:view 权限"), 404, errorResponse("笔记不存在")),
	})
	put(t, "/admin/notes/{id}", &openapi3.Operation{
		Tags: []string{"笔记管理"}, Summary: "全量保存笔记",
		Description: "全量替换标题、正文与标签；状态与首次发布时间不变。需 note:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "笔记 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("NoteSaveRequest", true, "笔记内容"),
		Responses:   responses(200, dataResponse("NoteDTO", "保存后的笔记", 200), 400, errorResponse("内容或标签校验失败"), 401, errorResponse("未认证"), 403, errorResponse("缺少 note:manage 权限"), 404, errorResponse("笔记不存在")),
	})
	post(t, "/admin/notes/{id}/publish", &openapi3.Operation{
		Tags: []string{"笔记管理"}, Summary: "发布笔记",
		Description: "draft→published 单向发布并盖首次发布时间；已发布时幂等无副作用。需 note:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "笔记 UUID"), csrfHeaderParam()},
		Responses: responses(200, dataResponse("NoteDTO", "发布后的笔记", 200), 401, errorResponse("未认证"), 403, errorResponse("缺少 note:manage 权限"), 404, errorResponse("笔记不存在")),
	})
	del(t, "/admin/notes/{id}", &openapi3.Operation{
		Tags: []string{"笔记管理"}, Summary: "删除笔记",
		Description: "物理删除笔记（note_tags 级联清理）；状态机无撤回路径，误发走编辑或删除。需 note:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "笔记 UUID"), csrfHeaderParam()},
		Responses: responses(204, noContentResponse("笔记已删除"), 401, errorResponse("未认证"), 403, errorResponse("缺少 note:manage 权限"), 404, errorResponse("笔记不存在")),
	})
	get(t, "/notes", &openapi3.Operation{
		Tags: []string{"笔记"}, Summary: "公开笔记流",
		Description: "匿名读取已发布笔记，按 published_at 与 id 复合游标倒序分页，可按标签 slug 筛选；草稿不出现。",
		Parameters:  openapi3.Parameters{queryStrParam("cursor", "下一页不透明游标"), queryStrParam("tag", "标签 slug 筛选，缺省返回全部"), limitParam(50)},
		Responses:   responses(200, dataArrayResponse("PublicNoteDTO", "公开笔记列表", 200, true), 400, errorResponse("分页游标非法")),
	})
	get(t, "/notes/{id}", &openapi3.Operation{
		Tags: []string{"笔记"}, Summary: "公开笔记详情",
		Description: "匿名按 ID 读取已发布笔记；草稿与无效 ID 一律 404。",
		Parameters:  openapi3.Parameters{pathStrParam("id", "笔记 UUID")},
		Responses:   responses(200, dataResponse("PublicNoteDTO", "公开笔记详情", 200), 404, errorResponse("笔记不存在")),
	})
}
