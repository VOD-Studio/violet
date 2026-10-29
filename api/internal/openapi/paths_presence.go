package openapi

import (
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
)

func registerPresencePaths(t *openapi3.T) {
	nullable := func(desc, schema string) *openapi3.SchemaRef {
		return &openapi3.SchemaRef{Value: &openapi3.Schema{
			Description: desc, Nullable: true,
			AllOf: openapi3.SchemaRefs{{Ref: "#/components/schemas/" + schema}},
		}}
	}
	nullableInt64 := func(desc string) *openapi3.SchemaRef {
		s := optInt64(desc)
		s.Value.Nullable = true
		return s
	}
	nullableFloat := func(desc string) *openapi3.SchemaRef {
		s := optFloat(desc)
		s.Value.Nullable = true
		return s
	}

	registerSchema(t, "PresenceApplication", openapi3.Schemas{"display_name": reqStr("前台应用展示名")}, "display_name")
	registerSchema(t, "PresenceWindow", openapi3.Schemas{"title": reqStr("已在客户端本地过滤的窗口标题")}, "title")
	registerSchema(t, "PresenceMedia", openapi3.Schemas{
		"session_id":  reqStr("媒体会话 ID；换曲时变化"),
		"player_name": reqStr("播放器展示名"),
		"title":       reqStr("曲名"),
		"artist":      nullableStr("艺人；播放器未提供时为 null"),
		"album":       nullableStr("专辑；播放器未提供时为 null"),
		"state":       strEnum("播放状态；会话结束时整个 media 为 null", "playing", "paused"),
		"duration_ms": nullableInt64("时长毫秒；不可靠时为 null"),
		"position_ms": nullableInt64("以 updated_at 为锚点的位置毫秒；不可靠时为 null，不得绘制进度"),
		"rate":        nullableFloat("播放速率；暂停为 0，不可靠时为 null，不得推进位置"),
	}, "session_id", "player_name", "title", "artist", "album", "state", "duration_ms", "position_ms", "rate")
	registerSchema(t, "PresenceSources", openapi3.Schemas{
		"application": nullable("前台应用；null=没有允许公开的应用", "PresenceApplication"),
		"window":      nullable("窗口标题；null=未开启、未授权或未命中白名单", "PresenceWindow"),
		"media":       nullable("媒体会话；null=没有仍有效且允许分享的会话", "PresenceMedia"),
	}, "application", "window", "media")
	registerSchema(t, "PresenceDevice", openapi3.Schemas{
		"id":           reqStr("设备 ID（随机 UUID v4，仅本站内稳定）"),
		"display_name": reqStr("站长填写的设备公开名称"),
		"updated_at":   reqStr("RFC3339；最后一份新快照的接收时间，也是播放位置锚点"),
		"expires_at":   reqStr("RFC3339；租约到期时间，过期后必须停止展示"),
		"sources":      optRef("完整来源集合", "PresenceSources"),
	}, "id", "display_name", "updated_at", "expires_at", "sources")
	registerSchema(t, "Presence", openapi3.Schemas{
		"generated_at": reqStr("RFC3339 服务端生成时间；与 updated_at 之差用于推进播放位置"),
		"devices":      refArray("租约内在线的设备，按签发顺序；公开读取关闭时为空数组", "PresenceDevice"),
	}, "generated_at", "devices")
	registerSchema(t, "PresenceAdminDevice", openapi3.Schemas{
		"id":           reqStr("设备 ID"),
		"display_name": reqStr("设备公开名称"),
		"created_at":   reqStr("RFC3339 签发时间"),
		"online":       optBool("是否持有有效租约；在线时三个来源仍可都为空"),
		"updated_at":   nullableStr("RFC3339；离线时为 null"),
		"expires_at":   nullableStr("RFC3339；离线时为 null"),
		"sources":      nullable("当前来源；离线时为 null", "PresenceSources"),
	}, "id", "display_name", "created_at", "online", "updated_at", "expires_at", "sources")
	registerSchema(t, "PresenceIssuedDevice", openapi3.Schemas{
		"device":      optRef("新设备，签发后保持离线直到客户端连接", "PresenceAdminDevice"),
		"token":       reqStr("设备凭证明文，仅本次返回；库中只存哈希"),
		"ingest_path": reqStr("上报路由，客户端拼成完整 wss:// 地址"),
	}, "device", "token", "ingest_path")
	registerSchema(t, "PresenceIssueDevice", openapi3.Schemas{"display_name": reqStr("1–128 字；修剪首尾空白，拒绝控制与不可见格式字符")}, "display_name")
	registerSchema(t, "PresenceSettings", openapi3.Schemas{"public_read": optBool("是否允许匿名访客读取当前状态；默认关闭")}, "public_read")

	for _, endpoint := range []struct {
		method, path, summary, schema, body string
		array                               bool
		status                              int
	}{
		{"GET", "/admin/presence/devices", "列出设备与连接诊断", "PresenceAdminDevice", "", true, 200},
		{"POST", "/admin/presence/devices", "签发设备凭证", "PresenceIssuedDevice", "PresenceIssueDevice", false, 201},
		{"DELETE", "/admin/presence/devices/{id}", "撤销设备并断开其连接", "", "", false, 200},
		{"GET", "/admin/presence/settings", "读取公开策略", "PresenceSettings", "", false, 200},
		{"PUT", "/admin/presence/settings", "更新公开策略", "PresenceSettings", "PresenceSettings", false, 200},
		{"GET", "/presence", "读取公开实时状态", "Presence", "", false, 200},
	} {
		op := &openapi3.Operation{Tags: []string{"实时状态"}, Summary: endpoint.summary}
		if strings.HasPrefix(endpoint.path, "/admin/") {
			op.Security = securityAdmin()
			op.Description = "需 admin:access 与 presence:view 权限。"
			if endpoint.method != "GET" {
				op.Description = "需 admin:access 与 presence:manage 权限及 CSRF。"
				op.Parameters = append(op.Parameters, csrfHeaderParam())
			}
		} else {
			op.Description = "匿名读取；只含租约内在线的设备，读取时同步过滤过期快照。响应不缓存。"
		}
		if strings.Contains(endpoint.path, "{id}") {
			op.Parameters = append(op.Parameters, pathStrParam("id", "设备 ID"))
		}
		if endpoint.body != "" {
			op.RequestBody = jsonBody(endpoint.body, true, "操作参数")
		}
		var success *openapi3.ResponseRef
		switch {
		case endpoint.array:
			success = dataArrayResponse(endpoint.schema, "数组永不为 null", endpoint.status, false)
		case endpoint.schema != "":
			success = dataResponse(endpoint.schema, "操作结果", endpoint.status)
		default:
			success = messageResponse("操作成功，data 为 null")
		}
		op.Responses = responses(endpoint.status, success, 400, errorResponse("请求体格式错误或设备名称不合法"), 404, errorResponse("设备不存在或已撤销"))
		setOp(t, endpoint.path, endpoint.method, op)
	}

	eventStream := &openapi3.ResponseRef{Value: &openapi3.Response{
		Description: strPtr("SSE 事件流"),
		Content: openapi3.Content{"text/event-stream": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
			Type: &openapi3.Types{openapi3.TypeString},
		}}}},
	}}
	get(t, "/presence/stream", &openapi3.Operation{
		Tags:    []string{"实时状态"},
		Summary: "实时状态推送流",
		Description: "text/event-stream。连上立即推送一次，之后每次状态变化（新快照、断开、过期、撤销、公开开关）" +
			"重发完整状态：event: presence，data 与 GET /presence 的 data 同形；每 25s 发注释行心跳。" +
			"每 IP 每分钟 30 次连接，全站连接数有上限，超出返回 429。",
		Responses: responses(200, eventStream, 429, errorResponse("连接过于频繁或推送连接已满"), 503, errorResponse("服务正在关闭")),
	})

	switching := &openapi3.ResponseRef{Value: &openapi3.Response{Description: strPtr("切换为 WebSocket，子协议 nowbeam.v1")}}
	get(t, "/presence/ingest", &openapi3.Operation{
		Tags:    []string{"实时状态"},
		Summary: "Nowbeam 设备上报（WebSocket）",
		Description: "nowbeam.v1 原生上报端点：Authorization: Bearer 设备凭证 + Sec-WebSocket-Protocol: nowbeam.v1。" +
			"握手前校验凭证，拒绝任何 Origin。之后按协议收发 welcome / snapshot / ack / error；" +
			"租约 45 秒，首份快照须在 welcome 后 10 秒内到达，完整消息上限 65536 字节。" +
			"错误响应体只含稳定 code，不回显凭证或内部异常。",
		Parameters: openapi3.Parameters{
			{Value: &openapi3.Parameter{Name: "Authorization", In: "header", Required: true, Description: "Bearer 设备凭证（violet_nb_ 前缀）", Schema: reqStr("凭证")}},
			{Value: &openapi3.Parameter{Name: "Sec-WebSocket-Protocol", In: "header", Required: true, Description: "必须包含 nowbeam.v1", Schema: reqStr("子协议")}},
		},
		Responses: responses(
			101, switching,
			400, errorResponse("缺少 nowbeam.v1 子协议或升级头不合法"),
			401, errorResponse("凭证无效或已撤销"),
			403, errorResponse("请求带有 Origin"),
			426, errorResponse("WebSocket 版本不是 13"),
			429, errorResponse("握手过于频繁"),
			503, errorResponse("服务正在关闭"),
		),
	})
}
