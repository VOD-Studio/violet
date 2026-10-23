package openapi

import "github.com/getkin/kin-openapi/openapi3"

func runtimeNumber(description string, min, max float64, integer bool) *openapi3.SchemaRef {
	kind := openapi3.TypeNumber
	if integer {
		kind = openapi3.TypeInteger
	}
	return &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{kind}, Description: description, Min: &min, Max: &max}}
}

func runtimeMap(value *openapi3.SchemaRef) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeObject}, AdditionalProperties: openapi3.AdditionalProperties{Schema: value}}}
}

func registerRuntimeSettingsPaths(t *openapi3.T) {
	rule := openapi3.Schemas{
		"enabled":        optBool("显式关闭整个入口限流；管理员仍使用同一规则"),
		"window_seconds": runtimeNumber("滚动窗口秒数", 1, 86400, true),
		"max_requests":   runtimeNumber("窗口请求额度", 1, 1e9, true),
		"burst_requests": runtimeNumber("额外一秒突发额度；0仅关闭突发限制", 0, 1e9, true),
		"daily_quota":    runtimeNumber("UTC自然日配额；0仅关闭日配额", 0, 1e9, true),
		"failure_mode":   strEnum("Redis不可用时放行或拒绝", "allow", "deny"),
	}
	registerSchema(t, "RuntimeRateRulePatch", rule)
	registerSchema(t, "RuntimeRateRule", rule, "enabled", "window_seconds", "max_requests", "burst_requests", "daily_quota", "failure_mode")
	registerSchema(t, "RuntimeRateEntry", openapi3.Schemas{"id": reqStr("实际绑定目录标识"), "title": reqStr("入口名称"), "description": reqStr("入口说明"), "identity": reqStr("计数身份规则，不包含身份凭据"), "endpoints": strArray("实际HTTP绑定入口")}, "id", "title", "description", "identity", "endpoints")
	registerSchema(t, "ImageCacheMaintenance", openapi3.Schemas{"last_started_at": nullableStr("最近开始时间；尚未运行时null"), "last_finished_at": nullableStr("最近完成时间；尚未完成时null"), "removed_entries": optInt("最近删除缓存条目数"), "removed_bytes": optInt64("最近回收字节数"), "remaining_bytes": optInt64("最近清理后剩余字节数"), "error": optStr("最近清理失败原因"), "running": optBool("是否正在清理")}, "last_started_at", "last_finished_at", "removed_entries", "removed_bytes", "remaining_bytes", "running")
	image := openapi3.Schemas{
		"memory_max_entries": runtimeNumber("内存缓存条目上限", 1, 100000, true), "memory_max_bytes": runtimeNumber("内存缓存字节上限", 1, 1<<30, true), "memory_ttl_seconds": runtimeNumber("内存缓存保留秒数", 1, 86400, true),
		"disk_max_bytes": runtimeNumber("可重建磁盘缓存字节上限，不包含正式素材", 1, 1<<40, true), "disk_ttl_seconds": runtimeNumber("磁盘缓存保留秒数", 1, 31536000, true), "cleanup_interval_seconds": runtimeNumber("独立缓存维护间隔秒数", 1, 86400, true),
		"max_source_dimension": runtimeNumber("源图片单边像素上限", 1, 32768, true), "max_source_pixels": runtimeNumber("源图片总像素上限", 1, 100000000, true), "thumbnail_width": runtimeNumber("JPEG缩略图宽度像素", 1, 4096, true), "thumbnail_quality": runtimeNumber("JPEG缩略图质量", 1, 100, true),
		"webp_mode": strEnum("静态WebP编码模式，动画保留", "lossless", "lossy"), "webp_quality": runtimeNumber("WebP编码质量", 1, 100, true), "webp_method": runtimeNumber("WebP编码强度", 0, 6, true), "max_concurrent": runtimeNumber("编码并发上限", 1, 16, true), "encode_timeout_seconds": runtimeNumber("单次编码超时秒数", 1, 120, true), "max_input_bytes": runtimeNumber("编码输入字节上限", 1, 256<<20, true), "max_output_bytes": runtimeNumber("编码输出字节上限", 1, 256<<20, true),
	}
	runner := openapi3.Schemas{
		"enabled": optBool("是否接受新任务"), "max_cpu_cores": runtimeNumber("单任务CPU核数", 0.1, 32, false), "max_memory_mb": runtimeNumber("单任务内存MiB", 16, 32768, true), "max_timeout_secs": runtimeNumber("执行超时秒数", 1, 300, true), "max_output_bytes": runtimeNumber("输出字节上限", 1, 16<<20, true), "max_source_bytes": runtimeNumber("源码字节上限", 1, 4<<20, true), "allow_network": optBool("联网仍需作者声明和语言许可"), "max_concurrent": runtimeNumber("执行并发上限，不撤销已有名额", 1, 32, true), "queue_timeout_secs": runtimeNumber("排队超时秒数", 1, 300, true), "task_ttl_secs": runtimeNumber("Redis任务保留秒数", 1, 86400, true), "languages": strArray("允许的canonical语言；空数组禁用全部"),
	}
	runner["languages"].Value.Items = strEnum("语言", "python", "node", "go", "rust", "bun")
	runner["languages"].Value.UniqueItems = true
	groups := []struct {
		path, name, label, activation string
		fields                        openapi3.Schemas
	}{
		{"rate-limit", "RuntimeRateLimit", "限流", "new_requests", openapi3.Schemas{"rules": runtimeMap(optRef("完整入口规则", "RuntimeRateRule"))}},
		{"image", "RuntimeImage", "图片与缓存", "new_requests", image},
		{"upload-queue", "RuntimeUploadQueue", "上传队列", "browser_scheduling", openapi3.Schemas{"max_concurrent_files": runtimeNumber("同一浏览器队列的文件级并发", 1, 10, true)}},
		{"code-runner", "RuntimeCodeRunner", "运行器", "new_tasks", runner},
	}
	for _, group := range groups {
		required := make([]string, 0, len(group.fields))
		for key := range group.fields {
			required = append(required, key)
		}
		registerSchema(t, group.name+"Values", group.fields, required...)
		patch := group.fields
		if group.path == "rate-limit" {
			patch = openapi3.Schemas{"rules": runtimeMap(optRef("部分入口规则", "RuntimeRateRulePatch"))}
		}
		registerSchema(t, group.name+"Patch", patch)
		t.Components.Schemas[group.name+"Patch"].Value.AdditionalProperties = openapi3.AdditionalProperties{Has: openapi3.Ptr(false)}
		registerSchema(t, group.name+"Runtime", openapi3.Schemas{"version": optInt64("本实例实际有效版本"), "values": optRef("实际有效值", group.name+"Values"), "status": strEnum("本实例状态，不代表全集群同步完成", "applied", "stale", "failed"), "activation": strEnum("生效对象", group.activation), "instance_id": reqStr("实例标识"), "applied_at": reqStr("最近应用时间RFC3339"), "last_checked_at": reqStr("最近检查时间RFC3339"), "error": optStr("读取或应用失败原因")}, "version", "values", "status", "activation", "instance_id", "applied_at", "last_checked_at")
		registerSchema(t, group.name+"Preset", openapi3.Schemas{"id": reqStr("预设标识"), "label": reqStr("名称"), "description": reqStr("行为取舍说明"), "values": optRef("预设完整值", group.name+"Values")}, "id", "label", "description", "values")
		fields := openapi3.Schemas{"version": optInt64("已保存组版本"), "values": optRef("已保存值", group.name+"Values"), "defaults": optRef("当前解析默认值", group.name+"Values"), "sources": runtimeMap(strEnum("默认或覆盖来源", "override", "deployment", "application")), "runtime": optRef("当前实例应用状态", group.name+"Runtime"), "presets": refArray("只改变草稿，需显式保存", group.name+"Preset")}
		if group.path == "rate-limit" {
			fields["entries"] = refArray("只包含实际绑定的入口", "RuntimeRateEntry")
		}
		if group.path == "image" {
			fields["cleanup"] = optRef("独立缓存维护状态", "ImageCacheMaintenance")
		}
		registerSchema(t, group.name+"View", fields, "version", "values", "defaults", "sources", "runtime", "presets")
		registerSchema(t, group.name+"Update", openapi3.Schemas{"expected_version": runtimeNumber("客户端读取的保存版本，冲突返回409", 0, 9007199254740991, true), "values": optRef("部分字段；省略保留覆盖；显式0/false/[]分别验证；禁止null", group.name+"Patch"), "reset": optBool("仅true表示清除本组全部覆盖，与values互斥")}, "expected_version")
		update := t.Components.Schemas[group.name+"Update"].Value
		update.AdditionalProperties = openapi3.AdditionalProperties{Has: openapi3.Ptr(false)}
		update.OneOf = openapi3.SchemaRefs{
			{Value: &openapi3.Schema{Required: []string{"values"}, Properties: openapi3.Schemas{"reset": {Value: &openapi3.Schema{Enum: []any{false}}}}}},
			{Value: &openapi3.Schema{Required: []string{"reset"}, Properties: openapi3.Schemas{"reset": {Value: &openapi3.Schema{Enum: []any{true}}}}, Not: &openapi3.SchemaRef{Value: &openapi3.Schema{Required: []string{"values"}}}}},
		}
		path := "/admin/settings/" + group.path
		get(t, path, &openapi3.Operation{Tags: []string{"站点设置"}, Summary: "获取" + group.label + "运行策略", Description: "需settings:view。每2秒跨实例刷新；保存值与当前实例有效值分开展示，stale/failed不能视为已应用。", Security: securityAdmin(), Responses: responses(200, dataResponse(group.name+"View", "运行策略与本实例状态", 200), 401, errorResponse("未登录"), 403, errorResponse("缺少settings:view"), 500, errorResponse("无法读取初始配置"))})
		put(t, path, &openapi3.Operation{Tags: []string{"站点设置"}, Summary: "保存或重置" + group.label + "运行策略", Description: "需settings:update与CSRF。整组验证后原子CAS；保存后应用失败仍返回200，runtime.status=failed且保留旧有效值。管理员仍受入口限流。", Security: securityAdmin(), Parameters: openapi3.Parameters{csrfHeaderParam()}, RequestBody: jsonBody(group.name+"Update", true, "版本及部分字段，或reset:true"), Responses: responses(200, dataResponse(group.name+"View", "已保存配置与实际应用结果", 200), 400, errorResponse("未知字段、null或非法范围；范围错误含details字段路径"), 401, errorResponse("未登录"), 403, errorResponse("缺少settings:update或CSRF无效"), 409, errorResponse("版本冲突；整组不落库"), 500, errorResponse("读取或持久化失败"))})
	}
	registerSchema(t, "UploadQueuePolicy", openapi3.Schemas{"version": optInt64("当前实例有效版本"), "max_concurrent_files": runtimeNumber("后续文件调度上限", 1, 10, true)}, "version", "max_concurrent_files")
	get(t, "/uploads/policy", &openapi3.Operation{Tags: []string{"媒体"}, Summary: "读取上传调度策略", Description: "只需登录，不需settings:view，位于文件写配额之外。仅影响刷新后的后续调度。", Security: securityCookie(), Responses: responses(200, dataResponse("UploadQueuePolicy", "有效上传策略", 200), 401, errorResponse("未登录"), 500, errorResponse("配置暂不可用"))})
	registerSchema(t, "CodeRunnerPublicPolicy", openapi3.Schemas{"version": optInt64("当前实例有效版本"), "enabled": optBool("是否接受新任务"), "languages": strArray("有效语言白名单，空数组禁用全部")}, "version", "enabled", "languages")
	get(t, "/code-runner/policy", &openapi3.Operation{Tags: []string{"代码运行器"}, Summary: "读取运行器有效启停与语言", Description: "读取当前实例有效快照，不暴露资源与管理配置；配置不可用不解释为主动关闭。", Responses: responses(200, dataResponse("CodeRunnerPublicPolicy", "运行器公开策略", 200), 500, errorResponse("运行策略不可用"))})
}
