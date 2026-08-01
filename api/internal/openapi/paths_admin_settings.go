package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminSettingsPaths 注册后台站点设置与操作日志接口。
func registerAdminSettingsPaths(t *openapi3.T) {
	// 站点设置按菜单子页拆成 7 组，每组独立 GET/PUT，schema 字段全 optional：
	// GET 返回该组全量字段，PUT 接收该组部分字段（指针表部分更新）。

	registerSchema(t, "GeneralSettings", openapi3.Schemas{
		"site_name":           optStr("站点名称"),
		"site_description":    optStr("站点描述"),
		"site_url":            optStr("站点 URL"),
		"admin_email":         optStr("管理员邮箱"),
		"posts_per_page":      optInt("每页文章数"),
		"comments_enabled":    optBool("是否开启评论"),
		"comments_moderation": optBool("评论是否需要审核"),
		"tech_stack":          optStr("技术栈"),
	})

	registerSchema(t, "AuthSettings", openapi3.Schemas{
		"google_login_enabled": optBool("是否启用 Google 登录"),
		"github_login_enabled": optBool("是否启用 GitHub 登录"),
	})

	registerSchema(t, "GithubSettings", openapi3.Schemas{
		"github_username": optStr("GitHub 用户名"),
		"github_token":    optStr("GitHub Token（敏感）"),
		"releases_repo":   optStr("更新日志仓库名（owner/repo 或 repo）"),
	})

	registerSchema(t, "ProfileSettings", openapi3.Schemas{
		"bio":              optStr("个人简介"),
		"footer_text":      optStr("页脚文案"),
		"avatar_url":       optStr("头像 URL"),
		"tagline":          optStr("标语"),
		"profile_role":     optStr("名片角色"),
		"profile_location": optStr("名片所在地"),
		"available_for":    optStr("可合作方向"),
		"skills_strong":    optStr("擅长技能"),
		"skills_learning":  optStr("正在学习"),
		"skills_interests": optStr("感兴趣方向"),
		"social_twitter":   optStr("Twitter"),
		"social_mastodon":  optStr("Mastodon"),
		"social_email":     optStr("邮箱"),
		"social_rss":       optStr("RSS"),
		"social_bilibili":  optStr("哔哩哔哩"),
	})

	registerSchema(t, "AboutSettings", openapi3.Schemas{
		"about_config": {Value: &openapi3.Schema{
			Type:        &openapi3.Types{openapi3.TypeObject},
			Description: "关于页区块版面配置（{sections:[{id,enabled,order,params}]}，null 表示未配置）",
		}},
	})

	registerSchema(t, "LlmSettings", openapi3.Schemas{
		"llm_api_key":   optStr("LLM API Key（敏感，OpenAI 协议兼容端点）"),
		"llm_api_url":   optStr("LLM API Base URL（如 https://api.openai.com/v1）"),
		"llm_model":     optStr("LLM 模型名（如 gpt-4o-mini）"),
		"llm_protocol":  optStr("LLM 协议（目前仅支持 openai）"),
	})

	registerSchema(t, "CodeRunnerSettings", openapi3.Schemas{
		"code_runner_enabled":          optBool("是否启用代码运行器"),
		"code_runner_max_cpu_cores":    optFloat("单次执行 CPU 上限（核数）"),
		"code_runner_max_memory_mb":    optInt64("单次执行内存上限（MB）"),
		"code_runner_max_timeout_secs": optInt64("单次执行超时上限（秒）"),
		"code_runner_max_output_bytes": optInt64("输出大小上限（字节）"),
		"code_runner_max_source_bytes": optInt64("源码大小上限（字节）"),
		"code_runner_allow_network":    optBool("是否允许网络（需作者+语言+全局三者取与）"),
		"code_runner_languages":        optStr("语言白名单（逗号分隔 canonical key，空=全部）"),
	})

	// ---- 分组 GET/PUT 路径 ----
	settingsGroups := []struct {
		path, schema, summary string
	}{
		{"/admin/settings/general", "GeneralSettings", "基础信息"},
		{"/admin/settings/auth", "AuthSettings", "第三方登录开关"},
		{"/admin/settings/github", "GithubSettings", "GitHub 资料"},
		{"/admin/settings/profile", "ProfileSettings", "关于博主内容"},
		{"/admin/settings/about", "AboutSettings", "关于页区块配置"},
		{"/admin/settings/llm", "LlmSettings", "LLM 配置"},
		{"/admin/settings/code-runner", "CodeRunnerSettings", "代码运行器"},
	}
	for _, g := range settingsGroups {
		g := g // capture
		get(t, g.path, &openapi3.Operation{
			Tags:    []string{"站点设置"},
			Summary: "获取" + g.summary,
			Description: "获取" + g.summary + "组站点设置。需 settings:view 权限。",
			Security:    securityAdmin(),
			Responses: responses(
				200, dataResponse(g.schema, g.summary+"设置", 200),
			),
		})
		put(t, g.path, &openapi3.Operation{
			Tags:        []string{"站点设置"},
			Summary:     "更新" + g.summary,
			Description: "部分更新" + g.summary + "组设置（指针字段，nil 不更新）。需 settings:update 权限。",
			Security:    securityAdmin(),
			Parameters:  openapi3.Parameters{csrfHeaderParam()},
			RequestBody: jsonBody(g.schema, false, "待更新字段（部分更新）"),
			Responses: responses(
				200, dataResponse(g.schema, "更新后的"+g.summary+"设置", 200),
			),
		})
	}

	// AuditLog：操作日志（domain 无 json tag，字段名为 PascalCase）
	registerSchema(t, "AuditLog", openapi3.Schemas{
		"ID":         optInt64("日志 ID"),
		"UserID":     optStr("操作用户 ID（UUID，可空）"),
		"Action":     reqStr("操作动作"),
		"Resource":   optStr("操作资源类型"),
		"ResourceID": optStr("操作资源 ID"),
		"Detail": {Value: &openapi3.Schema{
			Type:                 &openapi3.Types{openapi3.TypeObject},
			AdditionalProperties: openapi3.AdditionalProperties{Has: openapi3.Ptr(true)},
			Description:          "操作详情（动态字段）",
		}},
		"IPAddress": optStr("操作 IP"),
		"CreatedAt": optStr("操作时间（RFC3339）"),
	})

	// ---- GET /admin/logs ----
	get(t, "/admin/logs", &openapi3.Operation{
		Tags:        []string{"操作日志"},
		Summary:     "操作日志列表",
		Description: "分页查询操作日志。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pageParam(), limitParam(100)},
		Responses: responses(
			200, dataArrayResponse("AuditLog", "操作日志列表", 200, true),
		),
	})

	// ---- GET /admin/logs/user/{id} ----
	get(t, "/admin/logs/user/{id}", &openapi3.Operation{
		Tags:        []string{"操作日志"},
		Summary:     "用户操作日志",
		Description: "查询指定用户的操作日志。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "用户 ID（UUID）"), pageParam(), limitParam(100),
		},
		Responses: responses(
			200, dataArrayResponse("AuditLog", "用户操作日志列表", 200, true),
		),
	})
}
