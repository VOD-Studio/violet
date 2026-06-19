// Package response 提供统一的 HTTP 成功响应封装。
//
// 所有 handler 应使用本包的辅助函数写入响应，而非各自实现 writeJSON
// 和手拼 map[string]any，保证全站响应结构一致。
//
// 统一信封格式：
//
//	成功（数据）:   {"data": <T>}
//	成功（分页）:   {"data": [<T>], "meta": {"pagination": {...}}}
//	成功（消息）:   {"data": null, "meta": {"message": "..."}}
//	错误（已有）:   {"error": "<CODE>", "message": "...", "request_id": "..."}
//
// 分页支持两种模式：
//   - offset: page/limit（后台管理默认），响应含 total/total_pages
//   - cursor: cursor/limit（前台无限滚动），响应含 has_more/next_cursor
package response

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/rs/zerolog/log"
)

// ============================================================
// 响应结构
// ============================================================

// Envelope 统一响应信封
type Envelope struct {
	Data any   `json:"data"`
	Meta *Meta `json:"meta,omitempty"`
}

// Meta 响应元数据（消息或分页信息）
type Meta struct {
	Message    string     `json:"message,omitempty"`
	Pagination *Pagination `json:"pagination,omitempty"`
}

// Pagination 分页元数据（offset 与 cursor 模式共用）
type Pagination struct {
	Page       int    `json:"page,omitempty"`        // offset 模式：当前页码
	Limit      int    `json:"limit"`                 // 每页条数
	Total      int64  `json:"total,omitempty"`       // offset 模式：总记录数
	TotalPages int    `json:"total_pages,omitempty"` // offset 模式：总页数
	HasMore    bool   `json:"has_more,omitempty"`    // cursor 模式：是否还有下一页
	NextCursor string `json:"next_cursor,omitempty"` // cursor 模式：下一页游标
}

// ============================================================
// 底层写入
// ============================================================

// WriteJSON 写入 JSON 响应（底层，设置 Content-Type 与状态码）
func WriteJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Error().Err(err).Msg("响应 JSON 编码失败")
	}
}

// ============================================================
// 成功响应辅助函数
// ============================================================

// RespondOK 返回 200 + 数据
//
//	resp.RespondOK(w, dto)
func RespondOK(w http.ResponseWriter, data any) {
	WriteJSON(w, http.StatusOK, Envelope{Data: data})
}

// RespondCreated 返回 201 + 数据
//
//	resp.RespondCreated(w, dto)
func RespondCreated(w http.ResponseWriter, data any) {
	WriteJSON(w, http.StatusCreated, Envelope{Data: data})
}

// RespondMessage 返回指定状态码 + 消息（用于删除/更新等无返回体操作）
//
//	resp.RespondMessage(w, http.StatusOK, "删除成功")
func RespondMessage(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, Envelope{Data: nil, Meta: &Meta{Message: message}})
}

// RespondNoContent 返回 204 无内容（RESTful 风格的删除成功）
func RespondNoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// RespondPaged 返回 offset 分页结果
//
//	page, limit := resp.ParsePaging(r)
//	items, total, err := svc.List(ctx, page, limit)
//	resp.RespondPaged(w, items, page, limit, total)
func RespondPaged(w http.ResponseWriter, data any, page, limit int, total int64) {
	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}
	WriteJSON(w, http.StatusOK, Envelope{
		Data: data,
		Meta: &Meta{
			Pagination: &Pagination{
				Page: page, Limit: limit, Total: total, TotalPages: totalPages,
				HasMore: page < totalPages,
			},
		},
	})
}

// RespondCursor 返回 cursor 分页结果
//
//	cursor, limit := resp.ParseCursor(r)
//	items, nextCursor, err := svc.List(ctx, cursor, limit)
//	resp.RespondCursor(w, items, limit, nextCursor != "", nextCursor)
func RespondCursor(w http.ResponseWriter, data any, limit int, hasMore bool, nextCursor string) {
	WriteJSON(w, http.StatusOK, Envelope{
		Data: data,
		Meta: &Meta{
			Pagination: &Pagination{
				Limit: limit, HasMore: hasMore, NextCursor: nextCursor,
			},
		},
	})
}

// ============================================================
// 分页参数解析
// ============================================================

const (
	defaultPage  = 1
	defaultLimit = 20
	maxLimit     = 100
)

// ParsePaging 从 query 解析 offset 分页参数（page + limit）
//
// 统一默认值（page=1, limit=20）、上限（limit≤100）、边界保护。
//	page, limit := resp.ParsePaging(r)
func ParsePaging(r *http.Request) (page, limit int) {
	page, _ = strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = defaultPage
	}
	limit, _ = strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	return page, limit
}

// ParsePagingWithMax 同 ParsePaging，但允许自定义 limit 上限
//
// 前台展示场景可能需要更小的上限（如 limit≤50）：
//	page, limit := resp.ParsePagingWithMax(r, 50)
func ParsePagingWithMax(r *http.Request, max int) (page, limit int) {
	page, limit = ParsePaging(r)
	if max > 0 && limit > max {
		limit = max
	}
	return page, limit
}

// ParseCursor 从 query 解析 cursor 分页参数
//
//	cursor, limit := resp.ParseCursor(r)
func ParseCursor(r *http.Request) (cursor string, limit int) {
	cursor = r.URL.Query().Get("cursor")
	limit, _ = strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	return cursor, limit
}
