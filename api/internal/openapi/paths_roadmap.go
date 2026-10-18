package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerRoadmapPaths(t *openapi3.T) {
	completionDate := nullableStr("YYYY-MM-DD；仅已完成阶段有值，默认日期采用 Asia/Shanghai")
	completionDate.Value.Format = "date"
	registerSchema(t, "RoadmapLinkDTO", openapi3.Schemas{
		"label": reqStr("链接标题"),
		"url":   reqStr("HTTP(S) 地址或站内绝对路径"),
	}, "label", "url")
	registerSchema(t, "RoadmapLinkRequest", openapi3.Schemas{
		"label": optStr("链接标题；省略或空串时显示 URL"),
		"url":   reqStr("HTTP(S) 地址或站内绝对路径"),
	}, "url")
	registerSchema(t, "RoadmapProgressDTO", openapi3.Schemas{
		"planned":     optInt("未删除的规划中条目数"),
		"in_progress": optInt("未删除的开发中条目数"),
		"completed":   optInt("未删除的已完成条目数"),
		"total":       optInt("未删除条目总数"),
		"percent":     optInt("已完成数除以总数，四舍五入为整数百分比；无条目为 0"),
	}, "planned", "in_progress", "completed", "total", "percent")
	registerSchema(t, "RoadmapItemDTO", openapi3.Schemas{
		"id":                reqStr("条目 UUID"),
		"project_id":        reqStr("所属项目 UUID"),
		"number":            optInt64("项目内递增编号，删除后不复用"),
		"title":             reqStr("必填标题"),
		"description":       reqStr("纯文本简介"),
		"stage":             strEnum("阶段", "planned", "in_progress", "completed"),
		"position":          reqStr("按字节序排列的分数索引；已完成阶段不使用此键排序"),
		"tags":              strArray("项目内自由文本条目标签"),
		"links":             refArray("关联链接", "RoadmapLinkDTO"),
		"completion_date":   completionDate,
		"delivered_version": reqStr("交付版本；未完成或未填写时为空串"),
		"blocked":           optBool("是否存在未完成且未删除的阻塞前置条目，不改变阶段"),
		"created_at":        reqStr("创建时间，RFC3339"),
		"updated_at":        reqStr("最近更新时间，RFC3339"),
	}, "id", "project_id", "number", "title", "description", "stage", "position", "tags", "links", "completion_date", "delivered_version", "blocked", "created_at", "updated_at")
	registerSchema(t, "RoadmapDetailDTO", openapi3.Schemas{
		"project":   optRef("所属项目", "ProjectDTO"),
		"items":     refArray("全部未删除条目；已完成按完成日期倒序，同日按编号倒序", "RoadmapItemDTO"),
		"progress":  optRef("当前进度概览", "RoadmapProgressDTO"),
		"relations": refArray("两端均未删除的条目关系", "RoadmapRelationDTO"),
	}, "project", "items", "progress", "relations")
	contentFields := openapi3.Schemas{
		"title":             reqStr("必填标题，去空白后不能为空"),
		"description":       optStr("纯文本简介；空串清空"),
		"tags":              strArray("自由文本条目标签；空数组清空"),
		"links":             refArray("关联链接；空数组清空", "RoadmapLinkRequest"),
		"completion_date":   completionDate,
		"delivered_version": optStr("交付版本；只在已完成阶段允许非空，空串清空"),
	}
	registerSchema(t, "RoadmapUpdateRequest", contentFields, "title")
	createFields := make(openapi3.Schemas, len(contentFields)+1)
	for field, schema := range contentFields {
		createFields[field] = schema
	}
	createFields["stage"] = strEnum("阶段，省略时为 planned", "planned", "in_progress", "completed")
	registerSchema(t, "RoadmapCreateRequest", createFields, "title")

	get(t, "/projects/by-slug/{slug}/roadmap", &openapi3.Operation{
		Tags: []string{"项目路线图"}, Summary: "按项目 slug 读取公开路线图",
		Description: "返回项目、全部未删除条目与进度概览；无需登录。",
		Parameters:  openapi3.Parameters{pathStrParam("slug", "项目 slug")},
		Responses:   responses(200, dataResponse("RoadmapDetailDTO", "项目路线图", 200), 400, errorResponse("请求失败"), 404, errorResponse("请求失败")),
	})
	post(t, "/admin/projects/{projectID}/roadmap/items", &openapi3.Operation{
		Tags: []string{"项目路线图"}, Summary: "创建路线图条目",
		Description: "需 project:update 权限。项目内编号递增且不复用；新条目追加到目标阶段末尾。已完成条目缺省完成日期为 Asia/Shanghai 当天。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("projectID", "项目 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("RoadmapCreateRequest", true, "条目内容"),
		Responses:   roadmapItemResponses(201),
	})
	put(t, "/admin/projects/{projectID}/roadmap/items/{id}", &openapi3.Operation{
		Tags: []string{"项目路线图"}, Summary: "编辑路线图条目内容",
		Description: "需 project:update 权限。全量替换标题、简介、标签、链接与交付版本；completion_date 未传或为 null 时保留原值。阶段与位置仅通过移动接口变更。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("projectID", "项目 UUID"), pathStrParam("id", "条目 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("RoadmapUpdateRequest", true, "完整条目内容"),
		Responses:   roadmapItemResponses(200),
	})
}

func roadmapItemResponses(status int) *openapi3.Responses {
	return responses(status, dataResponse("RoadmapItemDTO", "受影响的条目", status),
		400, errorResponse("请求失败"), 401, errorResponse("请求失败"), 403, errorResponse("请求失败"), 404, errorResponse("请求失败"), 409, errorResponse("请求失败"))
}
