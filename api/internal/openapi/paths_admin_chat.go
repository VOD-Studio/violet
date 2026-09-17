package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminChatBadgePaths 注册聊天徽章授予管理接口（/admin/chat-badges）。
// ChatBadgeGrantDTO 已在 paths_chat.go 注册，此处复用；全部端点需 chat:manage 权限。
func registerAdminChatBadgePaths(t *openapi3.T) {
	registerSchema(t, "AdminGrantBadgesRequest", openapi3.Schemas{
		"user_id":   reqStr("被授予用户 ID"),
		"badge_ids": strArray("徽章目录 ID 列表;已持有的自动跳过"),
	}, "user_id", "badge_ids")

	secure := securityCookie()
	get(t, "/admin/chat-badges/grants", &openapi3.Operation{
		Tags: []string{"聊天管理"}, Summary: "查看用户徽章持有", Description: "需 chat:manage 权限。", Security: secure,
		Parameters: openapi3.Parameters{queryStrParam("user_id", "用户 ID")},
		Responses:  responses(200, dataArrayResponse("ChatBadgeGrantDTO", "持有记录,按授予时间升序", 200, false)),
	})
	post(t, "/admin/chat-badges/grants", &openapi3.Operation{
		Tags: []string{"聊天管理"}, Summary: "批量授予徽章", Description: "需 chat:manage 权限;已持有项静默跳过。", Security: secure,
		Parameters: openapi3.Parameters{csrfHeaderParam()}, RequestBody: jsonBody("AdminGrantBadgesRequest", true, "授予参数"),
		Responses: responses(200, messageResponse("徽章已授予")),
	})
	del(t, "/admin/chat-badges/grants/{userId}/{badgeId}", &openapi3.Operation{
		Tags: []string{"聊天管理"}, Summary: "撤销徽章", Description: "需 chat:manage 权限;用户展示侧在下次查询自动移除。", Security: secure,
		Parameters: openapi3.Parameters{pathStrParam("userId", "用户 ID"), pathStrParam("badgeId", "徽章目录 ID"), csrfHeaderParam()},
		Responses:  responses(200, messageResponse("徽章已撤销")),
	})
}
