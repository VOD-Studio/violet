// Package tag 提供 tag 模块的 HTTP handler 测试。
//
// tag.Handler 持有具体 *apptag.Service（非接口），无法直接注入 stub service。
// 故构造真实 apptag.Service，仅替换其依赖的 domaintag.TagRepository 接口为手写 stub，
// 既覆盖完整 HTTP→service→repo 通路，又保持纯内存、不触基础设施。
package tag

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apptag "blog-api/internal/application/tag"
	domaintag "blog-api/internal/domain/tag"
)

// stubTagRepo 手写 stub，实现 domaintag.TagRepository。
// 未覆盖的方法通过内嵌接口保持编译通过（测试不触碰它们）。
type stubTagRepo struct {
	domaintag.TagRepository
	findAllTags  []domaintag.Tag
	existsBySlug bool
	saveID       int32
	deletedID    int32
	deleteCalled bool
}

func (s *stubTagRepo) FindAll(context.Context) ([]domaintag.Tag, error) {
	return s.findAllTags, nil
}

func (s *stubTagRepo) ExistsBySlug(context.Context, string) (bool, error) {
	return s.existsBySlug, nil
}

func (s *stubTagRepo) Save(context.Context, domaintag.Tag) (int32, error) {
	return s.saveID, nil
}

func (s *stubTagRepo) Delete(_ context.Context, id int32) error {
	s.deletedID = id
	s.deleteCalled = true
	return nil
}

// 编译期断言：确保 stubTagRepo 满足 TagRepository 接口。
var _ domaintag.TagRepository = (*stubTagRepo)(nil)

func newTagHandler(repo *stubTagRepo) *Handler {
	return NewHandler(apptag.NewService(repo))
}

// newJSONRequest 构造带 JSON body 的请求（空 body 传 ""）。
func newJSONRequest(method, target, body string) *http.Request {
	req := httptest.NewRequest(method, target, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

// withID 模拟 chi 路径参数注入。
func withID(req *http.Request, id string) *http.Request {
	req.SetPathValue("id", id)
	return req
}

// =====================================================================
// List
// =====================================================================

func TestList_OK_ReturnsAllTags(t *testing.T) {
	repo := &stubTagRepo{findAllTags: []domaintag.Tag{
		domaintag.NewTag(1, "Go", "go"),
		domaintag.NewTag(2, "Rust", "rust"),
	}}
	h := newTagHandler(repo)

	rr := httptest.NewRecorder()
	h.List(rr, newJSONRequest(http.MethodGet, "/tags", ""))

	require.Equal(t, http.StatusOK, rr.Code)

	var got struct {
		Data []apptag.TagDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Len(t, got.Data, 2, "应返回 2 个标签")
	assert.Equal(t, "Go", got.Data[0].Name)
	assert.Equal(t, "go", got.Data[0].Slug)
	assert.Equal(t, "Rust", got.Data[1].Name)
}

func TestList_Empty_ReturnsEmptyArray(t *testing.T) {
	h := newTagHandler(&stubTagRepo{})

	rr := httptest.NewRecorder()
	h.List(rr, newJSONRequest(http.MethodGet, "/tags", ""))

	require.Equal(t, http.StatusOK, rr.Code)

	var got struct {
		Data []apptag.TagDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Empty(t, got.Data, "无标签应返回空数组而非 null")
}

// =====================================================================
// Create
// =====================================================================

func TestCreate_EmptyBody_Returns400(t *testing.T) {
	h := newTagHandler(&stubTagRepo{})

	rr := httptest.NewRecorder()
	h.Create(rr, newJSONRequest(http.MethodPost, "/admin/tags", ""))

	assert.Equal(t, http.StatusBadRequest, rr.Code, "空 body 应 400")
}

func TestCreate_InvalidJSON_Returns400(t *testing.T) {
	h := newTagHandler(&stubTagRepo{})

	rr := httptest.NewRecorder()
	h.Create(rr, newJSONRequest(http.MethodPost, "/admin/tags", "{not json"))

	assert.Equal(t, http.StatusBadRequest, rr.Code, "非法 JSON 应 400")
}

func TestCreate_Valid_Returns201(t *testing.T) {
	repo := &stubTagRepo{existsBySlug: false, saveID: 5}
	h := newTagHandler(repo)

	rr := httptest.NewRecorder()
	h.Create(rr, newJSONRequest(http.MethodPost, "/admin/tags", `{"name":"Go"}`))

	require.Equal(t, http.StatusCreated, rr.Code, "合法创建应 201")

	var got struct {
		Data apptag.TagDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Equal(t, int32(5), got.Data.ID)
	assert.Equal(t, "Go", got.Data.Name)
	assert.Equal(t, "go", got.Data.Slug, "slug 应由 name 自动生成")
}

// =====================================================================
// Update
// =====================================================================

func TestUpdate_EmptyName_Returns400(t *testing.T) {
	h := newTagHandler(&stubTagRepo{})

	rr := httptest.NewRecorder()
	h.Update(rr, withID(newJSONRequest(http.MethodPut, "/admin/tags/1", `{"name":""}`), "1"))

	assert.Equal(t, http.StatusBadRequest, rr.Code, "空标签名应 400（不触达 service）")
}

func TestUpdate_EmptyBody_Returns400(t *testing.T) {
	h := newTagHandler(&stubTagRepo{})

	rr := httptest.NewRecorder()
	h.Update(rr, withID(newJSONRequest(http.MethodPut, "/admin/tags/1", ""), "1"))

	assert.Equal(t, http.StatusBadRequest, rr.Code, "空 body 应 400")
}

// =====================================================================
// Delete —— URL path param 解析并透传给 service
// =====================================================================

func TestDelete_ParsesIDAndCallsService(t *testing.T) {
	repo := &stubTagRepo{}
	h := newTagHandler(repo)

	rr := httptest.NewRecorder()
	h.Delete(rr, withID(newJSONRequest(http.MethodDelete, "/admin/tags/7", ""), "7"))

	require.Equal(t, http.StatusOK, rr.Code)
	assert.True(t, repo.deleteCalled, "应调用 repo.Delete")
	assert.Equal(t, int32(7), repo.deletedID, "应把 URL 中的 id=7 解析为 int32 透传给 service")

	var got struct {
		Meta *struct {
			Message string `json:"message"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.NotNil(t, got.Meta)
	assert.Equal(t, "标签已删除", got.Meta.Message)
}
