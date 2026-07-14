// Package handler 提供 mimo-music HTTP 服务的请求处理器。
package handler

import (
	"net/http"

	"github.com/VOD-Studio/mimo-music/internal/server/response"
)

// RecommendResponse 是每日推荐响应数据。
type RecommendResponse struct {
	// Songs 是推荐歌曲列表。
	Songs []PlaylistSong `json:"songs"`
}

// GetDailyRecommend 处理 GET /api/v1/recommend/daily。
func (h *Handler) GetDailyRecommend(w http.ResponseWriter, r *http.Request) {
	songs, err := h.recommendSvc.Daily(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}

	result := make([]PlaylistSong, 0, len(songs))
	for _, s := range songs {
		result = append(result, PlaylistSong{
			ID: s.ID, Name: s.Name, Artist: s.Artist, Album: s.Album, Cover: s.Cover,
		})
	}

	response.OK(w, RecommendResponse{Songs: result})
}
