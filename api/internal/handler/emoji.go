package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"blog-api/internal/service"
)

// EmojiHandler 表情接口处理器
type EmojiHandler struct {
	emojiService *service.EmojiService
}

// NewEmojiHandler 创建表情处理器实例
func NewEmojiHandler(emojiService *service.EmojiService) *EmojiHandler {
	return &EmojiHandler{
		emojiService: emojiService,
	}
}

// --- 公开接口（用户端）---

// GetAllEmojis 获取所有表情分组和表情
// GET /api/emojis
func (h *EmojiHandler) GetAllEmojis(w http.ResponseWriter, r *http.Request) {
	groups, err := h.emojiService.GetAllEmojisForPublic(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取表情列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"groups": groups,
	})
}

// GetEmojiGroupByName 获取指定表情分组
// GET /api/emojis/groups/{name}
func (h *EmojiHandler) GetEmojiGroupByName(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		writeError(w, http.StatusBadRequest, "invalid_param", "缺少分组名称")
		return
	}

	group, err := h.emojiService.GetEmojiGroupByName(r.Context(), name)
	if err != nil {
		if errors.Is(err, service.ErrEmojiGroupNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "表情分组不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "获取表情分组失败")
		return
	}

	writeJSON(w, http.StatusOK, group)
}

// --- 管理接口：分组操作 ---

// ListAllGroups 获取所有表情分组（含未启用）
// GET /api/admin/emoji-groups
// 需要管理员权限
func (h *EmojiHandler) ListAllGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := h.emojiService.ListAllEmojiGroups(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取表情分组列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"groups": groups,
	})
}

// CreateGroup 创建表情分组
// POST /api/admin/emoji-groups
// 需要管理员权限
func (h *EmojiHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name      string `json:"name" validate:"required"`
		Source    string `json:"source"`
		SortOrder int32  `json:"sort_order"`
		IsEnabled bool   `json:"is_enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "名称为必填项")
		return
	}

	if req.Source == "" {
		req.Source = "custom"
	}

	input := service.CreateEmojiGroupInput{
		Name:      req.Name,
		Source:    req.Source,
		SortOrder: req.SortOrder,
		IsEnabled: req.IsEnabled,
	}

	group, err := h.emojiService.CreateEmojiGroup(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "创建表情分组失败")
		return
	}

	writeJSON(w, http.StatusOK, group)
}

// UpdateGroup 更新表情分组
// PATCH /api/admin/emoji-groups/{id}
// 需要管理员权限
func (h *EmojiHandler) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id := parseInt32(idStr)
	if id == 0 {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	// 使用指针区分"未提供"和"零值"
	var req struct {
		Name      *string `json:"name"`
		Source    *string `json:"source"`
		SortOrder *int32  `json:"sort_order"`
		IsEnabled *bool   `json:"is_enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 获取现有数据
	existing, err := h.emojiService.ListAllEmojiGroups(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取表情分组失败")
		return
	}

	var found *service.EmojiGroupResponse
	for _, g := range existing {
		if g.ID == id {
			found = g
			break
		}
	}

	if found == nil {
		writeError(w, http.StatusNotFound, "not_found", "表情分组不存在")
		return
	}

	// 只更新提供的字段，未提供的保持原值
	input := service.UpdateEmojiGroupInput{
		ID:        id,
		Name:      found.Name,
		Source:    found.Source,
		SortOrder: found.SortOrder,
		IsEnabled: found.IsEnabled,
	}

	if req.Name != nil {
		input.Name = *req.Name
	}
	if req.Source != nil {
		input.Source = *req.Source
	}
	if req.SortOrder != nil {
		input.SortOrder = *req.SortOrder
	}
	if req.IsEnabled != nil {
		input.IsEnabled = *req.IsEnabled
	}

	group, err := h.emojiService.UpdateEmojiGroup(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "更新表情分组失败")
		return
	}

	writeJSON(w, http.StatusOK, group)
}

// DeleteGroup 删除表情分组
// DELETE /api/admin/emoji-groups/{id}
// 需要管理员权限
func (h *EmojiHandler) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id := parseInt32(idStr)
	if id == 0 {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	err := h.emojiService.DeleteEmojiGroup(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "删除表情分组失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "删除成功"})
}

// ListGroupEmojis 获取分组内所有表情
// GET /api/admin/emoji-groups/{id}/emojis
// 需要管理员权限
func (h *EmojiHandler) ListGroupEmojis(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id := parseInt32(idStr)
	if id == 0 {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	emojis, err := h.emojiService.ListEmojisByGroup(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取表情列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"emojis": emojis,
	})
}

// CreateEmoji 创建表情
// POST /api/admin/emoji-groups/{id}/emojis
// 需要管理员权限
func (h *EmojiHandler) CreateEmoji(w http.ResponseWriter, r *http.Request) {
	groupIDStr := chi.URLParam(r, "id")
	groupID := parseInt32(groupIDStr)
	if groupID == 0 {
		writeError(w, http.StatusBadRequest, "invalid_param", "分组 ID 无效")
		return
	}

	var req struct {
		Name        string `json:"name" validate:"required"`
		URL         string `json:"url"`
		TextContent string `json:"text_content"`
		SortOrder   int32  `json:"sort_order"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "名称为必填项")
		return
	}

	input := service.CreateEmojiInput{
		GroupID:     groupID,
		Name:        req.Name,
		URL:         req.URL,
		TextContent: req.TextContent,
		SortOrder:   req.SortOrder,
	}

	emoji, err := h.emojiService.CreateEmoji(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "创建表情失败")
		return
	}

	writeJSON(w, http.StatusOK, emoji)
}

// --- 管理接口：表情操作 ---

// UpdateEmoji 更新表情
// PATCH /api/admin/emojis/{id}
// 需要管理员权限
func (h *EmojiHandler) UpdateEmoji(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id := parseInt32(idStr)
	if id == 0 {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	var req struct {
		Name        *string `json:"name"`
		URL         *string `json:"url"`
		TextContent *string `json:"text_content"`
		SortOrder   *int32  `json:"sort_order"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 获取现有数据
	existing, err := h.emojiService.GetEmojiByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "表情不存在")
		return
	}

	// 只更新提供的字段，未提供的保持原值
	input := service.UpdateEmojiInput{
		ID:          id,
		Name:        existing.Name,
		URL:         existing.URL,
		TextContent: existing.TextContent,
		SortOrder:   existing.SortOrder,
	}

	if req.Name != nil {
		input.Name = *req.Name
	}
	if req.URL != nil {
		input.URL = *req.URL
	}
	if req.TextContent != nil {
		input.TextContent = *req.TextContent
	}
	if req.SortOrder != nil {
		input.SortOrder = *req.SortOrder
	}

	emoji, err := h.emojiService.UpdateEmoji(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "更新表情失败")
		return
	}

	writeJSON(w, http.StatusOK, emoji)
}

// DeleteEmoji 删除表情
// DELETE /api/admin/emojis/{id}
// 需要管理员权限
func (h *EmojiHandler) DeleteEmoji(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id := parseInt32(idStr)
	if id == 0 {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	err := h.emojiService.DeleteEmoji(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "删除表情失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "删除成功"})
}

// --- 辅助函数 ---

func parseInt32(s string) int32 {
	var result int32
	for _, c := range s {
		if c >= '0' && c <= '9' {
			result = result*10 + int32(c-'0')
		} else {
			return 0
		}
	}
	return result
}