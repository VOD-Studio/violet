// Package response 提供统一错误响应封装。
//
// RespondError 自动识别 DomainError 并翻译为对应 HTTP 状态码与错误码，
// 替代散落在各 handler 的 switch 翻译逻辑。
package response

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/go-playground/validator/v10"
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
// 自动识别 DomainError 并按 Code 翻译为对应 HTTP 状态码。
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
		status := httpStatusForCode(de.Code)
		WriteJSON(w, status, resp)
		return
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		resp.Error = "NOT_FOUND"
		resp.Message = "资源未找到"
		WriteJSON(w, http.StatusNotFound, resp)
		return
	}

	// 校验错误（go-playground/validator）→ 400
	var valErrs validator.ValidationErrors
	if errors.As(err, &valErrs) {
		details := make(map[string][]string, len(valErrs))
		for _, fe := range valErrs {
			details[fe.Field()] = append(details[fe.Field()], fmt.Sprintf("校验失败: %s", fe.Tag()))
		}
		resp.Error = "VALIDATION_ERROR"
		resp.Message = "请求参数校验失败"
		resp.Details = details
		WriteJSON(w, http.StatusBadRequest, resp)
		return
	}

	// JSON 解析错误（语法/类型不匹配/空 body）→ 400
	var syntaxErr *json.SyntaxError
	if errors.As(err, &syntaxErr) {
		resp.Error = "BAD_REQUEST"
		resp.Message = "请求体格式错误"
		WriteJSON(w, http.StatusBadRequest, resp)
		return
	}
	var unmarshalErr *json.UnmarshalTypeError
	if errors.As(err, &unmarshalErr) {
		field := unmarshalErr.Field
		if field == "" {
			field = unmarshalErr.Value
		}
		resp.Error = "BAD_REQUEST"
		resp.Message = fmt.Sprintf("字段 %s 类型错误，期望 %s", field, unmarshalErr.Type.String())
		WriteJSON(w, http.StatusBadRequest, resp)
		return
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		resp.Error = "BAD_REQUEST"
		resp.Message = "请求体为空或格式不完整"
		WriteJSON(w, http.StatusBadRequest, resp)
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

// httpStatusForCode 领域错误码 → HTTP 状态码。
// HTTP 语义集中在接口层（domain 不感知 HTTP）。
func httpStatusForCode(code domainshared.ErrorCode) int {
	switch code {
	case domainshared.CodeNotFound:
		return http.StatusNotFound
	case domainshared.CodeBadRequest, domainshared.CodeValidation:
		return http.StatusBadRequest
	case domainshared.CodeUnauthorized:
		return http.StatusUnauthorized
	case domainshared.CodeForbidden:
		return http.StatusForbidden
	case domainshared.CodeConflict:
		return http.StatusConflict
	case domainshared.CodeInternal:
		return http.StatusInternalServerError
	default:
		// 未知错误码兜底为 400
		return http.StatusBadRequest
	}
}
