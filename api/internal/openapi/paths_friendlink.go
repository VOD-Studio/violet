package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerFriendLinkPaths 注册友链接口（PRD-0014）：前台公开列表/申请/发码 +
// 管理侧审核状态机。
func registerFriendLinkPaths(t *openapi3.T) {
	// ---- 公共 schema ----

	registerSchema(t, "FriendLinkDTO", openapi3.Schemas{
		"id":          reqStr("友链 ID"),
		"name":        reqStr("站点名称"),
		"url":         reqStr("站点 URL"),
		"avatar_url":  optStr("头像 URL"),
		"description": optStr("描述"),
		"owner_name":  optStr("站长称呼"),
		"sort_order":  optInt("排序权重"),
	})

	registerSchema(t, "FriendLinkAdminDTO", openapi3.Schemas{
		"status":        strEnum("审核状态", "pending", "approved", "rejected", "disabled"),
		"contact_email": optStr("联系邮箱"),
		"linkback_url":  optStr("回链 URL"),
		"user_id":       optStr("申请人用户 ID（匿名申请与手动添加为空串）"),
		"created_at":    optStr("申请时间（RFC3339）"),
		"updated_at":    optStr("最近更新时间（RFC3339）"),
		// 公开字段同 FriendLinkDTO（FriendLinkAdminDTO 内嵌之）
		"id":          reqStr("友链 ID"),
		"name":        reqStr("站点名称"),
		"url":         reqStr("站点 URL"),
		"avatar_url":  optStr("头像 URL"),
		"description": optStr("描述"),
		"owner_name":  optStr("站长称呼"),
		"sort_order":  optInt("排序权重"),
	})

	registerSchema(t, "FriendLinkApplyRequest", openapi3.Schemas{
		"name":         reqStr("站点名称"),
		"url":          reqStr("站点 URL"),
		"avatar_url":   optStr("头像 URL"),
		"description":  optStr("描述"),
		"owner_name":   optStr("站长称呼"),
		"linkback_url": optStr("回链 URL"),
		"contact_email": optStr("联系邮箱（匿名态必填；登录态由用户资料覆盖）"),
		"code":          optStr("邮箱验证码（匿名态必填；登录态忽略）"),
	}, "name", "url")

	registerSchema(t, "FriendLinkCodeRequest", openapi3.Schemas{
		"email": reqStr("接收验证码的邮箱"),
	}, "email")

	registerSchema(t, "FriendLinkManualRequest", openapi3.Schemas{
		"name":         reqStr("站点名称"),
		"url":          reqStr("站点 URL"),
		"avatar_url":   optStr("头像 URL"),
		"description":  optStr("描述"),
		"owner_name":   optStr("站长称呼"),
		"linkback_url": optStr("回链 URL"),
		"contact_email": optStr("联系邮箱"),
		"sort_order":   optInt("排序权重（默认 0）"),
	}, "name", "url")

	registerSchema(t, "FriendLinkPendingCount", openapi3.Schemas{
		"count": optInt64("待审数量"),
	})

	// ---- 公开接口 ----

	get(t, "/friend-links", &openapi3.Operation{
		Tags:    []string{"友链"},
		Summary: "友链列表（已通过）",
		Description: "仅 approved 友链，不分页（首页直接全量渲染）。" +
			"刻意不含联系邮箱/审核状态等私有字段。",
		Responses: responses(
			200, dataArrayResponse("FriendLinkDTO", "已通过友链", 200, false),
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
