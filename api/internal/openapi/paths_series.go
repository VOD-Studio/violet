package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerSeriesPaths 注册系列书接口（PRD-0021 文章合订成书）：
// 公开书架/详情/章节上下文 + 管理侧 CRUD/卷章编排/封面生成。
func registerSeriesPaths(t *openapi3.T) {
	// ---- 公共 schema ----

	registerSchema(t, "SeriesDTO", openapi3.Schemas{
		"id":                reqStr("系列书 ID"),
		"slug":              reqStr("URL slug"),
		"title":             reqStr("书名"),
		"description":       optStr("简介"),
		"cover_image":       optStr("封面图 URL（空串=无封面）"),
		"chapter_count":     optInt64("已发布章节数"),
		"latest_chapter_at": optStr("最新章节发布时间（RFC3339，空书为空串）"),
		"created_at":        reqStr("创建时间（RFC3339）"),
	})

	registerSchema(t, "SeriesAdminDTO", openapi3.Schemas{
		"status":              strEnum("发布状态", "draft", "published"),
		"total_chapter_count": optInt64("全部章节数（含 draft/archived）"),
		"updated_at":          optStr("最近更新时间（RFC3339）"),
		// 公开字段同 SeriesDTO（SeriesAdminDTO 内嵌之）
		"id":                reqStr("系列书 ID"),
		"slug":              reqStr("URL slug"),
		"title":             reqStr("书名"),
		"description":       optStr("简介"),
		"cover_image":       optStr("封面图 URL"),
		"chapter_count":     optInt64("已发布章节数"),
		"latest_chapter_at": optStr("最新章节发布时间（RFC3339）"),
		"created_at":        reqStr("创建时间（RFC3339）"),
	})

	registerSchema(t, "SeriesSectionDTO", openapi3.Schemas{
		"id":         reqStr("卷 ID"),
		"title":      reqStr("卷名"),
		"sort_order": optInt("排序权重"),
	})

	registerSchema(t, "SeriesChapterDTO", openapi3.Schemas{
		"post_id":      reqStr("章节文章 ID"),
		"slug":         reqStr("文章 slug"),
		"title":        reqStr("章节标题"),
		"chapter_no":   optInt("全书连续章节号（从 1 起）"),
		"status":       optStr("文章状态（仅管理视角输出，公开视角缺省）"),
		"published_at": optStr("发布时间（RFC3339，未发布为空串）"),
	})

	registerSchema(t, "SeriesSectionChaptersDTO", openapi3.Schemas{
		"section":  optRef("卷信息", "SeriesSectionDTO"),
		"chapters": refArray("卷内章节（sort_order 升序）", "SeriesChapterDTO"),
	})

	registerSchema(t, "SeriesDetailDTO", openapi3.Schemas{
		"sections":      refArray("分卷结构（含空卷，sort_order 升序）", "SeriesSectionChaptersDTO"),
		"root_chapters": refArray("书根（未入卷）章节", "SeriesChapterDTO"),
		// 管理字段同 SeriesAdminDTO（SeriesDetailDTO 内嵌之）
		"status":              strEnum("发布状态", "draft", "published"),
		"total_chapter_count": optInt64("全部章节数（含 draft/archived）"),
		"updated_at":          optStr("最近更新时间（RFC3339）"),
		"id":                  reqStr("系列书 ID"),
		"slug":                reqStr("URL slug"),
		"title":               reqStr("书名"),
		"description":         optStr("简介"),
		"cover_image":         optStr("封面图 URL"),
		"chapter_count":       optInt64("已发布章节数"),
		"latest_chapter_at":   optStr("最新章节发布时间（RFC3339）"),
		"created_at":          reqStr("创建时间（RFC3339）"),
	})

	registerSchema(t, "SeriesChapterContextDTO", openapi3.Schemas{
		"series": optRef("所属书（slug/title）", "SeriesContextSeries"),
		"chapter_no":       optInt("当前章节号"),
		"total_chapters":   optInt("总章节数"),
		"prev_chapter":     optRef("上一章（首章为 null）", "SeriesContextChapter"),
		"next_chapter":     optRef("下一章（末章为 null）", "SeriesContextChapter"),
	})

	registerSchema(t, "SeriesContextSeries", openapi3.Schemas{
		"slug":  reqStr("书 slug"),
		"title": reqStr("书名"),
	})

	registerSchema(t, "SeriesContextChapter", openapi3.Schemas{
		"slug":  reqStr("文章 slug"),
		"title": reqStr("章节标题"),
	})

	registerSchema(t, "CreateSeriesRequest", openapi3.Schemas{
		"title":       reqStr("书名"),
		"slug":        reqStr("URL slug（创建后不可改）"),
		"description": optStr("简介"),
		"cover_image": optStr("封面图 URL"),
	}, "title", "slug")

	registerSchema(t, "UpdateSeriesRequest", openapi3.Schemas{
		"title":       optStr("新书名（PATCH 语义，缺省=不改）"),
		"description": optStr("新简介（缺省=不改）"),
		"cover_image": optStr("新封面（缺省=不改）"),
		"publish":     optBool("true=发布，false=收回 draft（缺省=不改）"),
	})

	registerSchema(t, "SeriesCoverGenerateRequest", openapi3.Schemas{
		"prompt": reqStr("生成提示词（带书 id 的变体里可空，空时用书名+简介构造）"),
		"count":  optInt("生成张数（1-4，默认 2）"),
	})

	registerSchema(t, "SeriesCoverGenerateResponse", openapi3.Schemas{
		"urls": strArray("候选封面 URL 列表"),
	})

	registerSchema(t, "SeriesAddChaptersRequest", openapi3.Schemas{
		"post_ids":      strArray("要加入的文章 ID（至少 1 篇）"),
		"section_id":    optStr("目标卷 ID（空=书根）"),
		"after_post_id": optStr("插入到该章节之后（空=范围末尾）"),
	}, "post_ids")

	registerSchema(t, "SeriesChapterOrderPlan", openapi3.Schemas{
		"section_id":       optStr("卷 ID（空=书根）"),
		"ordered_post_ids": strArray("该范围内按序排列的文章 ID"),
	}, "ordered_post_ids")

	registerSchema(t, "SeriesChaptersOrderRequest", openapi3.Schemas{
		"plans": refArray("各卷与书根的排序计划", "SeriesChapterOrderPlan"),
	}, "plans")

	registerSchema(t, "CreateSeriesSectionRequest", openapi3.Schemas{
		"title": reqStr("卷名"),
	}, "title")

	registerSchema(t, "SeriesSectionsOrderRequest", openapi3.Schemas{
		"ordered_section_ids": strArray("全量卷 ID 按序排列"),
	}, "ordered_section_ids")

	// ---- 公开接口 ----

	get(t, "/series", &openapi3.Operation{
		Tags:        []string{"系列书"},
		Summary:     "书架（已发布系列书列表）",
		Description: "仅 published 的书（offset 分页）。",
		Parameters:  openapi3.Parameters{pageParam(), limitParam(100)},
		Responses: responses(
			200, dataArrayResponse("SeriesDTO", "书架列表", 200, true),
		),
	})

	get(t, "/series/{slug}", &openapi3.Operation{
		Tags:        []string{"系列书"},
		Summary:     "系列书详情（含卷章结构）",
		Description: "公开视角：draft 书 404，章节仅含已发布。data 结构为 SeriesDetailDTO。",
		Parameters:  openapi3.Parameters{pathStrParam("slug", "书 slug")},
		Responses: responses(
			200, dataResponse("SeriesDetailDTO", "系列书详情", 200),
			404, errorResponse("书不存在或未发布"),
		),
	})

	get(t, "/series/context/{postSlug}", &openapi3.Operation{
		Tags:        []string{"系列书"},
		Summary:     "章节上下文",
		Description: "按文章 slug 反查所属书与前后章；文章无归属书或书未发布时 data 为 null。",
		Parameters:  openapi3.Parameters{pathStrParam("postSlug", "文章 slug")},
		Responses: responses(
			200, dataResponse("SeriesChapterContextDTO", "章节上下文（可能为 null）", 200),
		),
	})

	// ---- 管理接口 ----

	get(t, "/admin/series", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "系列书列表（含 draft）",
		Description: "需 series:view 权限（offset 分页）。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pageParam(), limitParam(100)},
		Responses: responses(
			200, dataArrayResponse("SeriesAdminDTO", "全部状态系列书", 200, true),
		),
	})

	get(t, "/admin/series/{id}", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "系列书详情（管理视角）",
		Description: "需 series:view 权限；含全状态章节并带 status 字段。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "系列书 ID")},
		Responses: responses(
			200, dataResponse("SeriesDetailDTO", "系列书详情（管理视角）", 200),
			404, errorResponse("书不存在"),
		),
	})

	post(t, "/admin/series", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "创建系列书",
		Description: "需 series:create 权限。slug 创建后不可改。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreateSeriesRequest", true, "书信息"),
		Responses: responses(
			201, dataResponse("SeriesAdminDTO", "新建的书", 201),
			400, errorResponse("slug 已存在或参数非法"),
		),
	})

	patch(t, "/admin/series/{id}", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "更新系列书",
		Description: "需 series:update 权限。PATCH 语义：缺省字段不改。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "系列书 ID"), csrfHeaderParam()},
		RequestBody: jsonBody("UpdateSeriesRequest", true, "可更新字段"),
		Responses: responses(
			200, dataResponse("SeriesAdminDTO", "更新后的书", 200),
			404, errorResponse("书不存在"),
		),
	})

	del(t, "/admin/series/{id}", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "解散系列书",
		Description: "需 series:delete 权限。书内全部章节解绑回普通文章，不删文章。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "系列书 ID"), csrfHeaderParam()},
		Responses: responses(
			200, messageResponse("书已解散，全部章节已解绑"),
			404, errorResponse("书不存在"),
		),
	})

	post(t, "/admin/series/cover/generate", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "生成候选封面（建书前）",
		Description: "需 series:update 权限。无书 id 的变体：prompt 必填。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("SeriesCoverGenerateRequest", true, "生成参数"),
		Responses: responses(
			200, dataResponse("SeriesCoverGenerateResponse", "候选封面 URL", 200),
			400, errorResponse("prompt 为空"),
		),
	})

	post(t, "/admin/series/{id}/cover/generate", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "生成候选封面（为既有书）",
		Description: "需 series:update 权限。prompt 可空（用书名+简介构造）。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "系列书 ID"), csrfHeaderParam()},
		RequestBody: jsonBody("SeriesCoverGenerateRequest", true, "生成参数"),
		Responses: responses(
			200, dataResponse("SeriesCoverGenerateResponse", "候选封面 URL", 200),
			404, errorResponse("书不存在"),
		),
	})

	post(t, "/admin/series/{id}/chapters", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "添加章节",
		Description: "需 series:update 权限。把文章挂入指定卷（或书根）的指定位置。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "系列书 ID"), csrfHeaderParam()},
		RequestBody: jsonBody("SeriesAddChaptersRequest", true, "章节添加计划"),
		Responses: responses(
			200, dataResponse("SeriesDetailDTO", "更新后的书结构", 200),
			404, errorResponse("书不存在"),
		),
	})

	put(t, "/admin/series/{id}/chapters/order", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "重排章节",
		Description: "需 series:update 权限。按卷分组提交各范围内的新顺序。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "系列书 ID"), csrfHeaderParam()},
		RequestBody: jsonBody("SeriesChaptersOrderRequest", true, "排序计划"),
		Responses: responses(
			200, messageResponse("章节顺序已更新"),
			404, errorResponse("书不存在"),
		),
	})

	del(t, "/admin/series/{id}/chapters/{postId}", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "摘除章节",
		Description: "需 series:update 权限。把文章移出书，文章本身不删。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "系列书 ID"), pathStrParam("postId", "章节文章 ID"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("章节已摘除"),
			404, errorResponse("书或章节不存在"),
		),
	})

	post(t, "/admin/series/{id}/sections", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "创建卷",
		Description: "需 series:update 权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "系列书 ID"), csrfHeaderParam()},
		RequestBody: jsonBody("CreateSeriesSectionRequest", true, "卷名"),
		Responses: responses(
			201, dataResponse("SeriesAdminDTO", "含新卷的书", 201),
			404, errorResponse("书不存在"),
		),
	})

	put(t, "/admin/series/{id}/sections/order", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "重排卷",
		Description: "需 series:update 权限。提交全量卷 ID 的新顺序。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "系列书 ID"), csrfHeaderParam()},
		RequestBody: jsonBody("SeriesSectionsOrderRequest", true, "卷 ID 顺序"),
		Responses: responses(
			200, messageResponse("卷顺序已更新"),
			404, errorResponse("书不存在"),
		),
	})

	del(t, "/admin/series/{id}/sections/{sectionId}", &openapi3.Operation{
		Tags:        []string{"系列书管理"},
		Summary:     "删除卷",
		Description: "需 series:update 权限。非空卷须先移走章节（409）。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "系列书 ID"), pathStrParam("sectionId", "卷 ID"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("卷已删除"),
			404, errorResponse("书或卷不存在"),
			409, errorResponse("卷内还有章节"),
		),
	})
}
