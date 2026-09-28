package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerExternalTweetPaths(t *openapi3.T) {
	registerSchema(t, "ExternalTweetAuthor", openapi3.Schemas{
		"id": reqStr("X 作者 ID（字符串）"), "name": reqStr("原作者显示名"),
		"handle": reqStr("X 用户名，不含 @"), "url": reqStr("X 作者页面"),
		"avatar_source_url": optStr("来源头像地址"), "avatar_url": reqStr("本站保存的头像；空串时使用文字占位"), "verified": optBool("来源认证状态；未知时省略"),
	})
	registerSchema(t, "ExternalTweetSegment", openapi3.Schemas{
		"kind": reqStr("text、link、mention 或 hashtag"), "text": reqStr("纯文本片段"), "url": optStr("安全的 http/https 链接"),
	})
	registerSchema(t, "ExternalTweetMedia", openapi3.Schemas{
		"kind": reqStr("photo、video 或 animated_gif"), "source_url": reqStr("图片或封面来源"),
		"url": reqStr("本站保存的图片或封面"), "thumbnail_url": optStr("本站缩略图"),
		"width": optInt("实际像素宽度"), "height": optInt("实际像素高度"), "alt": reqStr("替代文本"), "file_id": reqStr("共享文件标识"),
	})
	registerSchema(t, "ExternalTweetSnapshot", openapi3.Schemas{
		"author": optRef("原作者", "ExternalTweetAuthor"), "text": reqStr("规范化完整正文"),
		"segments": refArray("安全文本片段", "ExternalTweetSegment"), "published_at": reqStr("X 原文发布时间（RFC3339）"),
		"completeness": reqStr("complete、partial 或 unknown；仅 complete 可以发布"), "media": refArray("来源媒体", "ExternalTweetMedia"),
		"warnings": strArray("无法完整呈现的内容提示"), "quote_url": optStr("更深层引用只保留来源链接"),
	})
	registerSchema(t, "ExternalTweetDTO", openapi3.Schemas{
		"id": reqStr("本站共享原文 UUID"), "source_id": reqStr("X 推文 ID（字符串）"), "canonical_url": reqStr("规范化原文链接"),
		"snapshot_version": reqStr("预览绑定版本"), "availability": reqStr("available、unavailable、deleted 或 private；unavailable 不表示确定删除"),
		"snapshot": optRef("仅 available 时有可展示内容", "ExternalTweetSnapshot"), "quoted_tweet": optRef("一层独立引用原文", "ExternalTweetDTO"),
	})
	registerSchema(t, "ExternalTweetPreviewRequest", openapi3.Schemas{"url": reqStr("完整的 HTTPS X/Twitter 推文链接")}, "url")
	registerSchema(t, "ExternalTweetPreviewDTO", openapi3.Schemas{
		"external_tweet": optRef("已保存的原文", "ExternalTweetDTO"), "preview_token": reqStr("当前用户专属的发布凭证"),
		"expires_at": reqStr("预览到期时间（RFC3339）"), "can_publish": optBool("是否允许发布"), "warnings": strArray("预览提示"),
	}, "external_tweet", "preview_token", "expires_at", "can_publish", "warnings")
	post(t, "/tweets/external/preview", &openapi3.Operation{
		Tags: []string{"推文"}, Summary: "预览 X 原文", Security: securityCookie(), Parameters: openapi3.Parameters{csrfHeaderParam()},
		Description: "服务端免凭据获取并保存必需媒体，不创建时间线推文。每用户每分钟 5 次、每日 50 次；凭证有效期 15 分钟。",
		RequestBody: jsonBody("ExternalTweetPreviewRequest", true, "原文链接"), Responses: responses(
			200, dataResponse("ExternalTweetPreviewDTO", "可发布预览", 200),
			400, errorResponse("EXTERNAL_INVALID_URL / EXTERNAL_UNAVAILABLE / EXTERNAL_INCOMPLETE / EXTERNAL_MEDIA_FAILED / EXTERNAL_TEMPORARY"),
			401, errorResponse("请先登录"), 429, errorResponse("预览额度已用尽"),
		),
	})
	post(t, "/tweets/external/{externalId}/refresh", &openapi3.Operation{
		Tags: []string{"推文"}, Summary: "刷新共享 X 原文", Security: securityCookie(), Parameters: openapi3.Parameters{pathStrParam("externalId", "共享原文 UUID"), csrfHeaderParam()},
		Description: "需 tweet:delete-any 或内置超管权限；临时失败保留有效快照，明确删除或私密状态撤回全部展示。",
		Responses:   responses(200, dataResponse("ExternalTweetDTO", "当前原文", 200), 400, errorResponse("数据源或媒体暂时失败"), 403, errorResponse("无权刷新"), 404, errorResponse("原文不存在")),
	})
	del(t, "/tweets/external/{externalId}", &openapi3.Operation{
		Tags: []string{"推文"}, Summary: "主动下架共享 X 原文", Security: securityCookie(), Parameters: openapi3.Parameters{pathStrParam("externalId", "共享原文 UUID"), csrfHeaderParam()},
		Description: "需 tweet:delete-any 或内置超管权限；撤回正文和所有版本媒体，保留各条本站转发与讨论，阻止自动重新导入。",
		Responses:   responses(200, messageResponse("原文已下架"), 403, errorResponse("无权下架"), 404, errorResponse("原文不存在")),
	})
}
