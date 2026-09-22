package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminBotPaths 注册聊天 Bot 的后台管理接口（需 chat:bot-manage 权限）。
func registerAdminBotPaths(t *openapi3.T) {
	secure := securityAdmin()

	registerSchema(t, "BotDTO", openapi3.Schemas{
		"id":         reqStr("bot 凭证 ID"),
		"user_id":    reqStr("对应虚拟用户 ID，消息 sender.id 即此值"),
		"username":   reqStr("虚拟用户名，@提及与私聊寻址用"),
		"name":       reqStr("显示名"),
		"avatar_id":  optStr("头像文件 ID，未设置为空"),
		"avatar_url": optStr("头像地址"),
		"enabled":    optBool("是否启用；禁用后 token 鉴权即拒"),
		"token":      optStr("明文 token，仅创建与重置响应返回一次，列表与详情恒空"),
		"created_at": reqStr("创建时间（RFC3339）"),
		"updated_at": reqStr("最近更新时间（RFC3339）"),
	})
	registerSchema(t, "CreateBotRequest", openapi3.Schemas{
		"name":      reqStr("显示名（≤32 字符，同时作为虚拟用户展示名）"),
		"username":  reqStr("虚拟用户名：3-32 位字母、数字、下划线或连字符，全站唯一"),
		"avatar_id": optStr("头像文件 ID，缺省表示不设头像"),
	}, "name", "username")
	registerSchema(t, "UpdateBotRequest", openapi3.Schemas{
		"name":      nullableStr("新显示名；缺省表示不改"),
		"avatar_id": nullableStr("新头像文件 ID；空串清除头像，缺省表示不改"),
		"enabled":   optBool("启停；缺省表示不改"),
	})

	get(t, "/admin/chat-bots", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "Bot 列表",
		Description: "需 chat:bot-manage 权限。token 恒为空——库里只有哈希，取不回明文。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pageParam(), limitParam(100)},
		Responses:   responses(200, dataArrayResponse("BotDTO", "bot 列表", 200, true)),
	})

	post(t, "/admin/chat-bots", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "注册 Bot",
		Description: "需 chat:bot-manage 权限。同时创建虚拟用户（无密码，不能用于登录）。token 明文只在本次响应出现。",
		Security:    secure,
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreateBotRequest", true, "bot 参数"),
		Responses:   responses(201, dataResponse("BotDTO", "新 bot（含一次性明文 token）", 201), 409, errorResponse("用户名已被占用")),
	})

	patch(t, "/admin/chat-bots/{botId}", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "改名换像与启停", Description: "需 chat:bot-manage 权限。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("botId", "bot ID"), csrfHeaderParam()},
		RequestBody: jsonBody("UpdateBotRequest", true, "待改字段"),
		Responses:   responses(200, dataResponse("BotDTO", "更新后的 bot", 200), 404, errorResponse("bot 不存在")),
	})

	post(t, "/admin/chat-bots/{botId}/regenerate-token", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "重置 token",
		Description: "需 chat:bot-manage 权限。旧 token 即刻失效，明文只在本次响应出现。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("botId", "bot ID"), csrfHeaderParam()},
		Responses:   responses(200, dataResponse("BotDTO", "新 token", 200), 404, errorResponse("bot 不存在")),
	})

	del(t, "/admin/chat-bots/{botId}", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "吊销 Bot",
		Description: "需 chat:bot-manage 权限。删凭证并停用虚拟用户；历史消息保留（删用户会级联删掉它发过的消息）。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("botId", "bot ID"), csrfHeaderParam()},
		Responses:   responses(200, messageResponse("Bot 已吊销"), 404, errorResponse("bot 不存在")),
	})
}
