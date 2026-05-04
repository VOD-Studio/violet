// Package request 提供统一的 HTTP 请求解析和验证辅助函数
// 避免在 handler 层重复编写解析和验证代码
package request

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-playground/validator/v10"
)

// DecodeAndValidate 解析 JSON 请求体并验证
// 如果解析或验证失败，返回错误
func DecodeAndValidate(r *http.Request, v *validator.Validate, req any) error {
	// 解析 JSON
	if err := json.NewDecoder(r.Body).Decode(req); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}

	// 验证结构体
	if err := v.Struct(req); err != nil {
		return err
	}

	return nil
}

// Decode 仅解析 JSON 请求体，不验证
func Decode(r *http.Request, req any) error {
	if err := json.NewDecoder(r.Body).Decode(req); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	return nil
}

// FormatValidationError 格式化验证错误为友好的错误消息映射
// 返回 map[字段名][]错误消息
func FormatValidationError(err error) map[string][]string {
	details := make(map[string][]string)

	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		for _, e := range validationErrors {
			field := e.Field()
			message := formatFieldError(e)
			details[field] = append(details[field], message)
		}
	}

	return details
}

// formatFieldError 格式化单个字段的验证错误
func formatFieldError(e validator.FieldError) string {
	switch e.Tag() {
	case "required":
		return "此字段为必填项"
	case "email":
		return "请输入有效的邮箱地址"
	case "min":
		return fmt.Sprintf("最少 %s 个字符", e.Param())
	case "max":
		return fmt.Sprintf("最多 %s 个字符", e.Param())
	case "len":
		return fmt.Sprintf("必须为 %s 个字符", e.Param())
	case "gte":
		return fmt.Sprintf("必须大于或等于 %s", e.Param())
	case "lte":
		return fmt.Sprintf("必须小于或等于 %s", e.Param())
	case "url":
		return "请输入有效的 URL"
	default:
		return fmt.Sprintf("验证失败: %s", e.Tag())
	}
}
