package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminUserPaths 注册用户管理后台接口（/admin/users，需管理员权限）。
func registerAdminUserPaths(t *openapi3.T) {
	// AdminUserDTO（useradmin service，字段名 avatar）
	registerSchema(t, "AdminUserDTO", openapi3.Schemas{
		"id":             reqStr("用户 ID（UUID）"),
		"username":       reqStr("用户名"),
		"email":          reqStr("邮箱"),
		"role":           strEnum("角色", "user", "admin", "superadmin"),
		"email_verified": optBool("邮箱是否已验证"),
		"is_active":      optBool("是否启用"),
		"bio":            optStr("个人简介"),
		"avatar":         optStr("头像 URL"),
		"created_at":     optStr("创建时间（RFC3339）"),
	})

	registerSchema(t, "CreateUserRequest", openapi3.Schemas{
		"username":  reqStr("用户名"),
		"email":     reqStr("邮箱"),
		"password":  reqStr("密码（至少 6 位）"),
		"role":      optStr("角色（缺省 user）"),
		"is_active": optBool("是否启用（缺省 true）"),
	}, "username", "email", "password")

	// UpdateUserRequest 全指针（部分更新）
	registerSchema(t, "UpdateUserRequest", openapi3.Schemas{
		"username":  optStr("用户名"),
		"email":     optStr("邮箱"),
		"password":  optStr("密码"),
		"role":      optStr("角色"),
		"is_active": optBool("是否启用"),
	})

	registerSchema(t, "UpdateUserRoleRequest", openapi3.Schemas{
		"role": reqStr("角色"),
	}, "role")

	// is_active 为 bool 值类型（required，缺省零值 false）
	registerSchema(t, "UpdateUserStatusRequest", openapi3.Schemas{
		"is_active": optBool("是否启用"),
	}, "is_active")

	registerSchema(t, "BatchUserStatusRequest", openapi3.Schemas{
		"ids":       strArray("用户 ID 列表"),
		"is_active": optBool("是否启用"),
	}, "ids")

	registerSchema(t, "BatchUserRoleRequest", openapi3.Schemas{
		"ids":  strArray("用户 ID 列表"),
		"role": reqStr("角色"),
	}, "ids", "role")

	// affected 响应
	affectedResp := func(desc string) *openapi3.ResponseRef {
		return &openapi3.ResponseRef{Value: &openapi3.Response{
			Description: strPtr(desc),
			Content: openapi3.Content{
				"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
					Type: &openapi3.Types{openapi3.TypeObject},
					Properties: openapi3.Schemas{
						"data": {Value: &openapi3.Schema{
							Type:       &openapi3.Types{openapi3.TypeObject},
							Properties: openapi3.Schemas{"affected": optInt64("受影响数量")},
						}},
						"meta": {Ref: "#/components/schemas/" + compMeta},
					},
				}}},
			},
		}}
	}

	// ---- GET /admin/users ----
	get(t, "/admin/users", &openapi3.Operation{
		Tags:        []string{"用户管理"},
		Summary:     "用户列表",
		Description: "分页查询用户列表，支持 role/is_active/keyword 筛选。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pageParam(), limitParam(100),
			queryStrParam("role", "按角色筛选"),
			queryStrParam("is_active", "按启用状态筛选（true/1）"),
			queryStrParam("keyword", "关键词（用户名/邮箱）"),
		},
		Responses: responses(
			200, dataArrayResponse("AdminUserDTO", "用户列表", 200, true),
		),
	})

	get(t, "/admin/users/{id}", &openapi3.Operation{
		Tags:        []string{"用户管理"},
		Summary:     "用户详情",
		Description: "按 ID 获取用户详情。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "用户 ID（UUID）")},
		Responses: responses(
			200, dataResponse("AdminUserDTO", "用户详情", 200),
			404, errorResponse("用户不存在"),
		),
	})

	post(t, "/admin/users", &openapi3.Operation{
		Tags:        []string{"用户管理"},
		Summary:     "创建用户",
		Description: "管理员创建用户。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreateUserRequest", true, "用户信息"),
		Responses: responses(
			201, dataResponse("AdminUserDTO", "新建用户", 201),
			400, errorResponse("请求参数错误或用户名/邮箱已存在"),
		),
	})

	put(t, "/admin/users/{id}", &openapi3.Operation{
		Tags:        []string{"用户管理"},
		Summary:     "编辑用户",
		Description: "部分更新用户信息（全指针字段）。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "用户 ID（UUID）"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("UpdateUserRequest", true, "待更新字段"),
		Responses: responses(
			200, dataResponse("AdminUserDTO", "更新后的用户", 200),
			404, errorResponse("用户不存在"),
		),
	})

	del(t, "/admin/users/{id}", &openapi3.Operation{
		Tags:        []string{"用户管理"},
		Summary:     "删除用户",
		Description: "删除用户。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "用户 ID（UUID）"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("用户已删除"),
			404, errorResponse("用户不存在"),
		),
	})

	patch(t, "/admin/users/{id}/role", &openapi3.Operation{
		Tags:        []string{"用户管理"},
		Summary:     "修改用户角色",
		Description: "修改单个用户角色。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "用户 ID（UUID）"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("UpdateUserRoleRequest", true, "目标角色"),
		Responses: responses(
			200, messageResponse("用户角色已更新"),
			404, errorResponse("用户不存在"),
		),
	})

	patch(t, "/admin/users/{id}/status", &openapi3.Operation{
		Tags:        []string{"用户管理"},
		Summary:     "启用/禁用用户",
		Description: "修改用户启用状态。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "用户 ID（UUID）"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("UpdateUserStatusRequest", true, "目标状态"),
		Responses: responses(
			200, messageResponse("用户状态已更新"),
			404, errorResponse("用户不存在"),
		),
	})

	post(t, "/admin/users/batch-status", &openapi3.Operation{
		Tags:        []string{"用户管理"},
		Summary:     "批量启用/禁用用户",
		Description: "批量修改用户启用状态。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("BatchUserStatusRequest", true, "用户 ID 列表与目标状态"),
		Responses: responses(
			200, affectedResp("批量更新结果"),
		),
	})

	post(t, "/admin/users/batch-role", &openapi3.Operation{
		Tags:        []string{"用户管理"},
		Summary:     "批量修改用户角色",
		Description: "批量修改用户角色。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("BatchUserRoleRequest", true, "用户 ID 列表与目标角色"),
		Responses: responses(
			200, affectedResp("批量更新结果"),
		),
	})
}
