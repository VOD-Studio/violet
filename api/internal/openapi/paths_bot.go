package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerBotPaths 注册 Bot API：外部程序以 Bearer bot token 代表虚拟用户收发站内聊天消息。
//
// 读模型复用聊天侧的 ChatConversationDTO / ChatMessageDTO——bot 与人在服务层走
// 同一条链路，文档也就只有一个形状。
func registerBotPaths(t *openapi3.T) {
	secure := securityBot()

	registerSchema(t, "BotSendMessageRequest", openapi3.Schemas{
		"content":     reqStr("文本内容，≤10000 字符；可含 @(username:uuid) 提及"),
		"reply_to_id": optStr("引用的同会话消息 ID，缺省表示不引用"),
	}, "content")
	registerSchema(t, "BotEditMessageRequest", openapi3.Schemas{
		"content": reqStr("修订后的文本内容，整体替换原文"),
	}, "content")
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
		Description: "只开放文本消息。Idempotency-Key 必填：重试应是同一条消息，而不是刷第二遍屏。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), idempotencyHeaderParam()},
		RequestBody: jsonBody("BotSendMessageRequest", true, "消息参数"),
		Responses:   responses(201, dataResponse("ChatMessageDTO", "已发送消息", 201), 400, errorResponse("内容或幂等键非法")),
	})

	patch(t, "/chat/bot/conversations/{conversationId}/messages/{messageId}", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "编辑自己的消息",
		Description: "流式回复的落地方式：先发消息占位，再按增量反复编辑。编辑他人消息返回 403。",
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
