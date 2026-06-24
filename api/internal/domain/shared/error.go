package shared

import (
	"errors"
	"fmt"
)

// ErrorCode 错误码类型（字符串常量，便于客户端识别）
//
// 命名规范：DOMAIN_REASON，全大写下划线分隔，如：
//   - USER_NOT_FOUND
//   - AUTH_INVALID_CREDENTIALS
//   - POST_SLUG_CONFLICT
type ErrorCode string

// 错误码常量（领域层只定义码，不感知 HTTP）
const (
	CodeNotFound     ErrorCode = "NOT_FOUND"
	CodeBadRequest   ErrorCode = "BAD_REQUEST"
	CodeUnauthorized ErrorCode = "UNAUTHORIZED"
	CodeForbidden    ErrorCode = "FORBIDDEN"
	CodeConflict     ErrorCode = "CONFLICT"
	CodeValidation   ErrorCode = "VALIDATION_ERROR"
	CodeInternal     ErrorCode = "INTERNAL_ERROR"
)

// DomainError 领域错误，统一后端错误表达
//
// 设计目标：收敛散落在 service 中的 sentinel error，由 interfaces 层的错误中间件
// 统一翻译为 HTTP 响应。
//
// 字段说明：
//   - Code: 机器可读错误码（客户端据此分支处理）
//   - Message: 用户友好的错误描述（可直接展示）
//   - Err: 包装的底层错误（用于日志与错误链追踪）
//
// 领域层不感知 HTTP：状态码由 interfaces 层按 Code 翻译（见 response/httpStatusForCode）。
type DomainError struct {
	Code    ErrorCode
	Message string
	Err     error
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

// NewError 创建领域错误（仅错误码 + 消息，不携带 HTTP 语义）
func NewError(code, message string) *DomainError {
	return &DomainError{
		Code:    ErrorCode(code),
		Message: message,
	}
}

// ============================================================
// 便捷构造函数（按错误码分类；HTTP 状态由接口层翻译）
// ============================================================

// NotFound 资源未找到错误
func NotFound(resource string) *DomainError {
	return NewError(string(CodeNotFound), fmt.Sprintf("%s不存在", resource))
}

// BadRequest 参数错误
func BadRequest(message string) *DomainError {
	return NewError(string(CodeBadRequest), message)
}

// Unauthorized 未认证
func Unauthorized(message string) *DomainError {
	if message == "" {
		message = "未授权"
	}
	return NewError(string(CodeUnauthorized), message)
}

// Forbidden 无权限
func Forbidden(message string) *DomainError {
	if message == "" {
		message = "禁止访问"
	}
	return NewError(string(CodeForbidden), message)
}

// Conflict 资源冲突，如重复注册、slug 已存在
func Conflict(message string) *DomainError {
	return NewError(string(CodeConflict), message)
}

// Validation 参数校验失败
func Validation(message string) *DomainError {
	return NewError(string(CodeValidation), message)
}

// Internal 内部错误，通常包装基础设施异常
func Internal(message string, err error) *DomainError {
	return NewError(string(CodeInternal), message).WithErr(err)
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
