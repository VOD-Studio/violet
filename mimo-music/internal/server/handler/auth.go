// Package handler 提供 mimo-music HTTP 服务的请求处理器。
package handler

import (
	"net/http"

	"github.com/VOD-Studio/mimo-music/internal/server/response"
)

// SendCaptchaRequest 是发送验证码的请求体。
type SendCaptchaRequest struct {
	// Phone 是手机号。
	Phone string `json:"phone"`
}

// LoginCellphoneRequest 是手机号登录的请求体。
type LoginCellphoneRequest struct {
	// Phone 是手机号。
	Phone string `json:"phone"`

	// Captcha 是验证码。
	Captcha string `json:"captcha"`
}

// LoginResponse 是登录成功响应数据。
type LoginResponse struct {
	// UserID 是平台用户 ID。
	UserID string `json:"user_id"`

	// Nickname 是用户昵称。
	Nickname string `json:"nickname"`

	// Avatar 是用户头像 URL。
	Avatar string `json:"avatar"`
}

// QrcodeResponse 是获取二维码的响应数据。
type QrcodeResponse struct {
	// Key 是轮询用的 key。
	Key string `json:"key"`

	// URL 是二维码扫描 URL。
	URL string `json:"url"`
}

// QrcodeCheckResponse 是二维码轮询的响应数据。
type QrcodeCheckResponse struct {
	// Code 是状态码（800 失效、801 等待、802 扫描、803 确认）。
	Code int `json:"code"`

	// Message 是状态描述。
	Message string `json:"message"`
}

// LoginStatusResponse 是登录态查询响应数据。
type LoginStatusResponse struct {
	// LoggedIn 表示是否已登录。
	LoggedIn bool `json:"logged_in"`

	// UserID 是用户 ID。
	UserID string `json:"user_id"`

	// Nickname 是用户昵称。
	Nickname string `json:"nickname"`
}

// SendCaptcha 处理 POST /api/v1/auth/captcha。
func (h *Handler) SendCaptcha(w http.ResponseWriter, r *http.Request) {
	var req SendCaptchaRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Phone == "" {
		response.Error(w, http.StatusBadRequest, 10400, "手机号不能为空")
		return
	}

	if err := h.authSvc.SendCaptcha(r.Context(), req.Phone); err != nil {
		writeError(w, err)
		return
	}
	response.OK(w, nil)
}

// LoginCellphone 处理 POST /api/v1/auth/login/cellphone。
func (h *Handler) LoginCellphone(w http.ResponseWriter, r *http.Request) {
	var req LoginCellphoneRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Phone == "" || req.Captcha == "" {
		response.Error(w, http.StatusBadRequest, 10400, "手机号和验证码不能为空")
		return
	}

	result, err := h.authSvc.LoginByCellphone(r.Context(), req.Phone, req.Captcha)
	if err != nil {
		writeError(w, err)
		return
	}
	response.OK(w, LoginResponse{
		UserID:   result.UserID,
		Nickname: result.Nickname,
		Avatar:   result.Avatar,
	})
}

// LoginQrcode 处理 GET /api/v1/auth/login/qrcode。
func (h *Handler) LoginQrcode(w http.ResponseWriter, r *http.Request) {
	result, err := h.authSvc.LoginByQrcode(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	response.OK(w, QrcodeResponse{Key: result.Key, URL: result.URL})
}

// LoginQrcodeCheck 处理 GET /api/v1/auth/login/qrcode/check。
func (h *Handler) LoginQrcodeCheck(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" {
		response.Error(w, http.StatusBadRequest, 10400, "key 不能为空")
		return
	}

	status, err := h.authSvc.CheckQrcode(r.Context(), key)
	if err != nil {
		writeError(w, err)
		return
	}
	response.OK(w, QrcodeCheckResponse{Code: status.Code, Message: status.Message})
}

// LoginStatus 处理 GET /api/v1/auth/status。
func (h *Handler) LoginStatus(w http.ResponseWriter, r *http.Request) {
	// 从 header 取 cookie（调用方传入）
	cookie := r.Header.Get("X-Cookie")
	if cookie == "" {
		response.OK(w, LoginStatusResponse{LoggedIn: false})
		return
	}

	result, err := h.authSvc.LoginStatus(r.Context(), cookie)
	if err != nil {
		response.OK(w, LoginStatusResponse{LoggedIn: false})
		return
	}
	response.OK(w, LoginStatusResponse{
		LoggedIn: true,
		UserID:   result.UserID,
		Nickname: result.Nickname,
	})
}

// Logout 处理 POST /api/v1/auth/logout。
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie := r.Header.Get("X-Cookie")
	userID := r.URL.Query().Get("user_id")

	if err := h.authSvc.Logout(r.Context(), userID, cookie); err != nil {
		writeError(w, err)
		return
	}
	response.OK(w, nil)
}
