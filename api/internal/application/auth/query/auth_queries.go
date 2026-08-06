// Package query 提供 auth/user 的读操作用例（CQRS Query 侧）。
package query

import (
	"context"
	"time"

	"blog-api/internal/domain/role"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// UserDTO 用户读模型（query 返回，供 HTTP handler 序列化）
type UserDTO struct {
	ID                  string   `json:"id"`
	Username            string   `json:"username"`
	Email               string   `json:"email"`
	AvatarURL           string   `json:"avatar_url"`
	Bio                 string   `json:"bio"`
	Role                string   `json:"role"`
	IsBuiltinSuperAdmin bool     `json:"is_builtin_super_admin"`
	EmailVerified       bool     `json:"email_verified"`
	IsActive            bool     `json:"is_active"`
	CreatedAt           string   `json:"created_at"`
	Permissions         []string `json:"permissions,omitempty"`
}

// GetMeHandler 获取当前登录用户信息
type GetMeHandler struct {
	userRepo user.UserRepository
	roleRepo role.RoleRepository
}

// NewGetMeHandler 构造 GetMe 用例
func NewGetMeHandler(userRepo user.UserRepository, roleRepo role.RoleRepository) *GetMeHandler {
	return &GetMeHandler{
		userRepo: userRepo,
		roleRepo: roleRepo,
	}
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

	// root 用户与被委派超管固有全部权限，返回通配码；普通角色查 role_permissions 表。
	var permissions []string
	if u.IsSuperAdmin() {
		permissions = []string{role.WildcardPermission}
	} else if h.roleRepo != nil {
		roleName, err := role.ParseRoleName(string(u.Role()))
		if err == nil {
			r, err := h.roleRepo.FindByName(ctx, roleName)
			if err == nil && r != nil {
				permissions = r.PermissionCodes()
			}
		}
	}

	return toUserDTO(u, permissions), nil
}

// toUserDTO 领域用户转 DTO
func toUserDTO(u *user.User, permissions []string) UserDTO {
	return UserDTO{
		ID:                  u.GetID().String(),
		Username:            u.Username().String(),
		Email:               u.Email().String(),
		AvatarURL:           u.AvatarURL(),
		Bio:                 u.Bio(),
		Role:                string(u.Role()),
		IsBuiltinSuperAdmin: u.IsBuiltinSuperAdmin(),
		EmailVerified:       u.EmailVerified(),
		IsActive:            u.IsActive(),
		CreatedAt:           u.CreatedAt().Format(time.RFC3339),
		Permissions:         permissions,
	}
}
