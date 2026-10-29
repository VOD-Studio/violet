package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerOMPUsagePaths(t *openapi3.T) {
	fields := openapi3.Schemas{
		"client_event_id": reqStr("稳定不透明 ID，1–128 UTF-8 字节；仅字母、数字、._:-，不含原始 session ID 或路径"),
		"provider":        reqStr("提供方，1–128 UTF-8 字节"),
		"model":           reqStr("模型，1–256 UTF-8 字节"),
		"cost_total":      optFloat("有限非负 USD API 等价估算，单次上限 1e12；不是订阅账单"),
		"stop_reason":     reqStr("结束原因，1–32 UTF-8 字节，不限枚举"),
		"is_error":        optBool("是否失败"),
		"duration_ms":     optFloat("非负有限毫秒；省略或 null 表示未测量；上限 9007199254740991"),
		"ttft_ms":         optFloat("首 token 延迟毫秒；省略或 null 表示未测量；上限 9007199254740991"),
		"is_subagent":     optBool("是否子代理调用"),
		"omp_version":     reqStr("OMP 版本，1–64 UTF-8 字节"),
		"occurred_at":     reqStr("RFC3339 UTC，以 Z 结尾；最多领先服务器五分钟，无历史保留期限限制"),
	}
	required := make([]string, 0, 14)
	required = append(required, "client_event_id", "provider", "model", "cost_total", "stop_reason", "is_error", "is_subagent", "omp_version", "occurred_at")
	for _, name := range []string{"input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "reasoning_tokens"} {
		field := optInt64("非负安全整数，最大 9007199254740991；reasoning 已含于 output，不再计入 total")
		field.Value.Min = new(float64(0))
		field.Value.Max = new(float64(9007199254740991))
		fields[name] = field
		required = append(required, name)
	}
	fields["duration_ms"].Value.Nullable = true
	fields["ttft_ms"].Value.Nullable = true
	fields["cost_total"].Value.Min = new(float64(0))
	fields["cost_total"].Value.Max = new(float64(1e12))
	registerSchema(t, "OMPUsageEvent", fields, required...)
	t.Components.Schemas["OMPUsageEvent"].Value.AdditionalProperties.Has = new(false)
	events := refArray("1–200 个事件；任何一项无效则整批拒绝", "OMPUsageEvent")
	events.Value.MinItems = 1
	events.Value.MaxItems = new(uint64(200))
	registerSchema(t, "OMPUsageBatch", openapi3.Schemas{"events": events}, "events")
	t.Components.Schemas["OMPUsageBatch"].Value.AdditionalProperties.Has = new(false)
	registerSchema(t, "OMPUsageAccepted", openapi3.Schemas{"accepted": optInt64("新增数"), "duplicated": optInt64("重复忽略数；不覆盖旧值")}, "accepted", "duplicated")

	summary := usageCounters()
	summary["error_rate"] = optFloat("errors / requests；零分母为 0")
	summary["api_cost_estimate"] = optFloat("API 等价 USD 总额，不是订阅账单")
	summary["avg_duration_ms"] = optFloat("仅对已测量 duration 求均值，包含实际 0")
	summary["avg_ttft_ms"] = optFloat("仅对已测量 TTFT 求均值，包含实际 0")
	summary["avg_tokens_per_second"] = optFloat("非错误调用的 output_tokens / ((duration_ms-ttft_ms)/1000) 的平均值；排除缺测和非正间隔")
	registerSchema(t, "OMPUsageSummary", summary)
	models := usageCounters()
	models["provider"], models["model"] = reqStr("提供方"), reqStr("模型")
	models["cost"] = optFloat("API 等价 USD")
	models["avg_tokens_per_second"], models["avg_ttft_ms"] = summary["avg_tokens_per_second"], summary["avg_ttft_ms"]
	registerSchema(t, "OMPUsageModel", models)
	registerSchema(t, "OMPUsageModels", openapi3.Schemas{"models": refArray("按 total_tokens 降序，再 provider/model 升序；无数据为 []", "OMPUsageModel")}, "models")
	registerSchema(t, "OMPUsagePoint", openapi3.Schemas{
		"timestamp": reqStr("UTC 桶起点 RFC3339"), "requests": optInt64("请求数"), "errors": optInt64("错误数"),
		"total_tokens": optFloat("input+output+cache_read+cache_write"), "api_cost_estimate": optFloat("API 等价 USD"),
	}, "timestamp", "requests", "errors", "total_tokens", "api_cost_estimate")
	registerSchema(t, "OMPUsageTimeseries", openapi3.Schemas{"bucket": strEnum("粒度", "day", "hour"), "points": refArray("完整补零、无未来小时", "OMPUsagePoint")}, "bucket", "points")

	t.Components.SecuritySchemes["patAuth"] = &openapi3.SecuritySchemeRef{Value: &openapi3.SecurityScheme{
		Type: "http", Scheme: "bearer", Description: "个人访问令牌；此写入端点要求 usage:write，独立于 Cookie/CSRF",
	}}
	patSecurity := openapi3.SecurityRequirements{{"patAuth": {}}}
	post(t, "/omp-usage/batch", &openapi3.Operation{
		Tags: []string{"OMP 用量"}, Summary: "批量上报个人用量", Security: &patSecurity,
		Description: "最大 512 KiB、200 项；严格拒绝未知字段，整批校验后原子写入。身份仅来自 PAT。按 user_id/client_event_id 去重不覆盖。独立每用户每分钟 60 次限流，可在运行策略调整。无需 CSRF。",
		RequestBody: jsonBody("OMPUsageBatch", true, "用量事件"),
		Responses:   responses(200, dataResponse("OMPUsageAccepted", "摄取计数", 200), 400, errorResponse("整批格式或字段无效"), 401, errorResponse("PAT 无效或过期"), 403, errorResponse("缺少 usage:write"), 429, errorResponse("上报频率超限；含 Retry-After"), 500, errorResponse("存储失败")),
	})
	for _, endpoint := range []struct{ path, schema string }{{"summary", "OMPUsageSummary"}, {"models", "OMPUsageModels"}, {"timeseries", "OMPUsageTimeseries"}} {
		parameters := openapi3.Parameters{&openapi3.ParameterRef{Value: &openapi3.Parameter{
			Name: "range", In: "query", Schema: strEnum("默认 30d", "7d", "30d", "90d"),
		}}}
		if endpoint.path == "timeseries" {
			parameters = append(parameters, &openapi3.ParameterRef{Value: &openapi3.Parameter{Name: "bucket", In: "query", Schema: strEnum("默认 day", "day", "hour")}})
		}
		get(t, "/omp-usage/"+endpoint.path, &openapi3.Operation{
			Tags: []string{"OMP 用量"}, Summary: "读取个人用量 " + endpoint.path, Security: securityCookie(), Parameters: parameters,
			Description: "仅 Session 用户本人；拒绝 user_id 等额外参数。UTC 当日和前 N-1 个自然日，截止当前时刻。无数据为零值结构；private, no-store。",
			Responses:   responses(200, dataResponse(endpoint.schema, "个人用量", 200), 400, errorResponse("参数无效"), 401, errorResponse("未登录"), 500, errorResponse("查询失败")),
		})
	}
}

func usageCounters() openapi3.Schemas {
	fields := openapi3.Schemas{"requests": optInt64("请求数，含错误"), "errors": optInt64("错误数"), "cache_rate": optFloat("cache_read / (input+cache_read+cache_write)，零分母为 0")}
	for _, name := range []string{"total_tokens", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "reasoning_tokens"} {
		fields[name] = optFloat("累计 token 数；total 不重复累加 reasoning")
	}
	return fields
}
