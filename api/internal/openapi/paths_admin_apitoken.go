package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminAPITokenPaths 注册 MCP PAT（个人访问令牌）管理接口：
// 列表/创建/吊销，仅操作当前用户自己的令牌。
func registerAdminAPITokenPaths(t *openapi3.T) {
	secure := securityAdmin()

	registerSchema(t, "PATDTO", openapi3.Schemas{
		"id":           reqStr("令牌 ID"),
		"name":         reqStr("令牌名"),
		"scopes":       strArray("授权范围"),
		"expires_at":   optStr("过期日（YYYY-MM-DD，缺省=永不过期）"),
		"last_used_at": optStr("最近使用时间（RFC3339，从未使用缺省）"),
		"created_at":   reqStr("创建时间（RFC3339）"),
		"token":        optStr("令牌明文（仅创建响应返回一次，列表恒空）"),
		"interactive":  optBool("是否交互式会话令牌"),
	})

	registerSchema(t, "CreatePATRequest", openapi3.Schemas{
		"name":        reqStr("令牌名（≤100 字）"),
		"scopes":      strArray("授权范围（至少一项）"),
		"expires_at":  optStr("过期日（YYYY-MM-DD 或 never；空串=90 天）"),
		"interactive": optBool("是否交互式会话令牌"),
	}, "name", "scopes")

	get(t, "/admin/api-tokens", &openapi3.Operation{
		Tags:        []string{"MCP 令牌"},
		Summary:     "我的令牌列表",
		Description: "需 mcp:manage-tokens 权限；仅返回当前用户自己的令牌（offset 分页）。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pageParam(), limitParam(100)},
		Responses: responses(
			200, dataArrayResponse("PATDTO", "令牌列表", 200, true),
		),
	})

	post(t, "/admin/api-tokens", &openapi3.Operation{
		Tags:        []string{"MCP 令牌"},
		Summary:     "创建令牌",
		Description: "需 mcp:manage-tokens 权限。token 明文仅本次响应返回，之后不可再取。",
		Security:    secure,
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreatePATRequest", true, "令牌参数"),
		Responses: responses(
			201, dataResponse("PATDTO", "新建令牌（含一次性明文）", 201),
			400, errorResponse("过期日早于今天或 scope 非法"),
		),
	})

	del(t, "/admin/api-tokens/{id}", &openapi3.Operation{
		Tags:        []string{"MCP 令牌"},
		Summary:     "吊销令牌",
		Description: "需 mcp:manage-tokens 权限。即时生效。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("id", "令牌 ID"), csrfHeaderParam()},
		Responses: responses(
			200, messageResponse("令牌已吊销"),
			404, errorResponse("令牌不存在"),
		),
	})
}
