// Package service 提供 mimo-music 的业务编排层。
package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"

	"github.com/VOD-Studio/mimo-music/observability"
	"github.com/VOD-Studio/mimo-music/provider"
)

// AuthService 是登录业务编排。
//
// 调用 provider 的 Auth 能力，把登录结果中的 Cookie 存入 SessionStore。
// handler 调用本服务，不直接调 provider。
type AuthService struct {
	auth   provider.Auth
	store  provider.SessionStore
	logger provider.Logger
}

// NewAuthService 创建登录 service。
func NewAuthService(auth provider.Auth, store provider.SessionStore, logger provider.Logger) *AuthService {
	return &AuthService{auth: auth, store: store, logger: logger}
}

// SendCaptcha 发送验证码。
func (s *AuthService) SendCaptcha(ctx context.Context, phone string) error {
	s.logger.Debug("sending captcha", slog.String(observability.FieldPhoneHash, hashValue(phone)))
	return s.auth.SendCaptcha(ctx, phone)
}

// LoginByCellphone 手机号登录，Cookie 存入 store。
func (s *AuthService) LoginByCellphone(ctx context.Context, phone, captcha string) (provider.SessionResult, error) {
	result, err := s.auth.LoginByCellphone(ctx, phone, captcha)
	if err != nil {
		return provider.SessionResult{}, err
	}

	// Cookie 存入 store
	if result.Cookie != "" && result.UserID != "" {
		if err := s.store.Save(ctx, result.UserID, result.Cookie); err != nil {
			s.logger.Error("failed to save session", slog.String(observability.FieldUserID, result.UserID))
			return result, fmt.Errorf("保存登录态失败: %w", err)
		}
		s.logger.Info("login success", slog.String(observability.FieldUserID, result.UserID))
	}

	return result, nil
}

// LoginByQrcode 获取二维码。
func (s *AuthService) LoginByQrcode(ctx context.Context) (provider.QrcodeResult, error) {
	return s.auth.LoginByQrcode(ctx)
}

// CheckQrcode 轮询二维码状态。
func (s *AuthService) CheckQrcode(ctx context.Context, key string) (provider.QrcodeStatus, error) {
	status, err := s.auth.CheckQrcode(ctx, key)
	if err != nil {
		return provider.QrcodeStatus{}, err
	}

	// Code=803 表示确认登录
	if status.Code == 803 {
		s.logger.Info("qrcode login confirmed")
	}

	return status, nil
}

// LoginStatus 查询登录态。
func (s *AuthService) LoginStatus(ctx context.Context, cookie string) (provider.SessionResult, error) {
	return s.auth.LoginStatus(ctx, cookie)
}

// Logout 登出并删除 session。
func (s *AuthService) Logout(ctx context.Context, userID, cookie string) error {
	if err := s.auth.Logout(ctx, cookie); err != nil {
		return err
	}
	if userID != "" {
		if err := s.store.Delete(ctx, userID); err != nil {
			s.logger.Error("failed to delete session", slog.String(observability.FieldUserID, userID))
		}
	}
	s.logger.Info("logout success", slog.String(observability.FieldUserID, userID))
	return nil
}

// hashValue 返回字符串 SHA256 前 8 位，日志脱敏用。
func hashValue(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])[:8]
}
