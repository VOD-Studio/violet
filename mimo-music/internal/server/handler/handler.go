// Package handler 提供 mimo-music HTTP 服务的请求处理器。
package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	merrors "github.com/VOD-Studio/mimo-music/errors"
	"github.com/VOD-Studio/mimo-music/internal/server/response"
	"github.com/VOD-Studio/mimo-music/service"
)

// Handler 是所有 HTTP handler 的容器，持有各 service。
type Handler struct {
	authSvc      *service.AuthService
	playlistSvc  *service.PlaylistService
	songSvc      *service.SongService
	searchSvc    *service.SearchService
	albumSvc     *service.AlbumService
	artistSvc    *service.ArtistService
	recommendSvc *service.RecommendService
	fmSvc        *service.FMService
}

// New 创建 Handler。
func New(
	authSvc *service.AuthService,
	playlistSvc *service.PlaylistService,
	songSvc *service.SongService,
	searchSvc *service.SearchService,
	albumSvc *service.AlbumService,
	artistSvc *service.ArtistService,
	recommendSvc *service.RecommendService,
	fmSvc *service.FMService,
) *Handler {
	return &Handler{
		authSvc:      authSvc,
		playlistSvc:  playlistSvc,
		songSvc:      songSvc,
		searchSvc:    searchSvc,
		albumSvc:     albumSvc,
		artistSvc:    artistSvc,
		recommendSvc: recommendSvc,
		fmSvc:        fmSvc,
	}
}

// mapError 把统一错误映射到 HTTP 状态码 + 业务 code。
func mapError(err error) (int, response.Code, string) {
	switch {
	case isErr(err, service.ErrNoAvailableSession):
		return http.StatusServiceUnavailable, 10503, "所有登录态均不可用"
	case isErr(err, merrors.ErrUnauthorized):
		return http.StatusUnauthorized, 10401, "登录态失效"
	case isErr(err, merrors.ErrRateLimited):
		return http.StatusTooManyRequests, 10429, "被限流"
	case isErr(err, merrors.ErrNotFound):
		return http.StatusNotFound, 10404, "资源不存在"
	case isErr(err, merrors.ErrUpstreamUnavailable):
		return http.StatusBadGateway, 10502, "上游不可用"
	case isErr(err, merrors.ErrInvalidResponse):
		return http.StatusBadGateway, 10502, "上游响应无效"
	default:
		return http.StatusInternalServerError, 10500, err.Error()
	}
}

// isErr 检查 err 是否匹配目标（errors.Is 封装）。
func isErr(err, target error) bool {
	return err != nil && target != nil && errors.Is(err, target)
}

// writeError 写入错误响应。
func writeError(w http.ResponseWriter, err error) {
	status, code, msg := mapError(err)
	response.Error(w, status, code, msg)
}

// decodeJSON 解码请求体 JSON，失败时写入 400 错误。
func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		response.Error(w, http.StatusBadRequest, 10400, "请求体格式错误")
		return false
	}
	return true
}

// 确保 isErr 用 errors.Is 正确匹配（替代字符串比较）。
var _ = errors.Is
