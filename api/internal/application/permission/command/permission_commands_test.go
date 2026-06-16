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
	existing := permission.NewPermission(1, code, "旧名称", "旧描述")
	repo.On("FindByCode", mock.Anything, mock.Anything).Return(existing, nil)
	repo.On("Save", mock.Anything, mock.Anything).Return(1, nil)

	err := h.Handle(context.Background(), command.UpdatePermissionInput{
		Code:        "post:create",
		Name:        "新名称",
		Description: "新描述",
	})
	require.NoError(t, err)
}

func TestDeletePermissionHandler_Success(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	h := command.NewDeletePermissionHandler(repo)

	repo.On("CountRoles", mock.Anything, mock.Anything).Return(int64(0), nil)
	repo.On("Delete", mock.Anything, mock.Anything).Return(nil)

	err := h.Handle(context.Background(), command.DeletePermissionInput{Code: "test:action"})
	require.NoError(t, err)
}

func TestDeletePermissionHandler_InUse(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	h := command.NewDeletePermissionHandler(repo)

	repo.On("CountRoles", mock.Anything, mock.Anything).Return(int64(3), nil)

	err := h.Handle(context.Background(), command.DeletePermissionInput{Code: "post:create"})
	assert.ErrorIs(t, err, permission.ErrInUse)
}

func TestDeletePermissionHandler_InvalidCode(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	h := command.NewDeletePermissionHandler(repo)

	err := h.Handle(context.Background(), command.DeletePermissionInput{Code: "INVALID"})
	assert.Error(t, err)
	repo.AssertNotCalled(t, "CountRoles")
}
