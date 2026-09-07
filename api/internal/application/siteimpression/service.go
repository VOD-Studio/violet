// Package siteimpression 提供匿名设备印记的查询与幂等写入用例。
package siteimpression

import (
	"context"
	"crypto/rand"
	"encoding/base64"

	"blog-api/internal/domain/shared"
	domainsiteimpression "blog-api/internal/domain/siteimpression"
)

const tokenSize = 16

// StateDTO 是首页展示的匿名设备印记状态。
type StateDTO struct {
	// Count 是主动留下印记的去重匿名设备数，不代表浏览量或可信 UV。
	Count int64 `json:"count"`
	// Impressed 表示请求携带的设备 Cookie 已存在于印记集合。
	Impressed bool `json:"impressed"`
}

// Service 仅以模块专属 HMAC 密钥处理原始设备令牌。
type Service struct {
	repository domainsiteimpression.Repository
	tokenKey   []byte
}

// NewService 复制密钥，避免调用方后续修改影响令牌身份。
func NewService(repository domainsiteimpression.Repository, tokenKey []byte) *Service {
	return &Service{repository: repository, tokenKey: append([]byte(nil), tokenKey...)}
}

// Get 返回总数以及当前 Cookie 是否对应已登记设备。
func (s *Service) Get(ctx context.Context, cookieToken string) (StateDTO, error) {
	count, err := s.repository.Count(ctx)
	if err != nil {
		return StateDTO{}, err
	}
	state := StateDTO{Count: count}
	rawToken, valid := decodeToken(cookieToken)
	if !valid {
		return state, nil
	}
	state.Impressed, err = s.repository.Contains(ctx, domainsiteimpression.NewTokenHash(s.tokenKey, rawToken))
	if err != nil {
		return StateDTO{}, err
	}
	return state, nil
}

// Impress 幂等登记设备；第二个返回值仅在需要下发新 Cookie 时非空。
func (s *Service) Impress(ctx context.Context, cookieToken string) (StateDTO, string, error) {
	rawToken, valid := decodeToken(cookieToken)
	issuedToken := ""
	if !valid {
		rawToken = make([]byte, tokenSize)
		if _, err := rand.Read(rawToken); err != nil {
			return StateDTO{}, "", shared.Internal("生成匿名设备令牌失败", err)
		}
		issuedToken = base64.RawURLEncoding.EncodeToString(rawToken)
	}
	if err := s.repository.Ensure(ctx, domainsiteimpression.NewTokenHash(s.tokenKey, rawToken)); err != nil {
		return StateDTO{}, "", err
	}
	count, err := s.repository.Count(ctx)
	if err != nil {
		return StateDTO{}, "", err
	}
	return StateDTO{Count: count, Impressed: true}, issuedToken, nil
}

func decodeToken(value string) ([]byte, bool) {
	if value == "" {
		return nil, false
	}
	token, err := base64.RawURLEncoding.Strict().DecodeString(value)
	if err != nil || len(token) != tokenSize {
		return nil, false
	}
	return token, true
}
