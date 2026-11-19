package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerTweetPaths 注册推文接口（PRD-0013）：时间线/详情/话题/发布/删除/
// 点赞/评论，以及用户主页公开资料与推文列表。
func registerTweetPaths(t *openapi3.T) {
	registerExternalTweetPaths(t)
	registerTweetCommentReactionPaths(t)
	registerPublicProfilePaths(t)
	// ---- 公共 schema ----

	registerSchema(t, "TweetAuthorDTO", openapi3.Schemas{
		"id":         reqStr("作者用户 ID"),
		"username":   reqStr("用户名"),
		"avatar_url": reqStr("头像 URL"),
		"is_bot":     optBool("作者是否为 bot 虚拟用户"),
	})

	registerSchema(t, "TweetEmojiRef", openapi3.Schemas{
		"url":             reqStr("表情静态图 URL"),
		"gif_url":         optStr("GIF 动图 URL（无动图时缺省）"),
		"size":            optInt("尺寸：1=小 2=大"),
		"custom_emoji_id": optStr("自定义表情 ID（自助上传的表情）"),
		"relation":        optStr("附加关系标记"),
	})

	registerSchema(t, "TweetImageDTO", openapi3.Schemas{
		"url":    reqStr("图片访问 URL"),
		"width":  optInt("宽（px）；null=历史数据缺尺寸"),
		"height": optInt("高（px）；null=历史数据缺尺寸"),
	})

	registerSchema(t, "QuotedTweetDTO", openapi3.Schemas{
		"id":             reqStr("被引用推文 ID"),
		"author":         optRef("被引用推文作者", "TweetAuthorDTO"),
		"content":        reqStr("正文"),
		"images":         refArray("配图（≤4 张）", "TweetImageDTO"),
		"link_cards":     refArray("正文链接卡片（按 URL 出现顺序，可为空数组）", "LinkCardDTO"),
		"quote_count":    optInt("被引用推文自身的引用数"),
		"created_at":     reqStr("发布时间（RFC3339）"),
		"external_tweet": optRef("当前共享 X 原文，失效时仅有来源占位", "ExternalTweetDTO"),
	})

	registerSchema(t, "TweetDTO", openapi3.Schemas{
		"id":             reqStr("推文 ID（UUID）"),
		"author":         optRef("作者", "TweetAuthorDTO"),
		"content":        reqStr("正文（≤500 字）"),
		"images":         refArray("配图（≤4 张）", "TweetImageDTO"),
		"link_cards":     refArray("正文链接卡片（按 URL 出现顺序，可为空数组）", "LinkCardDTO"),
		"like_count":     optInt("点赞数"),
		"view_count":     optInt64("累计去重浏览次数"),
		"is_liked":       optBool("当前用户是否已点赞（匿名恒 false）"),
		"comment_count":  optInt("评论数"),
		"quote_count":    optInt("引用数"),
		"quote_of":       nullableStr("引用的推文 ID（无引用时缺省）"),
		"quoted_tweet":   optRef("被引用推文详情（引用推文才有）", "QuotedTweetDTO"),
		"created_at":     reqStr("发布时间（RFC3339 UTC）"),
		"external_tweet": optRef("当前共享 X 原文，失效时仅有来源占位", "ExternalTweetDTO"),
	}, "view_count")

	registerSchema(t, "TweetSidebarAuthorDTO", openapi3.Schemas{
		"id":           reqStr("作者用户 ID"),
		"username":     reqStr("用户主页使用的用户名"),
		"display_name": reqStr("公开昵称，未设置时为空串"),
		"avatar_url":   reqStr("公开头像，未设置时为空串"),
		"count":        optInt64("近 30 天的公开推文数"),
	}, "id", "username", "display_name", "avatar_url", "count")

	registerSchema(t, "TweetSidebarTopicDTO", openapi3.Schemas{
		"tag":   reqStr("话题名（不含 #）"),
		"count": optInt64("近 30 天包含该话题的公开推文数"),
	}, "tag", "count")

	width := optInt("图片宽度（px），null 表示历史尺寸未知")
	width.Value.Nullable = true
	height := optInt("图片高度（px），null 表示历史尺寸未知")
	height.Value.Nullable = true
	registerSchema(t, "TweetSidebarImageDTO", openapi3.Schemas{
		"tweet_id": reqStr("所属推文 ID"),
		"url":      reqStr("图片访问 URL"),
		"width":    width,
		"height":   height,
		"index":    optInt("图片在所属推文中的零基下标"),
	}, "tweet_id", "url", "width", "height", "index")

	registerSchema(t, "TweetSidebarDTO", openapi3.Schemas{
		"authors": refArray("近 30 天发帖最多的公开作者，至多 4 个", "TweetSidebarAuthorDTO"),
		"topics":  refArray("近 30 天推文最多的公开话题，至多 4 个", "TweetSidebarTopicDTO"),
		"images":  refArray("最新的本站推文自身配图，至多 6 张", "TweetSidebarImageDTO"),
	}, "authors", "topics", "images")

	registerSchema(t, "TweetDetailContextProfileDTO", openapi3.Schemas{
		"username":     reqStr("用户主页使用的用户名"),
		"display_name": reqStr("公开昵称，未设置时为空串"),
		"avatar_url":   reqStr("公开头像，未设置时为空串"),
	}, "username", "display_name", "avatar_url")

	registerSchema(t, "TweetDetailContextAuthorDTO", openapi3.Schemas{
		"username":            reqStr("用户主页使用的用户名"),
		"display_name":        reqStr("公开昵称，未设置时为空串"),
		"avatar_url":          reqStr("公开头像，未设置时为空串"),
		"bio":                 reqStr("公开简介，未设置时为空串"),
		"tweet_count":         optInt64("作者全部当前公开推文数，不限时间"),
		"received_like_count": optInt64("上述推文各自现有点赞数之和，不按点赞用户去重"),
	}, "username", "display_name", "avatar_url", "bio", "tweet_count", "received_like_count")

	registerSchema(t, "TweetDetailContextQuoteDTO", openapi3.Schemas{
		"id":         reqStr("引用推文的 ID（UUID）"),
		"author":     optRef("引用推文作者", "TweetDetailContextProfileDTO"),
		"content":    reqStr("引用推文自身正文，纯引用时为空串"),
		"created_at": reqStr("发布时间（RFC3339 UTC）"),
	}, "id", "author", "content", "created_at")

	directQuotes := refArray("最近的公开直接引用，无引用时为空数组", "TweetDetailContextQuoteDTO")
	directQuotes.Value.MaxItems = new(uint64(6))
	registerSchema(t, "TweetDetailContextDTO", openapi3.Schemas{
		"author": optRef("主推文作者资料与统计", "TweetDetailContextAuthorDTO"),
		"quotes": directQuotes,
	}, "author", "quotes")

	registerSchema(t, "TweetViewCountDTO", openapi3.Schemas{
		"view_count": optInt64("累计去重浏览次数"),
	}, "view_count")

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

	registerSchema(t, "CreateTweetRequest", openapi3.Schemas{
		"content":                optStr("正文或转发感想（content/images/quote_of/external_preview_token 至少一项，≤500 字）"),
		"images":                 strArray("配图 URL（≤4 张，须归当前用户）"),
		"quote_of":               nullableStr("被引用推文 ID（无引用时缺省）"),
		"external_preview_token": optStr("服务端预览凭证，与 quote_of 互斥"),
		"client_request_id":      optStr("发布操作 UUID；X 转发必填，同用户同键同内容返回原结果"),
	})

	registerSchema(t, "CreateTweetCommentRequest", openapi3.Schemas{
		"body":      optStr("评论正文（body/pictures 至少一项）"),
		"parent_id": optStr("父评论 ID（空=顶层评论）"),
		"pictures":  refArray("评论配图", "TweetCommentPicture"),
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
	sortParam := queryStrParam("sort", "latest=最新，hot=热门，images=仅自身有配图")
	sortParam.Value.Schema = strEnum("推文排序", "latest", "hot", "images")
	sortParam.Value.Schema.Value.Default = "latest"

	get(t, "/tweets", &openapi3.Operation{
		Tags:    []string{"推文"},
		Summary: "推文时间线",
		Description: "公开推文 cursor 分页。latest 按时间和 ID 降序；images 在分页前筛选自身附有本站图片的推文，不算外链、视频封面或引用配图。" +
			"hot 在每分钟共享快照中锁定候选推文近 30 天的发布时间窗口，按点赞数 + 公开评论（含回复）数 + 公开引用数、发布时间、ID 依次降序。" +
			"排序快照最长保存 15 分钟，仅缓存顺序，不缓存 DTO；物理删除和作者注销后的推文不会继续返回。" +
			"公开机器人发帖与普通公开发帖一致。登录后填充 is_liked，HTTP 响应 no-store。" +
			"meta.pagination 为 cursor 模式（has_more/next_cursor），游标不能跨排序使用。",
		Parameters: append(tweetPageParams(), sortParam),
		Responses: responses(
			200, dataArrayResponse("TweetDTO", "推文列表", 200, true),
			400, errorResponse("排序或游标非法"),
			409, errorResponse("TWEET_HOT_CURSOR_EXPIRED：热门快照已失效，丢弃旧游标并重开第一页"),
		),
	})

	get(t, "/tweets/sidebar", &openapi3.Operation{
		Tags:    []string{"推文"},
		Summary: "推文时间线侧栏",
		Description: "仅聚合匿名可见推文，含公开机器人发帖，不含已注销作者。作者和话题统计近 30 天推文；" +
			"图片在不限时间的公开推文中按推文时间和 ID 降序、图内原顺序取最近的本站附图。响应 no-store。",
		Responses: responses(200, dataResponse("TweetSidebarDTO", "活跃作者、话题与最近图片", 200)),
	})

	post(t, "/tweets/{id}/views", &openapi3.Operation{
		Tags:    []string{"推文"},
		Summary: "登记一次推文浏览",
		Description: "匿名可用，须使用站点 CSRF 令牌；每条公开推文按受信客户端地址的摘要滚动 30 分钟去重，" +
			"重复提交返回当前累计数。无请求体；GET 和 SSR 不计入。响应 no-store，不返回去重标识。",
		Parameters: openapi3.Parameters{pathStrParam("id", "推文 ID（UUID）"), csrfHeaderParam()},
		Responses: responses(
			200, dataResponse("TweetViewCountDTO", "当前累计浏览次数", 200),
			400, errorResponse("ID 格式非法"),
			403, errorResponse("CSRF 校验失败"),
			404, errorResponse("推文不存在或不可公开访问"),
			429, errorResponse("浏览登记请求触发限流"),
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

	get(t, "/tweets/{id}/context", &openapi3.Operation{
		Tags:    []string{"推文"},
		Summary: "推文详情上下文",
		Description: "匿名可用。累计所有当前公开的该作者推文及其现有点赞数，不计评论和回应。" +
			"至多返回六条公开的直接引用，按发布时间与 ID 降序；不展开下级引用或 X 原文。已注销作者的推文不公开。响应 no-store。",
		Parameters: openapi3.Parameters{pathStrParam("id", "推文 ID（UUID）")},
		Responses: responses(
			200, dataResponse("TweetDetailContextDTO", "作者资料、累计统计与最近直接引用", 200),
			400, errorResponse("ID 格式非法"),
			404, errorResponse("推文不存在或不可公开访问"),
		),
	})

	get(t, "/tweets/topics/{tag}", &openapi3.Operation{
		Tags:        []string{"推文"},
		Summary:     "按话题查推文",
		Description: "话题维度倒序列表，cursor 分页；tag 为空时返回空列表。",
		Parameters:  append(openapi3.Parameters{pathStrParam("tag", "话题标签")}, tweetPageParams()...),
		Responses: responses(
			200, dataArrayResponse("TweetDTO", "话题推文列表", 200, true),
		),
	})

	// ---- 发布与删除 ----

	post(t, "/tweets", &openapi3.Operation{
		Tags:    []string{"推文"},
		Summary: "发布推文",
		Description: "登录 + 发布限流。content/images/quote_of/external_preview_token 至少一项；" +
			"配图 URL 须归当前用户，quote_of 指向不存在的推文返回 404。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreateTweetRequest", true, "推文内容"),
		Responses: responses(
			201, dataResponse("TweetDTO", "新发布的推文", 201),
			400, errorResponse("预览过期、已使用或原文版本变化；请重新预览"),
			403, errorResponse("预览不属于当前用户或图片所有权不符"),
			409, errorResponse("同一发布请求 ID 携带不同内容"),
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
		Description: "仅顶层评论（offset 分页）；sort=latest|hot，默认 latest。hot 按总回应记录数降序，并列按 created_at DESC、id DESC；回复的排序不变。",
		Parameters: append(
			openapi3.Parameters{pathStrParam("id", "推文 ID"), commentSortParam()},
			pageParam(), limitParam(100),
		),
		Responses: responses(
			200, dataArrayResponse("TweetCommentDTO", "顶层评论列表", 200, true),
			400, errorResponse("sort 必须为 latest 或 hot"),
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
