package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerCommentPaths 注册评论与评论反应接口。
func registerCommentPaths(t *openapi3.T) {
	// ---- schema ----
	// Picture：评论附图
	registerSchema(t, "CommentPicture", openapi3.Schemas{
		"url":    reqStr("图片 URL"),
		"width":  optInt("宽度"),
		"height": optInt("高度"),
		"size":   optInt64("字节数"),
	})

	// CommentDTO：前台评论读模型
	registerSchema(t, "CommentDTO", openapi3.Schemas{
		"id":          reqStr("评论 ID（UUID）"),
		"post_id":     reqStr("文章 ID（UUID）"),
		"parent_id":   optStr("父评论 ID（UUID，顶级评论为空）"),
		"depth":       optInt("嵌套深度（顶级为 0）"),
		"author_name": reqStr("评论者昵称"),
		"avatar_url":  optStr("评论者头像 URL"),
		"body":        reqStr("评论内容"),
		"pictures":    refArray("附图列表", "CommentPicture"),
		"status":      strEnum("状态", "pending", "approved", "spam", "deleted"),
		"created_at":  optStr("创建时间（RFC3339）"),
	})

	// AdminCommentDTO：后台评论读模型（CommentDTO 全部字段 + 文章标题/slug）
	registerSchema(t, "AdminCommentDTO", openapi3.Schemas{
		"id":          reqStr("评论 ID（UUID）"),
		"post_id":     reqStr("文章 ID（UUID）"),
		"parent_id":   optStr("父评论 ID（UUID，顶级评论为空）"),
		"depth":       optInt("嵌套深度（顶级为 0）"),
		"author_name": reqStr("评论者昵称"),
		"avatar_url":  optStr("评论者头像 URL"),
		"body":        reqStr("评论内容"),
		"pictures":    refArray("附图列表", "CommentPicture"),
		"status":      strEnum("状态", "pending", "approved", "spam", "deleted"),
		"created_at":  optStr("创建时间（RFC3339）"),
		"post_title":  optStr("所属文章标题"),
		"post_slug":   optStr("所属文章 slug"),
	})

	// CreateCommentRequest
	registerSchema(t, "CreateCommentRequest", openapi3.Schemas{
		"body":         reqStr("评论内容"),
		"parent_id":    optStr("父评论 ID（UUID，顶级评论不传）"),
		"author_name":  reqStr("评论者昵称"),
		"author_email": reqStr("评论者邮箱"),
		"author_url":   optStr("评论者网站"),
		"avatar_url":   optStr("评论者头像 URL"),
	}, "body", "author_name", "author_email")

	// BatchUpdateCommentStatusRequest
	registerSchema(t, "BatchUpdateCommentStatusRequest", openapi3.Schemas{
		"ids":    strArray("评论 ID 列表（1-100 条）"),
		"status": strEnum("目标状态", "pending", "approved", "spam", "deleted"),
	}, "ids", "status")

	// Reaction：评论反应
	registerSchema(t, "Reaction", openapi3.Schemas{
		"id":         optInt64("反应 ID"),
		"comment_id": reqStr("评论 ID（UUID）"),
		"user_id":    optStr("用户 ID（UUID，匿名反应为空）"),
		"emoji_id":   optInt32("表情 ID"),
		"emoji_name": reqStr("表情名称"),
		"emoji_url":  reqStr("表情图片 URL"),
		"ip_address": optStr("IP 哈希（可空）"),
		"created_at": optStr("创建时间（RFC3339）"),
	})

	// AddReactionRequest
	registerSchema(t, "AddReactionRequest", openapi3.Schemas{
		"emoji_id": reqStr("表情 ID"),
	}, "emoji_id")

	// BatchReactionsRequest / BatchResult
	registerSchema(t, "BatchReactionsRequest", openapi3.Schemas{
		"comment_ids": strArray("评论 ID 列表"),
	}, "comment_ids")

	registerSchema(t, "CommentReactionBatchResult", openapi3.Schemas{
		"comment_id": reqStr("评论 ID（UUID）"),
		"reactions":  refArray("该评论的反应列表", "Reaction"),
	})

	// ============ 前台评论 ============

	get(t, "/posts/{postId}/comments", &openapi3.Operation{
		Tags:    []string{"评论"},
		Summary: "文章已审核评论列表",
		Parameters: openapi3.Parameters{
			pathStrParam("postId", "文章 ID（UUID）"),
			pageParam(), limitParam(100),
		},
		Responses: responses(
			200, dataArrayResponse("CommentDTO", "已审核评论列表（仅 approved）", 200, true),
		),
	})

	post(t, "/posts/{postId}/comments", &openapi3.Operation{
		Tags:        []string{"评论"},
		Summary:     "提交评论",
		Description: "提交评论（默认 pending，待审核）。受评论限流保护。",
		Parameters: openapi3.Parameters{
			pathStrParam("postId", "文章 ID（UUID）"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("CreateCommentRequest", true, "评论内容"),
		Responses: responses(
			201, dataResponse("CommentDTO", "新建评论（pending 状态）", 201),
			400, errorResponse("请求参数错误"),
		),
	})

	// ============ 评论反应 ============

	get(t, "/comments/{comment_id}/reactions", &openapi3.Operation{
		Tags:       []string{"评论反应"},
		Summary:    "获取评论反应",
		Parameters: openapi3.Parameters{pathStrParam("comment_id", "评论 ID（UUID）")},
		Responses: responses(
			200, dataArrayResponse("Reaction", "评论反应列表", 200, false),
		),
	})

	post(t, "/comments/{comment_id}/reactions", &openapi3.Operation{
		Tags:        []string{"评论反应"},
		Summary:     "添加反应",
		Description: "对评论添加表情反应。受评论限流保护（公开，匿名可调）。",
		Parameters: openapi3.Parameters{
			pathStrParam("comment_id", "评论 ID（UUID）"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("AddReactionRequest", true, "表情 ID"),
		Responses: responses(
			200, messageResponse("反应已添加"),
		),
	})

	// DELETE /comments/{comment_id}/reactions/{emoji_id}（登录，非管理员）
	del(t, "/comments/{comment_id}/reactions/{emoji_id}", &openapi3.Operation{
		Tags:        []string{"评论反应"},
		Summary:     "删除反应",
		Description: "删除自己添加的反应（需登录，防匿名删除他人反应）。",
		Security:    securityCookie(),
		Parameters: openapi3.Parameters{
			pathStrParam("comment_id", "评论 ID（UUID）"),
			pathIntParam("emoji_id", "表情 ID"),
			csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("反应已移除"),
			401, errorResponse("未登录"),
		),
	})

	post(t, "/comments/reactions/batch", &openapi3.Operation{
		Tags:        []string{"评论反应"},
		Summary:     "批量获取评论反应",
		Description: "按评论 ID 批量查询反应（语义为查询，用 POST 因 body 含数组）。",
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("BatchReactionsRequest", true, "评论 ID 列表"),
		Responses: responses(
			200, dataArrayResponse("CommentReactionBatchResult", "各评论的反应汇总", 200, false),
		),
	})

	// ============ 后台评论审核（管理员）============

	patch(t, "/comments/{id}/approve", &openapi3.Operation{
		Tags:        []string{"评论管理"},
		Summary:     "审核通过",
		Description: "将评论标记为 approved。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "评论 ID（UUID）"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("评论已审核通过"),
			404, errorResponse("评论不存在"),
		),
	})

	patch(t, "/comments/{id}/spam", &openapi3.Operation{
		Tags:        []string{"评论管理"},
		Summary:     "标记垃圾",
		Description: "将评论标记为 spam。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "评论 ID（UUID）"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("评论已标记为垃圾"),
			404, errorResponse("评论不存在"),
		),
	})

	del(t, "/comments/{id}", &openapi3.Operation{
		Tags:        []string{"评论管理"},
		Summary:     "删除评论",
		Description: "删除评论。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "评论 ID（UUID）"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("评论已删除"),
			404, errorResponse("评论不存在"),
		),
	})

	// ============ 后台评论管理（/admin/comments）============

	get(t, "/admin/comments/pending", &openapi3.Operation{
		Tags:        []string{"评论管理"},
		Summary:     "待审核评论列表",
		Description: "获取 pending 状态评论（返回基础 CommentDTO）。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pageParam(), limitParam(100)},
		Responses: responses(
			200, dataArrayResponse("CommentDTO", "待审核评论列表", 200, true),
		),
	})

	get(t, "/admin/comments/pending/count", &openapi3.Operation{
		Tags:        []string{"评论管理"},
		Summary:     "待审核评论数量",
		Description: "返回待审核评论数量。需管理员权限。",
		Security:    securityAdmin(),
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("待审核评论数量"),
				Content: openapi3.Content{
					"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeObject},
						Properties: openapi3.Schemas{
							"data": {Value: &openapi3.Schema{
								Type:       &openapi3.Types{openapi3.TypeObject},
								Properties: openapi3.Schemas{"count": optInt64("待审核数量")},
							}},
							"meta": {Ref: "#/components/schemas/" + compMeta},
						},
					}}},
				},
			}},
		),
	})

	get(t, "/admin/comments", &openapi3.Operation{
		Tags:        []string{"评论管理"},
		Summary:     "所有评论列表",
		Description: "管理员查看所有评论，可按 status 过滤（返回 AdminCommentDTO）。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pageParam(), limitParam(100),
			&openapi3.ParameterRef{Value: &openapi3.Parameter{
				Name: "status", In: openapi3.ParameterInQuery,
				Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
					Type: &openapi3.Types{openapi3.TypeString},
					Enum: []any{"pending", "approved", "spam", "deleted"},
				}},
				Description: "按状态过滤",
			}},
		},
		Responses: responses(
			200, dataArrayResponse("AdminCommentDTO", "评论列表（含文章标题）", 200, true),
		),
	})

	get(t, "/admin/comments/{id}", &openapi3.Operation{
		Tags:        []string{"评论管理"},
		Summary:     "评论详情",
		Description: "获取评论详情（AdminCommentDTO）。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "评论 ID（UUID）")},
		Responses: responses(
			200, dataResponse("AdminCommentDTO", "评论详情", 200),
			404, errorResponse("评论不存在"),
		),
	})

	patch(t, "/admin/comments/batch-status", &openapi3.Operation{
		Tags:        []string{"评论管理"},
		Summary:     "批量更新评论状态",
		Description: "批量修改评论状态。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("BatchUpdateCommentStatusRequest", true, "评论 ID 列表与目标状态"),
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("批量更新结果"),
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
			}},
		),
	})
}
