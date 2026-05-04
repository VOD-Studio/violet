// Package auth 提供认证相关的辅助函数
package auth

import (
	"errors"
	"net/http"

	"blog-api/internal/middleware"
)

// GetUserID 从请求上下文中提取用户 ID
func GetUserID(r *http.Request) (string, error) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok || userID == "" {
		return "", errors.New("user ID not found in context")
	}
	return userID, nil
}

// GetUserRole 从请求上下文中提取用户角色
func GetUserRole(r *http.Request) (string, error) {
	role, ok := r.Context().Value(middleware.UserRoleKey).(string)
	if !ok || role == "" {
		return "", errors.New("user role not found in context")
	}
	return role, nil
}

// GetUserEmail 从请求上下文中提取用户邮箱
func GetUserEmail(r *http.Request) (string, error) {
	email, ok := r.Context().Value(middleware.UserEmailKey).(string)
	if !ok || email == "" {
		return "", errors.New("user email not found in context")
	}
	return email, nil
}

// GetUserRoleID 从请求上下文中提取用户角色 ID
func GetUserRoleID(r *http.Request) (int64, error) {
	roleID, ok := r.Context().Value(middleware.UserRoleIDKey).(int64)
	if !ok {
		return 0, errors.New("user role ID not found in context")
	}
	return roleID, nil
}
