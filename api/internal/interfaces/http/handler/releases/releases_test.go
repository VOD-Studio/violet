// Package releases 提供 releases 模块的 HTTP handler 测试。
//
// handler 依赖 *appreleases.Service（具体结构体，非接口），故测试构造真实
// Service，注入手写的 domain 端口 stub（Provider / SettingsStore）以可控地
// 驱动成功路径与错误路径，仅断言 HTTP 层（状态码 + 响应信封）。
package releases

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appreleases "blog-api/internal/application/releases"
	domainreleases "blog-api/internal/domain/releases"
	domainsettings "blog-api/internal/domain/settings"
	domainshared "blog-api/internal/domain/shared"
)

// stubReleasesProvider 手写 stub，实现 domainreleases.Provider，记录调用入参。
type stubReleasesProvider struct {
	releases []domainreleases.Release
	err      error
	called   bool
	owner    string
	repo     string
	token    string
}

func (p *stubReleasesProvider) ListReleases(_ context.Context, owner, repo, token string) ([]domainreleases.Release, error) {
	p.called = true
	p.owner, p.repo, p.token = owner, repo, token
	return p.releases, p.err
}

// stubSettingsStore 手写 stub，实现 domainsettings.SettingsStore。
type stubSettingsStore struct {
	values map[string]string
	err    error
}

func (s *stubSettingsStore) GetAll(_ context.Context) (map[string]string, error) {
	return s.values, s.err
}
func (s *stubSettingsStore) Upsert(context.Context, string, string) error        { return nil }
func (s *stubSettingsStore) UpsertMany(context.Context, map[string]string) error { return nil }

// 编译期断言：确保 stub 满足 domain 端口。
var (
	_ domainreleases.Provider      = (*stubReleasesProvider)(nil)
	_ domainsettings.SettingsStore = (*stubSettingsStore)(nil)
)

// TestGetReleases_Success 配置 releases_repo（owner/repo 格式）→ provider 返回
// release 列表 → 200 + 信封内含当前版本号；并校验 owner/repo 拆分逻辑。
func TestGetReleases_Success(t *testing.T) {
	provider := &stubReleasesProvider{releases: []domainreleases.Release{
		{TagName: "v2.0.0", Name: "Release 2.0.0", HTMLURL: "https://example/v2.0.0"},
		{TagName: "v1.9.0", Name: "Release 1.9.0"},
	}}
	settings := &stubSettingsStore{values: map[string]string{
		"github_username": "octocat",
		"releases_repo":   "octocat/violet",
		"github_token":    "tok",
	}}
	h := NewHandler(appreleases.NewService(provider, settings, nil))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/releases", nil)
	rec := httptest.NewRecorder()
	h.GetReleases(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	require.True(t, provider.called)
	// owner/repo 格式拆分后 owner 取自 repo 串，repo 为仓库名
	assert.Equal(t, "octocat", provider.owner)
	assert.Equal(t, "violet", provider.repo)
	assert.Equal(t, "tok", provider.token)

	var env struct {
		Data *domainreleases.ReleasesData `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &env))
	require.NotNil(t, env.Data)
	assert.Equal(t, "v2.0.0", env.Data.CurrentVersion)
	require.Len(t, env.Data.Releases, 2)
}

// TestGetReleases_NoRepoConfigured_ReturnsEmpty 未配置 releases_repo → 短路返回
// 空数据（不调 provider），仍 200。
func TestGetReleases_NoRepoConfigured_ReturnsEmpty(t *testing.T) {
	provider := &stubReleasesProvider{}
	settings := &stubSettingsStore{values: map[string]string{"github_username": "octocat"}}
	h := NewHandler(appreleases.NewService(provider, settings, nil))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/releases", nil)
	rec := httptest.NewRecorder()
	h.GetReleases(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.False(t, provider.called, "未配置 repo 不应调用 provider")

	var env struct {
		Data *domainreleases.ReleasesData `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &env))
	require.NotNil(t, env.Data)
	assert.Empty(t, env.Data.Releases)
}

// TestGetReleases_SettingsError_Returns500 settings 读取失败（领域 INTERNAL 错误）
// → RespondError 映射为 500。
func TestGetReleases_SettingsError_Returns500(t *testing.T) {
	provider := &stubReleasesProvider{}
	settings := &stubSettingsStore{err: domainshared.Internal("配置读取失败", nil)}
	h := NewHandler(appreleases.NewService(provider, settings, nil))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/releases", nil)
	rec := httptest.NewRecorder()
	h.GetReleases(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.False(t, provider.called)
	assert.Contains(t, rec.Body.String(), "INTERNAL_ERROR")
}
