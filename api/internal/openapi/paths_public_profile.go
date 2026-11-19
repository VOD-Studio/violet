package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerPublicProfilePaths(t *openapi3.T) {
	registerSchema(t, "PublicProfileStats", openapi3.Schemas{
		"posts": optInt64("当前公开文章数"), "tweets": optInt64("当前公开推文数"),
		"comments": optInt64("已审核文章自由评论与公开推文评论数"), "annotations": optInt64("已审核文章批注数"),
		"received_likes":     optInt64("当前公开推文收到的点赞数，不计表情回应"),
		"received_reactions": optInt64("当前公开评论和批注收到的表情回应数"),
	}, "posts", "tweets", "comments", "annotations", "received_likes", "received_reactions")
	registerSchema(t, "PublicProfileDay", openapi3.Schemas{
		"date": reqStr("UTC 日期 YYYY-MM-DD"), "count": optInt64("当日发表的当前公开内容数"),
	}, "date", "count")
	registerSchema(t, "PublicProfileCalendar", openapi3.Schemas{
		"timezone": reqStr("日期分组时区，固定 UTC"), "start_date": reqStr("半年前日期，包含"), "end_date": reqStr("今天日期，包含"),
		"total": optInt64("区间内公开文章、推文、已审核评论及批注总数，不包含点赞、阅读及表情回应"),
		"days":  refArray("连续逐日数据，空日为 0", "PublicProfileDay"),
	}, "timezone", "start_date", "end_date", "total", "days")
	registerSchema(t, "PublicProfileDTO", openapi3.Schemas{
		"id": reqStr("用户 ID"), "username": reqStr("用户名"), "display_name": reqStr("昵称"),
		"avatar_url": reqStr("头像 URL"), "cover_url": reqStr("主页封面 URL"), "bio": reqStr("简介"),
		"location": reqStr("本人主动公开的所在地"), "website": reqStr("本人主动公开的 HTTP(S) 主页"),
		"public_reading_preferences": strArray("本人主动公开的主题，绝不从阅读历史推导"),
		"created_at":                 reqStr("加入日期 RFC3339"), "is_bot": optBool("是否为机器人"),
		"stats": optRef("当前可见内容统计", "PublicProfileStats"), "activity": optRef("近半年 UTC 逐日活动", "PublicProfileCalendar"),
	}, "id", "username", "display_name", "avatar_url", "cover_url", "bio", "location", "website", "public_reading_preferences", "created_at", "is_bot", "stats", "activity")
	registerSchema(t, "PublicProfileActivity", openapi3.Schemas{
		"id": reqStr("内容 ID"), "type": strEnum("内容类型", "post", "tweet", "comment", "annotation", "tweet_comment"),
		"title": reqStr("来源标题"), "body": reqStr("公开正文摘要"), "selected_text": reqStr("批注选区，其他为空串"),
		"url": reqStr("本站原文路径"), "cover_image": reqStr("文章封面"), "images": refArray("真实公开配图", "TweetImageDTO"),
		"created_at": reqStr("发表时间 RFC3339，文章使用 published_at"),
	}, "id", "type", "title", "body", "selected_text", "url", "cover_image", "images", "created_at")
	get(t, "/users/{username}", &openapi3.Operation{
		Tags: []string{"用户主页"}, Summary: "公开用户资料、全量可见统计与半年活动",
		Parameters: openapi3.Parameters{pathStrParam("username", "用户名")},
		Responses:  responses(200, dataResponse("PublicProfileDTO", "公开主页", 200), 400, errorResponse("用户名格式非法"), 404, errorResponse("用户不存在或已注销")),
	})
	get(t, "/users/{username}/activity", &openapi3.Operation{
		Tags: []string{"用户主页"}, Summary: "混合公开动态游标分页",
		Description: "按发表时间、类型、UUID 倒序；游标绑定账号、分类与首屏快照。审核或删除即时过滤。只返回公开内容，不含阅读历史和 OMP 用量。默认每页 20，最多 50。",
		Parameters:  openapi3.Parameters{pathStrParam("username", "用户名"), queryStrParam("tab", "all（默认）、posts、tweets、comments 或 annotations"), queryStrParam("cursor", "服务端返回的不透明游标"), limitParam(50)},
		Responses:   responses(200, dataArrayResponse("PublicProfileActivity", "公开动态", 200, true), 400, errorResponse("分类或游标无效"), 404, errorResponse("用户不存在或已注销")),
	})
}
