// Package mocks 提供 application 层测试用的 mock 实现。
//
// 手写 mock（而非 gomock 生成），避免引入代码生成工具链，
// 配合 testify/mock 使用，简洁直观。
package mocks

import (
	"context"

	"github.com/stretchr/testify/mock"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/permission"
	"blog-api/internal/domain/role"
	"blog-api/internal/domain/shared"
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

// 编译期断言
var _ appshared.EventBus = (*MockEventBus)(nil)
