// Package useradmin 提供 useradmin 模块的 HTTP handler 测试。
//
// useradmin handler 的 svc 是 *appuseradmin.Service（结构体，非接口），无法用 stub
// 替换。可稳定覆盖的 HTTP 层路径为 JSON 解析失败（400）：所有写 handler 先 decode
// 请求体，解析失败在触碰 svc（及 operatorInfo）前短路，故用 nil svc 的 Handler 即可。
//
// 注意：本 handler 未持有 validator、也从不调用 validate.Struct——请求结构体上的
// validate tag 实际未生效，故语义校验（如非法 email）不会在此层产生 400，而会落到
// svc。语义校验与成功路径属 service 实现，handler 层不重复测。
package useradmin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
// BatchUpdateStatus：JSON 解析
// =====================================================================

func TestBatchUpdateStatus_EmptyBody_Returns400(t *testing.T) {
	h := NewHandler(nil)
	r := newJSONRequest(http.MethodPost, "/admin/users/batch-status", "")
	w := httptest.NewRecorder()

	h.BatchUpdateStatus(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

func TestBatchUpdateStatus_MalformedJSON_Returns400(t *testing.T) {
	h := NewHandler(nil)
	r := newJSONRequest(http.MethodPost, "/admin/users/batch-status", `{"ids":[`)
	w := httptest.NewRecorder()

	h.BatchUpdateStatus(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// =====================================================================
// BatchUpdateRole：JSON 解析
// =====================================================================

func TestBatchUpdateRole_MalformedJSON_Returns400(t *testing.T) {
	h := NewHandler(nil)
	r := newJSONRequest(http.MethodPost, "/admin/users/batch-role", `not-json`)
	w := httptest.NewRecorder()

	h.BatchUpdateRole(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// =====================================================================
// CreateUser：JSON 解析
// =====================================================================

func TestCreateUser_EmptyBody_Returns400(t *testing.T) {
	h := NewHandler(nil)
	r := newJSONRequest(http.MethodPost, "/admin/users", "")
	w := httptest.NewRecorder()

	h.CreateUser(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

func TestCreateUser_MalformedJSON_Returns400(t *testing.T) {
	h := NewHandler(nil)
	r := newJSONRequest(http.MethodPost, "/admin/users", `{"username":`)
	w := httptest.NewRecorder()

	h.CreateUser(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// =====================================================================
// UpdateUser / UpdateUserRole / UpdateUserStatus：JSON 解析
// =====================================================================

func TestUpdateUser_MalformedJSON_Returns400(t *testing.T) {
	h := NewHandler(nil)
	r := newJSONRequest(http.MethodPut, "/admin/users/1", `broken`)
	w := httptest.NewRecorder()

	h.UpdateUser(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

func TestUpdateUserRole_MalformedJSON_Returns400(t *testing.T) {
	h := NewHandler(nil)
	r := newJSONRequest(http.MethodPut, "/admin/users/1/role", `{`)
	w := httptest.NewRecorder()

	h.UpdateUserRole(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

func TestUpdateUserStatus_MalformedJSON_Returns400(t *testing.T) {
	h := NewHandler(nil)
	r := newJSONRequest(http.MethodPut, "/admin/users/1/status", `not-json`)
	w := httptest.NewRecorder()

	h.UpdateUserStatus(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}
