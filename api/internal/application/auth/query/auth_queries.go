// Package query 提供 auth/user 的读操作用例（CQRS Query 侧）。
package query

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// UserDTO 用户读模型（query 返回，供 HTTP handler 序列化）
type UserDTO struct {
	ID            string   `json:"id"`
	Username      string   `json:"username"`
	Email         string   `json:"email"`
	AvatarURL     string   `json:"avatar_url"`
	Bio           string   `json:"bio"`
	Role          string   `json:"role"`
	EmailVerified bool     `json:"email_verified"`
	IsActive      bool     `json:"is_active"`
	CreatedAt     string   `json:"created_at"`
	Permissions   []string `json:"permissions,omitempty"`
}

// GetMeHandler 获取当前登录用户信息
type GetMeHandler struct {
	userRepo user.UserRepository
}

// NewGetMeHandler 构造 GetMe 用例
func NewGetMeHandler(repo user.UserRepository) *GetMeHandler {
	return &GetMeHandler{userRepo: repo}
}

// Handle 执行 GetMe
func (h *GetMeHandler) Handle(ctx context.Context, userID string) (UserDTO, error) {
	id, err := shared.ParseID(userID)
	if err != nil {
		return UserDTO{}, shared.BadRequest("无效的用户 ID")
	}

	u, err := h.userRepo.FindByID(ctx, id)
	if err != nil {
		return UserDTO{}, err
	}

	return toUserDTO(u), nil
}

// toUserDTO 领域用户转 DTO
func toUserDTO(u *user.User) UserDTO {
	return UserDTO{
		ID:            u.GetID().String(),
		Username:      u.Username().String(),
		Email:         u.Email().String(),
		AvatarURL:     u.AvatarURL(),
		Bio:           u.Bio(),
		Role:          string(u.Role()),
		EmailVerified: u.EmailVerified(),
		IsActive:      u.IsActive(),
		CreatedAt:     u.CreatedAt().Format(time.RFC3339),
	}
}
