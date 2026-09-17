package chat

import (
	"errors"
	"mime"
	"net/http"

	appappearance "blog-api/internal/application/chatappearance"
	domainappearance "blog-api/internal/domain/chatappearance"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/handler/chatappearanceinput"
	"blog-api/internal/interfaces/http/response"
)

// WithAppearanceService 以装饰器方式注入可选外观服务,不改动 chat 服务的构造函数。
func (h *Handler) WithAppearanceService(service *appappearance.Service) *Handler {
	h.appearance = service
	return h
}

func appearanceError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, domainappearance.ErrConflict):
		response.RespondError(w, r, domainshared.Conflict("外观已在其他设备修改，请重新加载后再保存"))
	case errors.Is(err, domainappearance.ErrInvalid):
		response.RespondError(w, r, domainshared.BadRequest("外观参数非法，请使用当前素材目录中的选项"))
	default:
		response.RespondError(w, r, domainshared.Internal("无法读取或保存聊天外观", err))
	}
}

// GetAppearance 读取当前登录用户的外观,含乐观锁版本号。
func (h *Handler) GetAppearance(w http.ResponseWriter, r *http.Request) {
	actor, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	if h.appearance == nil {
		appearanceError(w, r, errors.New("appearance service not configured"))
		return
	}
	state, err := h.appearance.Get(r.Context(), actor.String())
	if err != nil {
		appearanceError(w, r, err)
		return
	}
	response.RespondOK(w, state)
}

// UpdateAppearance 的操作者一律取自会话;拒绝客户端自报 user_id。
func (h *Handler) UpdateAppearance(w http.ResponseWriter, r *http.Request) {
	actor, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	if h.appearance == nil {
		appearanceError(w, r, errors.New("appearance service not configured"))
		return
	}
	contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		response.RespondError(w, r, domainshared.BadRequest("Content-Type 必须是 application/json"))
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, chatappearanceinput.MaxBodyBytes)
	input, err := chatappearanceinput.Decode(r.Body)
	if err != nil {
		appearanceError(w, r, domainappearance.ErrInvalid)
		return
	}
	state, err := h.appearance.Update(r.Context(), actor.String(), input.Selection, input.Revision)
	if err != nil {
		appearanceError(w, r, err)
		return
	}
	response.RespondOK(w, state)
}

// ListAppearances 只暴露公开装饰;调用方仍须登录。
func (h *Handler) ListAppearances(w http.ResponseWriter, r *http.Request) {
	if _, err := currentUserID(r); err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	if h.appearance == nil {
		appearanceError(w, r, errors.New("appearance service not configured"))
		return
	}
	ids, err := chatappearanceinput.ParseUserIDs(r.URL.Query().Get("user_ids"))
	if err != nil {
		appearanceError(w, r, err)
		return
	}
	values, err := h.appearance.List(r.Context(), ids)
	if err != nil {
		appearanceError(w, r, err)
		return
	}
	response.RespondOK(w, values)
}
