// Package handler 提供 mimo-music HTTP 服务的请求处理器。
package handler

import (
	"net/http"
	"strconv"

	"github.com/VOD-Studio/mimo-music/internal/server/response"
)

// SearchResultResponse 是搜索结果响应数据。
type SearchResultResponse struct {
	// Songs 是匹配的歌曲列表。
	Songs []PlaylistSong `json:"songs"`

	// Total 是总数。
	Total int `json:"total"`
}

// Search 处理 GET /api/v1/search。
func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		response.Error(w, http.StatusBadRequest, 10400, "搜索关键词不能为空")
		return
	}

	limit := 10
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}

	result, err := h.searchSvc.Search(r.Context(), q, limit)
	if err != nil {
		writeError(w, err)
		return
	}

	songs := make([]PlaylistSong, 0, len(result.Songs))
	for _, s := range result.Songs {
		songs = append(songs, PlaylistSong{
			ID: s.ID, Name: s.Name, Artist: s.Artist, Album: s.Album, Cover: s.Cover,
		})
	}

	response.OK(w, SearchResultResponse{Songs: songs, Total: result.Total})
}
