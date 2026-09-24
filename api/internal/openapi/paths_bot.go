package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerBotPaths 注册 Bot API：外部程序以 Bearer bot token 代表虚拟用户收发站内聊天消息。
//
// 读模型复用聊天侧的 ChatConversationDTO / ChatMessageDTO——bot 与人在服务层走
// 同一条链路，文档也就只有一个形状。
func registerBotPaths(t *openapi3.T) {
	secure := securityBot()
	registerSchema(t, "BotCommandArgument", openapi3.Schemas{
		"name": reqStr("参数名"), "type": strEnum("参数类型", "string", "integer", "boolean"),
		"required": optBool("是否必填"),
	}, "name", "type", "required")
	registerSchema(t, "BotCommand", openapi3.Schemas{
		"id": reqStr("稳定命令 ID"), "path": strArray("不含前缀的命令路径"),
		"description": reqStr("简短说明"), "arguments": refArray("参数提示", "BotCommandArgument"),
		"scope": strEnum("作用域", "conversation", "global"),
	}, "id", "path", "description", "arguments", "scope")
	registerSchema(t, "BotCommandCatalogRequest", openapi3.Schemas{
		"schema_version": optInt("固定为 1"), "commands": refArray("完整目录；空数组撤销", "BotCommand"),
	}, "schema_version", "commands")
	registerSchema(t, "BotCommandRevision", openapi3.Schemas{"revision": reqStr("规范化目录 SHA-256 hex")}, "revision")
	registerSchema(t, "ChatBotCommandCatalog", openapi3.Schemas{
		"bot_user_id": reqStr("bot 虚拟用户 ID"), "username": reqStr("构造提及 token 所需用户名"),
		"name": reqStr("显示名"), "revision": reqStr("内容摘要"), "commands": refArray("命令目录", "BotCommand"),
	}, "bot_user_id", "username", "name", "revision", "commands")
	registerSchema(t, "ChatBotCommands", openapi3.Schemas{"bots": refArray("会话内已启用的 bot；未发布目录时命令为空", "ChatBotCommandCatalog")}, "bots")

	put(t, "/chat/bot/commands", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "替换本 bot 的命令目录", Security: secure,
		Description: "最多 64 KiB、100 项。相同内容重复发布保持 revision 与更新时间；空数组撤销。",
		RequestBody: jsonBody("BotCommandCatalogRequest", true, "完整目录"),
		Responses:   responses(200, dataResponse("BotCommandRevision", "目录版本", 200), 400, errorResponse("目录格式非法")),
	})

	registerSchema(t, "BotSendMessageRequest", openapi3.Schemas{
		"content":     optStr("文本内容，≤10000 字符；status=pending 时须为空"),
		"reply_to_id": optStr("引用的同会话消息 ID，缺省表示不引用"),
		"status":      optStr("pending 创建可恢复的生成回复；省略时兼容普通文本消息"),
	})
	registerSchema(t, "BotEditMessageRequest", openapi3.Schemas{
		"content":  optStr("累计正文，整体替换原文"),
		"thinking": optStr("累计思考内容；后台关闭展示时不保存"),
		"status":   optStr("pending、thinking、streaming、completed 或 failed；省略时兼容旧版编辑"),
		"revision": optInt64("生成更新递增版本，首次为 1"),
	})
	registerSchema(t, "BotTypingRequest", openapi3.Schemas{
		"is_typing": optBool("true 表示正在输入，false 显式结束"),
	})

	get(t, "/chat/bot/profile", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "本 bot 身份资料",
		Description: "返回 bot 与其虚拟用户标识：消息 sender.id 即 user_id，被 @ 判定比对 username。",
		Security:    secure,
		Responses:   responses(200, dataResponse("BotDTO", "bot 资料", 200), 401, errorResponse("token 无效"), 403, errorResponse("bot 已禁用")),
	})

	get(t, "/chat/bot/conversations", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "参与的会话列表", Security: secure,
		Parameters: openapi3.Parameters{queryStrParam("cursor", "会话游标"), limitParam(50)},
		Responses:  responses(200, dataArrayResponse("ChatConversationDTO", "会话列表", 200, true)),
	})

	get(t, "/chat/bot/conversations/{conversationId}", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "会话详情", Security: secure,
		Parameters: openapi3.Parameters{pathStrParam("conversationId", "会话 ID")},
		Responses:  responses(200, dataResponse("ChatConversationDTO", "会话详情", 200), 404, errorResponse("会话不存在或本 bot 不是成员")),
	})

	get(t, "/chat/bot/conversations/{conversationId}/messages", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "消息历史",
		Description: "也是断线恢复通道：事件流不做 Last-Event-ID 补发，重连后按 created_at 拉齐漏掉的消息。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), queryStrParam("cursor", "消息游标"), limitParam(50)},
		Responses:   responses(200, dataArrayResponse("ChatMessageDTO", "消息历史", 200, true)),
	})

	post(t, "/chat/bot/conversations/{conversationId}/messages", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "发送消息",
		Description: "只开放文本消息。Idempotency-Key 必填。status=pending 可创建空正文占位回复；首次非空正文更新后推进引用消息的已读位置。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), idempotencyHeaderParam()},
		RequestBody: jsonBody("BotSendMessageRequest", true, "消息参数"),
		Responses:   responses(201, dataResponse("ChatMessageDTO", "已发送消息", 201), 400, errorResponse("内容或幂等键非法")),
	})

	patch(t, "/chat/bot/conversations/{conversationId}/messages/{messageId}", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "编辑自己的消息",
		Description: "生成回复须上报累计正文、思考内容、状态与递增 revision；终态不可再更新。省略 status 时沿用普通文本编辑。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), pathStrParam("messageId", "消息 ID")},
		RequestBody: jsonBody("BotEditMessageRequest", true, "修订内容"),
		Responses:   responses(200, dataResponse("ChatMessageDTO", "编辑后的消息", 200), 403, errorResponse("不是本 bot 发的消息")),
	})

	post(t, "/chat/bot/conversations/{conversationId}/typing", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "上报输入状态",
		Description: "瞬态事件，不持久化、不参与补发。", Security: secure,
		Parameters:  openapi3.Parameters{pathStrParam("conversationId", "会话 ID")},
		RequestBody: jsonBody("BotTypingRequest", true, "输入状态"),
		Responses:   responses(204, noContentResponse("输入状态已上报")),
	})

	get(t, "/chat/bot/events", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "bot 事件流",
		Description: "SSE。帧的事件名即类型（message.created、typing.updated），data 自带消息全文。" +
			"只推本 bot 参与会话的事件：私聊对端消息全推，群聊仅推被 @ 到的；bot 自己发的消息不推。" +
			"不支持 Last-Event-ID 补发，断线后用消息历史接口补齐。",
		Security:  secure,
		Responses: responses(200, &openapi3.ResponseRef{Value: &openapi3.Response{Description: strPtr("text/event-stream")}}),
	})
}
