// Package gallery 提供图集模块的 HTTP handler。
//
// 路由鉴权在 routing 层区分（公开 GET 裸挂 / 写操作 SessionAuth + 发布限流 /
// 治理端点 RequirePermission），handler 只做 HTTP 适配；
// 删除的「作者或 gallery:delete-any」双重判定在应用层（application/gallery.Service.Delete）。
package gallery

import (
	"encoding/json"
	"net/http"

	appgallery "blog-api/internal/application/gallery"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"

	"github.com/go-playground/validator/v10"
)

// Handler 图集 HTTP handler。
type Handler struct {
	svc *appgallery.Service
	validate *validator.Validate
}

// NewHandler 构造图集 handler。
func NewHandler(svc *appgallery.Service) *Handler {
	return &Handler{svc: svc, validate: validator.New()}
}

// ============================================================
// 公开端点
// ============================================================

// List 全站浏览流（公开）：GET /galleries?page=&limit=
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := response.ParsePageQuery(r)
	dtos, total, err := h.svc.ListPublished(r.Context(), q)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, dtos, q.Page, q.Limit, total)
}

// Get 图集详情（公开；removed 404）：GET /galleries/{id}
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.GetPublic(r.Context(), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// ListByUser 用户主页图集列表（公开）：GET /users/{username}/galleries
func (h *Handler) ListByUser(w http.ResponseWriter, r *http.Request) {
	q := response.ParsePageQuery(r)
	dtos, total, err := h.svc.ListByUsername(r.Context(), r.PathValue("username"), q)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, dtos, q.Page, q.Limit, total)
}

// ============================================================
// 登录端点
// ============================================================

// createRequest 建图集请求体。
type createRequest struct {
	Title       string             `json:"title" validate:"required"`
	Description string             `json:"description"`
	CoverFileID string             `json:"cover_file_id,omitempty"`
	Items       []itemRequest      `json:"items" validate:"required,min=1"`
}

type itemRequest struct {
	FileID  string `json:"file_id" validate:"required"`
	Caption string `json:"caption"`
}

// Create 建图集（登录 + 发布限流）：POST /galleries
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), appgallery.CreateInput{
		OwnerID:     interfacesmw.GetUserIDFromContext(r),
		Title:       req.Title,
		Description: req.Description,
		CoverFileID: req.CoverFileID,
		Items:       toItemInputs(req.Items),
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// updateRequest 编辑图集请求体（items 为 nil 时不改动媒体列表）。
type updateRequest struct {
	Title       string        `json:"title" validate:"required"`
	Description string        `json:"description"`
	CoverFileID string        `json:"cover_file_id,omitempty"`
	ClearCover  bool          `json:"clear_cover,omitempty"`
	Items       []itemRequest `json:"items"`
}

// Update 编辑图集（owner）：PATCH /galleries/{id}
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var req updateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Update(r.Context(), r.PathValue("id"), appgallery.UpdateInput{
		Title:       req.Title,
		Description: req.Description,
		CoverFileID: req.CoverFileID,
		ClearCover:  req.ClearCover,
		Items:       toItemInputsPtr(req.Items),
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// Delete 删除图集（登录，作者或 gallery:delete-any）：DELETE /galleries/{id}
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Delete(r.Context(), r.PathValue("id")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "图集已删除")
}

// setStatusRequest 治理状态切换请求体。
type setStatusRequest struct {
	Status string `json:"status" validate:"required"`
}

// SetStatus 下架/恢复图集（gallery:delete-any，路由层卡权限码）：PATCH /galleries/{id}/status
func (h *Handler) SetStatus(w http.ResponseWriter, r *http.Request) {
	var req setStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.SetStatus(r.Context(), r.PathValue("id"), req.Status); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "状态已更新")
}

// ============================================================
// 管理端点（SessionAuth + AdminRequired + gallery:view 由 admin 路由层承担）
// ============================================================

// ListAdmin 管理列表（全部状态）：GET /admin/galleries?page=&limit=
func (h *Handler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	q := response.ParsePageQuery(r)
	dtos, total, err := h.svc.ListAdmin(r.Context(), q)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, dtos, q.Page, q.Limit, total)
}

// toItemInputs 请求媒体项 → 应用层入参（nil 输入归一为空切片，见 Create 的 min=1 校验）。
func toItemInputs(items []itemRequest) []appgallery.ItemInput {
	out := make([]appgallery.ItemInput, 0, len(items))
	for _, it := range items {
		out = append(out, appgallery.ItemInput{FileID: it.FileID, Caption: it.Caption})
	}
	return out
}

// toItemInputsPtr PATCH 语义：items 字段缺省（null）时不改动媒体列表。
// JSON 未传字段 → nil；显式传 [] → 空切片（全量替换为空，聚合层会拒绝）。
func toItemInputsPtr(items []itemRequest) []appgallery.ItemInput {
	if items == nil {
		return nil
	}
	return toItemInputs(items)
}
