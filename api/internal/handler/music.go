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
// GET /api/music/embed?url=xxx
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
