// Package post 提供 post 模块的 HTTP handler 测试。
//
// post handler 的 svc 是 *apppost.Service（结构体，非接口），无法用 stub service
// 替换。本测试聚焦两类可稳定覆盖的 HTTP 层路径：
//
//  1. 参数校验/解析失败（400）：JSON 解析、validator.Struct、路径参数解析在校验阶段
//     短路，不会触碰 svc，故用 nil 依赖的 Handler 即可。
//  2. Slugify 成功路径（200）：Service.Slugify 是纯计算（domain.GenerateSlug），
//     不读 DB，nil 依赖安全。
//
// 成功的 repo 依赖路径（GetBySlug/ListPublished/Create 等）需要真实仓储，留待
// service/集成层覆盖，handler 层不重复测 service 实现。
package post

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apppost "blog-api/internal/application/post"
)

// newTestHandler 构造依赖全部为 nil 的真实 Service 的 Handler。
// nil 依赖对校验失败路径与 Slugify 纯计算路径安全（svc 方法不会被触达）。
func newTestHandler() *Handler {
	return NewHandler(apppost.NewService(nil, nil, nil, nil, nil))
}

// decodeBody 把响应体解析为 map，便于断言 error/data 字段。
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
// Slugify
// =====================================================================

func TestSlugify_EmptyTitle_Returns400(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodPost, "/admin/posts/slugify", `{"title":""}`)
	w := httptest.NewRecorder()

	h.Slugify(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "VALIDATION_ERROR", decodeBody(t, w)["error"])
}

func TestSlugify_MalformedJSON_Returns400(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodPost, "/admin/posts/slugify", `{not json`)
	w := httptest.NewRecorder()

	h.Slugify(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

func TestSlugify_EmptyBody_Returns400(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodPost, "/admin/posts/slugify", "")
	w := httptest.NewRecorder()

	h.Slugify(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// Slugify 是纯计算路径：即使依赖全部为 nil，合法标题也应返回 200 + 生成的 slug。
func TestSlugify_ValidTitle_Returns200(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodPost, "/admin/posts/slugify", `{"title":"你好世界"}`)
	w := httptest.NewRecorder()

	h.Slugify(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	data, ok := decodeBody(t, w)["data"].(map[string]any)
	require.True(t, ok, "data 应为对象: %v", decodeBody(t, w)["data"])
	assert.NotEmpty(t, data["slug"], "中文标题应生成非空 slug")
}

// =====================================================================
// Create
// =====================================================================

func TestCreate_EmptyBody_Returns400(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodPost, "/admin/posts", "")
	w := httptest.NewRecorder()

	h.Create(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

func TestCreate_MalformedJSON_Returns400(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodPost, "/admin/posts", `{"title": "broken`)
	w := httptest.NewRecorder()

	h.Create(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// createPostRequest 的 title/slug 均 required；缺 slug → validator 命中 → 400。
func TestCreate_MissingRequiredFields_Returns400(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodPost, "/admin/posts", `{"title":"只有标题"}`)
	w := httptest.NewRecorder()

	h.Create(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "VALIDATION_ERROR", decodeBody(t, w)["error"])
}

// =====================================================================
// ArchiveByYear：路径参数解析
// =====================================================================

func TestArchiveByYear_InvalidYear_Returns400(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodGet, "/archive/abc", "")
	r.SetPathValue("year", "abc")
	w := httptest.NewRecorder()

	h.ArchiveByYear(w, r)

	// strconv.Atoi 失败 → domain BadRequest → 400
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// =====================================================================
// UpdateStatus：状态枚举校验
// =====================================================================

func TestUpdateStatus_InvalidStatus_Returns400(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodPatch, "/admin/posts/1/status", `{"status":"foo"}`)
	w := httptest.NewRecorder()

	h.UpdateStatus(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "VALIDATION_ERROR", decodeBody(t, w)["error"])
}

func TestUpdateStatus_EmptyBody_Returns400(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodPatch, "/admin/posts/1/status", "")
	w := httptest.NewRecorder()

	h.UpdateStatus(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// =====================================================================
// ImportURL：URL 校验
// =====================================================================

func TestImportURL_MalformedJSON_Returns400(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodPost, "/admin/posts/import-url", "nope")
	w := httptest.NewRecorder()

	h.ImportURL(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// ImportURL 的 url 字段 required,url 校验；非 URL 值 → validator 命中 → 400。
func TestImportURL_InvalidURL_Returns400(t *testing.T) {
	h := newTestHandler()
	r := newJSONRequest(http.MethodPost, "/admin/posts/import-url", `{"url":"not-a-url"}`)
	w := httptest.NewRecorder()

	h.ImportURL(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "VALIDATION_ERROR", decodeBody(t, w)["error"])
}
