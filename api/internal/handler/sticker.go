package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"blog-api/internal/middleware"
	"blog-api/internal/service"
)

// StickerHandler 表情包接口处理器
type StickerHandler struct {
	stickerService *service.StickerService
}

// NewStickerHandler 创建表情包处理器实例
func NewStickerHandler(stickerService *service.StickerService) *StickerHandler {
	return &StickerHandler{
		stickerService: stickerService,
	}
}

// --- 公开接口（用户端）---

// GetAllStickers 获取所有表情包组和表情包
// GET /api/stickers
func (h *StickerHandler) GetAllStickers(w http.ResponseWriter, r *http.Request) {
	groups, err := h.stickerService.GetAllStickersForPublic(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取表情包列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"groups": groups,
	})
}

// GetStickerGroupBySlug 获取指定表情包组
// GET /api/stickers/groups/{slug}
func (h *StickerHandler) GetStickerGroupBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		writeError(w, http.StatusBadRequest, "invalid_param", "缺少组标识")
		return
	}

	group, err := h.stickerService.GetStickerGroupWithStickers(r.Context(), slug)
	if err != nil {
		if errors.Is(err, service.ErrStickerGroupNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "表情包组不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "获取表情包组失败")
		return
	}

	writeJSON(w, http.StatusOK, group)
}

// AddFavorite 添加收藏表情包
// POST /api/stickers/favorites/{stickerId}
// 需要认证
func (h *StickerHandler) AddFavorite(w http.ResponseWriter, r *http.Request) {
	userIDStr := middleware.GetUserID(r.Context())
	if userIDStr == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "需要登录")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_user", "用户 ID 无效")
		return
	}

	stickerIDStr := chi.URLParam(r, "stickerId")
	stickerID, err := uuid.Parse(stickerIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "表情包 ID 无效")
		return
	}

	err = h.stickerService.AddFavoriteSticker(r.Context(), userID, stickerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "添加收藏失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "收藏成功"})
}

// RemoveFavorite 移除收藏表情包
// DELETE /api/stickers/favorites/{stickerId}
// 需要认证
func (h *StickerHandler) RemoveFavorite(w http.ResponseWriter, r *http.Request) {
	userIDStr := middleware.GetUserID(r.Context())
	if userIDStr == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "需要登录")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_user", "用户 ID 无效")
		return
	}

	stickerIDStr := chi.URLParam(r, "stickerId")
	stickerID, err := uuid.Parse(stickerIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "表情包 ID 无效")
		return
	}

	err = h.stickerService.RemoveFavoriteSticker(r.Context(), userID, stickerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "移除收藏失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "已取消收藏"})
}

// GetFavorites 获取用户收藏列表
// GET /api/stickers/favorites
// 需要认证
func (h *StickerHandler) GetFavorites(w http.ResponseWriter, r *http.Request) {
	userIDStr := middleware.GetUserID(r.Context())
	if userIDStr == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "需要登录")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_user", "用户 ID 无效")
		return
	}

	stickers, err := h.stickerService.ListUserFavoriteStickers(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取收藏列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"stickers": stickers,
	})
}

// --- 管理接口（管理端）---

// ListAllGroups 获取所有表情包组（含未激活）
// GET /api/admin/sticker-groups
// 需要管理员权限
func (h *StickerHandler) ListAllGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := h.stickerService.ListAllStickerGroups(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取表情包组列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"groups": groups,
	})
}

// CreateGroup 创建表情包组
// POST /api/admin/sticker-groups
// 需要管理员权限
func (h *StickerHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name" validate:"required"`
		Slug        string `json:"slug" validate:"required"`
		Type        string `json:"type"`        // custom/emoji/kaomoji
		IconURL     string `json:"icon_url"`
		Description string `json:"description"`
		SortOrder   int16  `json:"sort_order"`
		IsHot       bool   `json:"is_hot"`
		IsOfficial  bool   `json:"is_official"`
		IsActive    bool   `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if req.Name == "" || req.Slug == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "名称和标识为必填项")
		return
	}

	if req.Type == "" {
		req.Type = "custom"
	}

	input := service.CreateStickerGroupInput{
		Name:        req.Name,
		Slug:        req.Slug,
		Type:        req.Type,
		IconURL:     req.IconURL,
		Description: req.Description,
		SortOrder:   req.SortOrder,
		IsHot:       req.IsHot,
		IsOfficial:  req.IsOfficial,
		IsActive:    req.IsActive,
	}

	group, err := h.stickerService.CreateStickerGroup(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "创建表情包组失败")
		return
	}

	writeJSON(w, http.StatusOK, group)
}

// UpdateGroup 更新表情包组
// PATCH /api/admin/sticker-groups/{id}
// 需要管理员权限
func (h *StickerHandler) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	// 使用指针区分"未提供"和"空值"
	var req struct {
		Name        *string `json:"name"`
		Slug        *string `json:"slug"`
		IconURL     *string `json:"icon_url"`
		Description *string `json:"description"`
		SortOrder   *int16  `json:"sort_order"`
		IsHot       *bool   `json:"is_hot"`
		IsOfficial  *bool   `json:"is_official"`
		IsActive    *bool   `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 获取现有数据
	existing, err := h.stickerService.GetStickerGroupByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "表情包组不存在")
		return
	}

	// 只更新提供的字段，未提供的保持原值
	input := service.UpdateStickerGroupInput{
		ID:          id,
		Name:        existing.Name,
		Slug:        existing.Slug,
		IconURL:     existing.IconURL,
		Description: existing.Description,
		SortOrder:   existing.SortOrder,
		IsHot:       existing.IsHot,
		IsOfficial:  existing.IsOfficial,
		IsActive:    existing.IsActive,
	}

	if req.Name != nil {
		input.Name = *req.Name
	}
	if req.Slug != nil {
		input.Slug = *req.Slug
	}
	if req.IconURL != nil {
		input.IconURL = *req.IconURL
	}
	if req.Description != nil {
		input.Description = *req.Description
	}
	if req.SortOrder != nil {
		input.SortOrder = *req.SortOrder
	}
	if req.IsHot != nil {
		input.IsHot = *req.IsHot
	}
	if req.IsOfficial != nil {
		input.IsOfficial = *req.IsOfficial
	}
	if req.IsActive != nil {
		input.IsActive = *req.IsActive
	}

	group, err := h.stickerService.UpdateStickerGroup(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "更新表情包组失败")
		return
	}

	writeJSON(w, http.StatusOK, group)
}

// DeleteGroup 删除表情包组
// DELETE /api/admin/sticker-groups/{id}
// 需要管理员权限
func (h *StickerHandler) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	err = h.stickerService.DeleteStickerGroup(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "删除表情包组失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "删除成功"})
}

// ListGroupStickers 获取组内所有表情包（含未激活）
// GET /api/admin/sticker-groups/{id}/stickers
// 需要管理员权限
func (h *StickerHandler) ListGroupStickers(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	stickers, err := h.stickerService.ListAllStickersByGroup(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取表情包列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"stickers": stickers,
	})
}

// CreateSticker 创建表情包
// POST /api/admin/sticker-groups/{id}/stickers
// 需要管理员权限
func (h *StickerHandler) CreateSticker(w http.ResponseWriter, r *http.Request) {
	groupIDStr := chi.URLParam(r, "id")
	groupID, err := uuid.Parse(groupIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "组 ID 无效")
		return
	}

	var req struct {
		Name      string `json:"name" validate:"required"`
		Slug      string `json:"slug" validate:"required"`
		ImageURL  string `json:"image_url" validate:"required"`
		Width     int16  `json:"width"`
		Height    int16  `json:"height"`
		SortOrder int16  `json:"sort_order"`
		IsActive  bool   `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if req.Name == "" || req.Slug == "" || req.ImageURL == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "名称、标识和图片地址为必填项")
		return
	}

	input := service.CreateStickerInput{
		GroupID:   groupID,
		Name:      req.Name,
		Slug:      req.Slug,
		ImageURL:  req.ImageURL,
		Width:     req.Width,
		Height:    req.Height,
		SortOrder: req.SortOrder,
		IsActive:  req.IsActive,
	}

	sticker, err := h.stickerService.CreateSticker(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "创建表情包失败")
		return
	}

	writeJSON(w, http.StatusOK, sticker)
}

// UpdateSticker 更新表情包
// PATCH /api/admin/stickers/{id}
// 需要管理员权限
func (h *StickerHandler) UpdateSticker(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	var req struct {
		Name      *string `json:"name"`
		Slug      *string `json:"slug"`
		ImageURL  *string `json:"image_url"`
		Width     *int16  `json:"width"`
		Height    *int16  `json:"height"`
		SortOrder *int16  `json:"sort_order"`
		IsActive  *bool   `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	input := service.UpdateStickerInput{
		ID:        id,
		Name:      req.Name,
		Slug:      req.Slug,
		ImageURL:  req.ImageURL,
		Width:     req.Width,
		Height:    req.Height,
		SortOrder: req.SortOrder,
		IsActive:  req.IsActive,
	}

	sticker, err := h.stickerService.UpdateSticker(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "更新表情包失败")
		return
	}

	writeJSON(w, http.StatusOK, sticker)
}

// DeleteSticker 删除表情包
// DELETE /api/admin/stickers/{id}
// 需要管理员权限
func (h *StickerHandler) DeleteSticker(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	err = h.stickerService.DeleteSticker(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "删除表情包失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "删除成功"})
}

// UpdateStickersSortOrder 批量更新表情包排序
// POST /api/admin/stickers/reorder
// 需要管理员权限
func (h *StickerHandler) UpdateStickersSortOrder(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []struct {
			ID        uuid.UUID `json:"id"`
			SortOrder int16     `json:"sort_order"`
		} `json:"items"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "validation_error", "排序项不能为空")
		return
	}

	input := service.UpdateStickersSortOrderInput{}
	for _, item := range req.Items {
		input.Items = append(input.Items, struct {
			ID        uuid.UUID
			SortOrder int16
		}{ID: item.ID, SortOrder: item.SortOrder})
	}

	err := h.stickerService.UpdateStickersSortOrder(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "更新排序失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "排序更新成功"})
}