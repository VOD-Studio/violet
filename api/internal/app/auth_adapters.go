// Package app 提供 DDD 装配。本文件定义基础设施类型到应用层端口的适配器，
// 使 application/auth/command 不再直接 import infrastructure/auth。
package app

import (
	"time"

	appshared "blog-api/internal/application/shared"
	infraauth "blog-api/internal/infrastructure/auth"
)

// jwtTokenServiceAdapter 将 infraauth.JWTService 适配为 appshared.TokenService。
// infra 的 TokenInput/TokenPair 与 appshared 的 DTO 字段相同，做透传转换。
type jwtTokenServiceAdapter struct{ inner *infraauth.JWTService }

// NewTokenServiceAdapter 包装 infraauth.JWTService 为应用层 TokenService 端口。
func NewTokenServiceAdapter(inner *infraauth.JWTService) appshared.TokenService {
	return &jwtTokenServiceAdapter{inner: inner}
}

func (a *jwtTokenServiceAdapter) GenerateTokenPair(in appshared.TokenInput) (*appshared.TokenPair, error) {
	pair, err := a.inner.GenerateTokenPair(infraauth.TokenInput{
		UserID: in.UserID, Email: in.Email, Role: in.Role, RoleID: in.RoleID,
		IsBuiltinSuperAdmin: in.IsBuiltinSuperAdmin,
	})
	if err != nil {
		return nil, err
	}
	return &appshared.TokenPair{
		AccessToken: pair.AccessToken, RefreshToken: pair.RefreshToken,
		ExpiresIn: pair.ExpiresIn, RefreshExpiresIn: pair.RefreshExpiresIn,
	}, nil
}

func (a *jwtTokenServiceAdapter) ParseToken(token string) (*appshared.Claims, error) {
	c, err := a.inner.ParseToken(token)
	if err != nil {
		return nil, err
	}
	return &appshared.Claims{
		UserID: c.UserID, Email: c.Email, Role: c.Role, RoleID: c.RoleID,
		IsBuiltinSuperAdmin: c.IsBuiltinSuperAdmin,
	}, nil
}

func (a *jwtTokenServiceAdapter) AccessTTL() time.Duration  { return a.inner.AccessTTL() }
func (a *jwtTokenServiceAdapter) RefreshTTL() time.Duration { return a.inner.RefreshTTL() }

// RedisTokenStore / RedisCodeStore 的方法签名已与 appshared.TokenStore / CodeStore
// 端口一致（Save/Verify/Delete 与 Store/Verify），通过下方断言直接满足，无需适配。
var (
	_ appshared.TokenStore = (*infraauth.RedisTokenStore)(nil)
	_ appshared.CodeStore  = (*infraauth.RedisCodeStore)(nil)
)
