// Package service 的 AuthService impl。
//
// auth 接口不走 Execute（需要 Set-Cookie 创建 session），直接调 engine.RawDoWithCookieAndInput，
// 拿到 raw + setCookie 后调 model 解码 + Save session。
package service

import (
	"context"
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	authendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/auth"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// AuthServer 实现 AuthServiceServer。
//
// 持有 *engine.Engine 和 SessionStore（登录成功后存 cookie 池）。
type AuthServer struct {
	mmpb.UnimplementedAuthServiceServer
	eng      *engine.Engine
	sessions session.SessionStore
}

// NewAuthServer 创建 AuthServer。
func NewAuthServer(eng *engine.Engine, sessions session.SessionStore) *AuthServer {
	return &AuthServer{eng: eng, sessions: sessions}
}

// SendCaptcha 发送验证码。
func (s *AuthServer) SendCaptcha(ctx context.Context, req *mmpb.SendCaptchaRequest) (*mmpb.SendCaptchaResponse, error) {
	_, _, err := s.eng.RawDoWithCookieAndInput(ctx, authendpoint.SendCaptcha, authendpoint.SendCaptchaRequest(req), "")
	if err != nil {
		return nil, err
	}
	return &mmpb.SendCaptchaResponse{}, nil
}

// LoginByCellphone 手机号登录，返回 Session 并存入 cookie 池。
func (s *AuthServer) LoginByCellphone(ctx context.Context, req *mmpb.LoginByCellphoneRequest) (*mmpb.LoginByCellphoneResponse, error) {
	raw, setCookie, err := s.eng.RawDoWithCookieAndInput(ctx, authendpoint.LoginCellphone, authendpoint.LoginCellphoneRequest(req), "")
	if err != nil {
		return nil, err
	}

	sess, err := model.DecodeLoginResponse(raw)
	if err != nil {
		return nil, err
	}
	sess.Cookie = setCookie

	// 存入 session 池（UserID 用数字 ID 转字符串，Nickname 不唯一不能做 key）。
	s.saveSession(ctx, sess.UserId, setCookie)

	return &mmpb.LoginByCellphoneResponse{Session: sess}, nil
}

// LoginQrcode 获取登录二维码。
func (s *AuthServer) LoginQrcode(ctx context.Context, req *mmpb.LoginQrcodeRequest) (*mmpb.LoginQrcodeResponse, error) {
	raw, _, err := s.eng.RawDoWithCookieAndInput(ctx, authendpoint.LoginQrcode, authendpoint.LoginQrcodeRequest(req), "")
	if err != nil {
		return nil, err
	}

	key, err := model.DecodeQrcodeKey(raw)
	if err != nil {
		return nil, err
	}

	return &mmpb.LoginQrcodeResponse{
		Qrcode: &mmpb.Qrcode{Key: key, Url: authendpoint.QrcodeURL(key)},
	}, nil
}

// CheckQrcode 轮询二维码登录状态。
func (s *AuthServer) CheckQrcode(ctx context.Context, req *mmpb.CheckQrcodeRequest) (*mmpb.CheckQrcodeResponse, error) {
	raw, setCookie, err := s.eng.RawDoWithCookieAndInput(ctx, authendpoint.CheckQrcode, authendpoint.CheckQrcodeRequest(req), "")
	if err != nil {
		return nil, err
	}

	code, message, err := model.DecodeQrcodeStatus(raw)
	if err != nil {
		return nil, err
	}

	resp := &mmpb.CheckQrcodeResponse{Code: code, Message: message}

	// code=803 登录成功，提取 cookie 存入 session 池。
	if code == mmpb.QrcodeCode_QRCODE_CODE_CONFIRMED && setCookie != "" {
		// 从登录响应体提取用户信息（CheckQrcode 的 803 响应也含 account 信息）。
		if sess, err := model.DecodeLoginResponse(raw); err == nil && sess.UserId != 0 {
			sess.Cookie = setCookie
			resp.Session = sess
			s.saveSession(ctx, sess.UserId, setCookie)
		}
	}

	return resp, nil
}

// LoginStatus 查询当前登录态。
func (s *AuthServer) LoginStatus(ctx context.Context, req *mmpb.LoginStatusRequest) (*mmpb.LoginStatusResponse, error) {
	raw, _, err := s.eng.RawDoWithCookieAndInput(ctx, authendpoint.LoginStatus, authendpoint.LoginStatusRequest(req), req.GetCookie())
	if err != nil {
		return nil, err
	}

	sess, err := model.DecodeLoginResponse(raw)
	if err != nil {
		return &mmpb.LoginStatusResponse{}, nil // 未登录不算错误
	}
	sess.Cookie = req.GetCookie()

	return &mmpb.LoginStatusResponse{Session: sess}, nil
}

// Logout 登出。
func (s *AuthServer) Logout(ctx context.Context, req *mmpb.LogoutRequest) (*mmpb.LogoutResponse, error) {
	_, _, err := s.eng.RawDoWithCookieAndInput(ctx, authendpoint.Logout, authendpoint.LogoutRequest(req), req.GetCookie())
	if err != nil {
		return nil, err
	}
	return &mmpb.LogoutResponse{}, nil
}

// saveSession 把登录态 cookie 存入 session 池（UserID 用数字转字符串）。
func (s *AuthServer) saveSession(ctx context.Context, userID int64, cookie string) {
	if s.sessions == nil || userID == 0 || cookie == "" {
		return
	}
	_ = s.sessions.Save(ctx, &session.Session{UserID: fmt.Sprintf("%d", userID), Cookie: cookie})
}

// 确保 json import 被使用（model 解码函数的返回类型在编译期检查）。
var _ = json.RawMessage(nil)
