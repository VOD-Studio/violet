package handler

import (
	"net/http"

	"blog-api/internal/service"
)

// MusicHandler 音乐嵌入接口处理器
type MusicHandler struct {
	musicService *service.MusicService
}

// NewMusicHandler 创建音乐嵌入处理器实例
func NewMusicHandler(musicService *service.MusicService) *MusicHandler {
	return &MusicHandler{
		musicService: musicService,
	}
}

// GetEmbedInfo 解析音乐链接并返回嵌入信息
// GET /api/v1/music/embed?url=xxx
// 支持网易云音乐和 QQ 音乐链接
func (h *MusicHandler) GetEmbedInfo(w http.ResponseWriter, r *http.Request) {
	url := r.URL.Query().Get("url")
	if url == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "链接参数不能为空")
		return
	}

	info, err := h.musicService.ParseMusicURL(url)
	if err != nil {
		if err == service.ErrUnsupportedMusicURL {
			writeError(w, http.StatusBadRequest, "unsupported_url", "不支持的音乐链接格式")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "解析音乐链接失败")
		return
	}

	writeJSON(w, http.StatusOK, info)
}

// GetPlaylist 解析歌单链接并返回歌单信息
// GET /api/v1/music/playlist?url=xxx
// 支持网易云音乐和 QQ 音乐歌单
func (h *MusicHandler) GetPlaylist(w http.ResponseWriter, r *http.Request) {
	link := r.URL.Query().Get("url")
	if link == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "链接参数不能为空")
		return
	}

	playlist, err := h.musicService.ParsePlaylistURL(link)
	if err != nil {
		if err == service.ErrUnsupportedMusicURL {
			writeError(w, http.StatusBadRequest, "unsupported_url", "不支持的歌单链接格式")
			return
		}
		if err == service.ErrPlaylistNotFound {
			writeError(w, http.StatusNotFound, "not_found", "歌单不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "获取歌单信息失败")
		return
	}

	writeJSON(w, http.StatusOK, playlist)
}

// GetSongDetail 获取歌曲详情
// GET /api/v1/music/song?platform=xxx&id=xxx
func (h *MusicHandler) GetSongDetail(w http.ResponseWriter, r *http.Request) {
	platform := r.URL.Query().Get("platform")
	songID := r.URL.Query().Get("id")

	if platform == "" || songID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "平台和歌曲ID参数不能为空")
		return
	}

	song, err := h.musicService.FetchSongDetail(platform, songID)
	if err != nil {
		if err == service.ErrPlaylistNotFound {
			writeError(w, http.StatusNotFound, "not_found", "歌曲不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "获取歌曲详情失败")
		return
	}

	writeJSON(w, http.StatusOK, song)
}
