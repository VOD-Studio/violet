// Package handler 提供 mimo-music HTTP 服务的请求处理器。
package handler

import (
	"net/http"

	"github.com/VOD-Studio/mimo-music/internal/server/response"
)

// FMResponse 是私人 FM 响应数据。
type FMResponse struct {
	// Songs 是 FM 歌曲列表。
	Songs []PlaylistSong `json:"songs"`
}

// GetPersonalFM 处理 GET /api/v1/fm。
func (h *Handler) GetPersonalFM(w http.ResponseWriter, r *http.Request) {
	songs, err := h.fmSvc.Personal(r.Context())
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

	response.OK(w, FMResponse{Songs: result})
}
