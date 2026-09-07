// Package publication 提供公开发布物流 HTTP 适配。
package publication

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"

	apppublication "blog-api/internal/application/publication"
	"blog-api/internal/interfaces/http/response"
)

const cacheControl = "public, max-age=30, stale-while-revalidate=120"

// Handler 处理发布物公开读取请求。
type Handler struct {
	service *apppublication.Service
}

// NewHandler 创建发布物 HTTP 处理器。
func NewHandler(service *apppublication.Service) *Handler {
	return &Handler{service: service}
}

// List 返回首页消费的统一发布物流。
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page, err := h.service.List(r.Context(), apppublication.ListQuery{
		Cursor:   query.Get("cursor"),
		Limit:    response.ParseLimit(r, 20, 100),
		From:     query.Get("from"),
		To:       query.Get("to"),
		Featured: query.Get("featured"),
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}

	body := response.Envelope{
		Data: page.Items,
		Meta: &response.Meta{Pagination: &response.Pagination{
			Limit: page.Limit, HasMore: page.HasMore, NextCursor: page.NextCursor,
		}},
	}
	payload, err := json.Marshal(body)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	digest := sha256.Sum256(payload)
	etag := `W/"` + hex.EncodeToString(digest[:16]) + `"`
	w.Header().Set("Cache-Control", cacheControl)
	w.Header().Set("ETag", etag)
	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	response.WriteJSON(w, http.StatusOK, body)
}
