package openapi

import "github.com/getkin/kin-openapi/openapi3"

// ============================================================
// 字段（SchemaRef）构建 helper
//
// OpenAPI schema 里每个属性都是 *SchemaRef。这些 helper 简化常见类型
// 的构造，避免每个调用点都手写一大坨 &openapi3.SchemaRef{Value: ...}。
// ============================================================

// reqStr 必填/普通字符串字段（required 与否由调用 registerSchema 的 required 列表决定）
func reqStr(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:        &openapi3.Types{openapi3.TypeString},
		Description: desc,
	}}
}

// optStr 可选字符串字段（OpenAPI 层面 schema 与 reqStr 相同，区分仅为可读性）
func optStr(desc string) *openapi3.SchemaRef {
	return reqStr(desc)
}

func nullableStr(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:        &openapi3.Types{openapi3.TypeString},
		Description: desc,
		Nullable:    true,
	}}
}

// strEnum 字符串枚举字段
func strEnum(desc string, vals ...string) *openapi3.SchemaRef {
	enums := make([]any, len(vals))
	for i, v := range vals {
		enums[i] = v
	}
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:        &openapi3.Types{openapi3.TypeString},
		Description: desc,
		Enum:        enums,
	}}
}

// optInt 普通整数字段（int，无 format）
func optInt(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{openapi3.TypeInteger}, Description: desc,
	}}
}

// optInt64 int64 整数字段
func optInt64(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{openapi3.TypeInteger}, Format: "int64", Description: desc,
	}}
}

// optInt32 int32 整数字段
func optInt32(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{openapi3.TypeInteger}, Format: "int32", Description: desc,
	}}
}

// optBool bool 字段
func optBool(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{openapi3.TypeBoolean}, Description: desc,
	}}
}

// optFloat 浮点数字段
func optFloat(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{openapi3.TypeNumber}, Format: "double", Description: desc,
	}}
}

// strArray 字符串数组字段
func strArray(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:        &openapi3.Types{openapi3.TypeArray},
		Description: desc,
		Items:       &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeString}}},
	}}
}

// intArray 整数数组字段
func intArray(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:        &openapi3.Types{openapi3.TypeArray},
		Description: desc,
		Items:       &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{openapi3.TypeInteger}}},
	}}
}

// refArray 引用命名 schema 的数组字段（items 指向 #/components/schemas/<name>）
func refArray(desc, schemaName string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:        &openapi3.Types{openapi3.TypeArray},
		Description: desc,
		Items:       &openapi3.SchemaRef{Ref: "#/components/schemas/" + schemaName},
	}}
}

// optRef 引用命名 schema 的可选对象字段（指向 #/components/schemas/<name>）。
func optRef(desc, schemaName string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{
		Ref:   "#/components/schemas/" + schemaName,
		Value: &openapi3.Schema{Description: desc},
	}
}

// ============================================================
// 组件注册 helper
// ============================================================

// registerSchema 在 Components 注册一个命名 object schema。
// fields 为属性表，required 为必填字段名列表。
func registerSchema(t *openapi3.T, name string, fields openapi3.Schemas, required ...string) {
	t.Components.Schemas[name] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{openapi3.TypeObject}, Properties: fields, Required: required,
	}}
}

// ============================================================
// 数值辅助
// ============================================================

func float64Ptr(i int) *float64 {
	f := float64(i)
	return &f
}

// strPtr 把 string 转为 *string（用于 *string 类型字段，如 Response.Description）
func strPtr(s string) *string {
	return &s
}

// ============================================================
// Path 注册 helper
// ============================================================

// setOp 把一个 Operation 挂到指定 path 的指定方法上。
// 重复对同一 path 调用会合并到同一个 PathItem（避免 Paths.Set 的覆盖问题）。
func setOp(t *openapi3.T, path, method string, op *openapi3.Operation) {
	item := t.Paths.Find(path)
	if item == nil {
		item = &openapi3.PathItem{}
	}
	switch method {
	case "GET":
		item.Get = op
	case "POST":
		item.Post = op
	case "PUT":
		item.Put = op
	case "PATCH":
		item.Patch = op
	case "DELETE":
		item.Delete = op
	}
	t.Paths.Set(path, item)
}

// getOp/POST/PUT/PATCH/DELETE 便捷封装
func get(t *openapi3.T, path string, op *openapi3.Operation)   { setOp(t, path, "GET", op) }
func post(t *openapi3.T, path string, op *openapi3.Operation)  { setOp(t, path, "POST", op) }
func put(t *openapi3.T, path string, op *openapi3.Operation)   { setOp(t, path, "PUT", op) }
func patch(t *openapi3.T, path string, op *openapi3.Operation) { setOp(t, path, "PATCH", op) }
func del(t *openapi3.T, path string, op *openapi3.Operation)   { setOp(t, path, "DELETE", op) }
