package shared

import (
	"errors"
	"fmt"
	"net/http"
)

// ErrorCode 错误码类型（字符串常量，便于客户端识别）
//
// 命名规范：DOMAIN_REASON，全大写下划线分隔，如：
//   - USER_NOT_FOUND
//   - AUTH_INVALID_CREDENTIALS
//   - POST_SLUG_CONFLICT
type ErrorCode string

// DomainError 领域错误，统一后端错误表达
//
// 设计目标：收敛当前散落在 ~10 个 service 文件中的 sentinel error
// 和 handler 内的 switch 翻译，由 interfaces 层的错误中间件统一翻译为 HTTP 响应。
//
// 字段说明：
//   - Code: 机器可读错误码（客户端据此分支处理）
//   - Message: 用户友好的错误描述（可直接展示）
//   - HTTPStatus: 建议 HTTP 状态码（错误中间件使用；领域层不感知时设为 0）
//   - Err: 包装的底层错误（用于日志与错误链追踪）
//
// 用法：
//
//	return shared.NewError("USER_NOT_FOUND", "用户不存在", http.StatusNotFound)
//	return shared.NotFound("用户").WithErr(dbErr)  // 便捷构造 + 包装
type DomainError struct {
	Code       ErrorCode
	Message    string
	HTTPStatus int
	Err        error
}

// Error 实现 error 接口
func (e *DomainError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap 支持 errors.Is / errors.As 错误链
func (e *DomainError) Unwrap() error { return e.Err }

// WithErr 包装底层错误，保留原错误用于日志追踪
func (e *DomainError) WithErr(err error) *DomainError {
	e.Err = err
	return e
}

// WithMessage 覆盖默认消息
func (e *DomainError) WithMessage(msg string) *DomainError {
	e.Message = msg
	return e
}

// NewError 创建领域错误
//
// httpStatus 为 0 表示领域层不指定 HTTP 状态，由错误中间件按 Code 兜底翻译。
func NewError(code, message string, httpStatus int) *DomainError {
	return &DomainError{
		Code:       ErrorCode(code),
		Message:    message,
		HTTPStatus: httpStatus,
	}
}

// ============================================================
// 便捷构造函数（按 HTTP 语义分类）
// ============================================================

// NotFound 资源未找到错误（404）
func NotFound(resource string) *DomainError {
	return NewError("NOT_FOUND", fmt.Sprintf("%s不存在", resource), http.StatusNotFound)
}

// BadRequest 参数错误（400）
func BadRequest(message string) *DomainError {
	return NewError("BAD_REQUEST", message, http.StatusBadRequest)
}

// Unauthorized 未认证（401）
func Unauthorized(message string) *DomainError {
	if message == "" {
		message = "未授权"
	}
	return NewError("UNAUTHORIZED", message, http.StatusUnauthorized)
}

// Forbidden 无权限（403）
func Forbidden(message string) *DomainError {
	if message == "" {
		message = "禁止访问"
	}
	return NewError("FORBIDDEN", message, http.StatusForbidden)
}

// Conflict 资源冲突（409），如重复注册、slug 已存在
func Conflict(message string) *DomainError {
	return NewError("CONFLICT", message, http.StatusConflict)
}

// Validation 参数校验失败（422）
func Validation(message string) *DomainError {
	return NewError("VALIDATION_ERROR", message, http.StatusUnprocessableEntity)
}

// Internal 内部错误（500），通常包装基础设施异常
func Internal(message string, err error) *DomainError {
	return NewError("INTERNAL_ERROR", message, http.StatusInternalServerError).WithErr(err)
}

// ============================================================
// 错误识别谓词（供应用层判断错误类型）
// ============================================================

// IsDomainError 判断 err 是否为 DomainError 且 Code 匹配
func IsDomainError(err error, code ErrorCode) bool {
	var de *DomainError
	if errors.As(err, &de) {
		return de.Code == code
	}
	return false
}

// AsDomainError 尝试提取 DomainError，非领域错误返回 nil
func AsDomainError(err error) *DomainError {
	var de *DomainError
	if errors.As(err, &de) {
		return de
	}
	return nil
}
