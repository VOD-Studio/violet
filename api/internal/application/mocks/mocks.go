// Package mocks 提供 application 层测试用的 mock 实现。
//
// 手写 mock（而非 gomock 生成），避免引入代码生成工具链，
// 配合 testify/mock 使用，简洁直观。
package mocks

import (
	"context"
	"time"

	"github.com/stretchr/testify/mock"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/announcement"
	"blog-api/internal/domain/permission"
	"blog-api/internal/domain/role"
	"blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

// ============================================================
// Role Repository Mock
// ============================================================

// MockRoleRepository role.RoleRepository 的 mock 实现
type MockRoleRepository struct{ mock.Mock }

func (m *MockRoleRepository) FindByID(ctx context.Context, id int32) (*role.Role, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*role.Role), args.Error(1)
}

func (m *MockRoleRepository) FindByName(ctx context.Context, name role.RoleName) (*role.Role, error) {
	args := m.Called(ctx, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*role.Role), args.Error(1)
}

func (m *MockRoleRepository) FindAll(ctx context.Context) ([]*role.Role, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*role.Role), args.Error(1)
}

func (m *MockRoleRepository) ExistsByName(ctx context.Context, name role.RoleName) (bool, error) {
	args := m.Called(ctx, name)
	return args.Bool(0), args.Error(1)
}

func (m *MockRoleRepository) Save(ctx context.Context, r *role.Role) (int32, error) {
	args := m.Called(ctx, r)
	return int32(args.Int(0)), args.Error(1)
}

func (m *MockRoleRepository) SavePermissions(ctx context.Context, roleID int32, codes []string) error {
	return m.Called(ctx, roleID, codes).Error(0)
}

func (m *MockRoleRepository) Delete(ctx context.Context, id int32) error {
	return m.Called(ctx, id).Error(0)
}

func (m *MockRoleRepository) CountUsers(ctx context.Context, roleID int32) (int64, error) {
	args := m.Called(ctx, roleID)
	return args.Get(0).(int64), args.Error(1)
}

// ============================================================
// Permission Repository Mock
// ============================================================

// MockPermissionRepository permission.PermissionRepository 的 mock 实现
type MockPermissionRepository struct{ mock.Mock }

func (m *MockPermissionRepository) FindByID(ctx context.Context, id int32) (*permission.Permission, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*permission.Permission), args.Error(1)
}

func (m *MockPermissionRepository) FindByCode(ctx context.Context, code permission.Code) (*permission.Permission, error) {
	args := m.Called(ctx, code)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*permission.Permission), args.Error(1)
}

func (m *MockPermissionRepository) FindAll(ctx context.Context) ([]*permission.Permission, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*permission.Permission), args.Error(1)
}

func (m *MockPermissionRepository) ExistsByCode(ctx context.Context, code permission.Code) (bool, error) {
	args := m.Called(ctx, code)
	return args.Bool(0), args.Error(1)
}

func (m *MockPermissionRepository) Save(ctx context.Context, p *permission.Permission) (int32, error) {
	args := m.Called(ctx, p)
	return int32(args.Int(0)), args.Error(1)
}

func (m *MockPermissionRepository) Delete(ctx context.Context, id int32) error {
	return m.Called(ctx, id).Error(0)
}

func (m *MockPermissionRepository) CountRoles(ctx context.Context, id int32) (int64, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(int64), args.Error(1)
}

// ============================================================
// EventBus Mock
// ============================================================

// MockEventBus application/shared.EventBus 的 mock 实现
type MockEventBus struct{ mock.Mock }

func (m *MockEventBus) Publish(ctx context.Context, events []shared.DomainEvent) error {
	return m.Called(ctx, events).Error(0)
}

// ============================================================
// TokenStore Mock
// ============================================================

// MockTokenStore application/shared.TokenStore 的 mock 实现
type MockTokenStore struct{ mock.Mock }

func (m *MockTokenStore) Save(ctx context.Context, userID, refreshToken string) error {
	return m.Called(ctx, userID, refreshToken).Error(0)
}

func (m *MockTokenStore) Rotate(ctx context.Context, userID, oldToken, newToken string) (appshared.RotateResult, error) {
	args := m.Called(ctx, userID, oldToken, newToken)
	return args.Get(0).(appshared.RotateResult), args.Error(1)
}

func (m *MockTokenStore) Delete(ctx context.Context, userID string) error {
	return m.Called(ctx, userID).Error(0)
}

// ============================================================
// TokenService Mock
// ============================================================

// MockTokenService application/shared.TokenService 的 mock 实现
type MockTokenService struct{ mock.Mock }

func (m *MockTokenService) GenerateTokenPair(in appshared.TokenInput) (*appshared.TokenPair, error) {
	args := m.Called(in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*appshared.TokenPair), args.Error(1)
}

func (m *MockTokenService) ParseToken(token string) (*appshared.Claims, error) {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*appshared.Claims), args.Error(1)
}

func (m *MockTokenService) AccessTTL() time.Duration {
	return m.Called().Get(0).(time.Duration)
}

func (m *MockTokenService) RefreshTTL() time.Duration {
	return m.Called().Get(0).(time.Duration)
}

// ============================================================
// User Repository Mock
// ============================================================

// MockUserRepository user.UserRepository 的 mock 实现
type MockUserRepository struct{ mock.Mock }

func (m *MockUserRepository) FindByID(ctx context.Context, id shared.ID) (*domainuser.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domainuser.User), args.Error(1)
}

func (m *MockUserRepository) FindByIDs(ctx context.Context, ids []shared.ID) ([]*domainuser.User, error) {
	args := m.Called(ctx, ids)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domainuser.User), args.Error(1)
}

func (m *MockUserRepository) FindByEmail(ctx context.Context, email domainuser.Email) (*domainuser.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domainuser.User), args.Error(1)
}

func (m *MockUserRepository) FindByUsername(ctx context.Context, username domainuser.Username) (*domainuser.User, error) {
	args := m.Called(ctx, username)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domainuser.User), args.Error(1)
}

func (m *MockUserRepository) ExistsByEmail(ctx context.Context, email domainuser.Email) (bool, error) {
	args := m.Called(ctx, email)
	return args.Bool(0), args.Error(1)
}

func (m *MockUserRepository) ExistsByUsername(ctx context.Context, username domainuser.Username) (bool, error) {
	args := m.Called(ctx, username)
	return args.Bool(0), args.Error(1)
}

func (m *MockUserRepository) Save(ctx context.Context, u *domainuser.User) error {
	return m.Called(ctx, u).Error(0)
}

func (m *MockUserRepository) Delete(ctx context.Context, id shared.ID) error {
	return m.Called(ctx, id).Error(0)
}

func (m *MockUserRepository) Count(ctx context.Context) (int64, error) {
	args := m.Called(ctx)
	return args.Get(0).(int64), args.Error(1)
}

// ============================================================
// Announcement Repository Mock
// ============================================================

// MockAnnouncementRepository announcement.AnnouncementRepository 的 mock 实现
type MockAnnouncementRepository struct{ mock.Mock }

func (m *MockAnnouncementRepository) FindByID(ctx context.Context, id int32) (*announcement.Announcement, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*announcement.Announcement), args.Error(1)
}

func (m *MockAnnouncementRepository) FindAll(ctx context.Context) ([]*announcement.Announcement, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*announcement.Announcement), args.Error(1)
}

func (m *MockAnnouncementRepository) FindActive(ctx context.Context) ([]*announcement.Announcement, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*announcement.Announcement), args.Error(1)
}

func (m *MockAnnouncementRepository) Save(ctx context.Context, a *announcement.Announcement) (int32, error) {
	args := m.Called(ctx, a)
	return int32(args.Int(0)), args.Error(1)
}

func (m *MockAnnouncementRepository) Delete(ctx context.Context, id int32) error {
	return m.Called(ctx, id).Error(0)
}

// 编译期断言
var (
	_ appshared.EventBus         = (*MockEventBus)(nil)
	_ appshared.TokenStore       = (*MockTokenStore)(nil)
	_ appshared.TokenService     = (*MockTokenService)(nil)
	_ domainuser.UserRepository  = (*MockUserRepository)(nil)
	_ announcement.AnnouncementRepository = (*MockAnnouncementRepository)(nil)
)
