package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerGalleryPaths(t *openapi3.T) {
	registerSchema(t, "GallerySaveItemRequest", openapi3.Schemas{
		"file_id":           reqStr("素材文件 UUID"),
		"caption":           reqStr("图集语境下的图片说明，允许空串，最多 500 字符"),
		"alt_text_override": reqStr("图集语境下的无障碍文本覆盖，允许空串，最多 300 字符"),
	}, "file_id", "caption", "alt_text_override")
	registerSchema(t, "GallerySaveRequest", openapi3.Schemas{
		"expected_version": optInt64("工作稿乐观锁版本，必须大于 0"),
		"title":            reqStr("工作稿标题，允许空串，最多 120 字符"),
		"summary":          reqStr("工作稿摘要，允许空串，最多 500 字符"),
		"items":            refArray("完整有序图片列表；数组顺序是权威顺序，最多 50 项", "GallerySaveItemRequest"),
	}, "expected_version", "title", "summary", "items")
	registerSchema(t, "GalleryPublishRequest", openapi3.Schemas{
		"expected_version": optInt64("工作稿乐观锁版本，必须大于 0"),
	}, "expected_version")
	registerSchema(t, "GalleryItemDTO", openapi3.Schemas{
		"file_id":           reqStr("素材文件 UUID"),
		"position":          optInt("服务端归一化后的顺序，从 0 开始"),
		"url":               reqStr("原图 URL"),
		"thumbnail":         reqStr("缩略图 URL"),
		"mime_type":         reqStr("图片 MIME 类型"),
		"width":             optInt("图片宽度，未知为 0"),
		"height":            optInt("图片高度，未知为 0"),
		"asset_alt_text":    reqStr("素材库默认无障碍描述"),
		"caption":           reqStr("图集语境下的图片说明"),
		"alt_text_override": reqStr("图集语境下的无障碍文本覆盖"),
	}, "file_id", "position", "url", "thumbnail", "mime_type", "width", "height", "asset_alt_text", "caption", "alt_text_override")

	summaryFields := openapi3.Schemas{
		"id":           reqStr("图集 UUID"),
		"author_id":    reqStr("作者 UUID"),
		"slug":         nullableStr("首次发布后生成的稳定公开 slug；未发布为 null"),
		"title":        reqStr("工作稿标题"),
		"summary":      reqStr("工作稿摘要"),
		"status":       strEnum("图集发布状态", "draft", "published"),
		"version":      optInt64("工作稿乐观锁版本"),
		"item_count":   optInt("图片数量"),
		"published_at": nullableStr("首次发布时间，RFC3339；未发布为 null"),
		"created_at":   reqStr("创建时间，RFC3339"),
		"updated_at":   reqStr("最近保存时间，RFC3339"),
	}
	requiredSummary := []string{"id", "author_id", "slug", "title", "summary", "status", "version", "item_count", "published_at", "created_at", "updated_at"}
	registerSchema(t, "GallerySummaryDTO", summaryFields, requiredSummary...)
	detailFields := make(openapi3.Schemas, len(summaryFields)+1)
	for key, value := range summaryFields {
		detailFields[key] = value
	}
	detailFields["items"] = refArray("完整有序图片列表", "GalleryItemDTO")
	detailRequired := []string{"id", "author_id", "slug", "title", "summary", "status", "version", "item_count", "published_at", "created_at", "updated_at", "items"}
	registerSchema(t, "GalleryDetailDTO", detailFields, detailRequired...)
	registerSchema(t, "PublicGalleryItemDTO", openapi3.Schemas{
		"file_id":   reqStr("素材文件 UUID"),
		"position":  optInt("公开版本内的连续顺序，从 0 开始"),
		"thumbnail": reqStr("浏览流使用的缩略图 URL"),
		"url":       reqStr("详情与灯箱使用的图片 URL"),
		"width":     optInt("图片宽度，未知为 0"),
		"height":    optInt("图片高度，未知为 0"),
		"alt_text":  reqStr("图集覆盖、素材默认值或标题序号回退后的无障碍文本"),
		"caption":   reqStr("图集语境下的图片说明"),
	}, "file_id", "position", "thumbnail", "url", "width", "height", "alt_text", "caption")
	registerSchema(t, "PublicGalleryDTO", openapi3.Schemas{
		"id":           reqStr("图集 UUID"),
		"slug":         reqStr("稳定公开 slug"),
		"title":        reqStr("公开版本标题"),
		"summary":      reqStr("公开版本摘要"),
		"published_at": reqStr("首次发布时间，RFC3339"),
		"items":        refArray("公开版本的完整有序图片列表", "PublicGalleryItemDTO"),
	}, "id", "slug", "title", "summary", "published_at", "items")

	secure := securityAdmin()
	get(t, "/admin/galleries", &openapi3.Operation{
		Tags: []string{"图集管理"}, Summary: "图集工作稿列表",
		Description: "分页读取当前作者自己的图集工作稿。需 gallery:view 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pageParam(), limitParam(100)},
		Responses: responses(200, dataArrayResponse("GallerySummaryDTO", "图集工作稿列表", 200, true), 401, errorResponse("未认证"), 403, errorResponse("缺少 gallery:view 权限")),
	})
	post(t, "/admin/galleries", &openapi3.Operation{
		Tags: []string{"图集管理"}, Summary: "创建空图集工作稿",
		Description: "创建 title/summary 为空、items 为空、version=1 的工作稿。需 gallery:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{csrfHeaderParam()},
		Responses: responses(201, dataResponse("GalleryDetailDTO", "空图集工作稿", 201), 401, errorResponse("未认证"), 403, errorResponse("缺少 gallery:manage 权限")),
	})
	get(t, "/admin/galleries/{id}", &openapi3.Operation{
		Tags: []string{"图集管理"}, Summary: "图集工作稿详情",
		Description: "读取当前作者自己的工作稿和完整图片投影。需 gallery:view 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "图集 UUID")},
		Responses: responses(200, dataResponse("GalleryDetailDTO", "图集工作稿详情", 200), 401, errorResponse("未认证"), 403, errorResponse("不是图集作者或缺少 gallery:view 权限"), 404, errorResponse("图集不存在")),
	})
	put(t, "/admin/galleries/{id}", &openapi3.Operation{
		Tags: []string{"图集管理"}, Summary: "完整保存图集工作稿",
		Description: "完整替换标题、摘要和有序图片列表；工作稿、图片项与素材引用计数在同一事务提交。需 gallery:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "图集 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("GallerySaveRequest", true, "完整 Gallery document"),
		Responses:   responses(200, dataResponse("GalleryDetailDTO", "保存后的工作稿", 200), 400, errorResponse("文档或素材校验失败"), 401, errorResponse("未认证"), 403, errorResponse("不是图集作者或缺少 gallery:manage 权限"), 404, errorResponse("图集不存在"), 409, errorResponse("expected_version 已过期")),
	})
	post(t, "/admin/galleries/{id}/publish", &openapi3.Operation{
		Tags: []string{"图集管理"}, Summary: "发布图集工作稿",
		Description: "校验标题、2–50 张可用图片并首次发布当前工作稿；生成稳定 slug。需 gallery:manage 权限。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "图集 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("GalleryPublishRequest", true, "发布时的乐观锁版本"),
		Responses:   responses(200, dataResponse("GalleryDetailDTO", "发布后的图集管理详情", 200), 400, errorResponse("工作稿不符合发布约束"), 401, errorResponse("未认证"), 403, errorResponse("不是图集作者或缺少 gallery:manage 权限"), 404, errorResponse("图集不存在"), 409, errorResponse("expected_version 已过期或发布冲突")),
	})
	get(t, "/galleries", &openapi3.Operation{
		Tags: []string{"图集"}, Summary: "公开图集浏览流",
		Description: "匿名读取公开版本，按 published_at 与 id 复合游标倒序分页；每项返回完整有序图片数组。",
		Parameters:  openapi3.Parameters{queryStrParam("cursor", "下一页不透明游标"), limitParam(50)},
		Responses:   responses(200, dataArrayResponse("PublicGalleryDTO", "公开图集列表", 200, true), 400, errorResponse("分页游标非法")),
	})
	get(t, "/galleries/{slug}", &openapi3.Operation{
		Tags: []string{"图集"}, Summary: "公开图集详情",
		Description: "匿名按稳定 slug 读取公开版本；工作稿内容不会出现在响应中。",
		Parameters:  openapi3.Parameters{pathStrParam("slug", "图集公开 slug")},
		Responses:   responses(200, dataResponse("PublicGalleryDTO", "公开图集详情", 200), 404, errorResponse("公开图集不存在")),
	})
}
