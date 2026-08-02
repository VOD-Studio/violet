// Package content 提供 announcement + project 聚合的 HTTP handler 测试。
//
// content handler 的 annSvc/projSvc 是 *Service 结构体（非接口），无法用 stub service
// 替换。这两个 Service 都是「repo → toDTO → 返回」的薄 CRUD 包装，故在仓储端口注入
// 手写 stub（返回 canned 聚合），即可在不碰 DB/不引 mock 框架的前提下覆盖：
//
//   - 成功路径（200）：ListActiveAnnouncements / ListProjects / GetProject（含 chi 路径
//     参数注入），验证统一信封 {"data": ...} 与 DTO 编排。
//   - 错误映射：GetProject 资源不存在 → 仓储 ErrNotFound → 404。
//   - 参数校验（400）：CreateAnnouncement / CreateProject 的 JSON 解析与 validator。
package content

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appann "blog-api/internal/application/announcement"
	appproj "blog-api/internal/application/project"
	domainann "blog-api/internal/domain/announcement"
	domainproj "blog-api/internal/domain/project"
	domainshared "blog-api/internal/domain/shared"
)

// ---------------------------------------------------------------------
// 手写 stub 仓储
// ---------------------------------------------------------------------

type stubAnnRepo struct {
	active []*domainann.Announcement
	all    []*domainann.Announcement
}

func (s *stubAnnRepo) FindByID(context.Context, int32) (*domainann.Announcement, error) {
	return nil, domainann.ErrNotFound
}
func (s *stubAnnRepo) FindAll(context.Context) ([]*domainann.Announcement, error) {
	return s.all, nil
}
func (s *stubAnnRepo) FindActive(context.Context) ([]*domainann.Announcement, error) {
	return s.active, nil
}
func (s *stubAnnRepo) Save(context.Context, *domainann.Announcement) (int32, error) {
	return 0, nil
}
func (s *stubAnnRepo) Delete(context.Context, int32) error { return nil }

var _ domainann.AnnouncementRepository = (*stubAnnRepo)(nil)

type stubProjRepo struct {
	items   []*domainproj.Project
	canned  *domainproj.Project
	findErr error // 非 nil 时 FindByID 返回此错误
}

func (s *stubProjRepo) FindByID(context.Context, domainshared.ID) (*domainproj.Project, error) {
	if s.findErr != nil {
		return nil, s.findErr
	}
	return s.canned, nil
}
func (s *stubProjRepo) FindAll(context.Context) ([]*domainproj.Project, error) {
	return s.items, nil
}
func (s *stubProjRepo) Save(context.Context, *domainproj.Project) error { return nil }
func (s *stubProjRepo) Delete(context.Context, domainshared.ID) error   { return nil }

var _ domainproj.ProjectRepository = (*stubProjRepo)(nil)

// ---------------------------------------------------------------------
// 辅助
// ---------------------------------------------------------------------

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

// validUUID 用于 GetProject 路径参数（service.Get 会 parseID 校验 UUID 格式）。
const validUUID = "550e8400-e29b-41d4-a716-446655440000"

// =====================================================================
// ListActiveAnnouncements 成功路径
// =====================================================================

func TestListActiveAnnouncements_Returns200(t *testing.T) {
	ann := domainann.ReconstructAnnouncement(
		1, "站点公告", "欢迎", domainann.SeverityInfo, domainann.DisplayBanner,
		true, nil, nil, 0, nil, "", "", "", "", nil, time.Now(), time.Now(),
	)
	repo := &stubAnnRepo{active: []*domainann.Announcement{ann}}
	h := NewHandler(appann.NewService(repo), nil)

	r := httptest.NewRequest(http.MethodGet, "/announcements/active", nil)
	w := httptest.NewRecorder()
	h.ListActiveAnnouncements(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	body := decodeBody(t, w)
	list, ok := body["data"].([]any)
	require.True(t, ok, "data 应为数组: %T", body["data"])
	require.Len(t, list, 1)
	assert.Equal(t, "站点公告", list[0].(map[string]any)["title"])
}

// =====================================================================
// ListProjects 成功路径
// =====================================================================

func TestListProjects_Returns200(t *testing.T) {
	proj := domainproj.ReconstructProject(
		domainshared.NewID(), "我的项目", "描述", "https://example.com", "", "",
		[]string{"Go"}, 0, time.Now(), time.Now(),
	)
	repo := &stubProjRepo{items: []*domainproj.Project{proj}}
	h := NewHandler(nil, appproj.NewService(repo))

	r := httptest.NewRequest(http.MethodGet, "/projects", nil)
	w := httptest.NewRecorder()
	h.ListProjects(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	body := decodeBody(t, w)
	list, ok := body["data"].([]any)
	require.True(t, ok, "data 应为数组: %T", body["data"])
	require.Len(t, list, 1)
	assert.Equal(t, "我的项目", list[0].(map[string]any)["title"])
}

// =====================================================================
// GetProject：chi URL 路径参数注入 + 成功路径
// =====================================================================

func TestGetProject_Returns200(t *testing.T) {
	proj := domainproj.ReconstructProject(
		domainshared.NewID(), "详情项目", "描述", "", "", "", nil, 0, time.Now(), time.Now(),
	)
	repo := &stubProjRepo{canned: proj}
	h := NewHandler(nil, appproj.NewService(repo))

	r := httptest.NewRequest(http.MethodGet, "/projects/"+validUUID, nil)
	r.SetPathValue("id", validUUID)
	w := httptest.NewRecorder()
	h.GetProject(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	data, ok := decodeBody(t, w)["data"].(map[string]any)
	require.True(t, ok, "data 应为对象: %v", decodeBody(t, w)["data"])
	assert.Equal(t, "详情项目", data["title"])
	assert.NotEmpty(t, data["id"], "应回填项目 ID")
}

// =====================================================================
// GetProject：资源不存在 → 404
// =====================================================================

func TestGetProject_NotFound_Returns404(t *testing.T) {
	repo := &stubProjRepo{findErr: domainproj.ErrNotFound}
	h := NewHandler(nil, appproj.NewService(repo))

	r := httptest.NewRequest(http.MethodGet, "/projects/"+validUUID, nil)
	r.SetPathValue("id", validUUID)
	w := httptest.NewRecorder()
	h.GetProject(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Equal(t, "NOT_FOUND", decodeBody(t, w)["error"])
}

// =====================================================================
// CreateAnnouncement：参数校验
// =====================================================================

func TestCreateAnnouncement_EmptyBody_Returns400(t *testing.T) {
	h := NewHandler(appann.NewService(&stubAnnRepo{}), nil)
	r := newJSONRequest(http.MethodPost, "/admin/announcements", "")
	w := httptest.NewRecorder()

	h.CreateAnnouncement(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// announcementRequest.Title/Type 均 required；缺 type → 400。
func TestCreateAnnouncement_MissingType_Returns400(t *testing.T) {
	h := NewHandler(appann.NewService(&stubAnnRepo{}), nil)
	r := newJSONRequest(http.MethodPost, "/admin/announcements", `{"title":"有标题"}`)
	w := httptest.NewRecorder()

	h.CreateAnnouncement(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "VALIDATION_ERROR", decodeBody(t, w)["error"])
}

// Type 枚举校验 oneof；非法值 → 400。
func TestCreateAnnouncement_InvalidType_Returns400(t *testing.T) {
	h := NewHandler(appann.NewService(&stubAnnRepo{}), nil)
	r := newJSONRequest(http.MethodPost, "/admin/announcements", `{"title":"x","type":"wat"}`)
	w := httptest.NewRecorder()

	h.CreateAnnouncement(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "VALIDATION_ERROR", decodeBody(t, w)["error"])
}

// =====================================================================
// CreateProject：参数校验
// =====================================================================

func TestCreateProject_EmptyBody_Returns400(t *testing.T) {
	h := NewHandler(nil, appproj.NewService(&stubProjRepo{}))
	r := newJSONRequest(http.MethodPost, "/admin/projects", "")
	w := httptest.NewRecorder()

	h.CreateProject(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "BAD_REQUEST", decodeBody(t, w)["error"])
}

// projectRequest.Title required；缺 title → 400。
func TestCreateProject_MissingTitle_Returns400(t *testing.T) {
	h := NewHandler(nil, appproj.NewService(&stubProjRepo{}))
	r := newJSONRequest(http.MethodPost, "/admin/projects", `{"description":"无标题"}`)
	w := httptest.NewRecorder()

	h.CreateProject(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "VALIDATION_ERROR", decodeBody(t, w)["error"])
}
