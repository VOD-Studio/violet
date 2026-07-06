package openapi

import "github.com/getkin/kin-openapi/openapi3"

const secCookieAuth = "cookieAuth"

// registerSecuritySchemes 注册 cookieAuth scheme（opaque session id 走 HttpOnly cookie）。
func registerSecuritySchemes(t *openapi3.T) {
	t.Components.SecuritySchemes[secCookieAuth] = &openapi3.SecuritySchemeRef{Value: &openapi3.SecurityScheme{
		Type:        "apiKey",
		In:          "cookie",
		Name:        "mimo_session",
		Description: "登录后服务端下发的 opaque session cookie（HttpOnly）。登录接口会自动设置。",
	}}
}

// securityCookie 返回 cookieAuth 安全要求（用于登录态接口）。
// 返回 *SecurityRequirements 以匹配 Operation.Security 字段类型。
func securityCookie() *openapi3.SecurityRequirements {
	sr := openapi3.SecurityRequirements{
		{secCookieAuth: {}},
	}
	return &sr
}

// securityAdmin 返回管理员鉴权要求（cookieAuth + 需管理员角色）。
// OpenAPI security scheme 无法表达角色层级，管理员要求在 Operation.Description 中额外说明。
func securityAdmin() *openapi3.SecurityRequirements {
	return securityCookie()
}

// csrfHeaderParam 构建非 GET 写操作所需的 X-CSRF-Token 头参数
func csrfHeaderParam() *openapi3.ParameterRef {
	return &openapi3.ParameterRef{Value: &openapi3.Parameter{
		Name: "X-CSRF-Token", In: openapi3.ParameterInHeader, Required: true,
		Schema:      &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeString}}},
		Description: "CSRF Token，所有非 GET 写操作必需。通过 GET /auth/csrf-token 获取，与 mimo_csrf cookie 配套。",
	}}
}
