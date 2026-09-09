package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerCodeRunnerPaths 注册代码运行器接口（登录态）：同步执行、SSE 流式
// 执行、任务查询与任务输出流。
func registerCodeRunnerPaths(t *openapi3.T) {
	secure := securityCookie()

	registerSchema(t, "CodeRunOverrides", openapi3.Schemas{
		"cpu_cores":     optFloat("CPU 核数（服务端钳制）"),
		"memory_mb":     optInt64("内存上限 MB（服务端钳制）"),
		"timeout_secs":  optInt64("超时秒数（服务端钳制）"),
		"output_bytes":  optInt64("输出字节上限（服务端钳制）"),
		"allow_network": optBool("是否放开网络"),
	})

	registerSchema(t, "CodeRunRequest", openapi3.Schemas{
		"language": strEnum("语言（别名 js/ts/rs 会归一化）", "python", "node", "go", "rust", "bun", "js", "ts", "rs"),
		"source":   optStr("源码（受 max_source_bytes 上限校验）"),
		"overrides": optRef("资源覆盖项", "CodeRunOverrides"),
	}, "language")

	registerSchema(t, "CodeRunSubmitResponse", openapi3.Schemas{
		"task_id": reqStr("任务 ID（用于查询/订阅输出流）"),
	})

	registerSchema(t, "CodeRunTaskDTO", openapi3.Schemas{
		"id":          reqStr("任务 ID"),
		"language":    reqStr("语言"),
		"status": strEnum("任务状态（queued/running 非终态）",
			"queued", "running", "success", "error", "timeout", "oom_killed", "failed"),
		"stdout":      optStr("标准输出"),
		"stderr":      optStr("标准错误"),
		"exit_code":   optInt("退出码（未退出时缺省）"),
		"duration_ms": optInt64("耗时（微秒口径为 ms）"),
	})

	post(t, "/code-runner/run", &openapi3.Operation{
		Tags:        []string{"代码运行器"},
		Summary:     "提交执行",
		Description: "登录 + 执行限流。返回 task_id 后轮询 GET /code-runner/tasks/{id}。",
		Security:    secure,
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CodeRunRequest", true, "执行请求"),
		Responses: responses(
			200, dataResponse("CodeRunSubmitResponse", "任务受理", 200),
			429, errorResponse("执行过于频繁"),
		),
	})

	post(t, "/code-runner/run/stream", &openapi3.Operation{
		Tags:        []string{"代码运行器"},
		Summary:     "提交执行（流式）",
		Description: "登录 + 执行限流。同 run 请求体，区别是预注册 SSE channel，" +
			"提交后可立即连 GET /code-runner/stream 订阅输出。",
		Security:    secure,
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CodeRunRequest", true, "执行请求"),
		Responses: responses(
			200, dataResponse("CodeRunSubmitResponse", "任务受理", 200),
			429, errorResponse("执行过于频繁"),
		),
	})

	get(t, "/code-runner/tasks/{id}", &openapi3.Operation{
		Tags:       []string{"代码运行器"},
		Summary:    "查询任务结果",
		Security:   secure,
		Parameters: openapi3.Parameters{pathStrParam("id", "任务 ID")},
		Responses: responses(
			200, dataResponse("CodeRunTaskDTO", "任务状态与输出", 200),
			404, errorResponse("任务不存在"),
		),
	})

	get(t, "/code-runner/stream", &openapi3.Operation{
		Tags:    []string{"代码运行器"},
		Summary: "任务输出 SSE 流",
		Description: "text/event-stream，query 必须带 task_id。事件 event: stdout|" +
			"stderr|done；stdout/stderr 的 data 为增量文本；done 的 data 为终态 JSON" +
			"（CodeRunTaskDTO 形态）。channel 一次性消费，已消费或不存在返回 404" +
			"（前端降级为轮询）。每 15s 注释行保活。",
		Security: secure,
		Parameters: openapi3.Parameters{queryStrParam("task_id", "任务 ID（必填）")},
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("SSE 事件流"),
				Content: openapi3.Content{
					"text/event-stream": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeString},
					}}},
				},
			}},
			404, errorResponse("channel 不存在或已被消费"),
		),
	})
}
