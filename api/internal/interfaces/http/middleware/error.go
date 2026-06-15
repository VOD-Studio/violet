// Package middleware 提供接口层（HTTP）中间件与错误翻译。
//
// 本包是 DDD interfaces 层的 HTTP 子层，与 internal/middleware（旧分层）并存，
// P2 阶段逐步迁移并最终替换旧中间件。
package middleware

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	domainshared "blog-api/internal/domain/shared"
)

// errorResponse 统一错误响应结构
//
// 兼容现有 internal/pkg/response.ErrorResponse 的 {error, message, details?} 格式，
// 增加便于排障的 request_id 字段。
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
//	    RespondError(w, r, err)
//	    return
//	}
//
// 本函数自动识别 DomainError 并翻译为对应 HTTP 状态码与错误码，
// 替代当前散落在各 handler 的 switch 翻译逻辑。
func RespondError(w http.ResponseWriter, r *http.Request, err error) {
	if err == nil {
		return
	}

	resp := errorResponse{
		RequestID: getRequestID(r),
	}

	// 优先识别领域错误（应用层主要错误类型）
	var de *domainshared.DomainError
	if errors.As(err, &de) {
		resp.Error = string(de.Code)
		resp.Message = de.Message
		status := de.HTTPStatus
		if status == 0 {
			// 领域层未指定 HTTP 状态时的兜底（保守处理为 400）
			status = http.StatusBadRequest
		}
		writeJSON(w, status, resp)
		return
	}

	// GORM 记录未找到（兼容尚未返回 DomainError 的旧代码路径）
	if errors.Is(err, gorm.ErrRecordNotFound) {
		resp.Error = "NOT_FOUND"
		resp.Message = "资源未找到"
		writeJSON(w, http.StatusNotFound, resp)
		return
	}

	// 兜底：未识别的错误视为 500，记录原始错误用于排障
	log.Error().
		Err(err).
		Str("request_id", resp.RequestID).
		Str("path", r.URL.Path).
		Str("method", r.Method).
		Msg("未处理的错误")

	resp.Error = "INTERNAL_ERROR"
	resp.Message = "服务器内部错误"
	writeJSON(w, http.StatusInternalServerError, resp)
}

// writeJSON 写入 JSON 响应
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		// 编码失败仅记录（状态码已写入）
		log.Error().Err(err).Msg("错误响应 JSON 编码失败")
	}
}

// getRequestID 从 request context 获取 request_id（兼容新旧中间件）
//
// P0 已在 internal/middleware/requestid.go 提供 GetRequestID；
// 此处通过 interface 兜底，避免 interfaces 层硬依赖旧 middleware 包。
func getRequestID(r *http.Request) string {
	// 优先从 header 读取（已由 RequestID 中间件写入响应头）
	if id := r.Header.Get("X-Request-Id"); id != "" {
		return id
	}
	return ""
}
