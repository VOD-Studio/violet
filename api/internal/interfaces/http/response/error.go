// Package response 提供统一错误响应封装。
//
// RespondError 自动识别 DomainError 并翻译为对应 HTTP 状态码与错误码，
// 替代散落在各 handler 的 switch 翻译逻辑。
package response

import (
	"errors"
	"net/http"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	domainshared "blog-api/internal/domain/shared"
)

// errorResponse 统一错误响应结构
type errorResponse struct {
	Error     string              `json:"error"`
	Message   string              `json:"message"`
	RequestID string              `json:"request_id,omitempty"`
	Details   map[string][]string `json:"details,omitempty"`
}

// RespondError 统一错误响应辅助函数
//
// handler 调用 service/用例后，直接：
//
//	if err != nil {
//	    response.RespondError(w, r, err)
//	    return
//	}
//
// 自动识别 DomainError 并翻译为对应 HTTP 状态码与错误码。
func RespondError(w http.ResponseWriter, r *http.Request, err error) {
	if err == nil {
		return
	}

	resp := errorResponse{
		RequestID: GetRequestID(r),
	}

	var de *domainshared.DomainError
	if errors.As(err, &de) {
		resp.Error = string(de.Code)
		resp.Message = de.Message
		status := de.HTTPStatus
		if status == 0 {
			status = http.StatusBadRequest
		}
		WriteJSON(w, status, resp)
		return
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		resp.Error = "NOT_FOUND"
		resp.Message = "资源未找到"
		WriteJSON(w, http.StatusNotFound, resp)
		return
	}

	log.Error().
		Err(err).
		Str("request_id", resp.RequestID).
		Str("path", r.URL.Path).
		Str("method", r.Method).
		Msg("未处理的错误")

	resp.Error = "INTERNAL_ERROR"
	resp.Message = "服务器内部错误"
	WriteJSON(w, http.StatusInternalServerError, resp)
}

// GetRequestID 从 request 获取 request_id（由 RequestID 中间件写入响应头）
func GetRequestID(r *http.Request) string {
	return r.Header.Get("X-Request-Id")
}
