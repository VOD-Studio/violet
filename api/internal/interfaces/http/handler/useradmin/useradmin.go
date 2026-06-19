// Package useradmin 提供 useradmin 模块的 HTTP handler。
package useradmin

import (
	"encoding/json"
	"net/http"

	appuseradmin "blog-api/internal/application/useradmin"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

// Handler 用户管理 HTTP handler
type Handler struct {
	svc *appuseradmin.Service
}

// NewHandler 构造用户管理 handler
func NewHandler(svc *appuseradmin.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) operatorInfo(r *http.Request) (string, string, string) {
	userID := interfacesmw.GetUserIDFromContext(r)
	ip := r.Header.Get("X-Real-IP")
	if ip == "" {
		ip = r.Header.Get("X-Forwarded-For")
	}
	if ip == "" {
		ip = r.RemoteAddr
	}
	return userID, ip, r.Header.Get("User-Agent")
}

// ListUsers 用户列表
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	isActive := parseBoolPtr(r.URL.Query().Get("is_active"))
	filter := appuseradmin.ListFilter{
		Role:     r.URL.Query().Get("role"),
		IsActive: isActive,
		Keyword:  r.URL.Query().Get("keyword"),
	}
	users, total, err := h.svc.List(r.Context(), filter, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, users, page, limit, total)
}

// GetUserDetail 用户详情
func (h *Handler) GetUserDetail(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.GetDetail(r.Context(), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// CreateUser 创建用户
func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username" validate:"required"`
		Email    string `json:"email" validate:"required,email"`
		Password string `json:"password" validate:"required,min=6"`
		Role     string `json:"role"`
		IsActive *bool  `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	opID, ip, ua := h.operatorInfo(r)
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	role := req.Role
	if role == "" {
		role = "user"
	}
	dto, err := h.svc.Create(r.Context(), appuseradmin.CreateInput{
		Username: req.Username, Email: req.Email, Password: req.Password,
		Role: role, IsActive: active, IPAddress: ip, UserAgent: ua,
	}, opID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// UpdateUser 更新用户
func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username *string `json:"username"`
		Email    *string `json:"email"`
		Password *string `json:"password"`
		Role     *string `json:"role"`
		IsActive *bool   `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	opID, ip, ua := h.operatorInfo(r)
	dto, err := h.svc.Update(r.Context(), appuseradmin.UpdateInput{
		ID: r.PathValue("id"), Username: req.Username, Email: req.Email,
		Password: req.Password, Role: req.Role, IsActive: req.IsActive,
		IPAddress: ip, UserAgent: ua,
	}, opID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// DeleteUser 删除用户
func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	opID, ip, ua := h.operatorInfo(r)
	if err := h.svc.Delete(r.Context(), r.PathValue("id"), opID, ip, ua); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "用户已删除")
}

// UpdateUserRole 修改用户角色
func (h *Handler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Role string `json:"role" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	opID, ip, ua := h.operatorInfo(r)
	if err := h.svc.UpdateUserRole(r.Context(), r.PathValue("id"), req.Role, opID, ip, ua); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "用户角色已更新")
}

// UpdateUserStatus 修改用户状态
func (h *Handler) UpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	opID, ip, ua := h.operatorInfo(r)
	if err := h.svc.UpdateUserStatus(r.Context(), r.PathValue("id"), req.IsActive, opID, ip, ua); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "用户状态已更新")
}

// BatchUpdateStatus 批量启用/禁用
func (h *Handler) BatchUpdateStatus(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs      []string `json:"ids" validate:"required,min=1"`
		IsActive bool     `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	opID, ip, ua := h.operatorInfo(r)
	affected, err := h.svc.BatchUpdateStatus(r.Context(), req.IDs, req.IsActive, opID, ip, ua)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"affected": affected})
}

// BatchUpdateRole 批量修改角色
func (h *Handler) BatchUpdateRole(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs  []string `json:"ids" validate:"required,min=1"`
		Role string   `json:"role" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	opID, ip, ua := h.operatorInfo(r)
	affected, err := h.svc.BatchUpdateRole(r.Context(), req.IDs, req.Role, opID, ip, ua)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"affected": affected})
}

func parseBoolPtr(s string) *bool {
	if s == "" {
		return nil
	}
	b := s == "true" || s == "1"
	return &b
}
