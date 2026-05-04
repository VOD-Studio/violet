// Package apierr 提供统一的应用错误类型定义
package apierr

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// AppError 应用错误基础类型
type AppError struct {
	// Code 错误代码（用于客户端识别错误类型）
	Code string
	// Message 错误消息（用户友好的错误描述）
	Message string
	// HTTPStatus HTTP 状态码
	HTTPStatus int
	// Err 原始错误（用于错误链追踪）
	Err error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

// Unwrap 实现 errors.Unwrap 接口，支持 errors.Is 和 errors.As
func (e *AppError) Unwrap() error {
	return e.Err
}

// 预定义错误类型

var (
	// ErrNotFound 资源未找到错误
	ErrNotFound = &AppError{
		Code:       "NOT_FOUND",
		Message:    "资源未找到",
		HTTPStatus: http.StatusNotFound,
	}

	// ErrUnauthorized 未授权错误
	ErrUnauthorized = &AppError{
		Code:       "UNAUTHORIZED",
		Message:    "未授权",
		HTTPStatus: http.StatusUnauthorized,
	}

	// ErrForbidden 禁止访问错误
	ErrForbidden = &AppError{
		Code:       "FORBIDDEN",
		Message:    "禁止访问",
		HTTPStatus: http.StatusForbidden,
	}

	// ErrValidation 验证错误
	ErrValidation = &AppError{
		Code:       "VALIDATION_ERROR",
		Message:    "参数验证失败",
		HTTPStatus: http.StatusBadRequest,
	}

	// ErrConflict 冲突错误
	ErrConflict = &AppError{
		Code:       "CONFLICT",
		Message:    "资源冲突",
		HTTPStatus: http.StatusConflict,
	}

	// ErrInternal 内部错误
	ErrInternal = &AppError{
		Code:       "INTERNAL_ERROR",
		Message:    "服务器内部错误",
		HTTPStatus: http.StatusInternalServerError,
	}
)

// 错误构造函数

// NotFound 创建未找到错误
func NotFound(resource string) *AppError {
	return &AppError{
		Code:       "NOT_FOUND",
		Message:    fmt.Sprintf("%s未找到", resource),
		HTTPStatus: http.StatusNotFound,
	}
}

// Unauthorized 创建未授权错误
func Unauthorized(message string) *AppError {
	return &AppError{
		Code:       "UNAUTHORIZED",
		Message:    message,
		HTTPStatus: http.StatusUnauthorized,
	}
}

// Forbidden 创建禁止访问错误
func Forbidden(message string) *AppError {
	return &AppError{
		Code:       "FORBIDDEN",
		Message:    message,
		HTTPStatus: http.StatusForbidden,
	}
}

// BadRequest 创建错误请求错误
func BadRequest(message string) *AppError {
	return &AppError{
		Code:       "BAD_REQUEST",
		Message:    message,
		HTTPStatus: http.StatusBadRequest,
	}
}

// Conflict 创建冲突错误
func Conflict(message string) *AppError {
	return &AppError{
		Code:       "CONFLICT",
		Message:    message,
		HTTPStatus: http.StatusConflict,
	}
}

// Wrap 包装错误，保留原始错误信息
func Wrap(err error, message string) *AppError {
	return &AppError{
		Code:       "INTERNAL_ERROR",
		Message:    message,
		HTTPStatus: http.StatusInternalServerError,
		Err:        err,
	}
}

// WrapWithCode 包装错误并指定错误代码
func WrapWithCode(err error, code, message string, status int) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		HTTPStatus: status,
		Err:        err,
	}
}

// 兼容旧的 APIError 类型

// APIError 旧的错误类型（保留以兼容现有代码）
type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

func (e *APIError) Error() string {
	return e.Message
}

// 旧的预定义错误（保留以兼容现有代码）
var (
	ErrNotFoundLegacy  = &APIError{Code: http.StatusNotFound, Message: "not found"}
	ErrUnauth          = &APIError{Code: http.StatusUnauthorized, Message: "unauthorized"}
	ErrForbiddenLegacy = &APIError{Code: http.StatusForbidden, Message: "forbidden"}
	ErrInternalLegacy  = &APIError{Code: http.StatusInternalServerError, Message: "internal server error"}
)

// ErrBadRequest 创建错误请求错误（旧版本）
func ErrBadRequest(detail string) *APIError {
	return &APIError{Code: http.StatusBadRequest, Message: "bad request", Detail: detail}
}

// RespondError 发送错误响应（旧版本）
func RespondError(w http.ResponseWriter, err *APIError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.Code)
	json.NewEncoder(w).Encode(err)
}
