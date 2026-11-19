package gorm

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"

	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// CreatePendingRegistration 持久化待验证账号和邮箱更正凭据的摘要。
func (r *UserRepository) CreatePendingRegistration(ctx context.Context, u *user.User, tokenHash string) error {
	po := struct {
		model.User
		RegistrationTokenHash string
	}{User: toPO(u), RegistrationTokenHash: tokenHash}
	return registrationWriteError(r.db.WithContext(ctx).Table("users").Create(&po).Error)
}

// FindPendingRegistration 只按凭据查找尚未验证且未注销的账号。
func (r *UserRepository) FindPendingRegistration(ctx context.Context, tokenHash string) (*user.User, error) {
	var po model.User
	err := r.db.WithContext(ctx).
		Where("registration_token_hash = ? AND NOT email_verified AND deleted_at IS NULL", tokenHash).
		First(&po).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, user.ErrNotFound
	}
	if err != nil {
		return nil, shared.Internal("读取待验证注册失败", err)
	}
	return toDomain(po)
}

// SavePendingRegistration 只更新当前待验证版本，不覆盖账号的其他字段。
func (r *UserRepository) SavePendingRegistration(ctx context.Context, u *user.User, previousEmail user.Email, previousHash user.PasswordHash) error {
	var fields map[string]any
	if u.EmailVerified() {
		fields = map[string]any{"email_verified": true, "is_active": true, "registration_token_hash": nil}
	} else {
		fields = map[string]any{"email": u.Email().String(), "username": u.Username().String(), "password_hash": u.PasswordHash().String()}
	}
	result := r.db.WithContext(ctx).Model(&model.User{}).
		Where("id = ? AND email = ? AND password_hash = ? AND NOT email_verified AND deleted_at IS NULL",
			u.GetID().UUID(), previousEmail.String(), previousHash.String()).Updates(fields)
	if result.Error != nil {
		return registrationWriteError(result.Error)
	}
	if result.RowsAffected == 0 {
		return shared.Conflict("注册状态已变化，请重试")
	}
	return nil
}

func registrationWriteError(err error) error {
	if err == nil {
		return nil
	}
	var conflict *pgconn.PgError
	if errors.As(err, &conflict) && conflict.Code == "23505" {
		switch conflict.ConstraintName {
		case "idx_users_email":
			return user.ErrEmailExists
		case "idx_users_username":
			return user.ErrUsernameExists
		}
	}
	return shared.Internal("保存待验证注册失败", err)
}
