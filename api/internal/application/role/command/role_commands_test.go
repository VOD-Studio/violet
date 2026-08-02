package command_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"blog-api/internal/application/mocks"
	"blog-api/internal/application/role/command"
	"blog-api/internal/domain/role"
)

// 辅助：构造一个 mock EventBus 返回 nil
func newMockBus() *mocks.MockEventBus {
	bus := new(mocks.MockEventBus)
	bus.On("Publish", mock.Anything, mock.Anything).Return(nil)
	return bus
}

func TestCreateRoleHandler_Success(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	bus := newMockBus()
	h := command.NewCreateRoleHandler(repo, bus)

	// 名称查重：不存在
	repo.On("ExistsByName", mock.Anything, mock.Anything).Return(false, nil)
	// Save 返回新 ID
	repo.On("Save", mock.Anything, mock.Anything).Return(1, nil)

	out, err := h.Handle(context.Background(), command.CreateRoleInput{
		Name:        "editor",
		Description: "内容编辑",
	})
	require.NoError(t, err)
	assert.Equal(t, int32(1), out.ID)
	repo.AssertExpectations(t)
}

func TestCreateRoleHandler_InvalidName(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	bus := newMockBus()
	h := command.NewCreateRoleHandler(repo, bus)

	_, err := h.Handle(context.Background(), command.CreateRoleInput{
		Name: "INVALID NAME", // 大写空格非法
	})
	assert.Error(t, err)
	repo.AssertNotCalled(t, "ExistsByName")
}

func TestCreateRoleHandler_NameExists(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	bus := newMockBus()
	h := command.NewCreateRoleHandler(repo, bus)

	repo.On("ExistsByName", mock.Anything, mock.Anything).Return(true, nil)

	_, err := h.Handle(context.Background(), command.CreateRoleInput{Name: "editor"})
	assert.ErrorIs(t, err, role.ErrNameExists)
}

func TestUpdateRoleHandler_Success(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	h := command.NewUpdateRoleHandler(repo, newMockBus())

	name, _ := role.ParseRoleName("editor")
	existing := role.ReconstructRole(1, name, "旧描述", []string{}, zeroTime(), zeroTime())

	repo.On("FindByID", mock.Anything, int32(1)).Return(existing, nil)
	repo.On("ExistsByName", mock.Anything, mock.Anything).Return(false, nil)
	repo.On("Save", mock.Anything, mock.Anything).Return(1, nil)

	err := h.Handle(context.Background(), command.UpdateRoleInput{
		ID:          1,
		Name:        "content-editor",
		Description: "新描述",
	})
	require.NoError(t, err)
}

func TestUpdateRoleHandler_BuiltinCannotRename(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	h := command.NewUpdateRoleHandler(repo, newMockBus())

	name, _ := role.ParseRoleName("admin")
	builtin := role.ReconstructRole(1, name, "管理员", []string{}, zeroTime(), zeroTime())

	repo.On("FindByID", mock.Anything, int32(1)).Return(builtin, nil)
	repo.On("ExistsByName", mock.Anything, mock.Anything).Return(false, nil)

	err := h.Handle(context.Background(), command.UpdateRoleInput{
		ID:   1,
		Name: "renamed",
	})
	assert.Error(t, err) // 内置角色改名报错
}

func TestDeleteRoleHandler_Success(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	h := command.NewDeleteRoleHandler(repo, newMockBus())

	name, _ := role.ParseRoleName("editor")
	rl := role.ReconstructRole(1, name, "编辑", []string{}, zeroTime(), zeroTime())

	repo.On("FindByID", mock.Anything, int32(1)).Return(rl, nil)
	repo.On("CountUsers", mock.Anything, int32(1)).Return(int64(0), nil)
	repo.On("Delete", mock.Anything, int32(1)).Return(nil)

	err := h.Handle(context.Background(), command.DeleteRoleInput{ID: 1})
	require.NoError(t, err)
}

func TestDeleteRoleHandler_BuiltinCannotDelete(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	h := command.NewDeleteRoleHandler(repo, newMockBus())

	name, _ := role.ParseRoleName("admin")
	builtin := role.ReconstructRole(1, name, "管理员", []string{}, zeroTime(), zeroTime())

	repo.On("FindByID", mock.Anything, int32(1)).Return(builtin, nil)

	err := h.Handle(context.Background(), command.DeleteRoleInput{ID: 1})
	assert.ErrorIs(t, err, role.ErrCannotModifyBuiltin)
}

func TestDeleteRoleHandler_InUse(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	h := command.NewDeleteRoleHandler(repo, newMockBus())

	name, _ := role.ParseRoleName("editor")
	rl := role.ReconstructRole(1, name, "编辑", []string{}, zeroTime(), zeroTime())

	repo.On("FindByID", mock.Anything, int32(1)).Return(rl, nil)
	repo.On("CountUsers", mock.Anything, int32(1)).Return(int64(5), nil)

	err := h.Handle(context.Background(), command.DeleteRoleInput{ID: 1})
	assert.ErrorIs(t, err, role.ErrInUse)
}

func TestReplaceRolePermissionsHandler_Success(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	bus := newMockBus()
	h := command.NewReplaceRolePermissionsHandler(repo, bus)

	name, _ := role.ParseRoleName("editor")
	rl := role.ReconstructRole(1, name, "编辑", []string{"old:perm"}, zeroTime(), zeroTime())

	repo.On("FindByID", mock.Anything, int32(1)).Return(rl, nil)
	repo.On("SavePermissions", mock.Anything, int32(1), []string{"post:create", "post:delete"}).Return(nil)

	err := h.Handle(context.Background(), command.ReplaceRolePermissionsInput{
		RoleID:          1,
		PermissionCodes: []string{"post:create", "post:delete"},
	})
	require.NoError(t, err)
}

func TestReplaceRolePermissionsHandler_InvalidCode(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	bus := newMockBus()
	h := command.NewReplaceRolePermissionsHandler(repo, bus)

	name, _ := role.ParseRoleName("editor")
	rl := role.ReconstructRole(1, name, "编辑", []string{}, zeroTime(), zeroTime())

	repo.On("FindByID", mock.Anything, int32(1)).Return(rl, nil)

	err := h.Handle(context.Background(), command.ReplaceRolePermissionsInput{
		RoleID:          1,
		PermissionCodes: []string{"INVALID"},
	})
	assert.Error(t, err)
}

func TestReplaceRolePermissionsHandler_RoleNotFound(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	bus := newMockBus()
	h := command.NewReplaceRolePermissionsHandler(repo, bus)

	repo.On("FindByID", mock.Anything, int32(999)).Return(nil, role.ErrNotFound)

	err := h.Handle(context.Background(), command.ReplaceRolePermissionsInput{
		RoleID:          999,
		PermissionCodes: []string{"post:create"},
	})
	assert.ErrorIs(t, err, role.ErrNotFound)
}

// 辅助
func zeroTime() time.Time { return time.Time{} }
