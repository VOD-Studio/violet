package openapi

import "github.com/getkin/kin-openapi/openapi3"

func registerRoadmapDeletionPaths(t *openapi3.T) {
	parameters := openapi3.Parameters{pathStrParam("projectID", "项目 UUID"), pathStrParam("id", "条目 UUID"), csrfHeaderParam()}
	del(t, "/admin/projects/{projectID}/roadmap/items/{id}", &openapi3.Operation{
		Tags: []string{"项目路线图"}, Summary: "软删除路线图条目",
		Description: "需 project:update 权限。仅标记删除时间，公开读取和进度不再包含该条目。重复删除成功且不重复写日志。",
		Security:    securityAdmin(), Parameters: parameters,
		Responses: responses(204, noContentResponse("条目已删除"), 400, errorResponse("标识无效"),
			401, errorResponse("未登录"), 403, errorResponse("权限不足"), 404, errorResponse("项目或条目不存在")),
	})
	post(t, "/admin/projects/{projectID}/roadmap/items/{id}/restore", &openapi3.Operation{
		Tags: []string{"项目路线图"}, Summary: "恢复路线图条目",
		Description: "需 project:update 权限。恢复同一条目，编号、位置和内容保持不变。恢复活跃条目成功且不重复写日志。",
		Security:    securityAdmin(), Parameters: parameters,
		Responses: roadmapItemResponses(200),
	})
}
