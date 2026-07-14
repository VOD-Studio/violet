// Package openapi 注册 auth 模块的 paths。
package openapi

import (
	"github.com/getkin/kin-openapi/openapi3"
)

// strType 返回 string 类型的 schema 简写。
func strType(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:        &openapi3.Types{openapi3.TypeString},
		Description: desc,
	}}
}

// jsonBody 构造 JSON request body。
func jsonBody(schema *openapi3.Schema) *openapi3.RequestBodyRef {
	return &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Required: true,
			Content: openapi3.Content{
				"application/json": &openapi3.MediaType{
					Schema: &openapi3.SchemaRef{Value: schema},
				},
			},
		},
	}
}

// objSchema 构造 object schema with properties。
func objSchema(props openapi3.Schemas) *openapi3.Schema {
	return &openapi3.Schema{
		Type:       &openapi3.Types{openapi3.TypeObject},
		Properties: props,
	}
}

// registerAuthPaths 注册 6 个 auth 端点。
func registerAuthPaths(paths *openapi3.Paths) {
	base := "/api/v1/auth"

	// POST /auth/captcha
	paths.Set(base+"/captcha", &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"auth"},
			Summary:     "发送验证码",
			RequestBody: jsonBody(objSchema(openapi3.Schemas{"phone": strType("手机号")})),
		},
	})

	// POST /auth/login/cellphone
	paths.Set(base+"/login/cellphone", &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:    []string{"auth"},
			Summary: "手机号登录",
			RequestBody: jsonBody(objSchema(openapi3.Schemas{
				"phone":   strType("手机号"),
				"captcha": strType("验证码"),
			})),
		},
	})

	// GET /auth/login/qrcode
	paths.Set(base+"/login/qrcode", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:    []string{"auth"},
			Summary: "获取登录二维码",
		},
	})

	// GET /auth/login/qrcode/check
	paths.Set(base+"/login/qrcode/check", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:    []string{"auth"},
			Summary: "轮询二维码登录状态",
			Parameters: openapi3.Parameters{
				{Value: &openapi3.Parameter{
					Name: "key", In: openapi3.ParameterInQuery, Required: true,
					Schema: strType(""),
				}},
			},
		},
	})

	// GET /auth/status
	paths.Set(base+"/status", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:    []string{"auth"},
			Summary: "查询登录态",
		},
	})

	// POST /auth/logout
	paths.Set(base+"/logout", &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:    []string{"auth"},
			Summary: "登出",
		},
	})
}
