package validator

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

// ValidationError 表示请求校验错误
type ValidationError struct {
	Fields []FieldError `json:"fields"`
}

// FieldError 表示单个字段错误
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e *ValidationError) Error() string {
	if len(e.Fields) == 0 {
		return "validation failed"
	}
	return e.Fields[0].Message
}

// ValidateRequest 校验任意结构体
// 返回格式化的校验错误，nil 表示校验通过
func ValidateRequest(req any) *ValidationError {
	if err := validate.Struct(req); err != nil {
		return formatErrors(err)
	}
	return nil
}

// ParseAndValidate 解析 JSON 并校验
// 从 r.Body 读取 JSON，解析到 req，然后校验
func ParseAndValidate(r *http.Request, req any) error {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return &ValidationError{
			Fields: []FieldError{{Field: "body", Message: "failed to read request body"}},
		}
	}
	defer r.Body.Close()

	if err := json.Unmarshal(body, req); err != nil {
		return &ValidationError{
			Fields: []FieldError{{Field: "body", Message: "invalid JSON format"}},
		}
	}

	return ValidateRequest(req)
}

// formatErrors 将 validator 错误转换为格式化的 ValidationError
func formatErrors(err error) *ValidationError {
	validationErrors, ok := err.(validator.ValidationErrors)
	if !ok {
		return &ValidationError{
			Fields: []FieldError{{Field: "", Message: err.Error()}},
		}
	}

	fields := make([]FieldError, 0, len(validationErrors))
	for _, fe := range validationErrors {
		fields = append(fields, FieldError{
			Field:   fe.Field(),
			Message: formatFieldError(fe),
		})
	}
	return &ValidationError{Fields: fields}
}

// formatFieldError 格式化单个字段错误信息
func formatFieldError(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "此字段为必填项"
	case "email":
		return "邮箱格式不正确"
	case "min":
		return "长度或值不能小于 " + fe.Param()
	case "max":
		return "长度或值不能大于 " + fe.Param()
	case "len":
		return "长度必须为 " + fe.Param()
	case "gte":
		return "值必须大于或等于 " + fe.Param()
	case "lte":
		return "值必须小于或等于 " + fe.Param()
	case "gt":
		return "值必须大于 " + fe.Param()
	case "lt":
		return "值必须小于 " + fe.Param()
	case "oneof":
		return "值必须是以下之一: " + fe.Param()
	case "url":
		return "URL 格式不正确"
	case "uuid":
		return "UUID 格式不正确"
	case "alphanum":
		return "只能包含字母和数字"
	case "alpha":
		return "只能包含字母"
	case "numeric":
		return "只能是数字"
	default:
		return "校验失败: " + fe.Tag()
	}
}