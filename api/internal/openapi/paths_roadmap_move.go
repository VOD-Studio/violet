package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerRoadmapMovePath(t *openapi3.T) {
	date := nullableStr("YYYY-MM-DD；进入已完成时省略或 null 默认 Asia/Shanghai 当天")
	date.Value.Format = "date"
	registerSchema(t, "RoadmapMoveRequest", openapi3.Schemas{
		"stage":             strEnum("目标阶段", "planned", "in_progress", "completed"),
		"before_id":         optStr("目标位置的前一条 UUID；空串或省略表示无前邻居"),
		"after_id":          optStr("目标位置的后一条 UUID；空串或省略表示无后邻居"),
		"completion_date":   date,
		"delivered_version": optStr("进入已完成时的交付版本；空串表示未填写"),
	}, "stage")
	post(t, "/admin/projects/{projectID}/roadmap/items/{id}/move", &openapi3.Operation{
		Tags: []string{"项目路线图"}, Summary: "移动路线图条目",
		Description: "需 project:update 权限。以有效相邻条目生成分数索引，仅更新当前条目；邻居已删除、已移动或不再相邻时回退目标阶段末尾。已完成阶段按完成日期倒序，同日编号倒序，拒绝阶段内手动重排。离开已完成时清空完成日期与交付版本；阶段变更记录操作日志，阶段内排序不记录。返回已保存条目供前端对账。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("projectID", "项目 UUID"), pathStrParam("id", "条目 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("RoadmapMoveRequest", true, "目标阶段与相邻条目"),
		Responses:   roadmapItemResponses(200),
	})
}
