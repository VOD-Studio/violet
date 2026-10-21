package music

import (
	"encoding/json"
	"net/http"

	appmusic "blog-api/internal/application/music"
	"blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)

type Handler struct{ svc *appmusic.Service }

func NewHandler(svc *appmusic.Service) *Handler { return &Handler{svc: svc} }
func respond(w http.ResponseWriter, r *http.Request, value any, err error) {
	w.Header().Set("Cache-Control", "no-store")
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, value)
}
func paged[T any](w http.ResponseWriter, r *http.Request, value shared.PageResult[T], err error) {
	w.Header().Set("Cache-Control", "no-store")
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, value.Items, value.Page, value.Limit, value.Total)
}
func created(w http.ResponseWriter, r *http.Request, value any, err error) {
	w.Header().Set("Cache-Control", "no-store")
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, value)
}
func decode(w http.ResponseWriter, r *http.Request, target any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		response.RespondError(w, r, shared.BadRequest("请求体格式错误"))
		return false
	}
	return true
}
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) { respond(w, r, h.svc.Status(), nil) }
func (h *Handler) Verify(w http.ResponseWriter, r *http.Request) {
	respond(w, r, h.svc.Verify(r.Context()), nil)
}
func (h *Handler) Account(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.Account(r.Context())
	respond(w, r, value, err)
}
func (h *Handler) LoginQR(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.LoginQR(r.Context(), middleware.GetUserID(r.Context()))
	created(w, r, value, err)
}
func (h *Handler) CheckQR(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.CheckQR(r.Context(), r.PathValue("id"), middleware.GetUserID(r.Context()))
	respond(w, r, value, err)
}
func (h *Handler) CancelQR(w http.ResponseWriter, r *http.Request) {
	respond(w, r, nil, h.svc.CancelQR(r.Context(), r.PathValue("id"), middleware.GetUserID(r.Context())))
}
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.Refresh(r.Context())
	respond(w, r, value, err)
}
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	respond(w, r, nil, h.svc.Logout(r.Context()))
}
func (h *Handler) Featured(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.Featured(r.Context())
	respond(w, r, value, err)
}
func (h *Handler) AddFeatured(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PlaylistID string `json:"playlist_id"`
	}
	if !decode(w, r, &req) {
		return
	}
	value, err := h.svc.AddFeatured(r.Context(), req.PlaylistID)
	created(w, r, value, err)
}
func (h *Handler) SetEnabled(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Enabled *bool `json:"enabled"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.Enabled == nil {
		respond(w, r, nil, shared.BadRequest("enabled 为必填字段"))
		return
	}
	value, err := h.svc.SetEnabled(r.Context(), r.PathValue("id"), *req.Enabled)
	respond(w, r, value, err)
}
func (h *Handler) OrderFeatured(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []string `json:"ids"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.IDs == nil {
		respond(w, r, nil, shared.BadRequest("ids 为必填数组"))
		return
	}
	value, err := h.svc.OrderFeatured(r.Context(), req.IDs)
	respond(w, r, value, err)
}
func (h *Handler) RemoveFeatured(w http.ResponseWriter, r *http.Request) {
	respond(w, r, nil, h.svc.RemoveFeatured(r.Context(), r.PathValue("id")))
}
func (h *Handler) UserPlaylists(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.UserPlaylists(r.Context(), response.ParsePageQuery(r))
	paged(w, r, value, err)
}
func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	q := response.ParsePageQuery(r)
	switch r.URL.Query().Get("type") {
	case "song":
		value, err := h.svc.SearchSongs(r.Context(), r.URL.Query().Get("q"), q)
		paged(w, r, value, err)
	case "playlist":
		value, err := h.svc.SearchPlaylists(r.Context(), r.URL.Query().Get("q"), q)
		paged(w, r, value, err)
	default:
		respond(w, r, nil, shared.BadRequest("搜索类型必须为 song 或 playlist"))
	}
}
func (h *Handler) AdminTracks(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.Tracks(r.Context(), r.PathValue("id"), response.ParsePageQuery(r), false)
	paged(w, r, value, err)
}
func (h *Handler) PublicTracks(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.Tracks(r.Context(), r.PathValue("id"), response.ParsePageQuery(r), true)
	paged(w, r, value, err)
}
func (h *Handler) PublicPlaylists(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.PublicPlaylists(r.Context())
	respond(w, r, value, err)
}
func (h *Handler) PublicPlayback(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.Playback(r.Context())
	respond(w, r, value, err)
}
func (h *Handler) Song(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.Song(r.Context(), r.PathValue("id"))
	respond(w, r, value, err)
}
func (h *Handler) SongURL(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.SongURL(r.Context(), r.PathValue("id"), r.URL.Query().Get("level"))
	respond(w, r, value, err)
}

// SongStream 按需解析播放地址（站点账号或匿名），只重定向、不代理音频。
func (h *Handler) SongStream(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.SongURL(r.Context(), r.PathValue("id"), r.URL.Query().Get("level"))
	if err != nil {
		respond(w, r, nil, err)
		return
	}
	if !value.Playable || value.URL == nil {
		respond(w, r, nil, shared.NotFound("可播放的完整音频地址"))
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, *value.URL, http.StatusFound)
}

func (h *Handler) Lyric(w http.ResponseWriter, r *http.Request) {
	value, err := h.svc.Lyric(r.Context(), r.PathValue("id"))
	respond(w, r, value, err)
}
