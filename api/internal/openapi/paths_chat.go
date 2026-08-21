package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerChatPaths 注册聊天资源、事件流和 Web Push 订阅契约。
func registerChatPaths(t *openapi3.T) {
	registerSchema(t, "ChatUserDTO", openapi3.Schemas{
		"id":           reqStr("用户 ID"),
		"username":     reqStr("用户名"),
		"display_name": reqStr("展示名"),
		"avatar_url":   optStr("头像地址"),
	})
	registerSchema(t, "ChatMemberDTO", openapi3.Schemas{
		"user":      &openapi3.SchemaRef{Ref: "#/components/schemas/ChatUserDTO"},
		"role":      reqStr("owner 或 member"),
		"joined_at": reqStr("RFC3339 时间"),
		"is_muted":  optBool("当前用户是否静音该会话"),
	})
	registerSchema(t, "ChatMediaDTO", openapi3.Schemas{
		"id":        reqStr("媒体 ID"),
		"url":       reqStr("原图地址"),
		"thumbnail": optStr("缩略图地址"),
		"mime_type": reqStr("MIME 类型"),
		"size":      optInt64("字节数"),
		"width":     optInt("图片宽度"),
		"height":    optInt("图片高度"),
	})
	registerSchema(t, "ChatSharedTweetDTO", openapi3.Schemas{
		"id":         reqStr("推文 ID"),
		"author":     &openapi3.SchemaRef{Ref: "#/components/schemas/ChatUserDTO"},
		"content":    optStr("推文正文；推文已删除时为空"),
		"images":     strArray("推文图片 URL 列表；推文已删除时为空"),
		"created_at": optStr("推文创建时间；推文已删除时为空"),
		"is_deleted": optBool("被分享的推文是否已被物理删除"),
	})
	registerSchema(t, "ChatMessageReferenceDTO", openapi3.Schemas{
		"id":         reqStr("被引用消息 ID"),
		"sender":     &openapi3.SchemaRef{Ref: "#/components/schemas/ChatUserDTO"},
		"type":       reqStr("被引用消息类型"),
		"content":    optStr("被引用文本预览"),
		"media":      &openapi3.SchemaRef{Ref: "#/components/schemas/ChatMediaDTO"},
		"is_deleted": optBool("原消息是否已被管理员删除"),
	})
	registerSchema(t, "ChatMessageDTO", openapi3.Schemas{
		"id":              reqStr("消息 ID"),
		"conversation_id": reqStr("会话 ID"),
		"sender":          &openapi3.SchemaRef{Ref: "#/components/schemas/ChatUserDTO"},
		"type":            reqStr("text、image、system 或 tweet_share"),
		"content":         optStr("文本内容或分享推文的配文"),
		"media":           &openapi3.SchemaRef{Ref: "#/components/schemas/ChatMediaDTO"},
		"shared_tweet":    &openapi3.SchemaRef{Ref: "#/components/schemas/ChatSharedTweetDTO"},
		"reply_to":        &openapi3.SchemaRef{Ref: "#/components/schemas/ChatMessageReferenceDTO"},
		"is_deleted":      optBool("是否已被管理员删除"),
		"deleted_at":      optStr("删除时间"),
		"created_at":      reqStr("RFC3339 时间"),
	})
	registerSchema(t, "ChatConversationDTO", openapi3.Schemas{
		"id":           reqStr("会话 ID"),
		"kind":         reqStr("direct 或 room"),
		"title":        reqStr("房间名称"),
		"owner":        &openapi3.SchemaRef{Ref: "#/components/schemas/ChatUserDTO"},
		"members":      &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeArray}, Items: &openapi3.SchemaRef{Ref: "#/components/schemas/ChatMemberDTO"}}},
		"last_message": &openapi3.SchemaRef{Ref: "#/components/schemas/ChatMessageDTO"},
		"unread_count": optInt64("当前用户未读数"),
		"created_at":   reqStr("RFC3339 时间"),
		"updated_at":   reqStr("RFC3339 时间"),
	})
	registerSchema(t, "ChatEventDTO", openapi3.Schemas{
		"id":          reqStr("单调递增事件序号"),
		"type":        reqStr("事件类型"),
		"version":     optInt("事件契约版本"),
		"occurred_at": reqStr("RFC3339 时间"),
		"data":        &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeObject}, AdditionalProperties: openapi3.AdditionalProperties{Has: openapi3.Ptr(true)}}},
	})
	registerSchema(t, "ChatCreateConversationRequest", openapi3.Schemas{
		"kind":            reqStr("direct 或 room"),
		"title":           optStr("房间名称"),
		"participant_ids": strArray("其他参与者 ID"),
	}, "kind")
	registerSchema(t, "ChatRenameConversationRequest", openapi3.Schemas{
		"title": reqStr("新房间名称"),
	}, "title")
	registerSchema(t, "ChatSendMessageRequest", openapi3.Schemas{
		"type":            reqStr("text、image 或 tweet_share"),
		"content":         optStr("文本消息内容或分享推文的配文"),
		"media_id":        optStr("图片媒体 ID"),
		"shared_tweet_id": optStr("分享的推文 ID"),
		"reply_to_id":     optStr("被引用消息 ID"),
	}, "type")
	registerSchema(t, "ChatPushSubscriptionRequest", openapi3.Schemas{
		"endpoint":     reqStr("浏览器 Push endpoint"),
		"keys":         &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeObject}, Properties: openapi3.Schemas{"p256dh": reqStr("浏览器公钥"), "auth": reqStr("浏览器认证密钥")}}},
		"show_preview": optBool("是否显示消息摘要"),
	}, "endpoint", "keys")
	registerSchema(t, "ChatMuteRequest", openapi3.Schemas{"muted": optBool("是否静音当前会话")})
	registerSchema(t, "ChatPushUnsubscribeRequest", openapi3.Schemas{"endpoint": reqStr("浏览器 Push endpoint")}, "endpoint")
	registerSchema(t, "ChatMuteResponse", openapi3.Schemas{"conversation_id": reqStr("会话 ID"), "is_muted": optBool("静音状态")})
	registerSchema(t, "ChatReadRequest", openapi3.Schemas{"message_id": optStr("读到的最后一条消息 ID")})

	secure := securityCookie()
	get(t, "/chat/conversations", &openapi3.Operation{
		Tags: []string{"聊天"}, Summary: "会话列表", Security: secure,
		Parameters: openapi3.Parameters{queryStrParam("cursor", "会话游标"), limitParam(50)},
		Responses:  responses(200, dataArrayResponse("ChatConversationDTO", "会话列表", 200, true)),
	})
	post(t, "/chat/conversations", &openapi3.Operation{
		Tags: []string{"聊天"}, Summary: "创建会话", Security: secure,
		Parameters: openapi3.Parameters{csrfHeaderParam()}, RequestBody: jsonBody("ChatCreateConversationRequest", true, "会话参数"),
		Responses: responses(201, dataResponse("ChatConversationDTO", "会话详情", 201)),
	})
	get(t, "/chat/conversations/{conversationId}", &openapi3.Operation{
		Tags: []string{"聊天"}, Summary: "会话详情", Security: secure,
		Parameters: openapi3.Parameters{pathStrParam("conversationId", "会话 ID")}, Responses: responses(200, dataResponse("ChatConversationDTO", "会话详情", 200)),
	})
	patch(t, "/chat/conversations/{conversationId}", &openapi3.Operation{
		Tags: []string{"聊天"}, Summary: "修改房间名称", Security: secure,
		Parameters: openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), csrfHeaderParam()}, RequestBody: jsonBody("ChatRenameConversationRequest", true, "仅使用 title"),
		Responses: responses(200, dataResponse("ChatConversationDTO", "会话详情", 200)),
	})
	get(t, "/chat/conversations/{conversationId}/messages", &openapi3.Operation{
		Tags: []string{"聊天"}, Summary: "消息历史", Security: secure,
		Parameters: openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), queryStrParam("cursor", "消息游标"), limitParam(50)}, Responses: responses(200, dataArrayResponse("ChatMessageDTO", "消息历史", 200, true)),
	})
	post(t, "/chat/conversations/{conversationId}/messages", &openapi3.Operation{
		Tags: []string{"聊天"}, Summary: "发送消息", Security: secure,
		Parameters: openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), csrfHeaderParam(), idempotencyHeaderParam()}, RequestBody: jsonBody("ChatSendMessageRequest", true, "消息参数"), Responses: responses(201, dataResponse("ChatMessageDTO", "已发送消息", 201)),
	})
	get(t, "/chat/events", &openapi3.Operation{
		Tags: []string{"聊天"}, Summary: "聊天事件流", Description: "SSE 单用户事件流，支持 Last-Event-ID 断线补发。", Security: secure,
		Responses: responses(200, &openapi3.ResponseRef{Value: &openapi3.Response{Description: strPtr("text/event-stream")}}),
	})
	get(t, "/chat/unread-count", &openapi3.Operation{
		Tags: []string{"聊天"}, Summary: "聊天未读数", Security: secure, Responses: responses(200, dataResponse("ChatUnreadCount", "未读数", 200)),
	})
	registerSchema(t, "ChatUnreadCount", openapi3.Schemas{"unread_count": optInt64("全部会话未读数")})
	get(t, "/chat/push/config", &openapi3.Operation{Tags: []string{"聊天通知"}, Summary: "Web Push 配置", Security: secure, Responses: responses(200, dataResponse("ChatPushConfig", "推送配置", 200))})
	registerSchema(t, "ChatPushConfig", openapi3.Schemas{"public_key": optStr("VAPID 公钥"), "enabled": optBool("是否启用")})
	post(t, "/chat/push/subscription", &openapi3.Operation{Tags: []string{"聊天通知"}, Summary: "启用浏览器通知", Security: secure, Parameters: openapi3.Parameters{csrfHeaderParam()}, RequestBody: jsonBody("ChatPushSubscriptionRequest", true, "推送订阅"), Responses: responses(201, messageResponse("浏览器通知已启用"))})
	get(t, "/chat/users/{username}", &openapi3.Operation{Tags: []string{"聊天"}, Summary: "按用户名查找用户", Security: secure, Parameters: openapi3.Parameters{pathStrParam("username", "用户名")}, Responses: responses(200, dataResponse("ChatUserDTO", "用户资料", 200))})
	get(t, "/chat/contacts", &openapi3.Operation{
		Tags: []string{"聊天"}, Summary: "联系人列表", Security: secure,
		Parameters: openapi3.Parameters{queryStrParam("q", "用户名或展示名关键词"), queryStrParam("cursor", "联系人游标"), limitParam(50)},
		Responses:  responses(200, dataArrayResponse("ChatUserDTO", "联系人列表", 200, true)),
	})
	get(t, "/chat/conversations/{conversationId}/members", &openapi3.Operation{Tags: []string{"聊天"}, Summary: "会话成员", Security: secure, Parameters: openapi3.Parameters{pathStrParam("conversationId", "会话 ID")}, Responses: responses(200, dataArrayResponse("ChatMemberDTO", "成员列表", 200, false))})
	post(t, "/chat/conversations/{conversationId}/members", &openapi3.Operation{Tags: []string{"聊天"}, Summary: "邀请成员", Security: secure, Parameters: openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), csrfHeaderParam()}, RequestBody: jsonBody("ChatMemberRequest", true, "成员参数"), Responses: responses(201, messageResponse("成员已加入房间"))})
	del(t, "/chat/conversations/{conversationId}/members/me", &openapi3.Operation{Tags: []string{"聊天"}, Summary: "离开会话", Security: secure, Parameters: openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), csrfHeaderParam()}, Responses: responses(204, noContentResponse("已离开会话"))})
	patch(t, "/chat/conversations/{conversationId}/mute", &openapi3.Operation{Tags: []string{"聊天通知"}, Summary: "静音会话", Security: secure, Parameters: openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), csrfHeaderParam()}, RequestBody: jsonBody("ChatMuteRequest", true, "通知静音设置"), Responses: responses(200, dataResponse("ChatMuteResponse", "静音状态", 200))})
	post(t, "/chat/conversations/{conversationId}/read", &openapi3.Operation{Tags: []string{"聊天"}, Summary: "标记会话已读", Security: secure, Parameters: openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), csrfHeaderParam()}, RequestBody: jsonBody("ChatReadRequest", true, "阅读位置"), Responses: responses(200, dataResponse("ChatUnreadCount", "会话未读数", 200))})
	del(t, "/chat/conversations/{conversationId}/messages/{messageId}", &openapi3.Operation{Tags: []string{"聊天管理"}, Summary: "删除违规消息", Description: "需 chat:manage 权限。", Security: secure, Parameters: openapi3.Parameters{pathStrParam("conversationId", "会话 ID"), pathStrParam("messageId", "消息 ID"), csrfHeaderParam()}, Responses: responses(204, noContentResponse("消息已删除"))})
	del(t, "/chat/push/subscription", &openapi3.Operation{Tags: []string{"聊天通知"}, Summary: "关闭浏览器通知", Security: secure, Parameters: openapi3.Parameters{csrfHeaderParam()}, RequestBody: jsonBody("ChatPushUnsubscribeRequest", true, "推送订阅"), Responses: responses(204, noContentResponse("浏览器通知已关闭"))})
}

func idempotencyHeaderParam() *openapi3.ParameterRef {
	return &openapi3.ParameterRef{Value: &openapi3.Parameter{Name: "Idempotency-Key", In: openapi3.ParameterInHeader, Required: true, Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeString}}}}}
}
