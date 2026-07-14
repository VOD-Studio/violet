// Package handler 提供 mimo-music HTTP 服务的请求处理器。
package handler

import (
	"net/http"

	"github.com/VOD-Studio/mimo-music/internal/server/response"
)

// ArtistResponse 是歌手信息响应数据。
type ArtistResponse struct {
	// ID 是歌手 ID。
	ID string `json:"id"`

	// Name 是歌手名。
	Name string `json:"name"`

	// Cover 是歌手封面 URL。
	Cover string `json:"cover"`

	// Description 是歌手简介。
	Description string `json:"description"`

	// Songs 是热门歌曲列表。
	Songs []PlaylistSong `json:"songs"`
}

// GetArtist 处理 GET /api/v1/artists/:id。
func (h *Handler) GetArtist(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, 10400, "歌手 ID 不能为空")
		return
	}

	result, err := h.artistSvc.Info(r.Context(), id)
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

	response.OK(w, ArtistResponse{
		ID: result.ID, Name: result.Name, Cover: result.Cover,
		Description: result.Description, Songs: songs,
	})
}
