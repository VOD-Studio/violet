package github_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appgithub "blog-api/internal/application/github"
	domaingithub "blog-api/internal/domain/github"
	domainsettings "blog-api/internal/domain/settings"
)

// ============================================================
// 手写 stub：GitHubProvider
// ============================================================

type stubProvider struct {
	contribs *domaingithub.ContributionData
	repos    []domaingithub.RepoData
	err      error

	// 捕获转发给 provider 的参数，验证透传正确
	called   bool
	gotUser  string
	gotToken string
}

func (s *stubProvider) GetContributions(_ context.Context, username, token string) (*domaingithub.ContributionData, error) {
	s.called = true
	s.gotUser = username
	s.gotToken = token
	return s.contribs, s.err
}

func (s *stubProvider) GetRepos(_ context.Context, username, token string) ([]domaingithub.RepoData, error) {
	s.called = true
	s.gotUser = username
	s.gotToken = token
	return s.repos, s.err
}

// 编译期断言：stubProvider 实现 GitHubProvider
var _ domaingithub.GitHubProvider = (*stubProvider)(nil)

// ============================================================
// 手写 stub：SettingsStore
// ============================================================

type stubSettings struct {
	m   map[string]string
	err error
}

func (s stubSettings) GetAll(_ context.Context) (map[string]string, error) {
	return s.m, s.err
}

func (s stubSettings) Upsert(_ context.Context, _, _ string) error { return nil }

func (s stubSettings) UpsertMany(_ context.Context, _ map[string]string) error { return nil }

// 编译期断言：stubSettings 实现 SettingsStore
var _ domainsettings.SettingsStore = (*stubSettings)(nil)

// ============================================================
// GetContributions
// ============================================================

func TestGetContributions_Success(t *testing.T) {
	want := &domaingithub.ContributionData{
		Username:           "octocat",
		TotalContributions: 42,
		Contributions: []domaingithub.Contribution{
			{Date: "2026-08-01", Count: 5},
		},
	}
	prov := &stubProvider{contribs: want}
	svc := appgithub.NewService(prov, stubSettings{m: map[string]string{
		"github_username": "octocat",
		"github_token":    "tk_123",
	}})

	got, err := svc.GetContributions(context.Background())
	require.NoError(t, err)
	require.Equal(t, want, got)

	// 验证 username/token 从 settings 透传给 provider
	assert.True(t, prov.called, "provider should be invoked")
	assert.Equal(t, "octocat", prov.gotUser)
	assert.Equal(t, "tk_123", prov.gotToken)
}

func TestGetContributions_EmptyUsername_ShortCircuit(t *testing.T) {
	prov := &stubProvider{}
	svc := appgithub.NewService(prov, stubSettings{m: map[string]string{}}) // username 为空

	got, err := svc.GetContributions(context.Background())
	require.NoError(t, err)
	// 短路返回空结构，不调 provider
	assert.Equal(t, &domaingithub.ContributionData{}, got)
	assert.False(t, prov.called, "provider should NOT be called when username empty")
}

func TestGetContributions_SettingsError_Propagates(t *testing.T) {
	errSettings := errors.New("db down")
	svc := appgithub.NewService(&stubProvider{}, stubSettings{err: errSettings})

	got, err := svc.GetContributions(context.Background())
	require.ErrorIs(t, err, errSettings)
	assert.Nil(t, got)
}

// ============================================================
// GetRepos
// ============================================================

func TestGetRepos_Success(t *testing.T) {
	want := []domaingithub.RepoData{
		{Name: "violet", Description: "blog", URL: "https://github.com/x/violet",
			Language: "Go", Stars: 10, Forks: 2, Pinned: true},
		{Name: "iris", Description: "tui", URL: "https://github.com/x/iris",
			Language: "Go", Stars: 3, Forks: 0, Pinned: false},
	}
	prov := &stubProvider{repos: want}
	svc := appgithub.NewService(prov, stubSettings{m: map[string]string{
		"github_username": "octocat",
		"github_token":    "tk_456",
	}})

	got, err := svc.GetRepos(context.Background())
	require.NoError(t, err)
	assert.Equal(t, want, got)
	assert.Equal(t, "octocat", prov.gotUser)
	assert.Equal(t, "tk_456", prov.gotToken)
}

func TestGetRepos_EmptyUsername_ReturnsEmptySlice(t *testing.T) {
	prov := &stubProvider{}
	svc := appgithub.NewService(prov, stubSettings{m: map[string]string{}})

	got, err := svc.GetRepos(context.Background())
	require.NoError(t, err)
	assert.Equal(t, []domaingithub.RepoData{}, got)
	assert.False(t, prov.called)
}
