// Package media 提供 emoji/music/upload 的 HTTP handler（DDD 版）。
package media

import (
	"encoding/json"
	"io"
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
	Name      string `json:"name" validate:"required"`
	Source    string `json:"source"`
	SortOrder int    `json:"sort_order"`
	IsEnabled *bool  `json:"is_enabled"`
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
	enabled := true
	if req.IsEnabled != nil {
		enabled = *req.IsEnabled
	}
	id, err := h.emojiSvc.CreateGroup(r.Context(), appmedia.CreateGroupInput{
		Name: req.Name, Source: source, SortOrder: req.SortOrder, IsEnabled: enabled,
	})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": map[string]any{"id": id}})
}

// GetEmojiGroupByName 按名称获取分组（含表情，公开）
func (h *Handler) GetEmojiGroupByName(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	dto, err := h.emojiSvc.GetGroupByName(r.Context(), name)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": dto})
}

// UpdateEmojiGroup 更新分组
func (h *Handler) UpdateEmojiGroup(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	var req struct {
		Name      string `json:"name"`
		Source    string `json:"source"`
		SortOrder *int   `json:"sort_order"`
		IsEnabled *bool  `json:"is_enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.emojiSvc.UpdateGroup(r.Context(), appmedia.UpdateGroupInput{
		ID: int32(id), Name: req.Name, Source: req.Source,
		SortOrder: req.SortOrder, IsEnabled: req.IsEnabled,
	}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "分组已更新"})
}

// BatchUpdateEmojiGroupStatus 批量启用/禁用分组
func (h *Handler) BatchUpdateEmojiGroupStatus(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs    []int32 `json:"ids" validate:"required,min=1"`
		Enable bool    `json:"is_enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	affected, err := h.emojiSvc.BatchUpdateEnabled(r.Context(), req.IDs, req.Enable)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "批量更新成功", "updated": affected})
}

// ListGroupEmojis 列出分组内表情
func (h *Handler) ListGroupEmojis(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	emojis, err := h.emojiSvc.ListEmojisByGroup(r.Context(), int32(id))
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": emojis})
}

// CreateEmoji 在分组内创建表情
func (h *Handler) CreateEmoji(w http.ResponseWriter, r *http.Request) {
	groupID, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	var req struct {
		Name        string `json:"name" validate:"required"`
		URL         string `json:"url"`
		TextContent string `json:"text_content"`
		GifURL      string `json:"gif_url"`
		SourceURL   string `json:"source_url"`
		SortOrder   int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	id, err := h.emojiSvc.CreateEmoji(r.Context(), appmedia.CreateEmojiInput{
		GroupID: int32(groupID), Name: req.Name, URL: req.URL,
		TextContent: req.TextContent, GifURL: req.GifURL,
		SourceURL: req.SourceURL, SortOrder: req.SortOrder,
	})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": map[string]any{"id": id}})
}

// UpdateEmoji 更新表情
func (h *Handler) UpdateEmoji(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	var req struct {
		Name        string `json:"name"`
		URL         string `json:"url"`
		TextContent string `json:"text_content"`
		GifURL      string `json:"gif_url"`
		SourceURL   string `json:"source_url"`
		SortOrder   int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.emojiSvc.UpdateEmoji(r.Context(), appmedia.UpdateEmojiInput{
		ID: int32(id), Name: req.Name, URL: req.URL,
		TextContent: req.TextContent, GifURL: req.GifURL,
		SourceURL: req.SourceURL, SortOrder: req.SortOrder,
	}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "表情已更新"})
}

// DeleteEmoji 删除表情
func (h *Handler) DeleteEmoji(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.emojiSvc.DeleteEmoji(r.Context(), int32(id)); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "表情已删除"})
}

// UploadEmoji 上传表情文件
func (h *Handler) UploadEmoji(w http.ResponseWriter, r *http.Request) {
	// 限制 10MB
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	defer file.Close()
	content := make([]byte, header.Size)
	if _, err := file.Read(content); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	result, err := h.emojiSvc.UploadEmoji(r.Context(), header.Filename, header.Header.Get("Content-Type"), header.Size, content)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": result})
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

// GetMedia 获取媒体详情（公开）
func (h *Handler) GetMedia(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	dto, err := h.uploadSvc.GetFile(r.Context(), id)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": dto})
}

// BatchDeleteMedia 批量删除媒体
func (h *Handler) BatchDeleteMedia(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []string `json:"ids" validate:"required,min=1"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	deleted, err := h.uploadSvc.BatchDeleteFiles(r.Context(), req.IDs)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "批量删除完成", "deleted": deleted})
}

// UploadThumbnail 上传缩略图
func (h *Handler) UploadThumbnail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	defer file.Close()
	content := make([]byte, header.Size)
	if _, err := file.Read(content); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	url, err := h.uploadSvc.UploadThumbnail(r.Context(), appmedia.UploadThumbnailInput{
		FileID: id, FileName: header.Filename,
		MimeType: header.Header.Get("Content-Type"), Content: content,
	})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"thumbnail": url}})
}

// ============================================================
// 分片上传（Chunked Upload）
// ============================================================

// InitUploadSession 初始化上传会话（含秒传检查、断点续传恢复）
func (h *Handler) InitUploadSession(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	var req struct {
		FileName  string `json:"fileName" validate:"required"`
		FileSize  int64  `json:"fileSize" validate:"required"`
		FileHash  string `json:"fileHash"`
		MimeType  string `json:"mimeType"`
		ChunkSize int    `json:"chunkSize"`
		Purpose   string `json:"purpose"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	result, err := h.uploadSvc.InitSession(r.Context(), appmedia.InitSessionInput{
		UserID: userID, FileName: req.FileName, FileSize: req.FileSize,
		FileHash: req.FileHash, MimeType: req.MimeType,
		ChunkSize: req.ChunkSize, Purpose: req.Purpose,
	})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": result})
}

// SaveUploadChunk 上传单个分片
func (h *Handler) SaveUploadChunk(w http.ResponseWriter, r *http.Request) {
	uploadID := r.PathValue("uploadId")
	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	data, err := io.ReadAll(r.Body)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.uploadSvc.SaveChunk(r.Context(), uploadID, index, data); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "分片已保存"})
}

// CompleteUpload 合并所有分片为完整文件
func (h *Handler) CompleteUpload(w http.ResponseWriter, r *http.Request) {
	uploadID := r.PathValue("uploadId")
	userID := interfacesmw.GetUserIDFromContext(r)
	result, err := h.uploadSvc.CompleteUpload(r.Context(), uploadID, userID)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": result})
}

// CancelUpload 取消上传，清理临时分片
func (h *Handler) CancelUpload(w http.ResponseWriter, r *http.Request) {
	uploadID := r.PathValue("uploadId")
	if err := h.uploadSvc.CancelUpload(r.Context(), uploadID); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "上传已取消"})
}

// GetUploadStatus 查询上传状态（断点续传）
func (h *Handler) GetUploadStatus(w http.ResponseWriter, r *http.Request) {
	uploadID := r.PathValue("uploadId")
	result, err := h.uploadSvc.GetUploadStatus(r.Context(), uploadID)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": result})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
