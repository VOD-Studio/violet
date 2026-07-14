// Package handler 提供 mimo-music HTTP 服务的请求处理器。
package handler

import (
	"net/http"

	"github.com/VOD-Studio/mimo-music/internal/server/response"
)

// AlbumResponse 是专辑详情响应数据。
type AlbumResponse struct {
	// ID 是专辑 ID。
	ID string `json:"id"`

	// Name 是专辑名。
	Name string `json:"name"`

	// Cover 是封面 URL。
	Cover string `json:"cover"`

	// Artist 是专辑歌手。
	Artist string `json:"artist"`

	// PublishTime 是发行时间。
	PublishTime string `json:"publish_time"`

	// Songs 是歌曲列表。
	Songs []PlaylistSong `json:"songs"`
}

// GetAlbum 处理 GET /api/v1/albums/:id。
func (h *Handler) GetAlbum(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, 10400, "专辑 ID 不能为空")
		return
	}

	result, err := h.albumSvc.Detail(r.Context(), id)
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

	response.OK(w, AlbumResponse{
		ID: result.ID, Name: result.Name, Cover: result.Cover,
		Artist: result.Artist, PublishTime: result.PublishTime, Songs: songs,
	})
}
