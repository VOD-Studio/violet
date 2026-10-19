package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerRoadmapRelationPaths(t *openapi3.T) {
	registerSchema(t, "RoadmapRelationDTO", openapi3.Schemas{
		"id":         reqStr("关系 UUID"),
		"project_id": reqStr("两端共同所属的项目 UUID"),
		"source_id":  reqStr("来源条目 UUID"),
		"target_id":  reqStr("目标条目 UUID"),
		"type":       strEnum("来源扩展、修复或阻塞目标", "extends", "fixes", "blocks"),
		"created_at": reqStr("建立时间，RFC3339"),
	}, "id", "project_id", "source_id", "target_id", "type", "created_at")
	registerSchema(t, "RoadmapRelationRequest", openapi3.Schemas{
		"source_id": reqStr("来源条目 UUID"),
		"target_id": reqStr("目标条目 UUID"),
		"type":      strEnum("关系类型", "extends", "fixes", "blocks"),
	}, "source_id", "target_id", "type")
	post(t, "/admin/projects/{projectID}/roadmap/relations", &openapi3.Operation{
		Tags: []string{"项目路线图"}, Summary: "建立条目关系",
		Description: "需 project:update 权限。两端必须属于当前项目且未删除；拒绝自指、同类型重复与同类型成环。环校验保留隐藏关系，确保恢复条目不会成环。不同类型分别校验。",
		Security:    securityAdmin(), Parameters: openapi3.Parameters{pathStrParam("projectID", "项目 UUID"), csrfHeaderParam()},
		RequestBody: jsonBody("RoadmapRelationRequest", true, "来源、目标与关系类型"),
		Responses: responses(201, dataResponse("RoadmapRelationDTO", "已建立的关系", 201),
			400, errorResponse("关系无效或成环"), 401, errorResponse("未登录"), 403, errorResponse("权限不足"),
			404, errorResponse("项目或条目不存在"), 409, errorResponse("同类型关系已存在")),
	})
	del(t, "/admin/projects/{projectID}/roadmap/relations/{relationID}", &openapi3.Operation{
		Tags: []string{"项目路线图"}, Summary: "删除条目关系",
		Description: "需 project:update 权限。显式删除关系后，恢复条目不会重新建立该关系。条目软删除只隐藏关系。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("projectID", "项目 UUID"), pathStrParam("relationID", "关系 UUID"), csrfHeaderParam()},
		Responses: responses(200, messageResponse("关系已删除"), 400, errorResponse("标识无效"),
			401, errorResponse("未登录"), 403, errorResponse("权限不足"), 404, errorResponse("项目或关系不存在")),
	})
}
