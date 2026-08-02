// Package role 提供 role/permission 聚合的 HTTP handler 测试。
//
// role handler 依赖 10 个 CQRS 用例 handler（均为结构体指针，非接口），无法整体
// stub。本测试覆盖：
//
//   - 参数校验/解析失败（400）：CreateRole/CreatePermission 的 JSON 解析与
//     validator.Struct 在调用用例前短路，仅需 validate 字段。
//     的薄读路径，用手写 stub role 仓储注入 canned 数据，验证 200 信封与 DTO 编排。
//
// CreateRole/CreatePermission 的成功路径涉及 NewRole 工厂 + 事件发布等 service 编排，
// 属 service 实现范畴，handler 层不重复测。
package role

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/application/role/query"
	domainrole "blog-api/internal/domain/role"
)

// stubRoleRepo 手写 role.RoleRepository stub：FindAll/CountUsers 返回 canned 数据，
// 其余方法返回零值/未找到，供 ListRoles 薄读路径使用。
type stubRoleRepo struct {
	roles []*domainrole.Role
}

func (s *stubRoleRepo) FindByID(context.Context, int32) (*domainrole.Role, error) {
	return nil, domainrole.ErrNotFound
}
func (s *stubRoleRepo) FindByName(context.Context, domainrole.RoleName) (*domainrole.Role, error) {
	return nil, domainrole.ErrNotFound
}
func (s *stubRoleRepo) FindAll(context.Context) ([]*domainrole.Role, error) {
	return s.roles, nil
}
func (s *stubRoleRepo) ExistsByName(context.Context, domainrole.RoleName) (bool, error) {
	return false, nil
}
func (s *stubRoleRepo) Save(context.Context, *domainrole.Role) (int32, error)  { return 0, nil }
func (s *stubRoleRepo) SavePermissions(context.Context, int32, []string) error { return nil }
func (s *stubRoleRepo) Delete(context.Context, int32) error                    { return nil }
func (s *stubRoleRepo) CountUsers(context.Context, int32) (int64, error)       { return 5, nil }

// 编译期断言：stub 满足仓储接口。
var _ domainrole.RoleRepository = (*stubRoleRepo)(nil)

func decodeBody(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &m), "响应体应为 JSON: %s", w.Body.String())
	return m
}

func newJSONRequest(method, target, body string) *http.Request {
	r := httptest.NewRequest(method, target, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	return r
}

// =====================================================================
// ListRoles 成功路径
// =====================================================================

func TestListRoles_Returns200WithRoles(t *testing.T) {
	name, err := domainrole.ParseRoleName("admin")
	require.NoError(t, err)
	canned := []*domainrole.Role{
		domainrole.ReconstructRole(1, name, "管理员", nil, time.Now(), time.Now()),
	}
	repo := &stubRoleRepo{roles: canned}
	h := &Handler{
		roleQuery: query.NewListRolesWithUserCountHandler(repo),
		validate:  validator.New(),
	}

	r := httptest.NewRequest(http.MethodGet, "/admin/roles", nil)
	w := httptest.NewRecorder()
	h.ListRoles(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	body := decodeBody(t, w)
	list, ok := body["data"].([]any)
	require.True(t, ok, "data 应为数组: %T", body["data"])
	require.Len(t, list, 1)
	first := list[0].(map[string]any)
	assert.Equal(t, "admin", first["name"])
	assert.EqualValues(t, 5, first["user_count"])
}

// =====================================================================
// CreateRole 参数校验
// =====================================================================

func TestCreateRole_EmptyBody_Returns400(t *testing.T) {
	h := &Handler{validate: validator.New()}
	r := newJSONRequest(http.MethodPost, "/admin/roles", "")
	w := httptest.NewRecorder()

	h.CreateRole(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

func TestCreateRole_MalformedJSON_Returns400(t *testing.T) {
	h := &Handler{validate: validator.New()}
	r := newJSONRequest(http.MethodPost, "/admin/roles", `{broken`)
	w := httptest.NewRecorder()

	h.CreateRole(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// CreateRoleRequest.Name validate:"required,min=2,max=50"；缺 name → 400。
func TestCreateRole_MissingName_Returns400(t *testing.T) {
	h := &Handler{validate: validator.New()}
	r := newJSONRequest(http.MethodPost, "/admin/roles", `{"description":"无名称"}`)
	w := httptest.NewRecorder()

	h.CreateRole(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "VALIDATION_ERROR", decodeBody(t, w)["error"])
}

// Name 长度不足 min=2 → 400。
func TestCreateRole_NameTooShort_Returns400(t *testing.T) {
	h := &Handler{validate: validator.New()}
	r := newJSONRequest(http.MethodPost, "/admin/roles", `{"name":"a"}`)
	w := httptest.NewRecorder()

	h.CreateRole(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "VALIDATION_ERROR", decodeBody(t, w)["error"])
}

// =====================================================================
// CreatePermission 参数校验
// =====================================================================

func TestCreatePermission_EmptyBody_Returns400(t *testing.T) {
	h := &Handler{validate: validator.New()}
	r := newJSONRequest(http.MethodPost, "/admin/permissions", "")
	w := httptest.NewRecorder()

	h.CreatePermission(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

func TestCreatePermission_MalformedJSON_Returns400(t *testing.T) {
	h := &Handler{validate: validator.New()}
	r := newJSONRequest(http.MethodPost, "/admin/permissions", `not-json`)
	w := httptest.NewRecorder()

	h.CreatePermission(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// CreatePermissionRequest.Code/Name 均 required；缺 code → 400。
func TestCreatePermission_MissingCode_Returns400(t *testing.T) {
	h := &Handler{validate: validator.New()}
	r := newJSONRequest(http.MethodPost, "/admin/permissions", `{"name":"权限"}`)
	w := httptest.NewRecorder()

	h.CreatePermission(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "VALIDATION_ERROR", decodeBody(t, w)["error"])
}

func TestCreatePermission_MissingName_Returns400(t *testing.T) {
	h := &Handler{validate: validator.New()}
	r := newJSONRequest(http.MethodPost, "/admin/permissions", `{"code":"perm:view"}`)
	w := httptest.NewRecorder()

	h.CreatePermission(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "VALIDATION_ERROR", decodeBody(t, w)["error"])
}
