package query_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	approle "blog-api/internal/application/role"
	"blog-api/internal/application/mocks"
	"blog-api/internal/application/permission/query"
	"blog-api/internal/domain/permission"
)

// ============================================================
// ListPermissions
// ============================================================

// newPerm 构造权限点实体（参数对齐领域 NewPermission 全量签名）。
func newPerm(id int32, code, name, desc string, parentID *int32, permType string, sort int, builtin bool) *permission.Permission {
	c, err := permission.ParseCode(code)
	if err != nil {
		panic(err)
	}
	return permission.NewPermission(id, c, name, desc, parentID, permType, sort, builtin)
}

func ptrInt32(v int32) *int32 { return &v }

func TestListPermissions_BuildsMenuActionTree(t *testing.T) {
	menu := newPerm(1, "post", "\u6587\u7a0b\u7ba1\u7406", "\u6587\u7ae0\u83dc\u5355", nil, "menu", 1, true)
	create := newPerm(2, "post:create", "\u65b0\u5efa\u6587\u7ae0", "\u5199\u6587\u7ae0", ptrInt32(1), "action", 1, true)
	del := newPerm(3, "post:delete", "\u5220\u9664\u6587\u7ae0", "", ptrInt32(1), "action", 2, true)

	repo := new(mocks.MockPermissionRepository)
	// 故意乱序返回，验证 handler 内部按 sort→id 重排
	repo.On("FindAll", mock.Anything).Return([]*permission.Permission{del, create, menu}, nil)

	out, err := query.NewListPermissionsHandler(repo).Handle(context.Background())
	require.NoError(t, err)
	require.Len(t, out, 1, "\u5e94\u8be5\u53ea\u6709\u4e00\u4e2a\u9876\u5c42 menu")

	root := out[0]
	assert.Equal(t, int32(1), root.ID)
	assert.Equal(t, "post", root.Code)
	assert.Equal(t, "\u6587\u7a0b\u7ba1\u7406", root.Name)
	assert.Nil(t, root.ParentID)
	assert.Equal(t, "menu", root.Type)
	assert.True(t, root.IsBuiltin)
	require.Len(t, root.Children, 2, "menu \u4e0b\u5e94\u6302\u8f7d 2 \u4e2a action")

	// children 按 sort 升序：create(sort=1) 在前，delete(sort=2) 在后
	assert.Equal(t, "post:create", root.Children[0].Code)
	assert.Equal(t, "post:delete", root.Children[1].Code)
	// action 节点不带 children 字段
	assert.Nil(t, root.Children[0].Children)
}

func TestListPermissions_OrphanAction_FallsBackToRoot(t *testing.T) {
	// parentID 指向不存在的 menu → 兜底作为顶层节点
	orphan := newPerm(10, "post:update", "\u66f4\u65b0", "", ptrInt32(999), "action", 1, false)

	repo := new(mocks.MockPermissionRepository)
	repo.On("FindAll", mock.Anything).Return([]*permission.Permission{orphan}, nil)

	out, err := query.NewListPermissionsHandler(repo).Handle(context.Background())
	require.NoError(t, err)
	require.Len(t, out, 1)
	assert.Equal(t, "post:update", out[0].Code)
	assert.False(t, out[0].IsBuiltin)
}

func TestListPermissions_EmptyRepo_ReturnsEmpty(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	repo.On("FindAll", mock.Anything).Return([]*permission.Permission{}, nil)

	out, err := query.NewListPermissionsHandler(repo).Handle(context.Background())
	require.NoError(t, err)
	assert.Empty(t, out)
}

func TestListPermissions_FindAllError_Propagates(t *testing.T) {
	repo := new(mocks.MockPermissionRepository)
	repo.On("FindAll", mock.Anything).Return(nil, permission.ErrNotFound)

	out, err := query.NewListPermissionsHandler(repo).Handle(context.Background())
	require.ErrorIs(t, err, permission.ErrNotFound)
	assert.Nil(t, out)
}

// 编译期断言：DTO 类型契约
var _ []approle.PermissionDTO = nil
