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
	DisplayName         string   `json:"display_name"`
	Email               string   `json:"email"`
	AvatarURL           string   `json:"avatar_url"`
	Bio                 string   `json:"bio"`
	Role                string   `json:"role"`
	RoleDescription     string   `json:"role_description"`
	IsRoot              bool     `json:"is_root"`
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
	// 查角色信息：所有用户都需 description 供前端显示角色标签
	var roleDesc string
	var permissions []string
	roleName, parseErr := role.ParseRoleName(string(u.Role()))
	if parseErr == nil && h.roleRepo != nil {
		r, err := h.roleRepo.FindByName(ctx, roleName)
		if err == nil && r != nil {
			roleDesc = r.Description()
			// 超管通配；普通角色复用已查到的 role 对象取权限码
			if u.IsSuperAdmin() {
				permissions = []string{role.WildcardPermission}
			} else {
				permissions = r.PermissionCodes()
			}
		}
	}

	return toUserDTO(u, permissions, roleDesc), nil
}

// toUserDTO 领域用户转 DTO
func toUserDTO(u *user.User, permissions []string, roleDescription string) UserDTO {
	return UserDTO{
		Username:        u.Username().String(),
		DisplayName:     u.DisplayName().String(),
		Email:           u.Email().String(),
		AvatarURL:       u.AvatarURL(),
		Bio:             u.Bio(),
		Role:            string(u.Role()),
		RoleDescription: roleDescription,
		IsRoot:          u.IsRoot(),
		EmailVerified:   u.EmailVerified(),
		IsActive:        u.IsActive(),
		CreatedAt:       u.CreatedAt().Format(time.RFC3339),
		Permissions:     permissions,
	}
}
