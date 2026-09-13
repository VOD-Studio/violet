package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerTweetPaths 注册推文接口（PRD-0013）：时间线/详情/话题/发布/删除/
// 点赞/评论，以及用户主页公开资料与推文列表。
func registerTweetPaths(t *openapi3.T) {
	// ---- 公共 schema ----

	registerSchema(t, "TweetAuthorDTO", openapi3.Schemas{
		"id":         reqStr("作者用户 ID"),
		"username":   reqStr("用户名"),
		"avatar_url": reqStr("头像 URL"),
	})

	registerSchema(t, "TweetEmojiRef", openapi3.Schemas{
		"url":             reqStr("表情静态图 URL"),
		"gif_url":         optStr("GIF 动图 URL（无动图时缺省）"),
		"size":            optInt("尺寸：1=小 2=大"),
		"custom_emoji_id": optStr("自定义表情 ID（自助上传的表情）"),
		"relation":        optStr("附加关系标记"),
	})

	registerSchema(t, "QuotedTweetDTO", openapi3.Schemas{
		"id":          reqStr("被引用推文 ID"),
		"author":      optRef("被引用推文作者", "TweetAuthorDTO"),
		"content":     reqStr("正文"),
		"images":      strArray("配图 URL"),
		"quote_count": optInt("被引用推文自身的引用数"),
		"created_at":  reqStr("发布时间（RFC3339）"),
	})

	registerSchema(t, "TweetDTO", openapi3.Schemas{
		"id":            reqStr("推文 ID（UUID）"),
		"author":        optRef("作者", "TweetAuthorDTO"),
		"content":       reqStr("正文（≤500 字）"),
		"images":        strArray("配图 URL（≤4 张）"),
		"like_count":    optInt("点赞数"),
		"is_liked":      optBool("当前用户是否已点赞（匿名恒 false）"),
		"comment_count": optInt("评论数"),
		"quote_count":   optInt("引用数"),
		"quote_of":      nullableStr("引用的推文 ID（无引用时缺省）"),
		"quoted_tweet":  optRef("被引用推文详情（引用推文才有）", "QuotedTweetDTO"),
		"created_at":    reqStr("发布时间（RFC3339 UTC）"),
	})

	registerSchema(t, "TweetCommentDTO", openapi3.Schemas{
		"id":            reqStr("评论 ID"),
		"tweet_id":      reqStr("所属推文 ID"),
		"author":        optRef("评论作者", "TweetAuthorDTO"),
		"body":          reqStr("评论正文"),
		"parent_id":     optStr("父评论 ID（顶层评论缺省）"),
		"depth":         optInt("嵌套深度（顶层=0）"),
		"replies_count": optInt64("回复数（回复列表里恒 0）"),
		"created_at":    reqStr("发布时间（RFC3339）"),
	})

	registerSchema(t, "TweetUserProfileDTO", openapi3.Schemas{
		"id":           reqStr("用户 ID"),
		"username":     reqStr("用户名"),
		"display_name": reqStr("显示名"),
		"avatar_url":   reqStr("头像 URL"),
		"bio":          reqStr("个人简介"),
		"created_at":   reqStr("注册时间（RFC3339）"),
	})

	registerSchema(t, "CreateTweetRequest", openapi3.Schemas{
		"content":  optStr("正文（content/images/quote_of 至少一项，≤500 字）"),
		"images":   strArray("配图 URL（≤4 张，须归当前用户）"),
		"quote_of": nullableStr("被引用推文 ID（无引用时缺省）"),
	})

	registerSchema(t, "CreateTweetCommentRequest", openapi3.Schemas{
		"body":      optStr("评论正文（body/pictures 至少一项）"),
		"parent_id": optStr("父评论 ID（空=顶层评论）"),
		"pictures": refArray("评论配图", "TweetCommentPicture"),
	})

	registerSchema(t, "TweetCommentPicture", openapi3.Schemas{
		"url":    reqStr("图片 URL"),
		"width":  optInt("宽（px）"),
		"height": optInt("高（px）"),
		"size":   optInt64("文件字节数"),
	})

	// 时间线、详情与话题的通用参数组（cursor 分页）
	tweetPageParams := func() openapi3.Parameters {
		return openapi3.Parameters{cursorParam(), limitParam(100)}
	}

	// ---- 时间线与话题 ----

	get(t, "/tweets", &openapi3.Operation{
		Tags:    []string{"推文"},
		Summary: "推文时间线",
		Description: "全站推文倒序流（cursor 分页）。匿名可读；登录后填充 is_liked。" +
			"meta.pagination 为 cursor 模式（has_more/next_cursor）。",
		Parameters: tweetPageParams(),
		Responses: responses(
			200, dataArrayResponse("TweetDTO", "推文列表", 200, true),
		),
	})

	get(t, "/tweets/{id}", &openapi3.Operation{
		Tags:       []string{"推文"},
		Summary:    "推文详情",
		Parameters: openapi3.Parameters{pathStrParam("id", "推文 ID（UUID）")},
		Responses: responses(
			200, dataResponse("TweetDTO", "推文详情", 200),
			400, errorResponse("ID 格式非法"),
			404, errorResponse("推文不存在"),
		),
	})

	get(t, "/tweets/topics/{tag}", &openapi3.Operation{
		Tags:        []string{"推文"},
		Summary:     "按话题查推文",
		Description: "话题维度倒序列表，cursor 分页；tag 为空时返回空列表。",
		Parameters: append(openapi3.Parameters{pathStrParam("tag", "话题标签")}, tweetPageParams()...),
		Responses: responses(
			200, dataArrayResponse("TweetDTO", "话题推文列表", 200, true),
		),
	})

	// ---- 发布与删除 ----

	post(t, "/tweets", &openapi3.Operation{
		Tags:    []string{"推文"},
		Summary: "发布推文",
		Description: "登录 + 发布限流。content/images/quote_of 至少一项；" +
			"配图 URL 须归当前用户，quote_of 指向不存在的推文返回 404。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreateTweetRequest", true, "推文内容"),
		Responses: responses(
			201, dataResponse("TweetDTO", "新发布的推文", 201),
			404, errorResponse("被引用推文不存在"),
			422, errorResponse("content/images/quote_of 全为空或超限"),
		),
	})

	del(t, "/tweets/{id}", &openapi3.Operation{
		Tags:        []string{"推文"},
		Summary:     "删除推文",
		Description: "作者本人、超管或持 tweet:delete-any 权限可删。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "推文 ID"), csrfHeaderParam()},
		Responses: responses(
			200, messageResponse("推文已删除"),
			403, errorResponse("无权删除他人推文"),
			404, errorResponse("推文不存在"),
		),
	})

	// ---- 点赞 ----

	post(t, "/tweets/{id}/like", &openapi3.Operation{
		Tags:        []string{"推文"},
		Summary:     "点赞推文",
		Description: "幂等：重复点赞不报错。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "推文 ID"), csrfHeaderParam()},
		Responses:   responses(200, messageResponse("已点赞")),
	})

	del(t, "/tweets/{id}/like", &openapi3.Operation{
		Tags:        []string{"推文"},
		Summary:     "取消点赞",
		Description: "幂等：未点赞时取消也不报错。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "推文 ID"), csrfHeaderParam()},
		Responses:   responses(200, messageResponse("已取消点赞")),
	})

	// ---- 推文评论 ----

	get(t, "/tweets/{id}/comments", &openapi3.Operation{
		Tags:        []string{"推文"},
		Summary:     "推文评论列表",
		Description: "仅顶层评论，最新在前（offset 分页）；回复走 replies 端点。",
		Parameters: append(
			openapi3.Parameters{pathStrParam("id", "推文 ID")},
			pageParam(), limitParam(100),
		),
		Responses: responses(
			200, dataArrayResponse("TweetCommentDTO", "顶层评论列表", 200, true),
		),
	})

	post(t, "/tweets/{id}/comments", &openapi3.Operation{
		Tags:        []string{"推文"},
		Summary:     "发布推文评论",
		Description: "parent_id 须指向同推文评论，否则 400。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "推文 ID"), csrfHeaderParam()},
		RequestBody: jsonBody("CreateTweetCommentRequest", true, "评论内容"),
		Responses: responses(
			201, dataResponse("TweetCommentDTO", "新评论", 201),
			400, errorResponse("parent_id 不属于该推文"),
		),
	})

	del(t, "/tweets/{id}/comments/{commentId}", &openapi3.Operation{
		Tags:        []string{"推文"},
		Summary:     "删除推文评论",
		Description: "作者本人、超管或持 tweet:delete-any 权限可删。",
		Security:    securityCookie(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "推文 ID"), pathStrParam("commentId", "评论 ID"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("评论已删除"),
			403, errorResponse("无权删除他人评论"),
		),
	})

	get(t, "/tweets/{id}/comments/{commentId}/replies", &openapi3.Operation{
		Tags:        []string{"推文"},
		Summary:     "推文评论回复列表",
		Description: "某顶层评论下的回复，最早在前（offset 分页）；replies_count 恒 0。",
		Parameters: append(
			openapi3.Parameters{pathStrParam("id", "推文 ID"), pathStrParam("commentId", "顶层评论 ID")},
			pageParam(), limitParam(100),
		),
		Responses: responses(
			200, dataArrayResponse("TweetCommentDTO", "回复列表", 200, true),
		),
	})

	// ---- 用户主页 ----

	get(t, "/users/{username}", &openapi3.Operation{
		Tags:       []string{"推文"},
		Summary:    "用户公开资料",
		Parameters: openapi3.Parameters{pathStrParam("username", "用户名")},
		Responses: responses(
			200, dataResponse("TweetUserProfileDTO", "用户公开资料", 200),
			400, errorResponse("用户名格式非法"),
			404, errorResponse("用户不存在"),
		),
	})

	get(t, "/users/{username}/tweets", &openapi3.Operation{
		Tags:        []string{"推文"},
		Summary:     "用户推文列表",
		Description: "指定用户的推文倒序流（cursor 分页）。",
		Parameters: append(
			openapi3.Parameters{pathStrParam("username", "用户名")},
			tweetPageParams()...,
		),
		Responses: responses(
			200, dataArrayResponse("TweetDTO", "用户推文列表", 200, true),
			404, errorResponse("用户不存在"),
		),
	})
}
