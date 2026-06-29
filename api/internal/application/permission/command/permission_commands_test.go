package command_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"blog-api/internal/application/mocks"
	"blog-api/internal/application/permission/command"
	"blog-api/internal/domain/permission"
)

func TestCreatePermissionHandler_Success(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	h := command.NewCreatePermissionHandler(repo)

	repo.On("ExistsByCode", mock.Anything, mock.Anything).Return(false, nil)
	repo.On("Save", mock.Anything, mock.Anything).Return(1, nil)

	out, err := h.Handle(context.Background(), command.CreatePermissionInput{
		Code:        "post:create",
		Name:        "创建文章",
		Description: "允许创建文章",
	})
	require.NoError(t, err)
	assert.Equal(t, int32(1), out.ID)
}

func TestCreatePermissionHandler_InvalidCode(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	h := command.NewCreatePermissionHandler(repo)

	_, err := h.Handle(context.Background(), command.CreatePermissionInput{
		Code: "INVALID",
	})
	assert.Error(t, err)
	repo.AssertNotCalled(t, "ExistsByCode")
}

func TestCreatePermissionHandler_CodeExists(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	h := command.NewCreatePermissionHandler(repo)

	repo.On("ExistsByCode", mock.Anything, mock.Anything).Return(true, nil)

	_, err := h.Handle(context.Background(), command.CreatePermissionInput{Code: "post:create"})
	assert.ErrorIs(t, err, permission.ErrCodeExists)
}

func TestUpdatePermissionHandler_Success(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	h := command.NewUpdatePermissionHandler(repo)

	code, _ := permission.ParseCode("post:create")
	// 非内置权限，允许改 name/description
	existing := permission.NewPermission(1, code, "旧名称", "旧描述", nil, "action", 0, false)
	repo.On("FindByID", mock.Anything, int32(1)).Return(existing, nil)
	repo.On("Save", mock.Anything, mock.Anything).Return(1, nil)

	err := h.Handle(context.Background(), command.UpdatePermissionInput{
		ID:          1,
		Name:        "新名称",
		Description: "新描述",
	})
	require.NoError(t, err)
}

func TestUpdatePermissionHandler_BuiltinCannotChangeCode(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	h := command.NewUpdatePermissionHandler(repo)

	code, _ := permission.ParseCode("post:create")
	// 内置权限，改 code 应报错
	existing := permission.NewPermission(1, code, "创建文章", "", nil, "action", 0, true)
	repo.On("FindByID", mock.Anything, int32(1)).Return(existing, nil)

	newCode := "post:create-new"
	err := h.Handle(context.Background(), command.UpdatePermissionInput{
		ID:   1,
		Code: newCode,
	})
	assert.ErrorIs(t, err, permission.ErrCannotModifyBuiltin)
	repo.AssertNotCalled(t, "Save")
}

func TestDeletePermissionHandler_Success(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	h := command.NewDeletePermissionHandler(repo)

	code, _ := permission.ParseCode("test:action")
	// 非内置权限
	existing := permission.NewPermission(1, code, "测试", "", nil, "action", 0, false)
	repo.On("FindByID", mock.Anything, int32(1)).Return(existing, nil)
	repo.On("CountRoles", mock.Anything, int32(1)).Return(int64(0), nil)
	repo.On("Delete", mock.Anything, int32(1)).Return(nil)

	err := h.Handle(context.Background(), command.DeletePermissionInput{ID: 1})
	require.NoError(t, err)
}

func TestDeletePermissionHandler_InUse(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	h := command.NewDeletePermissionHandler(repo)

	code, _ := permission.ParseCode("post:create")
	existing := permission.NewPermission(1, code, "创建文章", "", nil, "action", 0, false)
	repo.On("FindByID", mock.Anything, int32(1)).Return(existing, nil)
	repo.On("CountRoles", mock.Anything, int32(1)).Return(int64(3), nil)

	err := h.Handle(context.Background(), command.DeletePermissionInput{ID: 1})
	assert.ErrorIs(t, err, permission.ErrInUse)
}

func TestDeletePermissionHandler_Builtin(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	h := command.NewDeletePermissionHandler(repo)

	code, _ := permission.ParseCode("post:create")
	// 内置权限，不可删
	existing := permission.NewPermission(1, code, "创建文章", "", nil, "action", 0, true)
	repo.On("FindByID", mock.Anything, int32(1)).Return(existing, nil)

	err := h.Handle(context.Background(), command.DeletePermissionInput{ID: 1})
	assert.ErrorIs(t, err, permission.ErrCannotModifyBuiltin)
	repo.AssertNotCalled(t, "CountRoles")
	repo.AssertNotCalled(t, "Delete")
}
