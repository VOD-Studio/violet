package openapi

import "github.com/getkin/kin-openapi/openapi3"

const (
	secCookieAuth = "cookieAuth"
	secBotToken   = "botTokenAuth"
)

// registerSecuritySchemes 注册两种互不相通的凭据形态：
// cookieAuth 是浏览器登录态（opaque session，HttpOnly cookie + CSRF 配对），
// botTokenAuth 是外部 bot 的 Bearer token（无 cookie，因而不参与 CSRF）。
func registerSecuritySchemes(t *openapi3.T) {
	t.Components.SecuritySchemes[secCookieAuth] = &openapi3.SecuritySchemeRef{Value: &openapi3.SecurityScheme{
		Type:        "apiKey",
		In:          "cookie",
		Name:        "violet_session",
		Description: "登录后服务端下发的 opaque session cookie（HttpOnly）。登录接口会自动设置。",
	}}
	t.Components.SecuritySchemes[secBotToken] = &openapi3.SecuritySchemeRef{Value: &openapi3.SecurityScheme{
		Type:        "http",
		Scheme:      "bearer",
		Description: "聊天 Bot 的 API token（violet_bot_ 前缀），经 Authorization: Bearer 传递。明文仅在创建或重置时返回一次。",
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

// securityBot 返回 Bot API 的鉴权要求：Bearer bot token，不走 session 与 CSRF。
func securityBot() *openapi3.SecurityRequirements {
	sr := openapi3.SecurityRequirements{{secBotToken: {}}}
	return &sr
}

// csrfHeaderParam 构建非 GET 写操作所需的 X-CSRF-Token 头参数
func csrfHeaderParam() *openapi3.ParameterRef {
	return &openapi3.ParameterRef{Value: &openapi3.Parameter{
		Name: "X-CSRF-Token", In: openapi3.ParameterInHeader, Required: true,
		Schema:      &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeString}}},
		Description: "CSRF Token，所有非 GET 写操作必需。通过 GET /auth/csrf-token 获取，与 violet_csrf cookie 配套。",
	}}
}
