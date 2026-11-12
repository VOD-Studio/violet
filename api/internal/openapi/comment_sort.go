package openapi

import "github.com/getkin/kin-openapi/openapi3"

func commentSortParam() *openapi3.ParameterRef {
	parameter := queryStrParam("sort", "顶层评论排序：latest（默认）或 hot（总回应数）；并列按 created_at DESC,id DESC")
	parameter.Value.Schema.Value.Enum = []any{"latest", "hot"}
	parameter.Value.Schema.Value.Default = "latest"
	return parameter
}
