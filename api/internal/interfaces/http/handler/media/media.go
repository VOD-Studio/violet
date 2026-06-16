// Package media 提供 emoji/music/upload 的 HTTP handler（DDD 版）。
package media

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-playground/validator/v10"

	appmedia "blog-api/internal/application/media"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
)

// Handler emoji/music/upload HTTP 处理器
type Handler struct {
	emojiSvc  *appmedia.EmojiService
	musicSvc  *appmedia.MusicService
	uploadSvc *appmedia.UploadService
	validate  *validator.Validate
}

// NewHandler 创建 media handler
func NewHandler(emojiSvc *appmedia.EmojiService, musicSvc *appmedia.MusicService, uploadSvc *appmedia.UploadService) *Handler {
	return &Handler{emojiSvc: emojiSvc, musicSvc: musicSvc, uploadSvc: uploadSvc, validate: validator.New()}
}

// ============================================================
// Emoji
// ============================================================

// GetAllEmojis 获取所有启用表情分组（前台公开）
func (h *Handler) GetAllEmojis(w http.ResponseWriter, r *http.Request) {
	groups, err := h.emojiSvc.GetAll(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": groups})
}

// ListAllEmojiGroups 获取所有表情分组（后台）
func (h *Handler) ListAllEmojiGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := h.emojiSvc.GetAllAdmin(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": groups})
}

type createEmojiGroupRequest struct {
	Name   string `json:"name" validate:"required"`
	Source string `json:"source"`
}

// CreateEmojiGroup 创建表情分组（后台）
func (h *Handler) CreateEmojiGroup(w http.ResponseWriter, r *http.Request) {
	var req createEmojiGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	source := req.Source
	if source == "" {
		source = "system"
	}
	id, err := h.emojiSvc.CreateGroup(r.Context(), appmedia.CreateGroupInput{Name: req.Name, Source: source})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": map[string]any{"id": id}})
}

// SetEmojiGroupEnabled 启用/禁用表情分组
func (h *Handler) SetEmojiGroupEnabled(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	var req struct {
		Enabled bool `json:"enabled"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	if err := h.emojiSvc.SetEnabled(r.Context(), int32(id), req.Enabled); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "状态已更新"})
}

// DeleteEmojiGroup 删除表情分组
func (h *Handler) DeleteEmojiGroup(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.emojiSvc.DeleteGroup(r.Context(), int32(id)); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "分组已删除"})
}

// ============================================================
// Music
// ============================================================

// GetActivePlaylists 获取活跃歌单（前台公开）
func (h *Handler) GetActivePlaylists(w http.ResponseWriter, r *http.Request) {
	playlists, err := h.musicSvc.GetActive(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": playlists})
}

// ListAllPlaylists 获取所有歌单（后台）
func (h *Handler) ListAllPlaylists(w http.ResponseWriter, r *http.Request) {
	playlists, err := h.musicSvc.GetAll(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": playlists})
}

// SetPlaylistActive 启用/禁用歌单
func (h *Handler) SetPlaylistActive(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Active bool `json:"active"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	if err := h.musicSvc.SetActive(r.Context(), id, req.Active); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "状态已更新"})
}

// DeletePlaylist 删除歌单
func (h *Handler) DeletePlaylist(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.musicSvc.DeletePlaylist(r.Context(), id); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "歌单已删除"})
}

// ============================================================
// Upload
// ============================================================

// CheckInstantUpload 秒传检查
func (h *Handler) CheckInstantUpload(w http.ResponseWriter, r *http.Request) {
	hash := r.URL.Query().Get("hash")
	if hash == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "hash 参数不能为空"})
		return
	}
	dto, exists, err := h.uploadSvc.CheckInstantUpload(r.Context(), hash)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": dto, "exists": exists})
}

// ListFiles 列出文件（后台）
func (h *Handler) ListFiles(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	purpose := r.URL.Query().Get("purpose")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	files, total, err := h.uploadSvc.ListByOwner(r.Context(), userID, purpose, page, limit)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": files, "total": total})
}

// DeleteFile 删除文件
func (h *Handler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.uploadSvc.DeleteFile(r.Context(), id); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "文件已删除"})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
