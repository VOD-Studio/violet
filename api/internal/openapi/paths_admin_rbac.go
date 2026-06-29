package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminRBACPaths 注册角色与权限管理后台接口（/admin/roles, /admin/permissions）。
// 角色管理需管理员权限；权限 CRUD 需超级管理员权限。
func registerAdminRBACPaths(t *openapi3.T) {
	registerSchema(t, "RoleDTO", openapi3.Schemas{
		"id":               optInt32("角色 ID"),
		"name":             reqStr("角色名"),
		"description":      optStr("角色描述"),
		"permission_codes": strArray("权限代码列表"),
		"created_at":       optStr("创建时间（RFC3339）"),
		"user_count":       optInt64("用户数量（仅列表查询填充）"),
	})

	registerSchema(t, "PermissionDTO", openapi3.Schemas{
		"id":          optInt32("权限 ID"),
		"code":        reqStr("权限代码（menu 为纯 module 名如 post；action 为 module:action 如 post:create）"),
		"name":        reqStr("权限名称"),
		"description": optStr("权限描述"),
		"type":        optStr("权限类型：menu（分组容器）| action（可授权操作）"),
		"parent_id":   optInt32("父权限 ID（action 指向所属 menu；menu 为 null）"),
		"sort":        optInt("排序值（升序）"),
		"is_builtin":  optBool("是否内置权限（内置不可删、不可改 code）"),
		"children":    refArray("子权限列表（仅 menu 节点有）", "PermissionDTO"),
	})

	// RoleWithPermissionsDTO：内嵌 RoleDTO + permissions 列表
	registerSchema(t, "RoleWithPermissionsDTO", openapi3.Schemas{
		"id":               optInt32("角色 ID"),
		"name":             reqStr("角色名"),
		"description":      optStr("角色描述"),
		"permission_codes": strArray("权限代码列表"),
		"created_at":       optStr("创建时间（RFC3339）"),
		"user_count":       optInt64("用户数量"),
		"permissions":      refArray("权限详情列表", "PermissionDTO"),
	})

	registerSchema(t, "CreateRoleRequest", openapi3.Schemas{
		"name":        reqStr("角色名（2-50 字符）"),
		"description": optStr("角色描述"),
	}, "name")

	registerSchema(t, "UpdateRoleRequest", openapi3.Schemas{
		"name":        optStr("角色名（2-50 字符）"),
		"description": optStr("角色描述"),
	})

	registerSchema(t, "UpdateRolePermissionsRequest", openapi3.Schemas{
		"permission_codes": strArray("权限代码列表（设为全部权限）"),
	}, "permission_codes")

	registerSchema(t, "CreatePermissionRequest", openapi3.Schemas{
		"code":        reqStr("权限代码（menu 为纯 module 名；action 为 module:action）"),
		"name":        reqStr("权限名称"),
		"description": optStr("权限描述"),
		"type":        optStr("权限类型：menu | action（默认 action）"),
		"parent_id":   optInt32("父权限 ID（action 必填指向 menu；menu 为 null）"),
		"sort":        optInt("排序值（默认 0）"),
	}, "code", "name")

	registerSchema(t, "UpdatePermissionRequest", openapi3.Schemas{
		"code":        optStr("权限代码（内置权限不可改，提交时忽略）"),
		"name":        optStr("权限名称"),
		"description": optStr("权限描述"),
		"parent_id":   optInt32("父权限 ID"),
		"sort":        optInt("排序值"),
	})

	// id 响应（创建返回）
	idResp := func(desc string) *openapi3.ResponseRef {
		return &openapi3.ResponseRef{Value: &openapi3.Response{
			Description: strPtr(desc),
			Content: openapi3.Content{
				"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
					Type: &openapi3.Types{openapi3.TypeObject},
					Properties: openapi3.Schemas{
						"data": {Value: &openapi3.Schema{
							Type:       &openapi3.Types{openapi3.TypeObject},
							Properties: openapi3.Schemas{"id": optInt32("新建 ID")},
						}},
						"meta": {Ref: "#/components/schemas/" + compMeta},
					},
				}}},
			},
		}}
	}

	// ============ 权限（管理员查看 / 超管 CRUD）============

	get(t, "/admin/permissions", &openapi3.Operation{
		Tags:        []string{"权限管理"},
		Summary:     "获取所有权限定义",
		Description: "列出所有权限。需管理员权限。",
		Security:    securityAdmin(),
		Responses: responses(
			200, dataArrayResponse("PermissionDTO", "权限列表", 200, false),
		),
	})

	post(t, "/admin/permissions", &openapi3.Operation{
		Tags:        []string{"权限管理"},
		Summary:     "创建权限",
		Description: "创建权限。需超级管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreatePermissionRequest", true, "权限信息"),
		Responses: responses(
			201, idResp("新建权限 ID"),
			400, errorResponse("请求参数错误或代码已存在"),
		),
	})

	patch(t, "/admin/permissions/{id}", &openapi3.Operation{
		Tags:        []string{"权限管理"},
		Summary:     "更新权限",
		Description: "更新权限。需超级管理员权限。内置权限不可改 code。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "权限 ID"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("UpdatePermissionRequest", true, "待更新字段"),
		Responses: responses(
			200, messageResponse("权限已更新"),
			404, errorResponse("权限不存在"),
		),
	})

	del(t, "/admin/permissions/{id}", &openapi3.Operation{
		Tags:        []string{"权限管理"},
		Summary:     "删除权限",
		Description: "删除权限。需超级管理员权限。内置权限不可删；被角色使用中的权限不可删。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "权限 ID"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("权限已删除"),
			404, errorResponse("权限不存在"),
		),
	})

	// ============ 角色（管理员）============

	get(t, "/admin/roles", &openapi3.Operation{
		Tags:        []string{"角色管理"},
		Summary:     "角色列表",
		Description: "列出所有角色（含 user_count）。需管理员权限。",
		Security:    securityAdmin(),
		Responses: responses(
			200, dataArrayResponse("RoleDTO", "角色列表", 200, false),
		),
	})

	get(t, "/admin/roles/{id}", &openapi3.Operation{
		Tags:        []string{"角色管理"},
		Summary:     "角色详情（含权限）",
		Description: "获取角色详情及其权限列表。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathIntParam("id", "角色 ID")},
		Responses: responses(
			200, dataResponse("RoleWithPermissionsDTO", "角色详情", 200),
			404, errorResponse("角色不存在"),
		),
	})

	post(t, "/admin/roles", &openapi3.Operation{
		Tags:        []string{"角色管理"},
		Summary:     "创建角色",
		Description: "创建角色。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreateRoleRequest", true, "角色信息"),
		Responses: responses(
			201, idResp("新建角色 ID"),
			400, errorResponse("请求参数错误"),
		),
	})

	patch(t, "/admin/roles/{id}", &openapi3.Operation{
		Tags:        []string{"角色管理"},
		Summary:     "更新角色",
		Description: "更新角色信息。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "角色 ID"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("UpdateRoleRequest", true, "待更新字段"),
		Responses: responses(
			200, messageResponse("角色已更新"),
			404, errorResponse("角色不存在"),
		),
	})

	del(t, "/admin/roles/{id}", &openapi3.Operation{
		Tags:        []string{"角色管理"},
		Summary:     "删除角色",
		Description: "删除角色。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "角色 ID"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("角色已删除"),
			404, errorResponse("角色不存在"),
		),
	})

	patch(t, "/admin/roles/{id}/permissions", &openapi3.Operation{
		Tags:        []string{"角色管理"},
		Summary:     "设置角色权限",
		Description: "设置角色的全部权限。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathIntParam("id", "角色 ID"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("UpdateRolePermissionsRequest", true, "权限代码列表"),
		Responses: responses(
			200, messageResponse("角色权限已更新"),
			404, errorResponse("角色不存在"),
		),
	})
}
