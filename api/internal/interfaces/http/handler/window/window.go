// Package window 提供「窗」模块的 HTTP handler。
package window

import (
	"encoding/json"
	"net/http"

	appwindow "blog-api/internal/application/window"
	domainshared "blog-api/internal/domain/shared"
	domainwindow "blog-api/internal/domain/window"
	"blog-api/internal/interfaces/http/response"
)

// errBadBody 请求体不是合法 JSON
var errBadBody = domainshared.BadRequest("请求体格式错误")

// Handler 窗 HTTP handler
type Handler struct {
	svc *appwindow.Service
}

// NewHandler 构造窗 handler
func NewHandler(svc *appwindow.Service) *Handler {
	return &Handler{svc: svc}
}

// Public 公开读取窗状态（全站背景用，无需鉴权）
func (h *Handler) Public(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.Public(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// knockRequest 敲窗请求
type knockRequest struct {
	// Page 访客所在页面路径，服务端只保留路径部分
	Page string `json:"page"`
}

// Knock 访客敲窗：给站长发一条轻提示（频率由路由层限流）
func (h *Handler) Knock(w http.ResponseWriter, r *http.Request) {
	var req knockRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req); err != nil {
		response.RespondError(w, r, errBadBody)
		return
	}
	if err := h.svc.Knock(r.Context(), req.Page); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

// Get 后台读取窗配置
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.Get(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// updateRequest 后台整体更新窗配置
type updateRequest struct {
	// City 站长所在城市；null 表示清除
	City *domainwindow.City `json:"city"`
	// Photos 各槽位照片 URL；未出现的槽位清空为默认图
	Photos map[domainwindow.PhotoSlot]string `json:"photos"`
}

// Update 后台整体更新窗配置
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var req updateRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
		response.RespondError(w, r, errBadBody)
		return
	}
	data, err := h.svc.Update(r.Context(), appwindow.UpdateInput{City: req.City, Photos: req.Photos})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// SearchCities 后台按名称搜索城市（?q=杭州）
func (h *Handler) SearchCities(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.SearchCities(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}
