// Package main 提供中间件端口适配器。
//
// middleware.Auth / RequirePermission 已重构为接收端口接口
// (TokenValidator / PermissionChecker)，与具体实现解耦。
// 本文件将 DDD 基础设施实现转换为中间件端口。
package main

import (
	"blog-api/internal/infrastructure/auth"
	"blog-api/internal/middleware"
)

// dddJWTAdapter 包装 DDD JWTService，适配 middleware.TokenValidator
type dddJWTAdapter struct {
	jwt *auth.JWTService
}

// ParseToken 转换 auth.JWTClaims → middleware.TokenClaims
func (a dddJWTAdapter) ParseToken(tokenString string) (*middleware.TokenClaims, error) {
	c, err := a.jwt.ParseToken(tokenString)
	if err != nil {
		return nil, err
	}
	return &middleware.TokenClaims{
		UserID: c.UserID,
		Email:  c.Email,
		Role:   c.Role,
		RoleID: c.RoleID,
	}, nil
}

// newDDDAuthValidator 构造 DDD JWTService 的中间件适配器
func newDDDAuthValidator(jwt *auth.JWTService) middleware.TokenValidator {
	return dddJWTAdapter{jwt: jwt}
}
