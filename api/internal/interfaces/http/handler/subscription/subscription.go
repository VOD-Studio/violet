// Package subscription 提供 RSS 订阅管理的 HTTP handler（后台 admin CRUD）。
//
// admin 视角：管理全站订阅，不按 userID 过滤/校验所有权（区别于 MCP tool 的
// 用户视角，那里只管自己的订阅）。直接走 SubscriptionRepository + 领域方法，
// 不经过 application/subscription.Service 的所有权校验层。
package subscription

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	appsub "blog-api/internal/application/subscription"
	domainsub "blog-api/internal/domain/subscription"
	domainshared "blog-api/internal/domain/shared"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

// Handler 订阅管理 HTTP handler（后台 admin）。
type Handler struct {
	repo domainsub.SubscriptionRepository
}

// NewHandler 构造订阅管理 handler。
func NewHandler(repo domainsub.SubscriptionRepository) *Handler {
	return &Handler{repo: repo}
}

// --- DTO（admin 视角，含 user_id 字段便于后台看是谁的订阅） ---

// adminSubscriptionDTO 订阅读模型（admin 视角，比 SubscriptionDTO 多 user_id）。
type adminSubscriptionDTO struct {
	appsub.SubscriptionDTO
	UserID string `json:"user_id"`
}

// List 列出全站订阅（分页 + 可选 status 过滤）。
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	subs, total, err := h.repo.FindAll(r.Context(), status, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	dtos := make([]adminSubscriptionDTO, 0, len(subs))
	for _, s := range subs {
		dtos = append(dtos, toAdminDTO(s))
	}
	response.RespondOK(w, map[string]any{
		"items": dtos, "total": total, "page": page, "limit": limit,
	})
}

// Get 查单个订阅详情。
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	sub, err := h.findByID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, toAdminDTO(sub))
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
	uid, err := domainshared.ParseID(userID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req createSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	interval := req.Interval
	if interval == "" {
		interval = domainsub.IntervalDaily
	}
	sub, err := domainsub.NewSubscription(uid, req.FeedURL, req.Title, interval, time.Now())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := sub.UpdateConfig(req.Title, "", req.AutoPublish, req.CanonicalOverride, req.Tags); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.repo.Save(r.Context(), sub); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, toAdminDTO(sub))
}

type updateSubscriptionRequest struct {
	Title             *string  `json:"title"`
	Interval          *string  `json:"interval"`
	AutoPublish       *bool    `json:"auto_publish"`
	CanonicalOverride *string  `json:"canonical_override"`
	Tags              []string `json:"tags"`
}

// Update 更新订阅配置（admin 视角，不校验所有权）。
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	sub, err := h.findByID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req updateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	// admin 全量覆盖语义（与 post update 一致）：传则覆盖，指针 nil 保持原值
	title := sub.Title()
	if req.Title != nil {
		title = *req.Title
	}
	interval := ""
	if req.Interval != nil {
		interval = *req.Interval
	}
	autoPublish := sub.AutoPublish()
	if req.AutoPublish != nil {
		autoPublish = *req.AutoPublish
	}
	canonical := sub.CanonicalOverride()
	if req.CanonicalOverride != nil {
		canonical = *req.CanonicalOverride
	}
	tags := sub.Tags()
	if req.Tags != nil {
		tags = req.Tags
	}
	if err := sub.UpdateConfig(title, interval, autoPublish, canonical, tags); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.repo.Save(r.Context(), sub); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, toAdminDTO(sub))
}

// Pause 手动暂停订阅。
func (h *Handler) Pause(w http.ResponseWriter, r *http.Request) {
	sub, err := h.findByID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	sub.Pause()
	if err := h.repo.Save(r.Context(), sub); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, toAdminDTO(sub))
}

// Resume 手动恢复订阅（清零失败计数）。
func (h *Handler) Resume(w http.ResponseWriter, r *http.Request) {
	sub, err := h.findByID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	sub.Resume()
	if err := h.repo.Save(r.Context(), sub); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, toAdminDTO(sub))
}

// Delete 删除订阅（连带 entries 由 ON DELETE CASCADE 处理）。
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	sub, err := h.findByID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	// admin 删除用 repo.Delete 需双键，这里用 sub 的 id + userID
	if err := h.repo.Delete(r.Context(), sub.ID(), sub.UserID()); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "订阅已删除")
}

// findByID 从 path 解析 id 并查（admin 视角，无所有权校验，用 FindByIDForSchedule）。
func (h *Handler) findByID(r *http.Request) (*domainsub.Subscription, error) {
	id := r.PathValue("id")
	sid, err := domainshared.ParseID(id)
	if err != nil {
		return nil, err
	}
	return h.repo.FindByIDForSchedule(r.Context(), sid)
}

// toAdminDTO 领域实体 → admin DTO（含 user_id）。
func toAdminDTO(s *domainsub.Subscription) adminSubscriptionDTO {
	return adminSubscriptionDTO{
		SubscriptionDTO: appsub.SubscriptionDTO{
			ID:                  s.ID().String(),
			FeedURL:             s.FeedURL(),
			Title:               s.Title(),
			SourceType:          s.SourceType(),
			Interval:            s.Interval(),
			AutoPublish:         s.AutoPublish(),
			CanonicalOverride:   s.CanonicalOverride(),
			Tags:                s.Tags(),
			Status:              s.Status(),
			ConsecutiveFailures: s.ConsecutiveFailures(),
			LastError:           s.LastError(),
		},
		UserID: s.UserID().String(),
	}
}
