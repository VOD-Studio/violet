// Package response 提供统一的 HTTP 响应辅助函数
// 避免在 handler 层重复编写响应代码
package response

import (
	"encoding/json"
	"net/http"
)

// ErrorResponse 错误响应结构
type ErrorResponse struct {
	/** Error 错误代码 */
	Error string `json:"error"`
	/** Message 错误消息 */
	Message string `json:"message"`
	/** Details 错误详情（可选，用于验证错误） */
	Details map[string][]string `json:"details,omitempty"`
}

// JSON 发送 JSON 响应
func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		// 如果编码失败，记录错误但不再尝试发送响应（状态码已写入）
		// 实际项目中应该使用日志库记录
		return
	}
}

// Success 发送成功响应（200 OK）
func Success(w http.ResponseWriter, data any) {
	JSON(w, http.StatusOK, data)
}

// Created 发送创建成功响应（201 Created）
func Created(w http.ResponseWriter, data any) {
	JSON(w, http.StatusCreated, data)
}

// NoContent 发送无内容响应（204 No Content）
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// Error 发送错误响应
func Error(w http.ResponseWriter, status int, errorCode, message string) {
	JSON(w, status, ErrorResponse{
		Error:   errorCode,
		Message: message,
	})
}

// ValidationError 发送验证错误响应（400 Bad Request）
func ValidationError(w http.ResponseWriter, message string, details map[string][]string) {
	JSON(w, http.StatusBadRequest, ErrorResponse{
		Error:   "validation_error",
		Message: message,
		Details: details,
	})
}

// BadRequest 发送错误请求响应（400 Bad Request）
func BadRequest(w http.ResponseWriter, message string) {
	Error(w, http.StatusBadRequest, "bad_request", message)
}

// Unauthorized 发送未授权响应（401 Unauthorized）
func Unauthorized(w http.ResponseWriter, message string) {
	Error(w, http.StatusUnauthorized, "unauthorized", message)
}

// Forbidden 发送禁止访问响应（403 Forbidden）
func Forbidden(w http.ResponseWriter, message string) {
	Error(w, http.StatusForbidden, "forbidden", message)
}

// NotFound 发送未找到响应（404 Not Found）
func NotFound(w http.ResponseWriter, message string) {
	Error(w, http.StatusNotFound, "not_found", message)
}

// Conflict 发送冲突响应（409 Conflict）
func Conflict(w http.ResponseWriter, message string) {
	Error(w, http.StatusConflict, "conflict", message)
}

// InternalServerError 发送服务器内部错误响应（500 Internal Server Error）
func InternalServerError(w http.ResponseWriter, message string) {
	Error(w, http.StatusInternalServerError, "internal_error", message)
}
