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

	registerSchema(t, "BotMediaDTO", openapi3.Schemas{
		"id": reqStr("媒体文件 ID"), "url": reqStr("站内相对访问 URL"),
		"mime_type": reqStr("图片 MIME 类型"), "width": optInt("图片宽度"),
		"height": optInt("图片高度"), "size": optInt64("文件字节数"),
	}, "id", "url", "mime_type", "width", "height", "size")
	registerSchema(t, "BotSendMessageRequest", openapi3.Schemas{
		"type":        strEnum("消息类型；省略时为 text", "text", "image"),
		"content":     optStr("文本内容或图片说明，≤10000 字符；status=pending 时须为空"),
		"media_ids":   strArray("图片文件 ID；type=image 时必填"),
		"reply_to_id": optStr("引用的同会话消息 ID，缺省表示不引用"),
		"status":      optStr("pending 创建可恢复的文本生成回复；图片消息必须省略"),
	})
	registerSchema(t, "BotEditMessageRequest", openapi3.Schemas{
		"content":    optStr("累计正文，整体替换原文"),
		"thinking":   optStr("累计思考内容；后台关闭展示时不保存"),
		"tool_calls": refArray("工具调用累计快照：整体替换已存列表，空数组清空；最多 32 项、序列化后 ≤64 KiB。name 必填且 ≤64 字符，id ≤128 字符且非空时唯一，status 为 running、completed 或 failed（空值按 completed），arguments/result/error 各 ≤8000 字符，duration_ms 0..86400000。终态回复可保留 running 调用，前端渲染为中断", "ChatBotToolCallDTO"),
		"status":     optStr("pending、thinking、streaming、completed 或 failed；省略时兼容旧版编辑"),
		"revision":   optInt64("生成更新递增版本，首次为 1"),
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

	mediaUploadBody := &openapi3.RequestBodyRef{Value: &openapi3.RequestBody{
		Required: true,
		Content: openapi3.Content{
			"multipart/form-data": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
				Type: &openapi3.Types{openapi3.TypeObject},
				Properties: openapi3.Schemas{
					"file":     {Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeString}, Format: "binary"}},
					"filename": optStr("可选原始文件名，仅作元数据"),
				},
				Required: []string{"file"},
			}}},
		},
	}}
	post(t, "/chat/bot/media", &openapi3.Operation{
		Tags: []string{"聊天 Bot"}, Summary: "上传聊天图片", Security: secure,
		Description: "上传一张不超过配置上限的 png、jpeg、gif 或 webp 图片，文件归当前 bot 虚拟用户所有。",
		RequestBody: mediaUploadBody,
		Responses:   responses(201, dataResponse("BotMediaDTO", "已上传媒体", 201), 400, errorResponse("图片格式非法"), 401, errorResponse("token 无效"), 403, errorResponse("bot 已禁用"), 413, errorResponse("图片超过大小上限")),
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
		Description: "支持文本与图片消息。图片须先上传并用 media_ids 引用，且不支持 pending 状态。Idempotency-Key 必填。",
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
			"同一条流也承载推文互动事件：tweet.commented（data.reason 为 comment_on_tweet 或 reply_to_comment）、" +
			"tweet.quoted、tweet.liked，载荷见 PRD-0039；bot 自己作的互动不产生事件。" +
			"流是有损的（缓冲满即丢），不支持 Last-Event-ID 补发：断线后用消息历史与公开推文读取接口补齐。",
		Security:  secure,
		Responses: responses(200, &openapi3.ResponseRef{Value: &openapi3.Response{Description: strPtr("text/event-stream")}}),
	})
}
