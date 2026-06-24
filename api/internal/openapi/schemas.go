package openapi

import "github.com/getkin/kin-openapi/openapi3"

// 公共组件 schema 名称常量。
const (
	compMeta          = "Meta"
	compPagination    = "Pagination"
	compMessage       = "MessageResponse"
	compErrorResponse = "ErrorResponse"
)

// registerCommonSchemas 注册公共组件 schema。
//
// 响应统一信封（response.Envelope）：{"data": <T>, "meta": {...}}。
// OpenAPI 3.0 不支持泛型，Envelope 不建模为单一组件；各接口的 responses
// 用内联 object 描述 data + meta，data 通过 $ref 指向具体 schema，
// 具体类型在响应 description 里说明。
func registerCommonSchemas(t *openapi3.T) {
	c := t.Components

	// Meta：消息或分页元数据
	c.Schemas[compMeta] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{openapi3.TypeObject},
		Properties: openapi3.Schemas{
			"message":    optStr("提示消息"),
			"pagination": {Ref: "#/components/schemas/" + compPagination},
		},
	}}

	// Pagination：offset（page/limit/total/total_pages）与 cursor（has_more/next_cursor）合并字段
	c.Schemas[compPagination] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{openapi3.TypeObject},
		Properties: openapi3.Schemas{
			"page":        optInt("当前页码（offset 模式）"),
			"limit":       optInt("每页条数"),
			"total":       optInt64("总记录数（offset 模式）"),
			"total_pages": optInt("总页数（offset 模式）"),
			"has_more":    optBool("是否还有下一页（cursor 模式）"),
			"next_cursor": optStr("下一页游标（cursor 模式）"),
		},
	}}

	// MessageResponse：{"data": null, "meta": {"message": "..."}}
	c.Schemas[compMessage] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{openapi3.TypeObject},
		Properties: openapi3.Schemas{
			"data": {Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeNull}}},
			"meta": {Ref: "#/components/schemas/" + compMeta},
		},
	}}

	// ErrorResponse：{"error","message","request_id","details"}
	c.Schemas[compErrorResponse] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{openapi3.TypeObject},
		Properties: openapi3.Schemas{
			"error":      reqStr("错误代码"),
			"message":    reqStr("错误描述"),
			"request_id": optStr("请求追踪 ID"),
			"details": {Value: &openapi3.Schema{
				Type:                 &openapi3.Types{openapi3.TypeObject},
				AdditionalProperties: openapi3.AdditionalProperties{Has: openapi3.BoolPtr(true)},
				Description:          "字段级校验错误详情",
			}},
		},
		Required: []string{"error", "message"},
	}}
}

// ============================================================
// query 参数工厂
// ============================================================

// pageParam offset 模式分页 page 参数（默认 1）
func pageParam() *openapi3.ParameterRef {
	return &openapi3.ParameterRef{Value: &openapi3.Parameter{
		Name: "page", In: openapi3.ParameterInQuery,
		Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
			Type: &openapi3.Types{openapi3.TypeInteger}, Default: 1,
		}},
		Description: "页码，默认 1",
	}}
}

// limitParam offset 模式分页 limit 参数（默认 20，max 为上限）
func limitParam(max int) *openapi3.ParameterRef {
	return &openapi3.ParameterRef{Value: &openapi3.Parameter{
		Name: "limit", In: openapi3.ParameterInQuery,
		Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
			Type: &openapi3.Types{openapi3.TypeInteger}, Default: 20, Max: float64Ptr(max),
		}},
		Description: "每页条数，默认 20",
	}}
}

// queryStrParam 字符串 query 参数
func queryStrParam(name, desc string) *openapi3.ParameterRef {
	return &openapi3.ParameterRef{Value: &openapi3.Parameter{
		Name: name, In: openapi3.ParameterInQuery,
		Schema:      &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeString}}},
		Description: desc,
	}}
}

// pathStrParam 字符串 path 参数（required 自动为 true）
func pathStrParam(name, desc string) *openapi3.ParameterRef {
	return &openapi3.ParameterRef{Value: &openapi3.Parameter{
		Name: name, In: openapi3.ParameterInPath, Required: true,
		Schema:      &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeString}}},
		Description: desc,
	}}
}

// pathIntParam 整数 path 参数
func pathIntParam(name, desc string) *openapi3.ParameterRef {
	return &openapi3.ParameterRef{Value: &openapi3.Parameter{
		Name: name, In: openapi3.ParameterInPath, Required: true,
		Schema:      &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeInteger}}},
		Description: desc,
	}}
}

// ============================================================
// 响应/请求体工厂
// ============================================================

// dataResponse 包装 data schema 到信封响应（{data: $ref, meta}）
func dataResponse(dataSchemaName, desc string, status int) *openapi3.ResponseRef {
	return &openapi3.ResponseRef{Value: &openapi3.Response{
		Description: strPtr(desc),
		Content: openapi3.Content{
			"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
				Type: &openapi3.Types{openapi3.TypeObject},
				Properties: openapi3.Schemas{
					"data": {Ref: "#/components/schemas/" + dataSchemaName},
					"meta": {Ref: "#/components/schemas/" + compMeta},
				},
			}}},
		},
	}}
}

// dataArrayResponse 包装 data 为命名 schema 数组的信封响应
func dataArrayResponse(dataSchemaName, desc string, status int, paged bool) *openapi3.ResponseRef {
	dataField := &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:  &openapi3.Types{openapi3.TypeArray},
		Items: &openapi3.SchemaRef{Ref: "#/components/schemas/" + dataSchemaName},
	}}
	props := openapi3.Schemas{"data": dataField}
	if paged {
		props["meta"] = &openapi3.SchemaRef{Ref: "#/components/schemas/" + compMeta}
	}
	return &openapi3.ResponseRef{Value: &openapi3.Response{
		Description: strPtr(desc),
		Content: openapi3.Content{
			"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
				Type: &openapi3.Types{openapi3.TypeObject}, Properties: props,
			}}},
		},
	}}
}

// messageResponse 消息响应（data:null + meta.message）
func messageResponse(desc string) *openapi3.ResponseRef {
	return &openapi3.ResponseRef{Value: &openapi3.Response{
		Description: strPtr(desc),
		Content: openapi3.Content{
			"application/json": {Schema: &openapi3.SchemaRef{Ref: "#/components/schemas/" + compMessage}},
		},
	}}
}

// errorResponse 错误响应
func errorResponse(desc string) *openapi3.ResponseRef {
	return &openapi3.ResponseRef{Value: &openapi3.Response{
		Description: strPtr(desc),
		Content: openapi3.Content{
			"application/json": {Schema: &openapi3.SchemaRef{Ref: "#/components/schemas/" + compErrorResponse}},
		},
	}}
}

// noContentResponse 204 无内容响应
func noContentResponse(desc string) *openapi3.ResponseRef {
	return &openapi3.ResponseRef{Value: &openapi3.Response{Description: strPtr(desc)}}
}

// jsonBody 构建请求体（application/json）
func jsonBody(schemaName string, required bool, desc string) *openapi3.RequestBodyRef {
	return &openapi3.RequestBodyRef{Value: &openapi3.RequestBody{
		Description: desc,
		Required:    required,
		Content: openapi3.Content{
			"application/json": {Schema: &openapi3.SchemaRef{Ref: "#/components/schemas/" + schemaName}},
		},
	}}
}

// binaryBody 构建二进制/文件上传请求体（multipart 或原始二进制）
func binaryBody(contentType, desc string) *openapi3.RequestBodyRef {
	return &openapi3.RequestBodyRef{Value: &openapi3.RequestBody{
		Description: desc,
		Required:    true,
		Content: openapi3.Content{
			contentType: {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
				Type: &openapi3.Types{openapi3.TypeString}, Format: "binary",
			}}},
		},
	}}
}
