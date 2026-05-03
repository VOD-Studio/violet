package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"blog-api/internal/service"
)

// MusicAdminHandler 音乐后台管理接口处理器
type MusicAdminHandler struct {
	playlistAdminService *service.MusicPlaylistAdminService
	musicSettingsService *service.MusicSettingsService
}

// NewMusicAdminHandler 创建音乐后台管理处理器实例
func NewMusicAdminHandler(playlistAdminService *service.MusicPlaylistAdminService, musicSettingsService *service.MusicSettingsService) *MusicAdminHandler {
	return &MusicAdminHandler{
		playlistAdminService: playlistAdminService,
		musicSettingsService: musicSettingsService,
	}
}

// --- 歌单管理接口（管理端）---

// ListPlaylists 获取所有歌单
// GET /api/v1/admin/playlists
// 需要管理员权限
func (h *MusicAdminHandler) ListPlaylists(w http.ResponseWriter, r *http.Request) {
	playlists, err := h.playlistAdminService.ListPlaylists(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取歌单列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"playlists": playlists,
	})
}

// CreatePlaylist 创建歌单（导入链接）
// POST /api/v1/admin/playlists
// 需要管理员权限
func (h *MusicAdminHandler) CreatePlaylist(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL string `json:"url" validate:"required"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if req.URL == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "歌单链接不能为空")
		return
	}

	input := service.CreatePlaylistInput{
		URL: req.URL,
	}

	playlist, err := h.playlistAdminService.CreatePlaylist(r.Context(), input)
	if err != nil {
		if errors.Is(err, service.ErrUnsupportedMusicURL) {
			writeError(w, http.StatusBadRequest, "unsupported_url", "不支持的歌单链接格式")
			return
		}
		if errors.Is(err, service.ErrPlaylistAlreadyExists) {
			writeError(w, http.StatusConflict, "already_exists", "歌单已存在")
			return
		}
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "歌单不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "创建歌单失败")
		return
	}

	writeJSON(w, http.StatusOK, playlist)
}

// UpdatePlaylist 更新歌单信息
// PATCH /api/v1/admin/playlists/{id}
// 需要管理员权限
func (h *MusicAdminHandler) UpdatePlaylist(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	var req struct {
		Title    *string `json:"title"`
		IsActive *bool   `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	input := service.UpdatePlaylistInput{
		ID:       id,
		Title:    req.Title,
		IsActive: req.IsActive,
	}

	playlist, err := h.playlistAdminService.UpdatePlaylist(r.Context(), input)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "歌单不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "更新歌单失败")
		return
	}

	writeJSON(w, http.StatusOK, playlist)
}

// DeletePlaylist 删除歌单
// DELETE /api/v1/admin/playlists/{id}
// 需要管理员权限
func (h *MusicAdminHandler) DeletePlaylist(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	err = h.playlistAdminService.DeletePlaylist(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "歌单不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "删除歌单失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "删除成功"})
}

// SetActivePlaylist 设置启用的歌单
// POST /api/v1/admin/playlists/{id}/activate
// 需要管理员权限
func (h *MusicAdminHandler) SetActivePlaylist(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	playlist, err := h.playlistAdminService.SetActivePlaylist(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "歌单不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "设置启用歌单失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "歌单已启用",
		"playlist": playlist,
	})
}

// RefreshPlaylistSongs 刷新歌单歌曲（重新解析）
// POST /api/v1/admin/playlists/{id}/refresh
// 需要管理员权限
func (h *MusicAdminHandler) RefreshPlaylistSongs(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	playlist, err := h.playlistAdminService.RefreshPlaylistSongs(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "歌单不存在")
			return
		}
		if errors.Is(err, service.ErrUnsupportedMusicURL) {
			writeError(w, http.StatusBadRequest, "unsupported_url", "不支持的歌单平台")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "刷新歌单失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "歌单已刷新",
		"playlist": playlist,
	})
}

// --- 公开接口（前台）---

// GetActivePlaylist 获取当前启用的歌单配置
// GET /api/v1/music/playlist/config/active
// 公开接口，无需认证
func (h *MusicAdminHandler) GetActivePlaylist(w http.ResponseWriter, r *http.Request) {
	playlist, err := h.playlistAdminService.GetActivePlaylist(r.Context())
	if err != nil {
		if errors.Is(err, service.ErrNoActivePlaylist) {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"playlist": nil,
				"message":  "暂无启用的歌单",
			})
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "获取歌单失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"playlist": playlist,
	})
}

// GetAllActivePlaylists 获取所有启用的歌单列表
// GET /api/v1/music/playlists/active
// 公开接口，无需认证
func (h *MusicAdminHandler) GetAllActivePlaylists(w http.ResponseWriter, r *http.Request) {
	playlists, err := h.playlistAdminService.GetAllActivePlaylists(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取歌单列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"playlists": playlists,
	})
}

// GetMusicSettings 获取音乐播放器设置
// GET /api/v1/music/settings
// 公开接口，无需认证
func (h *MusicAdminHandler) GetMusicSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.musicSettingsService.GetMusicSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取音乐设置失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"settings": settings,
	})
}

// UpdatePlayerVersion 更新播放器版本
// PATCH /api/v1/admin/music/settings
// 需要管理员权限
func (h *MusicAdminHandler) UpdatePlayerVersion(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PlayerVersion string `json:"player_version"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 验证播放器版本
	if req.PlayerVersion != "v1" && req.PlayerVersion != "v2" {
		writeError(w, http.StatusBadRequest, "validation_error", "播放器版本必须是 v1 或 v2")
		return
	}

	settings, err := h.musicSettingsService.UpdatePlayerVersion(r.Context(), req.PlayerVersion)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "更新播放器版本失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "播放器版本已更新",
		"settings": settings,
	})
}