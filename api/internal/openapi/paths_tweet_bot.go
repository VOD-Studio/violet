package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerTweetBotPaths 注册 bot 推文 API：外部 bot 以虚拟用户身份发布推文、
// 评论、点赞并删除自己的内容。读模型复用人类侧 TweetDTO / TweetCommentDTO——
// 两者同一条服务链路，只有鉴权与幂等入口不同。
func registerTweetBotPaths(t *openapi3.T) {
	secure := securityBot()

	registerSchema(t, "BotTweetCreateRequest", openapi3.Schemas{
		"content":  optStr("正文或引用感想（content/images/quote_of 至少一项，≤500 字）"),
		"images":   strArray("配图 URL（≤4 张，须由本 bot 上传）"),
		"quote_of": nullableStr("被引用推文 ID（无引用时缺省或 null）"),
	})

	registerSchema(t, "BotTweetCommentRequest", openapi3.Schemas{
		"body":      optStr("评论正文（body/pictures 至少一项，≤500 字）"),
		"pictures":  refArray("评论配图（≤10 张，须由本 bot 上传）", "TweetCommentPicture"),
		"parent_id": optStr("被回复的评论 ID；空=顶层评论，须属于同一推文"),
	})

	mediaUploadBody := &openapi3.RequestBodyRef{Value: &openapi3.RequestBody{
		Required: true,
		Content: openapi3.Content{
			"multipart/form-data": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
				Type: &openapi3.Types{openapi3.TypeObject},
				Properties: openapi3.Schemas{
					"file":     {Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeString}, Format: "binary"}},
					"filename": optStr("可选原始文件名，仅作元数据"),
				},
				Required: []string{"file"},
			}}},
		},
	}}

	post(t, "/tweets/bot", &openapi3.Operation{
		Tags: []string{"推文 Bot"}, Summary: "bot 发布推文或引用推文",
		Description: "作者恒为本 bot 的虚拟用户。Idempotency-Key 必填：同键同内容返回已发布的推文，" +
			"同键换内容返回 409。不接受 external_preview_token（bot 不共享 X 原文）。",
		Security:    secure,
		Parameters:  openapi3.Parameters{idempotencyHeaderParam()},
		RequestBody: jsonBody("BotTweetCreateRequest", true, "推文内容"),
		Responses: responses(
			201, dataResponse("TweetDTO", "新发布的推文", 201),
			400, errorResponse("缺少或非法的 Idempotency-Key"),
			403, errorResponse("配图不属于本 bot"),
			404, errorResponse("被引用推文不存在"),
			409, errorResponse("同一发布请求携带不同内容"),
			422, errorResponse("content/images/quote_of 全为空或超限"),
		),
	})

	post(t, "/tweets/bot/media", &openapi3.Operation{
		Tags: []string{"推文 Bot"}, Summary: "上传推文配图", Security: secure,
		Description: "上传一张不超过配置上限的 png、jpeg、gif 或 webp 图片，文件归本 bot 虚拟用户所有，" +
			"purpose=tweet，可在推文或评论中引用。",
		RequestBody: mediaUploadBody,
		Responses: responses(
			201, dataResponse("BotMediaDTO", "已上传媒体", 201),
			400, errorResponse("图片格式或 MIME 非法"),
			401, errorResponse("token 无效"),
			403, errorResponse("bot 已禁用"),
			413, errorResponse("图片超过大小上限"),
		),
	})

	post(t, "/tweets/bot/{tweetId}/comments", &openapi3.Operation{
		Tags: []string{"推文 Bot"}, Summary: "bot 评论或回复推文",
		Description: "Idempotency-Key 必填，同时作为新评论 ID：重试同键同内容返回已存在的评论，" +
			"同键换内容返回 409。parent_id 指向另一条推文的评论返回 400。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("tweetId", "推文 ID"), idempotencyHeaderParam()},
		RequestBody: jsonBody("BotTweetCommentRequest", true, "评论内容"),
		Responses: responses(
			201, dataResponse("TweetCommentDTO", "新评论", 201),
			400, errorResponse("缺少或非法的 Idempotency-Key，或 parent_id 不属于该推文"),
			403, errorResponse("评论配图不属于本 bot"),
			404, errorResponse("推文或父评论不存在"),
			409, errorResponse("同一评论请求携带不同内容"),
		),
	})

	del(t, "/tweets/bot/{tweetId}/comments/{commentId}", &openapi3.Operation{
		Tags: []string{"推文 Bot"}, Summary: "bot 删除自己的评论",
		Description: "仅能删除本 bot 虚拟用户发表的评论；删除他人评论返回 403。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("tweetId", "推文 ID"), pathStrParam("commentId", "评论 ID")},
		Responses: responses(
			200, messageResponse("评论已删除"),
			403, errorResponse("无权删除他人评论"),
			404, errorResponse("评论不存在"),
		),
	})

	post(t, "/tweets/bot/{tweetId}/like", &openapi3.Operation{
		Tags: []string{"推文 Bot"}, Summary: "bot 点赞推文",
		Description: "幂等：重复点赞不报错；仅首次点赞产生 tweet.liked 事件。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("tweetId", "推文 ID")},
		Responses:   responses(200, messageResponse("已点赞")),
	})

	del(t, "/tweets/bot/{tweetId}/like", &openapi3.Operation{
		Tags: []string{"推文 Bot"}, Summary: "bot 取消点赞",
		Description: "幂等：未点赞时取消也不报错。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("tweetId", "推文 ID")},
		Responses:   responses(200, messageResponse("已取消点赞")),
	})

	del(t, "/tweets/bot/{tweetId}", &openapi3.Operation{
		Tags: []string{"推文 Bot"}, Summary: "bot 删除自己的推文",
		Description: "仅能删除本 bot 虚拟用户发布的推文；删除他人推文返回 403。物理删除，评论与点赞级联清理。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("tweetId", "推文 ID")},
		Responses: responses(
			200, messageResponse("推文已删除"),
			403, errorResponse("无权删除他人推文"),
			404, errorResponse("推文不存在"),
		),
	})
}
