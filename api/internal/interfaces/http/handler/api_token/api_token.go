// Package apitoken 提供 PAT 管理的 HTTP handler（后台 CRUD）。
package apitoken

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-playground/validator/v10"

	appapitoken "blog-api/internal/application/api_token"
	domainshared "blog-api/internal/domain/shared"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

// Handler PAT 管理 HTTP handler。
type Handler struct {
	svc      *appapitoken.Service
	validate *validator.Validate
}

// NewHandler 构造 PAT 管理 handler。
func NewHandler(svc *appapitoken.Service) *Handler {
	return &Handler{svc: svc, validate: validator.New()}
}

type createTokenRequest struct {
	Name   string   `json:"name" validate:"required,max=100"`
	Scopes []string `json:"scopes" validate:"required,min=1,dive,oneof=posts:read posts:write posts:publish posts:scrape subscriptions:read subscriptions:write comments:read comments:write notes:read notes:write notes:publish roadmap:read roadmap:write usage:write"`
	// ExpiresAt：ISO 日期（YYYY-MM-DD）或 "never"（永不过期）。空串默认 90 天。
	ExpiresAt string `json:"expires_at" validate:"omitempty"`
	// Interactive MCP 交互偏好：省略/true=冲突返回候选；false=一路到底（#272）
	Interactive *bool `json:"interactive"`
}

// Create 创建 PAT（后台 admin）。返回明文 token，仅此一次。
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	var req createTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	expiresAt, err := parseExpiry(req.ExpiresAt, time.Now())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	result, err := h.svc.Create(r.Context(), appapitoken.CreateInput{
		UserID:      userID,
		Name:        req.Name,
		Scopes:      req.Scopes,
		ExpiresAt:   expiresAt,
		Interactive: req.Interactive,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, result.Token)
}

type updateTokenRequest struct {
	Name        *string         `json:"name"`
	Scopes      json.RawMessage `json:"scopes"`
	ExpiresAt   *string         `json:"expires_at"`
	Interactive *bool           `json:"interactive"`
}

// Update 仅修改本人的令牌；省略字段保留原值。
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var req updateTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	var scopes *[]string
	if req.Scopes != nil {
		var values []string
		if err := json.Unmarshal(req.Scopes, &values); err != nil {
			response.RespondError(w, r, err)
			return
		}
		scopes = &values
	}
	var expiresAt *time.Time
	if req.ExpiresAt != nil {
		if *req.ExpiresAt == "" {
			response.RespondError(w, r, domainshared.BadRequest("过期日期不能为空，永久令牌请使用 never"))
			return
		}
		expiry, err := parseExpiry(*req.ExpiresAt, time.Now())
		if err != nil {
			response.RespondError(w, r, err)
			return
		}
		expiresAt = &expiry
	}
	token, err := h.svc.Update(r.Context(), appapitoken.UpdateInput{
		ID: r.PathValue("id"), UserID: interfacesmw.GetUserIDFromContext(r),
		Name: req.Name, Scopes: scopes, ExpiresAt: expiresAt, Interactive: req.Interactive,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, token)
}

// parseExpiry 把前端传入的过期值解析为绝对时间。
//   - ""：默认 90 天（安全默认值，防止留空拿到永不过期 PAT）
//   - "never"：零值（永不过期）
//   - "YYYY-MM-DD"：当天 23:59:59（给足整天，避免创建即过期）
//
// 非法格式或已过去的日期返回 BadRequest。
func parseExpiry(s string, now time.Time) (time.Time, error) {
	if s == "" {
		return now.Add(90 * 24 * time.Hour), nil
	}
	if s == "never" {
		return time.Time{}, nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}, domainshared.BadRequest("过期日期格式无效，需 YYYY-MM-DD 或 never")
	}
	// 当天 23:59:59，避免选当天导致创建即过期
	expiresAt := t.Add(24*time.Hour - time.Second)
	if !expiresAt.After(now) {
		return time.Time{}, domainshared.BadRequest("过期日期不能早于今天")
	}
	return expiresAt, nil
}

// List 分页列出当前用户的 PAT。
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	result, err := h.svc.ListPage(r.Context(), userID, response.ParsePageQuery(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, result.Items, result.Page, result.Limit, result.Total)
}

// Delete 吊销 PAT。
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := interfacesmw.GetUserIDFromContext(r)
	if err := h.svc.Delete(r.Context(), id, userID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "令牌已吊销")
}
