package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminSystemPaths 注册系统监控、数据库操作与备份维护接口。
func registerAdminSystemPaths(t *openapi3.T) {
	secure := securityAdmin()
	registerSystemSchemas(t)

	freeObject := func(desc string) *openapi3.SchemaRef {
		return &openapi3.SchemaRef{Value: &openapi3.Schema{
			Type:                 &openapi3.Types{openapi3.TypeObject},
			Description:          desc,
			AdditionalProperties: openapi3.AdditionalProperties{Has: openapi3.Ptr(true)},
		}}
	}
	freeDataResponse := func(desc string, _ int) *openapi3.ResponseRef {
		return &openapi3.ResponseRef{Value: &openapi3.Response{
			Description: strPtr(desc),
			Content: openapi3.Content{
				"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
					Type: &openapi3.Types{openapi3.TypeObject},
					Properties: openapi3.Schemas{
						"data": freeObject(desc),
					},
				}}},
			},
		}}
	}
	binaryResponse := func(desc string) *openapi3.ResponseRef {
		return &openapi3.ResponseRef{Value: &openapi3.Response{
			Description: strPtr(desc),
			Content: openapi3.Content{
				"application/octet-stream": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
					Type: &openapi3.Types{openapi3.TypeString}, Format: "binary",
				}}},
			},
		}}
	}

	get(t, "/admin/system/snapshot", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "系统实时快照",
		Description: "需 system:view 权限。返回 host/cpu/memory/disk/network/load/runtime 与依赖状态。",
		Security:    secure, Responses: responses(200, freeDataResponse("系统快照", 200)),
	})
	get(t, "/admin/system/history", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "系统历史采样",
		Description: "需 system:view 权限。返回 Redis 中保留的监控采样点。",
		Security:    secure, Responses: responses(200, freeDataResponse("历史采样", 200)),
	})
	get(t, "/admin/system/database", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "数据库状态",
		Description: "需 system:view 权限。返回数据库容量、连接池、迁移、表、索引与活动查询统计。",
		Security:    secure, Responses: responses(200, freeDataResponse("数据库状态", 200)),
	})
	get(t, "/admin/system/schema", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "数据库结构",
		Description: "需 system:manage 权限。返回 public schema 的表与列。",
		Security:    secure, Responses: responses(200, freeDataResponse("数据库结构", 200)),
	})
	post(t, "/admin/system/sql", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "执行受控 SQL",
		Description: "需 system:manage 权限。默认单语句；写入需显式确认；返回最多 500 行。",
		Security:    secure, Parameters: openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("SystemSQLRequest", true, "SQL 执行参数"),
		Responses:   responses(200, freeDataResponse("SQL 执行结果", 200), 400, errorResponse("SQL 被安全策略拒绝或执行失败")),
	})
	post(t, "/admin/system/export", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "导出数据",
		Description: "需 system:manage 权限。流式导出表或单条只读查询结果。",
		Security:    secure, Parameters: openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("SystemExportRequest", true, "导出来源与格式"),
		Responses:   responses(200, binaryResponse("CSV 或 SQL 附件"), 400, errorResponse("导出参数或查询无效")),
	})
	get(t, "/admin/system/backups", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "备份列表",
		Description: "需 system:manage 权限。返回已完成备份与自动备份设置。",
		Security:    secure, Responses: responses(200, freeDataResponse("备份清单", 200)),
	})
	post(t, "/admin/system/backups", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "创建手动备份",
		Description: "需 system:manage 权限。异步运行 pg_dump，可附带上传文件归档。",
		Security:    secure, Parameters: openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("SystemBackupCreateRequest", true, "备份选项"),
		Responses:   responses(202, freeDataResponse("备份任务", 202), 409, errorResponse("已有维护任务运行")),
	})
	post(t, "/admin/system/backups/import", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "导入备份",
		Description: "需 system:manage 权限。仅接受当前实例签名的 SQL 备份，最大 512MB。",
		Security:    secure, Parameters: openapi3.Parameters{csrfHeaderParam()},
		RequestBody: binaryBody("multipart/form-data", "备份文件，字段名 file"),
		Responses:   responses(201, freeDataResponse("导入的备份", 201), 400, errorResponse("签名、格式或大小无效")),
	})
	get(t, "/admin/system/backups/{filename}/download", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "下载备份",
		Description: "需 system:manage 权限。part=database 下载 SQL；part=uploads 下载配对上传归档。",
		Security:    secure,
		Parameters:  openapi3.Parameters{pathStrParam("filename", "数据库备份文件名"), queryStrParam("part", "database 或 uploads")},
		Responses:   responses(200, binaryResponse("数据库或上传归档附件"), 404, errorResponse("备份不存在")),
	})
	post(t, "/admin/system/backups/{filename}/restore", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "恢复数据库备份",
		Description: "需 system:manage 权限。仅恢复数据库；确认文本必须与文件名完全一致。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("filename", "数据库备份文件名"), csrfHeaderParam()},
		RequestBody: jsonBody("SystemBackupRestoreRequest", true, "恢复确认"),
		Responses:   responses(202, freeDataResponse("恢复任务", 202), 400, errorResponse("确认文本不匹配"), 409, errorResponse("已有维护任务运行")),
	})
	del(t, "/admin/system/backups/{filename}", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "删除备份",
		Description: "需 system:manage 权限。同步删除 SQL、清单和配对上传归档。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("filename", "数据库备份文件名"), csrfHeaderParam()},
		Responses: responses(204, noContentResponse("备份已删除"), 404, errorResponse("备份不存在")),
	})
	get(t, "/admin/system/tasks/{id}", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "备份任务状态",
		Description: "需 system:manage 权限。返回内存中的异步备份或恢复任务快照。",
		Security:    secure, Parameters: openapi3.Parameters{pathStrParam("id", "任务 UUID")},
		Responses: responses(200, freeDataResponse("备份任务", 200), 404, errorResponse("任务不存在")),
	})
	put(t, "/admin/system/backup-settings", &openapi3.Operation{
		Tags: []string{"系统"}, Summary: "更新自动备份设置",
		Description: "需 system:manage 权限。使用 UTC HH:mm 时间与按份数轮转策略。",
		Security:    secure, Parameters: openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("SystemBackupSettingsRequest", true, "自动备份设置"),
		Responses:   responses(200, freeDataResponse("自动备份设置", 200), 400, errorResponse("时间或保留份数无效")),
	})
}

func registerSystemSchemas(t *openapi3.T) {
	registerSchema(t, "SystemSQLRequest", openapi3.Schemas{
		"sql":               reqStr("SQL 文本"),
		"allow_multi":       optBool("是否允许多语句"),
		"confirm_dangerous": optBool("是否确认写入或结构变更风险"),
		"with_explain":      optBool("是否返回 EXPLAIN JSON"),
	}, "sql")
	registerSchema(t, "SystemExportRequest", openapi3.Schemas{
		"source":          strEnum("导出来源", "table", "query"),
		"schema":          optStr("表来源 schema"),
		"table":           optStr("表名"),
		"query":           optStr("单条只读查询"),
		"format":          strEnum("导出格式", "csv", "sql"),
		"include_columns": optBool("是否包含列名"),
	}, "source", "format")
	registerSchema(t, "SystemBackupCreateRequest", openapi3.Schemas{
		"include_uploads": optBool("是否附带上传目录归档"),
	})
	registerSchema(t, "SystemBackupRestoreRequest", openapi3.Schemas{
		"confirm_filename": reqStr("必须与 URL 中的备份文件名完全一致"),
	}, "confirm_filename")
	registerSchema(t, "SystemBackupSettingsRequest", openapi3.Schemas{
		"auto_enabled":    optBool("是否启用自动备份"),
		"time_utc":        reqStr("UTC HH:mm"),
		"retention_count": optInt("自动备份保留份数，1–365"),
		"include_uploads": optBool("自动备份是否附带上传目录"),
	}, "time_utc", "retention_count")
}
