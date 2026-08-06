package command

import (
	"context"
	"errors"

	"github.com/rs/zerolog/log"

	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// ============================================================
// EnsureSuperAdmin 初始化/校正超级管理员账户
// ============================================================

// EnsureSuperAdminInput 超级管理员初始化入参
type EnsureSuperAdminInput struct {
	Email    string
	Username string
	Password string
}

// EnsureSuperAdminHandler 超级管理员初始化用例
//
// 编排逻辑（幂等）：
//   - 用户已存在：重置密码、确保角色为 superadmin、激活并验证邮箱
//   - 用户不存在：构造新用户聚合（默认 superadmin 角色、已验证、已激活）并持久化
//
// 与旧 initSuperAdmin 的差异：不再需要显式查询/更新 role_id 外键，
// 新 DDD 模型以 users.role 字符串列为唯一角色来源，role_id 外键属旧 sqlc 范式。
//
// 注意：本用例不创建 superadmin 角色记录本身——roles 表的内置角色
// 由数据库迁移（migrations）预置，这里只确保用户聚合正确。
type EnsureSuperAdminHandler struct {
	userRepo user.UserRepository
	hasher   PasswordHasher
}

// NewEnsureSuperAdminHandler 构造超级管理员初始化用例
func NewEnsureSuperAdminHandler(repo user.UserRepository, hasher PasswordHasher) *EnsureSuperAdminHandler {
	return &EnsureSuperAdminHandler{userRepo: repo, hasher: hasher}
}

// Handle 执行超级管理员初始化（幂等）
func (h *EnsureSuperAdminHandler) Handle(ctx context.Context, in EnsureSuperAdminInput) error {
	if in.Email == "" || in.Password == "" {
		return shared.BadRequest("超级管理员邮箱或密码未配置")
	}

	email, err := user.ParseEmail(in.Email)
	if err != nil {
		return err
	}
	username, err := user.ParseUsername(in.Username)
	if err != nil {
		return err
	}

	// 密码哈希（领域层不依赖 bcrypt，由 hasher 端口完成）
	hash, err := h.hasher.Hash(in.Password)
	if err != nil {
		return shared.Internal("密码哈希失败", err)
	}

	// 幂等：若用户已存在则校正密码/角色/状态
	existing, err := h.userRepo.FindByEmail(ctx, email)
	if err != nil && !errors.Is(err, user.ErrNotFound) {
		return err
	}
	if existing != nil {
		existing.ChangePassword(hash)
		existing.MarkAsRoot() // 校正为 root 用户
		existing.VerifyEmail()
		existing.Activate()
		if err := h.userRepo.Save(ctx, existing); err != nil {
			return err
		}
		log.Info().
			Str("username", in.Username).
			Str("email", in.Email).
			Msg("超级管理员已校正（密码/角色/状态已同步）")
		return nil
	}

	// 新建：root 用户，superadmin 角色 + isRoot 标志
	u := user.NewUser(shared.NewID(), email, username, hash)
	u.MarkAsRoot()
	u.VerifyEmail()
	u.Activate()

	if err := h.userRepo.Save(ctx, u); err != nil {
		return err
	}

	log.Info().
		Str("username", in.Username).
		Str("email", in.Email).
		Msg("超级管理员已创建")
	return nil
}
