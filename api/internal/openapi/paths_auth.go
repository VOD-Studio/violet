package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAuthPaths 注册认证接口（/auth/*）。
func registerAuthPaths(t *openapi3.T) {
	// ---- 请求体 schema ----
	registerSchema(t, "RegisterRequest", openapi3.Schemas{
		"email":    reqStr("邮箱"),
		"username": reqStr("用户名（3-32 字符）"),
		"password": reqStr("密码（至少 8 位）"),
	}, "email", "username", "password")

	registerSchema(t, "VerifyEmailRequest", openapi3.Schemas{
		"email": reqStr("邮箱"),
		"code":  reqStr("验证码"),
	}, "email", "code")

	registerSchema(t, "LoginRequest", openapi3.Schemas{
		"email":    reqStr("邮箱"),
		"password": reqStr("密码"),
	}, "email", "password")

	registerSchema(t, "ForgotPasswordRequest", openapi3.Schemas{
		"email": reqStr("邮箱"),
	}, "email")

	registerSchema(t, "ResetPasswordRequest", openapi3.Schemas{
		"email":        reqStr("邮箱"),
		"code":         reqStr("验证码"),
		"new_password": reqStr("新密码（至少 8 位）"),
	}, "email", "code", "new_password")

	registerSchema(t, "UpdateProfileRequest", openapi3.Schemas{
		"username":   optStr("用户名（3-32 字符）"),
		"bio":        optStr("个人简介（最多 500 字）"),
		"avatar_url": optStr("头像 URL（最多 2048 字符）"),
	})

	registerSchema(t, "ChangePasswordRequest", openapi3.Schemas{
		"old_password": reqStr("原密码"),
		"new_password": reqStr("新密码（至少 8 位）"),
	}, "old_password", "new_password")

	// ---- 响应 schema ----
	// UserDTO：当前用户信息（auth/me）
	registerSchema(t, "UserDTO", openapi3.Schemas{
		"id":             reqStr("用户 ID（UUID）"),
		"username":       reqStr("用户名"),
		"email":          reqStr("邮箱"),
		"avatar_url":     optStr("头像 URL"),
		"bio":            optStr("个人简介"),
		"role":           strEnum("角色", "user", "admin", "superadmin"),
		"email_verified": optBool("邮箱是否已验证"),
		"is_active":      optBool("是否启用"),
		"created_at":     optStr("创建时间（RFC3339）"),
		"permissions":    strArray("权限代码列表"),
	})

	// LoginResponse：login/google/github 响应的 data（session id 与 csrf 走 cookie，不在 body）
	registerSchema(t, "LoginResponse", openapi3.Schemas{
		"user_id": reqStr("用户 ID（UUID）"),
	})

	// SessionResponse：/auth/session 响应的 data（SSR 探活，只读不续期）
	registerSchema(t, "SessionResponse", openapi3.Schemas{
		"user_id":                reqStr("用户 ID（UUID）"),
		"role":                   strEnum("角色", "user", "admin", "superadmin"),
		"email":                  reqStr("邮箱"),
		"is_root": optBool("是否 root 用户"),
	})

	// ProfileResponse：auth/profile 响应的 data
	registerSchema(t, "ProfileResponse", openapi3.Schemas{
		"id":         reqStr("用户 ID（UUID）"),
		"username":   reqStr("用户名"),
		"email":      reqStr("邮箱"),
		"avatar_url": optStr("头像 URL"),
		"bio":        optStr("个人简介"),
		"role":       strEnum("角色", "user", "admin", "superadmin"),
	})

	// CSRFToken：auth/csrf-token 响应的 data
	registerSchema(t, "CSRFToken", openapi3.Schemas{
		"csrf_token": reqStr("CSRF Token（64 字符 hex）"),
	})

	// ---- GET /auth/csrf-token ----
	t.Paths.Set("/auth/csrf-token", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"认证"},
			Summary:     "获取 CSRF Token",
			Description: "返回 CSRF Token，并设置 violet_csrf cookie（JS 可读）。首次访问需先调用此端点拿到 cookie 才能 login。",
			Responses: responses(
				200, dataResponse("CSRFToken", "CSRF Token", 200),
			),
		},
	})

	// ---- POST /auth/register ----
	t.Paths.Set("/auth/register", &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"认证"},
			Summary:     "注册",
			Description: "注册新用户并发送验证邮件。受认证限流保护。",
			Parameters:  openapi3.Parameters{csrfHeaderParam()},
			RequestBody: jsonBody("RegisterRequest", true, "注册信息"),
			Responses: responses(
				201, messageResponse("注册成功，请查收验证邮件"),
				400, errorResponse("请求参数错误"),
			),
		},
	})

	// ---- POST /auth/verify-email ----
	t.Paths.Set("/auth/verify-email", &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"认证"},
			Summary:     "邮箱验证",
			Description: "校验邮箱验证码。受认证限流保护。",
			Parameters:  openapi3.Parameters{csrfHeaderParam()},
			RequestBody: jsonBody("VerifyEmailRequest", true, "邮箱与验证码"),
			Responses: responses(
				200, messageResponse("邮箱验证成功"),
				400, errorResponse("验证码错误"),
			),
		},
	})

	// ---- POST /auth/login ----
	t.Paths.Set("/auth/login", &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"认证"},
			Summary:     "登录",
			Description: "校验凭证并下发 session/CSRF cookie（HttpOnly）。受认证限流保护。",
			Parameters:  openapi3.Parameters{csrfHeaderParam()},
			RequestBody: jsonBody("LoginRequest", true, "登录凭证"),
			Responses: responses(
				200, dataResponse("LoginResponse", "登录用户 ID（session/csrf 走 cookie，不在 body）", 200),
				401, errorResponse("凭证错误"),
			),
		},
	})

	// ---- GET /auth/session（登录，只读）----
	t.Paths.Set("/auth/session", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"认证"},
			Summary:     "SSR 登录态探活",
			Description: "只读校验当前 session，返回用户身份。不续期、不写 cookie（命门不变量）。",
			Security:    securityCookie(),
			Responses: responses(
				200, dataResponse("SessionResponse", "当前登录用户身份", 200),
				401, errorResponse("未登录"),
			),
		},
	})

	// ---- POST /auth/forgot-password ----
	t.Paths.Set("/auth/forgot-password", &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"认证"},
			Summary:     "忘记密码",
			Description: "发送密码重置码到邮箱（邮箱不存在也返回成功，防探测）。受认证限流保护。",
			Parameters:  openapi3.Parameters{csrfHeaderParam()},
			RequestBody: jsonBody("ForgotPasswordRequest", true, "注册邮箱"),
			Responses: responses(
				200, messageResponse("如果该邮箱已注册，重置码已发送"),
			),
		},
	})

	// ---- POST /auth/reset-password ----
	t.Paths.Set("/auth/reset-password", &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"认证"},
			Summary:     "重置密码",
			Description: "用验证码重置密码。受认证限流保护。",
			Parameters:  openapi3.Parameters{csrfHeaderParam()},
			RequestBody: jsonBody("ResetPasswordRequest", true, "邮箱、验证码、新密码"),
			Responses: responses(
				200, messageResponse("密码已重置"),
				400, errorResponse("验证码错误"),
			),
		},
	})

	// ---- POST /auth/logout（登录）----
	t.Paths.Set("/auth/logout", &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"认证"},
			Summary:     "登出",
			Description: "登出当前设备并清除 session/CSRF cookie。",
			Security:    securityCookie(),
			Parameters:  openapi3.Parameters{csrfHeaderParam()},
			Responses: responses(
				200, messageResponse("已登出"),
			),
		},
	})

	// ---- GET /auth/me（登录）----
	t.Paths.Set("/auth/me", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:     []string{"认证"},
			Summary:  "获取当前用户信息",
			Security: securityCookie(),
			Responses: responses(
				200, dataResponse("UserDTO", "当前用户信息", 200),
				401, errorResponse("未登录"),
			),
		},
	})

	// ---- PATCH /auth/profile（登录）----
	t.Paths.Set("/auth/profile", &openapi3.PathItem{
		Patch: &openapi3.Operation{
			Tags:        []string{"认证"},
			Summary:     "更新个人资料",
			Description: "更新头像、简介等个人资料。",
			Security:    securityCookie(),
			Parameters:  openapi3.Parameters{csrfHeaderParam()},
			RequestBody: jsonBody("UpdateProfileRequest", true, "待更新字段"),
			Responses: responses(
				200, dataResponse("ProfileResponse", "更新后的用户资料", 200),
				401, errorResponse("未登录"),
			),
		},
	})

	// ---- PATCH /auth/password（登录）----
	t.Paths.Set("/auth/password", &openapi3.PathItem{
		Patch: &openapi3.Operation{
			Tags:        []string{"认证"},
			Summary:     "修改密码",
			Description: "修改密码并吊销该用户全部 session（全部设备需重新登录）。",
			Security:    securityCookie(),
			Parameters:  openapi3.Parameters{csrfHeaderParam()},
			RequestBody: jsonBody("ChangePasswordRequest", true, "原密码与新密码"),
			Responses: responses(
				200, messageResponse("密码已修改，请重新登录"),
				401, errorResponse("原密码错误"),
			),
		},
	})
}
