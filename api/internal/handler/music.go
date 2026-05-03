package handler

import (
	"net/http"
	"strconv"

	"blog-api/internal/service"
)

// MusicHandler 音乐嵌入接口处理器
type MusicHandler struct {
	musicService  *service.MusicService
	searchService *service.MusicSearchService
}

func NewMusicHandler(musicService *service.MusicService, searchService *service.MusicSearchService) *MusicHandler {
	return &MusicHandler{
		musicService:  musicService,
		searchService: searchService,
	}
}

// GetEmbedInfo 解析音乐链接并返回嵌入信息
// GET /api/v1/music/embed?url=xxx
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

// SearchSongs 搜索歌曲
// GET /api/v1/music/search?keyword=xxx&limit=10
func (h *MusicHandler) SearchSongs(w http.ResponseWriter, r *http.Request) {
	keyword := r.URL.Query().Get("keyword")
	if keyword == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "搜索关键词不能为空")
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	results, err := h.searchService.SearchSongs(keyword, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "搜索歌曲失败")
		return
	}

	writeJSON(w, http.StatusOK, results)
}

// GetLyrics 获取歌词
// GET /api/v1/music/lyrics?platform=netease&id=xxx
func (h *MusicHandler) GetLyrics(w http.ResponseWriter, r *http.Request) {
	platform := r.URL.Query().Get("platform")
	songID := r.URL.Query().Get("id")

	if platform == "" || songID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "平台和歌曲ID参数不能为空")
		return
	}

	lrc, err := h.searchService.FetchLyrics(platform, songID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取歌词失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"lrc": lrc})
}

// FetchSongMeta 获取歌曲元数据（封面+歌词）
// GET /api/v1/music/meta?platform=netease&id=xxx
func (h *MusicHandler) FetchSongMeta(w http.ResponseWriter, r *http.Request) {
	platform := r.URL.Query().Get("platform")
	songID := r.URL.Query().Get("id")

	if platform == "" || songID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "平台和歌曲ID参数不能为空")
		return
	}

	detail, err := h.searchService.FetchSongDetail(platform, songID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "获取歌曲元数据失败")
		return
	}

	writeJSON(w, http.StatusOK, detail)
}
