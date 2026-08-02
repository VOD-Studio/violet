// Package github 提供 github 模块的 HTTP handler 测试。
//
// handler 依赖 *appgithub.Service（具体结构体），测试构造真实 Service 注入
// 手写的 domain 端口 stub（GitHubProvider / SettingsStore），仅断言 HTTP 层。
package github

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appgithub "blog-api/internal/application/github"
	domaingithub "blog-api/internal/domain/github"
	domainsettings "blog-api/internal/domain/settings"
)

// stubGitHubProvider 手写 stub，实现 domaingithub.GitHubProvider，记录调用入参。
type stubGitHubProvider struct {
	contrib *domaingithub.ContributionData
	repos   []domaingithub.RepoData
	err     error

	calledContrib bool
	calledRepos   bool
	username      string
	token         string
}

func (p *stubGitHubProvider) GetContributions(_ context.Context, username, token string) (*domaingithub.ContributionData, error) {
	p.calledContrib = true
	p.username, p.token = username, token
	return p.contrib, p.err
}

func (p *stubGitHubProvider) GetRepos(_ context.Context, username, token string) ([]domaingithub.RepoData, error) {
	p.calledRepos = true
	p.username, p.token = username, token
	return p.repos, p.err
}

// stubSettingsStore 手写 stub，实现 domainsettings.SettingsStore。
type stubSettingsStore struct {
	values map[string]string
}

func (s *stubSettingsStore) GetAll(_ context.Context) (map[string]string, error) {
	return s.values, nil
}
func (s *stubSettingsStore) Upsert(context.Context, string, string) error        { return nil }
func (s *stubSettingsStore) UpsertMany(context.Context, map[string]string) error { return nil }

// 编译期断言。
var (
	_ domaingithub.GitHubProvider  = (*stubGitHubProvider)(nil)
	_ domainsettings.SettingsStore = (*stubSettingsStore)(nil)
)

// TestGetContributions_Success 配置 username → provider 返回贡献数据 → 200。
func TestGetContributions_Success(t *testing.T) {
	provider := &stubGitHubProvider{contrib: &domaingithub.ContributionData{
		Username:           "octocat",
		TotalContributions: 42,
		Contributions:      []domaingithub.Contribution{{Date: "2026-08-01", Count: 5}},
	}}
	settings := &stubSettingsStore{values: map[string]string{
		"github_username": "octocat",
		"github_token":    "tok",
	}}
	h := NewHandler(appgithub.NewService(provider, settings))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/github/contributions", nil)
	rec := httptest.NewRecorder()
	h.GetContributions(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	require.True(t, provider.calledContrib)
	assert.Equal(t, "octocat", provider.username)
	assert.Equal(t, "tok", provider.token)

	var env struct {
		Data *domaingithub.ContributionData `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &env))
	require.NotNil(t, env.Data)
	assert.Equal(t, "octocat", env.Data.Username)
	assert.Equal(t, 42, env.Data.TotalContributions)
	require.Len(t, env.Data.Contributions, 1)
}

// TestGetRepos_Success 配置 username → provider 返回仓库列表 → 200。
func TestGetRepos_Success(t *testing.T) {
	provider := &stubGitHubProvider{repos: []domaingithub.RepoData{
		{Name: "violet", Language: "Go", Stars: 100, Pinned: true},
		{Name: "blog-theme", Language: "TypeScript", Stars: 20},
	}}
	settings := &stubSettingsStore{values: map[string]string{"github_username": "octocat"}}
	h := NewHandler(appgithub.NewService(provider, settings))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/github/repos", nil)
	rec := httptest.NewRecorder()
	h.GetRepos(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	require.True(t, provider.calledRepos)
	assert.Equal(t, "octocat", provider.username)

	var env struct {
		Data []domaingithub.RepoData `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &env))
	require.Len(t, env.Data, 2)
	assert.Equal(t, "violet", env.Data[0].Name)
}

// TestGetContributions_EmptyUsername_ReturnsEmpty 未配置 username → 短路返回空
// 贡献数据（不调 provider），仍 200。
func TestGetContributions_EmptyUsername_ReturnsEmpty(t *testing.T) {
	provider := &stubGitHubProvider{}
	settings := &stubSettingsStore{values: map[string]string{}}
	h := NewHandler(appgithub.NewService(provider, settings))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/github/contributions", nil)
	rec := httptest.NewRecorder()
	h.GetContributions(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.False(t, provider.calledContrib, "未配置 username 不应调用 provider")

	var env struct {
		Data *domaingithub.ContributionData `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &env))
	require.NotNil(t, env.Data)
	assert.Equal(t, "", env.Data.Username)
	assert.Empty(t, env.Data.Contributions)
}
