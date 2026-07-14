// Package handler 提供 mimo-music HTTP 服务的请求处理器。
package handler

import (
	"net/http"

	"github.com/VOD-Studio/mimo-music/internal/server/response"
)

// PlaylistResponse 是歌单详情响应数据。
type PlaylistResponse struct {
	// ID 是歌单 ID。
	ID string `json:"id"`

	// Title 是歌单标题。
	Title string `json:"title"`

	// Cover 是封面 URL。
	Cover string `json:"cover"`

	// Creator 是创建者。
	Creator string `json:"creator"`

	// Songs 是歌曲列表。
	Songs []PlaylistSong `json:"songs"`
}

// PlaylistSong 是歌单内歌曲的响应数据。
type PlaylistSong struct {
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

// GetPlaylist 处理 GET /api/v1/playlists/:id。
func (h *Handler) GetPlaylist(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, 10400, "歌单 ID 不能为空")
		return
	}

	result, err := h.playlistSvc.Detail(r.Context(), id)
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

	response.OK(w, PlaylistResponse{
		ID: result.ID, Title: result.Title, Cover: result.Cover,
		Creator: result.Creator, Songs: songs,
	})
}
