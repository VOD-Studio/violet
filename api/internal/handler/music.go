// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"net/http"
	"strconv"

	"github.com/rs/zerolog/log"

	"blog-api/internal/pkg/request"
	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

// MusicHandler 音乐嵌入接口处理器
type MusicHandler struct {
	musicService  *service.MusicService
	searchService *service.MusicSearchService
}

// NewMusicHandler 创建音乐处理器实例
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
	log.Info().Str("handler", "GetEmbedInfo").Str("url", url).Msg("处理请求")

	if url == "" {
		log.Warn().Msg("参数验证失败：链接参数不能为空")
		response.Error(w, http.StatusBadRequest, "validation_error", "链接参数不能为空")
		return
	}

	info, err := h.musicService.ParseMusicURL(url)
	if err != nil {
		if err == service.ErrUnsupportedMusicURL {
			log.Warn().Str("url", url).Msg("不支持的音乐链接格式")
			response.Error(w, http.StatusBadRequest, "unsupported_url", "不支持的音乐链接格式")
			return
		}
		log.Error().Err(err).Str("operation", "ParseMusicURL").Msg("服务调用失败")
		response.InternalServerError(w, "解析音乐链接失败")
		return
	}

	response.Success(w, info)
	log.Info().Int("status", http.StatusOK).Msg("请求处理成功")
}

// GetPlaylist 解析歌单链接并返回歌单信息
// GET /api/v1/music/playlist?url=xxx
func (h *MusicHandler) GetPlaylist(w http.ResponseWriter, r *http.Request) {
	link := r.URL.Query().Get("url")
	log.Info().Str("handler", "GetPlaylist").Str("url", link).Msg("处理请求")

	if link == "" {
		log.Warn().Msg("参数验证失败：链接参数不能为空")
		response.Error(w, http.StatusBadRequest, "validation_error", "链接参数不能为空")
		return
	}

	playlist, err := h.musicService.ParsePlaylistURL(link)
	if err != nil {
		if err == service.ErrUnsupportedMusicURL {
			log.Warn().Str("url", link).Msg("不支持的歌单链接格式")
			response.Error(w, http.StatusBadRequest, "unsupported_url", "不支持的歌单链接格式")
			return
		}
		if err == service.ErrPlaylistNotFound {
			log.Warn().Str("url", link).Msg("歌单不存在")
			response.NotFound(w, "歌单不存在")
			return
		}
		log.Error().Err(err).Str("operation", "ParsePlaylistURL").Msg("服务调用失败")
		response.InternalServerError(w, "获取歌单信息失败")
		return
	}

	response.Success(w, playlist)
	log.Info().Int("status", http.StatusOK).Msg("请求处理成功")
}

// GetSongDetail 获取歌曲详情
// GET /api/v1/music/song?platform=xxx&id=xxx
func (h *MusicHandler) GetSongDetail(w http.ResponseWriter, r *http.Request) {
	platform := r.URL.Query().Get("platform")
	songID := r.URL.Query().Get("id")
	log.Info().Str("handler", "GetSongDetail").Str("platform", platform).Str("song_id", songID).Msg("处理请求")

	if platform == "" || songID == "" {
		log.Warn().Msg("参数验证失败：平台和歌曲ID参数不能为空")
		response.Error(w, http.StatusBadRequest, "validation_error", "平台和歌曲ID参数不能为空")
		return
	}

	song, err := h.musicService.FetchSongDetail(platform, songID)
	if err != nil {
		if err == service.ErrPlaylistNotFound {
			log.Warn().Str("platform", platform).Str("song_id", songID).Msg("歌曲不存在")
			response.NotFound(w, "歌曲不存在")
			return
		}
		log.Error().Err(err).Str("operation", "FetchSongDetail").Msg("服务调用失败")
		response.InternalServerError(w, "获取歌曲详情失败")
		return
	}

	response.Success(w, song)
	log.Info().Int("status", http.StatusOK).Msg("请求处理成功")
}

// SearchSongs 搜索歌曲
// GET /api/v1/music/search?keyword=xxx&limit=10
func (h *MusicHandler) SearchSongs(w http.ResponseWriter, r *http.Request) {
	keyword := r.URL.Query().Get("keyword")
	log.Info().Str("handler", "SearchSongs").Str("keyword", keyword).Msg("处理请求")

	if keyword == "" {
		log.Warn().Msg("参数验证失败：搜索关键词不能为空")
		response.Error(w, http.StatusBadRequest, "validation_error", "搜索关键词不能为空")
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
		log.Error().Err(err).Str("operation", "SearchSongs").Msg("服务调用失败")
		response.InternalServerError(w, "搜索歌曲失败")
		return
	}

	response.Success(w, results)
	log.Info().Int("status", http.StatusOK).Int("result_count", len(results)).Msg("请求处理成功")
}

// GetLyrics 获取歌词
// GET /api/v1/music/lyrics?platform=netease&id=xxx
func (h *MusicHandler) GetLyrics(w http.ResponseWriter, r *http.Request) {
	platform := r.URL.Query().Get("platform")
	songID := r.URL.Query().Get("id")
	log.Info().Str("handler", "GetLyrics").Str("platform", platform).Str("song_id", songID).Msg("处理请求")

	if platform == "" || songID == "" {
		log.Warn().Msg("参数验证失败：平台和歌曲ID参数不能为空")
		response.Error(w, http.StatusBadRequest, "validation_error", "平台和歌曲ID参数不能为空")
		return
	}

	lrc, err := h.searchService.FetchLyrics(platform, songID)
	if err != nil {
		log.Error().Err(err).Str("operation", "FetchLyrics").Msg("服务调用失败")
		response.InternalServerError(w, "获取歌词失败")
		return
	}

	response.Success(w, map[string]string{"lrc": lrc})
	log.Info().Int("status", http.StatusOK).Msg("请求处理成功")
}

// FetchSongMeta 获取歌曲元数据（封面+歌词）
// GET /api/v1/music/meta?platform=netease&id=xxx
func (h *MusicHandler) FetchSongMeta(w http.ResponseWriter, r *http.Request) {
	platform := r.URL.Query().Get("platform")
	songID := r.URL.Query().Get("id")
	log.Info().Str("handler", "FetchSongMeta").Str("platform", platform).Str("song_id", songID).Msg("处理请求")

	if platform == "" || songID == "" {
		log.Warn().Msg("参数验证失败：平台和歌曲ID参数不能为空")
		response.Error(w, http.StatusBadRequest, "validation_error", "平台和歌曲ID参数不能为空")
		return
	}

	detail, err := h.searchService.FetchSongDetail(platform, songID)
	if err != nil {
		log.Error().Err(err).Str("operation", "FetchSongDetail").Msg("服务调用失败")
		response.InternalServerError(w, "获取歌曲元数据失败")
		return
	}

	response.Success(w, detail)
	log.Info().Int("status", http.StatusOK).Msg("请求处理成功")
}
