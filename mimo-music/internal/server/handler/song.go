// Package handler 提供 mimo-music HTTP 服务的请求处理器。
package handler

import (
	"net/http"

	"github.com/VOD-Studio/mimo-music/internal/server/response"
)

// SongDetailResponse 是歌曲详情响应数据。
type SongDetailResponse struct {
	// ID 是歌曲 ID。
	ID string `json:"id"`

	// Name 是歌曲名。
	Name string `json:"name"`

	// Artist 是歌手。
	Artist string `json:"artist"`

	// Album 是专辑。
	Album string `json:"album"`

	// Cover 是封面。
	Cover string `json:"cover"`
}

// SongURLResponse 是播放 URL 响应数据。
type SongURLResponse struct {
	// URL 是播放直链。
	URL string `json:"url"`
}

// LyricResponse 是歌词响应数据。
type LyricResponse struct {
	// Lrc 是原始 LRC 歌词。
	Lrc string `json:"lrc"`

	// Translated 是翻译歌词。
	Translated string `json:"translated,omitempty"`

	// Romanized 是音译歌词。
	Romanized string `json:"romanized,omitempty"`
}

// GetSongDetail 处理 GET /api/v1/songs/:id。
func (h *Handler) GetSongDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, 10400, "歌曲 ID 不能为空")
		return
	}

	result, err := h.songSvc.Detail(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}

	response.OK(w, SongDetailResponse{
		ID: result.ID, Name: result.Name, Artist: result.Artist,
		Album: result.Album, Cover: result.Cover,
	})
}

// GetSongURL 处理 GET /api/v1/songs/:id/url。
func (h *Handler) GetSongURL(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, 10400, "歌曲 ID 不能为空")
		return
	}

	level := r.URL.Query().Get("level")
	url, err := h.songSvc.URL(r.Context(), id, level)
	if err != nil {
		writeError(w, err)
		return
	}

	response.OK(w, SongURLResponse{URL: url})
}

// GetLyric 处理 GET /api/v1/songs/:id/lyric。
func (h *Handler) GetLyric(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, 10400, "歌曲 ID 不能为空")
		return
	}

	result, err := h.songSvc.Lyric(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}

	response.OK(w, LyricResponse{
		Lrc: result.Lrc, Translated: result.Translated, Romanized: result.Romanized,
	})
}
