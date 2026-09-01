package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerMediaPaths 注册媒体接口与分片上传接口。
func registerMediaPaths(t *openapi3.T) {
	// ---- schema ----
	registerSchema(t, "FileDTO", openapi3.Schemas{
		"id":            reqStr("文件 ID（UUID）"),
		"owner_id":      reqStr("所有者 ID（UUID）"),
		"purpose":       optStr("用途"),
		"original_name": optStr("原始文件名"),
		"url":           reqStr("访问 URL"),
		"size":          optInt64("字节数"),
		"mime_type":     optStr("MIME 类型"),
		"thumbnail":     optStr("缩略图 URL"),
		"status":        optStr("状态"),
		"created_at":    optStr("创建时间（RFC3339）"),
	})

	// InitSessionResult：秒传命中时只填 instant/file_id/url；
	// 续传/新建时填 upload_id/chunk_size/total_chunks/uploaded_chunks
	registerSchema(t, "InitSessionResult", openapi3.Schemas{
		"instant":         optBool("是否秒传命中"),
		"file_id":         optStr("秒传命中时的文件 ID"),
		"url":             optStr("秒传命中时的访问 URL"),
		"upload_id":       optStr("上传会话 ID（续传/新建）"),
		"chunk_size":      optInt("分片大小"),
		"total_chunks":    optInt("总分片数"),
		"uploaded_chunks": intArray("已上传分片索引（断点续传）"),
	})

	registerSchema(t, "MergeResult", openapi3.Schemas{
		"file_id":   reqStr("文件 ID（UUID）"),
		"url":       reqStr("访问 URL"),
		"thumbnail": optStr("缩略图 URL"),
		"width":     optInt("宽度（仅图片）"),
		"height":    optInt("高度（仅图片）"),
	})

	registerSchema(t, "InitUploadSessionRequest", openapi3.Schemas{
		"fileName":  reqStr("文件名"),
		"fileSize":  optInt64("字节数（上限 1GB）"),
		"fileHash":  optStr("文件哈希（用于秒传/续传）"),
		"mimeType":  optStr("MIME 类型（缺省按扩展名推断）"),
		"chunkSize": optInt("分片大小（≤0 时默认 5MB）"),
		"purpose":   optStr("用途（缺省 material）"),
	}, "fileName")

	registerSchema(t, "BatchDeleteMediaRequest", openapi3.Schemas{
		"ids": strArray("文件 ID 列表"),
	}, "ids")

	registerSchema(t, "EmojiUploadResult", openapi3.Schemas{
		"url":       reqStr("访问 URL"),
		"filename":  reqStr("文件名"),
		"size":      optInt64("字节数"),
		"mime_type": optStr("MIME 类型"),
	})

	// ============ 媒体 ============

	// GET /media/{id}（公开）
	get(t, "/media/{id}", &openapi3.Operation{
		Tags:       []string{"媒体"},
		Summary:    "媒体详情",
		Parameters: openapi3.Parameters{pathStrParam("id", "文件 ID（UUID）")},
		Responses: responses(
			200, dataResponse("FileDTO", "媒体详情", 200),
			404, errorResponse("文件不存在"),
		),
	})

	// GET /media（登录）
	get(t, "/media", &openapi3.Operation{
		Tags:        []string{"媒体"},
		Summary:     "媒体列表",
		Description: "获取当前用户的媒体文件列表。需登录。",
		Security:    securityCookie(),
		Parameters: openapi3.Parameters{
			queryStrParam("purpose", "按用途筛选"),
			queryStrParam("type", "按 MIME 大类筛选：image、video、audio、file"),
			queryStrParam("category", "按自定义分类筛选"),
			queryStrParam("keyword", "按原始文件名搜索"),
			pageParam(), limitParam(100),
		},
		Responses: responses(
			200, dataArrayResponse("FileDTO", "媒体列表", 200, true),
			401, errorResponse("未认证"),
		),
	})

	// DELETE /media/{id}（登录）
	del(t, "/media/{id}", &openapi3.Operation{
		Tags:        []string{"媒体"},
		Summary:     "删除媒体",
		Description: "删除媒体文件。需登录。",
		Security:    securityCookie(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "文件 ID（UUID）"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("文件已删除"),
			404, errorResponse("文件不存在"),
		),
	})

	// POST /media/batch-delete（登录）
	post(t, "/media/batch-delete", &openapi3.Operation{
		Tags:        []string{"媒体"},
		Summary:     "批量删除媒体",
		Description: "批量删除媒体文件。需登录。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("BatchDeleteMediaRequest", true, "文件 ID 列表"),
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("批量删除结果"),
				Content: openapi3.Content{
					"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeObject},
						Properties: openapi3.Schemas{
							"data": {Value: &openapi3.Schema{
								Type:       &openapi3.Types{openapi3.TypeObject},
								Properties: openapi3.Schemas{"deleted": optInt("已删除数量")},
							}},
							"meta": {Ref: "#/components/schemas/" + compMeta},
						},
					}}},
				},
			}},
		),
	})

	// POST /uploads/thumbnail（登录，multipart）—— 为媒体上传缩略图
	post(t, "/uploads/thumbnail", &openapi3.Operation{
		Tags:        []string{"上传"},
		Summary:     "上传缩略图",
		Description: "为媒体文件上传缩略图（multipart/form-data，字段 file + fileId，≤10MB，仅图片）。需登录，受上传限流保护。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: binaryBody("multipart/form-data", "缩略图文件（字段名 file）+ fileId（所属媒体 ID）"),
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("缩略图 URL"),
				Content: openapi3.Content{
					"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeObject},
						Properties: openapi3.Schemas{
							"data": {Value: &openapi3.Schema{
								Type:       &openapi3.Types{openapi3.TypeObject},
								Properties: openapi3.Schemas{"thumbnail": reqStr("缩略图 URL")},
							}},
							"meta": {Ref: "#/components/schemas/" + compMeta},
						},
					}}},
				},
			}},
			400, errorResponse("文件类型不允许"),
		),
	})

	// POST /uploads/replace（登录，multipart）—— 覆盖素材原图
	post(t, "/uploads/replace", &openapi3.Operation{
		Tags:        []string{"上传"},
		Summary:     "覆盖素材原图",
		Description: "用裁剪后的新文件覆盖调用者自己上传的素材记录（multipart/form-data，字段 file + fileId，≤10MB，仅图片，GIF 拒绝）。仅 owner 可覆盖，受上传限流保护。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: binaryBody("multipart/form-data", "裁剪后新文件（字段名 file）+ fileId（目标素材 ID）"),
		Responses: responses(
			200, dataResponse("FileDTO", "更新后的素材记录", 200),
			400, errorResponse("文件类型不允许 / GIF 不支持覆盖"),
			403, errorResponse("无权操作他人文件"),
		),
	})

	// POST /uploads/emoji（登录，multipart）—— 上传表情图片（返回 URL，非创建 emoji 记录）
	post(t, "/uploads/emoji", &openapi3.Operation{
		Tags:        []string{"上传"},
		Summary:     "上传表情图片",
		Description: "上传表情图片（multipart/form-data，字段 file，≤10MB，扩展名白名单 jpg/jpeg/png/gif/webp/svg）。需登录，受上传限流保护。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: binaryBody("multipart/form-data", "表情图片（字段名 file）"),
		Responses: responses(
			200, dataResponse("EmojiUploadResult", "上传结果", 200),
			400, errorResponse("文件类型不允许"),
		),
	})

	// GET /uploads/instant（登录）—— 秒传检查
	get(t, "/uploads/instant", &openapi3.Operation{
		Tags:        []string{"上传"},
		Summary:     "秒传检查",
		Description: "按文件哈希检查是否已存在（秒传）。需登录，受上传限流保护。",
		Security:    securityCookie(),
		Parameters: openapi3.Parameters{
			&openapi3.ParameterRef{Value: &openapi3.Parameter{
				Name: "hash", In: openapi3.ParameterInQuery, Required: true,
				Schema:      &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeString}}},
				Description: "文件哈希（必填）",
			}},
		},
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("秒传检查结果"),
				Content: openapi3.Content{
					"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeObject},
						Properties: openapi3.Schemas{
							"data": {Value: &openapi3.Schema{
								Type: &openapi3.Types{openapi3.TypeObject},
								Properties: openapi3.Schemas{
									"file":   {Ref: "#/components/schemas/FileDTO", Value: &openapi3.Schema{Description: "命中的文件（存在时）"}},
									"exists": optBool("是否已存在"),
								},
							}},
							"meta": {Ref: "#/components/schemas/" + compMeta},
						},
					}}},
				},
			}},
			400, errorResponse("缺少 hash"),
		),
	})

	// ============ 分片上传（登录 + 上传限流）============

	post(t, "/uploads", &openapi3.Operation{
		Tags:        []string{"上传"},
		Summary:     "初始化上传会话",
		Description: "初始化上传会话（秒传/续传/新建）。需登录，受上传限流保护。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("InitUploadSessionRequest", true, "上传会话初始化参数"),
		Responses: responses(
			200, dataResponse("InitSessionResult", "上传会话信息（秒传命中或新建/续传）", 200),
			400, errorResponse("文件名/大小不合法"),
		),
	})

	put(t, "/uploads/{uploadId}/chunks/{index}", &openapi3.Operation{
		Tags:        []string{"上传"},
		Summary:     "上传单个分片",
		Description: "上传单个分片（原始二进制 body，≤32MB）。需登录，受上传限流保护。",
		Security:    securityCookie(),
		Parameters: openapi3.Parameters{
			pathStrParam("uploadId", "上传会话 ID"),
			pathIntParam("index", "分片序号"),
			csrfHeaderParam(),
		},
		RequestBody: binaryBody("application/octet-stream", "分片二进制数据"),
		Responses: responses(
			200, messageResponse("分片已保存"),
			400, errorResponse("分片超限或序号非法"),
		),
	})

	post(t, "/uploads/{uploadId}/complete", &openapi3.Operation{
		Tags:        []string{"上传"},
		Summary:     "合并所有分片",
		Description: "合并所有分片完成上传。需登录，受上传限流保护。",
		Security:    securityCookie(),
		Parameters: openapi3.Parameters{
			pathStrParam("uploadId", "上传会话 ID"), csrfHeaderParam(),
		},
		Responses: responses(
			200, dataResponse("MergeResult", "合并结果", 200),
			400, errorResponse("分片不完整"),
		),
	})

	del(t, "/uploads/{uploadId}", &openapi3.Operation{
		Tags:        []string{"上传"},
		Summary:     "取消上传",
		Description: "取消上传会话并清理已上传分片。需登录，受上传限流保护。",
		Security:    securityCookie(),
		Parameters: openapi3.Parameters{
			pathStrParam("uploadId", "上传会话 ID"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("上传已取消"),
		),
	})

	get(t, "/uploads/{uploadId}", &openapi3.Operation{
		Tags:        []string{"上传"},
		Summary:     "查询上传状态",
		Description: "查询上传会话状态（断点续传用）。需登录，受上传限流保护。",
		Security:    securityCookie(),
		Parameters:  openapi3.Parameters{pathStrParam("uploadId", "上传会话 ID")},
		Responses: responses(
			200, dataResponse("InitSessionResult", "上传状态（含已上传分片）", 200),
			404, errorResponse("上传会话不存在"),
		),
	})
}
