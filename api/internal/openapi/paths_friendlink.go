package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerFriendLinkPaths 注册友链接口（PRD-0014）：前台公开列表/申请/发码 +
// 管理侧审核状态机。
func registerFriendLinkPaths(t *openapi3.T) {
	// ---- 公共 schema ----

	registerSchema(t, "FriendLinkDTO", openapi3.Schemas{
		"id":                  reqStr("友链 ID"),
		"name":                reqStr("站点名称"),
		"url":                 reqStr("站点 URL"),
		"avatar_url":          optStr("头像 URL"),
		"description":         optStr("描述"),
		"owner_name":          optStr("站长称呼"),
		"sort_order":          optInt("排序权重"),
		"rss_url":             optStr("选填 RSS/Atom 地址"),
		"feed_status":         strEnum("RSS 抓取状态", "no_feed", "pending", "ok", "empty", "error"),
		"site_status":         strEnum("站点健康，与 RSS 状态独立", "unchecked", "up", "down"),
		"checked_at":          nullableStr("上次健康探测时间，未探测为 null"),
		"latest_title":        optStr("最近文章标题；失败保留上次成功结果"),
		"latest_url":          optStr("最近文章外站链接"),
		"latest_published_at": nullableStr("源站文章时间，缺失为 null，不以抓取时间填充"),
	})

	registerSchema(t, "FriendLinkAdminDTO", openapi3.Schemas{
		"status":        strEnum("审核状态", "pending", "approved", "rejected", "disabled"),
		"contact_email": optStr("联系邮箱"),
		"linkback_url":  optStr("回链 URL"),
		"user_id":       optStr("申请人用户 ID（匿名申请与手动添加为空串）"),
		"created_at":    optStr("申请时间（RFC3339）"),
		"updated_at":    optStr("最近更新时间（RFC3339）"),
		// 公开字段同 FriendLinkDTO（FriendLinkAdminDTO 内嵌之）
		"id":                  reqStr("友链 ID"),
		"name":                reqStr("站点名称"),
		"url":                 reqStr("站点 URL"),
		"avatar_url":          optStr("头像 URL"),
		"description":         optStr("描述"),
		"owner_name":          optStr("站长称呼"),
		"sort_order":          optInt("排序权重"),
		"rss_url":             optStr("选填 RSS/Atom 地址"),
		"feed_status":         strEnum("RSS 抓取状态", "no_feed", "pending", "ok", "empty", "error"),
		"site_status":         strEnum("站点健康", "unchecked", "up", "down"),
		"checked_at":          nullableStr("上次健康探测时间"),
		"latest_title":        optStr("最近文章标题"),
		"latest_url":          optStr("最近文章外站链接"),
		"latest_published_at": nullableStr("源站文章时间"),
	})

	registerSchema(t, "FriendLinkApplyRequest", openapi3.Schemas{
		"name":          reqStr("站点名称"),
		"url":           reqStr("站点 URL"),
		"avatar_url":    optStr("头像 URL"),
		"rss_url":       optStr("选填 RSS/Atom 地址，仅 HTTP(S) 公开站点"),
		"description":   optStr("描述"),
		"owner_name":    optStr("站长称呼"),
		"linkback_url":  optStr("回链 URL"),
		"contact_email": optStr("联系邮箱（匿名态必填；登录态由用户资料覆盖）"),
		"code":          optStr("邮箱验证码（匿名态必填；登录态忽略）"),
	}, "name", "url")

	registerSchema(t, "FriendLinkCodeRequest", openapi3.Schemas{
		"email": reqStr("接收验证码的邮箱"),
	}, "email")

	registerSchema(t, "FriendLinkManualRequest", openapi3.Schemas{
		"name":          reqStr("站点名称"),
		"url":           reqStr("站点 URL"),
		"avatar_url":    optStr("头像 URL"),
		"rss_url":       optStr("选填 RSS/Atom 地址，仅 HTTP(S) 公开站点"),
		"description":   optStr("描述"),
		"owner_name":    optStr("站长称呼"),
		"linkback_url":  optStr("回链 URL"),
		"contact_email": optStr("联系邮箱"),
		"sort_order":    optInt("排序权重（默认 0）"),
	}, "name", "url")

	registerSchema(t, "FriendLinkPendingCount", openapi3.Schemas{
		"count": optInt64("待审数量"),
	})

	// ---- 公开接口 ----

	get(t, "/friend-links", &openapi3.Operation{
		Tags:        []string{"友链"},
		Summary:     "友链列表（已通过）",
		Description: "仅 approved，读取服务端持久快照，不等待第三方网络。无参数返回全量数组；带 page/limit/sort 时返回分页，默认按真实文章日期倒序，空日期最后，sort_order 与 id ASC 稳定破同分。抓取失败保留上次文章，不改变审核状态。",
		Parameters:  openapi3.Parameters{pageParam(), limitParam(100), queryStrParam("sort", "updated（默认）或 manual（站长顺序）")},
		Responses: responses(
			200, dataArrayResponse("FriendLinkDTO", "已通过友链；有查询参数时附加分页元数据", 200, true),
		),
	})

	post(t, "/friend-links", &openapi3.Operation{
		Tags:    []string{"友链"},
		Summary: "申请友链",
		Description: "双轨：登录（会话有 userID）跳过验证码直接提交；匿名必须先 " +
			"POST /friend-links/code 发码再携带 contact_email + code 提交。限流 3 次/分/IP。",
		Security:    &openapi3.SecurityRequirements{}, // OptionalAuth：匿名可调用
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("FriendLinkApplyRequest", true, "申请信息"),
		Responses: responses(
			201, dataResponse("FriendLinkDTO", "已受理的申请（pending 态）", 201),
			429, errorResponse("提交过于频繁"),
		),
	})

	post(t, "/friend-links/code", &openapi3.Operation{
		Tags:        []string{"友链"},
		Summary:     "发送申请验证码",
		Description: "匿名申请第一步。限流 5 次/分/IP。",
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("FriendLinkCodeRequest", true, "邮箱"),
		Responses: responses(
			200, messageResponse("验证码已发送"),
			429, errorResponse("发送过于频繁"),
		),
	})

	// ---- 管理接口 ----

	get(t, "/admin/friend-links", &openapi3.Operation{
		Tags:        []string{"友链管理"},
		Summary:     "友链管理列表",
		Description: "需 friendlink:view 权限。status 过滤（空=全部），offset 分页。",
		Security:    securityAdmin(),
		Parameters: append(
			openapi3.Parameters{queryStrParam("status", "过滤状态（pending/approved/rejected/disabled，空=全部）")},
			pageParam(), limitParam(100),
		),
		Responses: responses(
			200, dataArrayResponse("FriendLinkAdminDTO", "友链管理列表", 200, true),
			400, errorResponse("status 枚举非法"),
		),
	})

	get(t, "/admin/friend-links/pending/count", &openapi3.Operation{
		Tags:        []string{"友链管理"},
		Summary:     "待审友链计数",
		Description: "需 friendlink:view 权限。侧边栏角标用。",
		Security:    securityAdmin(),
		Responses: responses(
			200, dataResponse("FriendLinkPendingCount", "待审数量", 200),
		),
	})

	post(t, "/admin/friend-links", &openapi3.Operation{
		Tags:        []string{"友链管理"},
		Summary:     "手动添加友链",
		Description: "需 friendlink:manage 权限。直达 approved。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("FriendLinkManualRequest", true, "友链信息"),
		Responses: responses(
			201, dataResponse("FriendLinkAdminDTO", "新建友链", 201),
		),
	})

	patch(t, "/admin/friend-links/{id}", &openapi3.Operation{
		Tags:        []string{"友链管理"},
		Summary:     "更新友链信息",
		Description: "需 friendlink:manage 权限。全量替换语义（name/url 必填）。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "友链 ID"), csrfHeaderParam()},
		RequestBody: jsonBody("FriendLinkManualRequest", true, "友链信息"),
		Responses: responses(
			200, dataResponse("FriendLinkAdminDTO", "更新后的友链", 200),
			404, errorResponse("友链不存在"),
		),
	})

	del(t, "/admin/friend-links/{id}", &openapi3.Operation{
		Tags:        []string{"友链管理"},
		Summary:     "删除友链",
		Description: "需 friendlink:manage 权限。物理删除。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "友链 ID"), csrfHeaderParam()},
		Responses: responses(
			200, messageResponse("友链已删除"),
			404, errorResponse("友链不存在"),
		),
	})

	// 审核状态机动作（均无 body）
	reviewActions := []struct {
		suffix  string
		summary string
		desc    string
	}{
		{"approve", "通过友链", "pending/rejected → approved。"},
		{"reject", "驳回友链", "pending → rejected。"},
		{"disable", "停用友链", "approved → disabled。"},
		{"restore", "恢复友链", "disabled → approved。"},
	}
	for _, a := range reviewActions {
		post(t, "/admin/friend-links/{id}/"+a.suffix, &openapi3.Operation{
			Tags:        []string{"友链管理"},
			Summary:     a.summary,
			Description: "需 friendlink:manage 权限。状态机：" + a.desc,
			Security:    securityAdmin(),
			Parameters:  openapi3.Parameters{pathStrParam("id", "友链 ID"), csrfHeaderParam()},
			Responses: responses(
				200, messageResponse("状态已更新"),
				404, errorResponse("友链不存在"),
				409, errorResponse("状态迁移非法"),
			),
		})
	}
}
