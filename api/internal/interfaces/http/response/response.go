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

	domainshared "blog-api/internal/domain/shared"
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
	Message    string      `json:"message,omitempty"`
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
	defaultPage  = domainshared.DefaultPage
	defaultLimit = domainshared.DefaultPageLimit
	maxPage      = domainshared.MaxPage
	maxLimit     = domainshared.MaxPageLimit
)

// ParsePaging 从 query 解析 offset 分页参数（page + limit）
//
// 统一默认值（page=1, limit=20）、上限（page≤MaxPage、limit≤MaxPageLimit）。
//
//	page, limit := resp.ParsePaging(r)
func ParsePaging(r *http.Request) (page, limit int) {
	return parsePage(r), ParseLimit(r, defaultLimit, maxLimit)
}

// ParsePageQuery 解析 query 参数为 domain/shared.PageQuery 值对象
//
// 供仓储 FindPage 签名直接使用；钳制规则同 ParsePaging（Normalize 再兜底）。
func ParsePageQuery(r *http.Request) domainshared.PageQuery {
	page, limit := ParsePaging(r)
	return domainshared.PageQuery{Page: page, Limit: limit}
}

// ParsePagingWithMax 同 ParsePaging，但 limit 上限由调用方指定
//
// 前台展示场景可能需要更小的上限（如 limit≤50）：
//
//	page, limit := resp.ParsePagingWithMax(r, 50)
func ParsePagingWithMax(r *http.Request, max int) (page, limit int) {
	if max <= 0 || max > maxLimit {
		max = maxLimit
	}
	return parsePage(r), ParseLimit(r, defaultLimit, max)
}

// ParseCursor 从 query 解析 cursor 分页参数
//
//	cursor, limit := resp.ParseCursor(r)
func ParseCursor(r *http.Request) (cursor string, limit int) {
	return r.URL.Query().Get("cursor"), ParseLimit(r, defaultLimit, maxLimit)
}

// ParseLimit 解析纯条数上限参数（无页码/游标语义）
//
// 适用场景：搜索条数（?limit=10）、调度批量大小等"只要数量不要分页"的端点。
// 钳制规则对齐业界惯例（GitHub per_page / Stripe limit）：静默钳制而非报错，
// 缺省/非法（<1 或非数字）回 def，越界钳到 max。
//
//	limit := resp.ParseLimit(r, 10, 50)
func ParseLimit(r *http.Request, def, max int) int {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	switch {
	case limit < 1:
		return def
	case limit > max:
		return max
	default:
		return limit
	}
}

// parsePage 解析并钳制页码：缺省/非法回 1，越界钳到 MaxPage
func parsePage(r *http.Request) int {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	switch {
	case page < defaultPage:
		return defaultPage
	case page > maxPage:
		return maxPage
	default:
		return page
	}
}
