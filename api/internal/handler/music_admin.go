package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

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
	log.Info().Str("handler", "ListPlaylists").Msg("处理请求")

	playlists, err := h.playlistAdminService.ListPlaylists(r.Context())
	if err != nil {
		log.Error().Err(err).Str("operation", "ListPlaylists").Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "获取歌单列表失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Int("count", len(playlists)).Msg("请求处理成功")
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"playlists": playlists,
	})
}

// CreatePlaylist 创建歌单（导入链接）
// POST /api/v1/admin/playlists
// 需要管理员权限
func (h *MusicAdminHandler) CreatePlaylist(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "CreatePlaylist").Msg("处理请求")

	var req struct {
		URL string `json:"url" validate:"required"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if req.URL == "" {
		log.Warn().Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", "歌单链接不能为空")
		return
	}

	input := service.CreatePlaylistInput{
		URL: req.URL,
	}

	playlist, err := h.playlistAdminService.CreatePlaylist(r.Context(), input)
	if err != nil {
		if errors.Is(err, service.ErrUnsupportedMusicURL) {
			log.Warn().Err(err).Str("url", req.URL).Msg("参数验证失败")
			writeError(w, http.StatusBadRequest, "unsupported_url", "不支持的歌单链接格式")
			return
		}
		if errors.Is(err, service.ErrPlaylistAlreadyExists) {
			log.Warn().Err(err).Str("url", req.URL).Msg("歌单已存在")
			writeError(w, http.StatusConflict, "already_exists", "歌单已存在")
			return
		}
		if errors.Is(err, service.ErrPlaylistNotFound) {
			log.Warn().Err(err).Str("url", req.URL).Msg("歌单不存在")
			writeError(w, http.StatusNotFound, "not_found", "歌单不存在")
			return
		}
		log.Error().Err(err).Str("operation", "CreatePlaylist").Str("url", req.URL).Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "创建歌单失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("playlist_id", playlist.ID.String()).Msg("请求处理成功")
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
	log.Info().Str("handler", "DeletePlaylist").Msg("处理请求")

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("playlist_id", idStr).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	err = h.playlistAdminService.DeletePlaylist(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			log.Warn().Str("playlist_id", id.String()).Msg("歌单不存在")
			writeError(w, http.StatusNotFound, "not_found", "歌单不存在")
			return
		}
		log.Error().Err(err).Str("operation", "DeletePlaylist").Str("playlist_id", id.String()).Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "删除歌单失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("playlist_id", id.String()).Msg("请求处理成功")
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
	log.Info().Str("handler", "GetActivePlaylist").Msg("处理请求")

	playlist, err := h.playlistAdminService.GetActivePlaylist(r.Context())
	if err != nil {
		if errors.Is(err, service.ErrNoActivePlaylist) {
			log.Info().Msg("暂无启用的歌单")
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"playlist": nil,
				"message":  "暂无启用的歌单",
			})
			return
		}
		log.Error().Err(err).Str("operation", "GetActivePlaylist").Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "获取歌单失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("playlist_id", playlist.ID.String()).Msg("请求处理成功")
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
	log.Info().Str("handler", "UpdatePlayerVersion").Msg("处理请求")

	var req struct {
		PlayerVersion string `json:"player_version"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 验证播放器版本
	if req.PlayerVersion != "v1" && req.PlayerVersion != "v2" {
		log.Warn().Str("player_version", req.PlayerVersion).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", "播放器版本必须是 v1 或 v2")
		return
	}

	settings, err := h.musicSettingsService.UpdatePlayerVersion(r.Context(), req.PlayerVersion)
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdatePlayerVersion").Str("version", req.PlayerVersion).Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "更新播放器版本失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("player_version", req.PlayerVersion).Msg("请求处理成功")
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "播放器版本已更新",
		"settings": settings,
	})
}

// --- 自定义歌单接口（管理端）---

// CreateCustomPlaylist 创建自定义歌单
// POST /api/v1/admin/playlists/custom
// 需要管理员权限
func (h *MusicAdminHandler) CreateCustomPlaylist(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title string `json:"title"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "歌单标题不能为空")
		return
	}

	playlist, err := h.playlistAdminService.CreateCustomPlaylist(r.Context(), req.Title)
	if err != nil {
		log.Printf("[CreateCustomPlaylist] failed: %v", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "创建自定义歌单失败")
		return
	}

	writeJSON(w, http.StatusOK, playlist)
}

// AddSongToPlaylist 向歌单添加歌曲（上传音频文件）
// POST /api/v1/admin/playlists/{id}/songs
// 需要管理员权限
func (h *MusicAdminHandler) AddSongToPlaylist(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "AddSongToPlaylist").Msg("处理请求")

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("playlist_id", idStr).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	file, header, err := r.FormFile("audio")
	if err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "缺少音频文件")
		return
	}
	defer file.Close()

	// 校验音频文件类型
	ext := path.Ext(header.Filename)
	allowedExts := map[string]bool{
		".mp3": true, ".wav": true, ".ogg": true,
		".flac": true, ".aac": true, ".m4a": true,
	}
	if !allowedExts[strings.ToLower(ext)] {
		log.Warn().Str("ext", ext).Str("filename", header.Filename).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_file_type", "仅支持音频文件（mp3, wav, ogg, flac, aac, m4a）")
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType != "" && !strings.HasPrefix(contentType, "audio/") {
		log.Warn().Str("content_type", contentType).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_file_type", "仅支持音频文件")
		return
	}

	uploadDir := "uploads/music"
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		log.Error().Err(err).Str("path", uploadDir).Msg("创建目录失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "创建上传目录失败")
		return
	}

	fileUUID := uuid.New().String()
	ext = path.Ext(header.Filename)
	if ext == "" {
		ext = ".mp3"
	}
	filename := fmt.Sprintf("%s%s", fileUUID, ext)
	filePath := path.Join(uploadDir, filename)

	dst, err := os.Create(filePath)
	if err != nil {
		log.Error().Err(err).Str("path", filePath).Msg("创建文件失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "保存文件失败")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		log.Error().Err(err).Str("path", filePath).Msg("写入文件失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "写入文件失败")
		return
	}

	servedURL := "/uploads/music/" + filename

	playlist, err := h.playlistAdminService.AddSongToPlaylist(r.Context(), id, filePath, servedURL)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			log.Warn().Str("playlist_id", id.String()).Msg("歌单不存在")
			writeError(w, http.StatusNotFound, "not_found", "歌单不存在")
			return
		}
		log.Error().Err(err).Str("operation", "AddSongToPlaylist").Str("playlist_id", id.String()).Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "添加歌曲失败")
		return
	}

	log.Info().Int("status", http.StatusOK).Str("playlist_id", id.String()).Str("filename", header.Filename).Msg("请求处理成功")
	writeJSON(w, http.StatusOK, playlist)
}

// RemoveSongFromPlaylist 从歌单中移除歌曲
// DELETE /api/v1/admin/playlists/{id}/songs/{index}
// 需要管理员权限
func (h *MusicAdminHandler) RemoveSongFromPlaylist(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	indexStr := chi.URLParam(r, "index")
	songIndex, err := strconv.Atoi(indexStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "歌曲索引无效")
		return
	}

	playlist, err := h.playlistAdminService.RemoveSongFromPlaylist(r.Context(), id, songIndex)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "歌单不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "移除歌曲失败")
		return
	}

	writeJSON(w, http.StatusOK, playlist)
}

// UpdateSongInPlaylist 更新歌单中的歌曲信息
// PATCH /api/v1/admin/playlists/{id}/songs/{index}
// 需要管理员权限
func (h *MusicAdminHandler) UpdateSongInPlaylist(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "ID 无效")
		return
	}

	indexStr := chi.URLParam(r, "index")
	songIndex, err := strconv.Atoi(indexStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "歌曲索引无效")
		return
	}

	var req struct {
		Title  string `json:"title"`
		Artist string `json:"artist"`
		Cover  string `json:"cover"`
		Lrc    string `json:"lrc"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	playlist, err := h.playlistAdminService.UpdateSongInPlaylist(r.Context(), id, songIndex, req.Title, req.Artist, req.Cover, req.Lrc)
	if err != nil {
		if errors.Is(err, service.ErrPlaylistNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "歌单不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "更新歌曲信息失败")
		return
	}

	writeJSON(w, http.StatusOK, playlist)
}