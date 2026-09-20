package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerNotificationPaths 注册站内通知接口（全部登录态）：列表/未读计数/
// SSE 事件流/标记已读。
func registerNotificationPaths(t *openapi3.T) {
	secure := securityCookie()

	registerSchema(t, "NotificationDTO", openapi3.Schemas{
		"id": reqStr("通知 ID"),
		"source_type": strEnum("通知来源域",
			"subscription_failed", "subscription_succeeded", "friendlink_applied",
			"friendlink_reviewed", "comment_approved", "comment_created",
			"comment_pending", "comment_rejected", "user_registered",
			"account_security", "chat_room_invited",
			"tweet_liked", "tweet_quoted", "tweet_commented", "tweet_comment_replied"),
		"source_id":  reqStr("来源对象 ID"),
		"title":      reqStr("标题"),
		"body":       reqStr("正文"),
		"payload":    optRef("来源域附加数据", "NotificationPayload"),
		"is_read":    optBool("是否已读"),
		"read_at":    optStr("已读时间（RFC3339，未读缺省）"),
		"created_at": reqStr("产生时间（RFC3339）"),
	})

	// payload 各来源域结构不同，建模为自由 object（字段以 source_type 实现为准）
	registerSchema(t, "NotificationPayload", openapi3.Schemas{})

	registerSchema(t, "NotificationUnreadCount", openapi3.Schemas{
		"unread_count": optInt64("未读数"),
	})

	registerSchema(t, "NotificationPushConfig", openapi3.Schemas{
		"public_key": optStr("VAPID 公钥"),
		"enabled":    optBool("站点是否启用浏览器通知"),
	})

	registerSchema(t, "NotificationPushSubscriptionRequest", openapi3.Schemas{
		"endpoint": reqStr("浏览器 Push endpoint"),
		"keys": &openapi3.SchemaRef{Value: &openapi3.Schema{
			Type:       &openapi3.Types{openapi3.TypeObject},
			Properties: openapi3.Schemas{"p256dh": reqStr("浏览器公钥"), "auth": reqStr("浏览器认证密钥")},
		}},
	}, "endpoint", "keys")

	registerSchema(t, "NotificationPushUnsubscribeRequest", openapi3.Schemas{
		"endpoint": reqStr("浏览器 Push endpoint"),
	}, "endpoint")

	get(t, "/notifications", &openapi3.Operation{
		Tags:       []string{"通知"},
		Summary:    "通知列表",
		Security:   secure,
		Parameters: openapi3.Parameters{pageParam(), limitParam(100)},
		Responses: responses(
			200, dataArrayResponse("NotificationDTO", "当前用户通知", 200, true),
		),
	})

	get(t, "/notifications/unread-count", &openapi3.Operation{
		Tags:     []string{"通知"},
		Summary:  "未读计数",
		Security: secure,
		Responses: responses(
			200, dataResponse("NotificationUnreadCount", "未读数", 200),
		),
	})

	get(t, "/notifications/stream", &openapi3.Operation{
		Tags:    []string{"通知"},
		Summary: "通知 SSE 事件流",
		Description: "text/event-stream。事件无 event: 行（默认 message），每条 " +
			"id: 为通知 ID、data: 为 NotificationDTO 形态 JSON；断线重连带 " +
			"Last-Event-ID 头补发漏掉的通知（最多 50 条）；每 30s 发注释行心跳。",
		Security: secure,
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("SSE 事件流"),
				Content: openapi3.Content{
					"text/event-stream": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeString},
					}}},
				},
			}},
		),
	})

	post(t, "/notifications/read-all", &openapi3.Operation{
		Tags:       []string{"通知"},
		Summary:    "全部标记已读",
		Security:   secure,
		Parameters: openapi3.Parameters{csrfHeaderParam()},
		Responses:  responses(200, messageResponse("全部已读")),
	})

	get(t, "/notifications/push/config", &openapi3.Operation{
		Tags:        []string{"通知"},
		Summary:     "浏览器通知配置",
		Description: "与聊天推送订阅相互独立：两者各自授权、各自订阅。",
		Security:    secure,
		Responses:   responses(200, dataResponse("NotificationPushConfig", "推送配置", 200)),
	})

	post(t, "/notifications/push/subscription", &openapi3.Operation{
		Tags:        []string{"通知"},
		Summary:     "启用浏览器通知",
		Description: "按 endpoint upsert：同一浏览器重复授权覆盖密钥，不产生重复订阅。",
		Security:    secure,
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("NotificationPushSubscriptionRequest", true, "推送订阅"),
		Responses:   responses(201, messageResponse("浏览器通知已启用")),
	})

	del(t, "/notifications/push/subscription", &openapi3.Operation{
		Tags:        []string{"通知"},
		Summary:     "关闭浏览器通知",
		Security:    secure,
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("NotificationPushUnsubscribeRequest", true, "推送订阅"),
		Responses:   responses(204, noContentResponse("浏览器通知已关闭")),
	})

	post(t, "/notifications/{id}/read", &openapi3.Operation{
		Tags:        []string{"通知"},
		Summary:     "标记单条已读",
		Description: "重复标记已读返回 400。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("id", "通知 ID"), csrfHeaderParam()},
		Responses: responses(
			200, messageResponse("已标记已读"),
			400, errorResponse("通知已是已读状态"),
			404, errorResponse("通知不存在"),
		),
	})
}
