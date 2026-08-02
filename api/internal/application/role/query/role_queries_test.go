package query_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	approle "blog-api/internal/application/role"
	"blog-api/internal/application/mocks"
	"blog-api/internal/application/role/query"
	"blog-api/internal/domain/permission"
	"blog-api/internal/domain/role"
)

// now 固定时间戳，便于断言 RFC3339 格式化
var now = time.Date(2026, 8, 2, 12, 0, 0, 0, time.UTC)

// newRole 构造重建角色（带权限码 + 时间戳），便于断言 DTO 映射。
func newRole(id int32, name, desc string, codes []string) *role.Role {
	return role.ReconstructRole(id, mustRoleName(name), desc, codes, now, now)
}

func mustRoleName(s string) role.RoleName {
	n, err := role.ParseRoleName(s)
	if err != nil {
		panic(err)
	}
	return n
}

// ============================================================
// ListRolesWithUserCount
// ============================================================

func TestListRolesWithUserCount_Success(t *testing.T) {
	r1 := newRole(1, "admin", "\u7ba1\u7406\u5458", []string{"admin:access"})
	r2 := newRole(2, "editor", "\u7f16\u8f91", []string{"post:create", "post:edit"})
	repo := new(mocks.MockRoleRepository)

	repo.On("FindAll", mock.Anything).Return([]*role.Role{r1, r2}, nil)
	// 逐角色查用户数：按具体 roleID 设置不同返回
	repo.On("CountUsers", mock.Anything, r1.RoleID()).Return(int64(5), nil)
	repo.On("CountUsers", mock.Anything, r2.RoleID()).Return(int64(0), nil)

	h := query.NewListRolesWithUserCountHandler(repo)
	out, err := h.Handle(context.Background())
	require.NoError(t, err)
	require.Len(t, out, 2)
	repo.AssertExpectations(t)

	// 角色 1：DTO 字段映射 + 用户数
	assert.Equal(t, int32(1), out[0].ID)
	assert.Equal(t, "admin", out[0].Name)
	assert.Equal(t, "\u7ba1\u7406\u5458", out[0].Description)
	assert.True(t, out[0].IsBuiltin) // admin 是内置角色
	assert.Equal(t, []string{"admin:access"}, out[0].PermissionCodes)
	assert.Equal(t, now.Format(time.RFC3339), out[0].CreatedAt)
	assert.Equal(t, int64(5), out[0].UserCount)

	// 角色 2
	assert.Equal(t, int32(2), out[1].ID)
	assert.Equal(t, "editor", out[1].Name)
	assert.False(t, out[1].IsBuiltin)
	// 权限集语义上无序（底层 map 存储），断言顺序无关
	assert.ElementsMatch(t, []string{"post:create", "post:edit"}, out[1].PermissionCodes)
	assert.Equal(t, int64(0), out[1].UserCount)
}

func TestListRolesWithUserCount_EmptyRepo_ReturnsEmpty(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	repo.On("FindAll", mock.Anything).Return([]*role.Role{}, nil)

	out, err := query.NewListRolesWithUserCountHandler(repo).Handle(context.Background())
	require.NoError(t, err)
	assert.Empty(t, out)
}

func TestListRolesWithUserCount_FindAllError_Propagates(t *testing.T) {
	repo := new(mocks.MockRoleRepository)
	repo.On("FindAll", mock.Anything).Return(nil, role.ErrNotFound)

	out, err := query.NewListRolesWithUserCountHandler(repo).Handle(context.Background())
	require.ErrorIs(t, err, role.ErrNotFound)
	assert.Nil(t, out)
}

func TestListRolesWithUserCount_CountUsersError_Propagates(t *testing.T) {
	r1 := newRole(1, "editor", "", nil)
	repo := new(mocks.MockRoleRepository)
	repo.On("FindAll", mock.Anything).Return([]*role.Role{r1}, nil)
	repo.On("CountUsers", mock.Anything, r1.RoleID()).Return(int64(0), role.ErrNotFound)

	out, err := query.NewListRolesWithUserCountHandler(repo).Handle(context.Background())
	require.ErrorIs(t, err, role.ErrNotFound)
	assert.Nil(t, out)
}

// ============================================================
// ListRoles（同文件薄透传，一并覆盖）
// ============================================================

func TestListRoles_Success(t *testing.T) {
	r1 := newRole(1, "admin", "\u7ba1\u7406\u5458", []string{"admin:access"})
	repo := new(mocks.MockRoleRepository)
	repo.On("FindAll", mock.Anything).Return([]*role.Role{r1}, nil)

	out, err := query.NewListRolesHandler(repo).Handle(context.Background())
	require.NoError(t, err)
	require.Len(t, out, 1)
	assert.Equal(t, approle.RoleDTO{
		ID:              1,
		Name:            "admin",
		Description:     "\u7ba1\u7406\u5458",
		IsBuiltin:       true,
		PermissionCodes: []string{"admin:access"},
		CreatedAt:       now.Format(time.RFC3339),
	}, out[0])
}

// ============================================================
// GetRoleWithPermissions
// ============================================================

func TestGetRoleWithPermissions_Success(t *testing.T) {
	rl := newRole(1, "editor", "\u7f16\u8f91", []string{"post:create", "post:delete"})
	roleRepo := new(mocks.MockRoleRepository)
	permRepo := new(mocks.MockPermissionRepository)

	roleRepo.On("FindByID", mock.Anything, int32(1)).Return(rl, nil)
	cCreate, _ := permission.ParseCode("post:create")
	cDelete, _ := permission.ParseCode("post:delete")
	permRepo.On("FindByCode", mock.Anything, cCreate).Return(
		permission.NewPermission(2, cCreate, "\u65b0\u5efa\u6587\u7ae0", "\u5199\u6587\u7ae0", ptrInt32(1), "action", 1, true), nil)
	permRepo.On("FindByCode", mock.Anything, cDelete).Return(
		permission.NewPermission(3, cDelete, "\u5220\u9664\u6587\u7ae0", "", ptrInt32(1), "action", 2, true), nil)

	out, err := query.NewGetRoleWithPermissionsHandler(roleRepo, permRepo).
		Handle(context.Background(), query.GetRoleWithPermissionsInput{ID: 1})
	require.NoError(t, err)
	assert.Equal(t, int32(1), out.ID)
	assert.Equal(t, "editor", out.Name)
	// 权限集语义上无序（底层 map 存储），断言顺序无关
	assert.ElementsMatch(t, []string{"post:create", "post:delete"}, out.PermissionCodes)
	require.Len(t, out.Permissions, 2)
	assert.ElementsMatch(t, []string{"新建文章", "删除文章"}, []string{out.Permissions[0].Name, out.Permissions[1].Name})
}

func TestGetRoleWithPermissions_NotFound(t *testing.T) {
	roleRepo := new(mocks.MockRoleRepository)
	roleRepo.On("FindByID", mock.Anything, int32(99)).Return((*role.Role)(nil), role.ErrNotFound)

	out, err := query.NewGetRoleWithPermissionsHandler(roleRepo, new(mocks.MockPermissionRepository)).
		Handle(context.Background(), query.GetRoleWithPermissionsInput{ID: 99})
	require.ErrorIs(t, err, role.ErrNotFound)
	assert.Equal(t, approle.RoleWithPermissionsDTO{}, out)
}

func ptrInt32(v int32) *int32 { return &v }
