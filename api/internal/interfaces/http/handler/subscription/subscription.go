// Package subscription 提供 RSS 订阅管理的 HTTP handler（后台 admin CRUD）。
//
// admin 视角：管理全站订阅，不按 userID 过滤/校验所有权（区别于 MCP tool 的
// 用户视角，那里只管自己的订阅）。用例编排在 application/subscription.Service
// 的 admin 方法（AGENTS.md：用例编排进 application），handler 只做 HTTP 适配。
package subscription

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	appsub "blog-api/internal/application/subscription"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

// Handler 订阅管理 HTTP handler（后台 admin）。
type Handler struct {
	svc *appsub.Service
}

// NewHandler 构造订阅管理 handler。
func NewHandler(svc *appsub.Service) *Handler {
	return &Handler{svc: svc}
}

// List 列出全站订阅（分页 + 可选 status 过滤）。
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	// 钳制用于响应回显（Service 内部有同样钳制，保持一致）
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	dtos, total, err := h.svc.ListAll(r.Context(), status, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{
		"items": dtos, "total": total, "page": page, "limit": limit,
	})
}

// Get 查单个订阅详情。
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.GetByIDForAdmin(r.Context(), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

type createSubscriptionRequest struct {
	FeedURL           string   `json:"feed_url" validate:"required"`
	Title             string   `json:"title"`
	Interval          string   `json:"interval"`
	AutoPublish       bool     `json:"auto_publish"`
	CanonicalOverride string   `json:"canonical_override"`
	Tags              []string `json:"tags"`
}

// Create 创建订阅。user_id 取自当前 admin（订阅归属创建者）。
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	var req createSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), appsub.CreateInput{
		UserID:            userID,
		FeedURL:           req.FeedURL,
		Title:             req.Title,
		Interval:          req.Interval,
		AutoPublish:       req.AutoPublish,
		CanonicalOverride: req.CanonicalOverride,
		Tags:              req.Tags,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

type updateSubscriptionRequest struct {
	Title             *string  `json:"title"`
	Interval          *string  `json:"interval"`
	AutoPublish       *bool    `json:"auto_publish"`
	CanonicalOverride *string  `json:"canonical_override"`
	Tags              []string `json:"tags"`
}

// Update 更新订阅配置（admin 视角，部分更新：指针 nil 保持原值）。
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var req updateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.UpdateForAdmin(r.Context(), appsub.AdminUpdateInput{
		ID:                r.PathValue("id"),
		Title:             req.Title,
		Interval:          req.Interval,
		AutoPublish:       req.AutoPublish,
		CanonicalOverride: req.CanonicalOverride,
		Tags:              req.Tags,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// Pause 手动暂停订阅。
func (h *Handler) Pause(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.PauseForAdmin(r.Context(), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// Resume 手动恢复订阅（清零失败计数）。
func (h *Handler) Resume(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.ResumeForAdmin(r.Context(), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// Fetch 异步拉取订阅（手动触发，不等调度器）。
//
// 立即返回 202 Accepted，FetchNow 在后台 goroutine 跑。
// 用 context.Background() 脱离 HTTP request 生命周期——request 取消不影响抓取。
// 抓取完成后 FetchNow 内部发布的 SubscriptionFetched 事件 → 通知 subscriber
// 给触发者写通知（PRD-0015 N5）。
func (h *Handler) Fetch(w http.ResponseWriter, r *http.Request) {
	subID := r.PathValue("id")
	go func() {
		h.svc.FetchNow(context.Background(), subID, false)
	}()
	response.RespondMessage(w, http.StatusAccepted, "抓取已开始，完成后会通知你")
}

// Delete 删除订阅（连带 entries 由 ON DELETE CASCADE 处理）。
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.DeleteForAdmin(r.Context(), r.PathValue("id")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "订阅已删除")
}
