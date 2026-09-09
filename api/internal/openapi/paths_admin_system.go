package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminSystemPaths 注册系统监控接口：实时快照与 Redis 历史采样。
// 两个响应体都是深嵌套的监控结构，字段以实现为准建模为自由 object。
func registerAdminSystemPaths(t *openapi3.T) {
	secure := securityAdmin()

	freeObject := func(desc string) *openapi3.SchemaRef {
		return &openapi3.SchemaRef{Value: &openapi3.Schema{
			Type:                 &openapi3.Types{openapi3.TypeObject},
			Description:          desc,
			AdditionalProperties: openapi3.AdditionalProperties{Has: openapi3.Ptr(true)},
		}}
	}

	get(t, "/admin/system/snapshot", &openapi3.Operation{
		Tags:        []string{"系统"},
		Summary:     "系统实时快照",
		Description: "需 system:view 权限。host/cpu/memory/disk/network/load/runtime/" +
			"dependencies（postgres/redis 连通与延迟）全量结构。",
		Security:  secure,
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("系统快照"),
				Content: openapi3.Content{
					"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeObject},
						Properties: openapi3.Schemas{
							"data": freeObject("系统快照（host/cpu/memory/disk/network/load/runtime/dependencies）"),
						},
					}}},
				},
			}},
		),
	})

	get(t, "/admin/system/history", &openapi3.Operation{
		Tags:        []string{"系统"},
		Summary:     "系统历史采样",
		Description: "需 system:view 权限。Redis 存储的近段采样点，键名为压缩短键" +
			"（ts/cpu/m/d/n/ld/rt/dep），interval 为采样间隔（秒）。",
		Security:  secure,
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("历史采样"),
				Content: openapi3.Content{
					"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeObject},
						Properties: openapi3.Schemas{
							"data": freeObject("历史采样（interval + points 数组，压缩键）"),
						},
					}}},
				},
			}},
		),
	})
}
