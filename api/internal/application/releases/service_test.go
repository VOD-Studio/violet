package releases

import (
	"context"
	"testing"

	domainreleases "blog-api/internal/domain/releases"
	domainsettings "blog-api/internal/domain/settings"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================
// parseBody 单元测试
// ============================================================

func TestParseBody_GitHubNativeFormat(t *testing.T) {
	body := `## What's Changed
* About 页重设计 by @xunrua in #7

### 新功能
* About 页重设计 + 更新日志 by @xunrua in #7

### Bug 修复
* 修复评论分页越界 by @DefectingCat in #11

**Full Changelog**: https://github.com/VOD-Studio/violet/compare/v2.0.4...v2.1.0`

	cats, breaking := parseBody(body)

	if breaking {
		t.Error("不应标记 breaking")
	}
	if len(cats) != 2 {
		t.Fatalf("期望 2 个分类，得到 %d: %+v", len(cats), cats)
	}
	assertCategory(t, cats[0], "新功能", []string{"About 页重设计 + 更新日志 by @xunrua in #7"})
	assertCategory(t, cats[1], "Bug 修复", []string{"修复评论分页越界 by @DefectingCat in #11"})
}

func TestParseBody_BreakingDetection(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		breaking bool
	}{
		{
			name:     "label 含破坏性",
			body:     "### 破坏性变更\n* 移除旧 API",
			breaking: true,
		},
		{
			name:     "条目含 Breaking",
			body:     "### Changed\n* **Breaking:** bump yaml-parser from 4.x to 5.x",
			breaking: true,
		},
		{
			name:     "label 含不兼容",
			body:     "### 不兼容变更\n* 重构数据库 schema",
			breaking: true,
		},
		{
			name:     "无 breaking",
			body:     "### 新功能\n* 新增搜索功能",
			breaking: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, breaking := parseBody(tt.body)
			if breaking != tt.breaking {
				t.Errorf("breaking = %v, want %v", breaking, tt.breaking)
			}
		})
	}
}

func TestParseBody_SkipsNonCategorySections(t *testing.T) {
	body := `## What's Changed
* 总览条目 by @user in #1

## New Contributors
* @newuser made their first contribution in #2

### 新功能
* 实际功能条目

**Full Changelog**: https://example.com/compare/v1...v2`

	cats, _ := parseBody(body)

	// What's Changed 和 New Contributors 下的条目不应被归入分类
	if len(cats) != 1 {
		t.Fatalf("期望 1 个分类（跳过 ## 级），得到 %d", len(cats))
	}
	assertCategory(t, cats[0], "新功能", []string{"实际功能条目"})
}

func TestParseBody_EmptyBody(t *testing.T) {
	cats, breaking := parseBody("")
	if cats != nil {
		t.Errorf("空 body 应返回 nil categories，得到 %+v", cats)
	}
	if breaking {
		t.Error("空 body 不应标记 breaking")
	}
}

func TestParseBody_EmptyCategoryHasEmptyItems(t *testing.T) {
	// 有标题但无条目的分类，Items 应为 []string{} 而非 nil
	body := "### 新功能\n"
	cats, _ := parseBody(body)
	if len(cats) != 1 {
		t.Fatalf("期望 1 个分类，得到 %d", len(cats))
	}
	if cats[0].Items == nil {
		t.Error("无条目分类的 Items 应为 []string{} 非 nil")
	}
	if len(cats[0].Items) != 0 {
		t.Errorf("期望 0 个条目，得到 %d", len(cats[0].Items))
	}
}

func assertCategory(t *testing.T, cat domainreleases.Category, label string, items []string) {
	t.Helper()
	if cat.Label != label {
		t.Errorf("label = %q, want %q", cat.Label, label)
	}
	if len(cat.Items) != len(items) {
		t.Errorf("items 数量 = %d, want %d (%+v)", len(cat.Items), len(items), cat.Items)
		return
	}
	for i, want := range items {
		if cat.Items[i] != want {
			t.Errorf("items[%d] = %q, want %q", i, cat.Items[i], want)
		}
	}
}

// ============================================================
// Service.Get 单元测试
// ============================================================

type stubProvider struct {
	releases []domainreleases.Release
	err      error

	called   bool
	gotOwner string
	gotRepo  string
	gotToken string
}

func (s *stubProvider) ListReleases(_ context.Context, owner, repo, token string) ([]domainreleases.Release, error) {
	s.called = true
	s.gotOwner = owner
	s.gotRepo = repo
	s.gotToken = token
	return s.releases, s.err
}

var _ domainreleases.Provider = (*stubProvider)(nil)

type stubSettings struct {
	m   map[string]string
	err error
}

func (s stubSettings) GetAll(_ context.Context) (map[string]string, error) {
	return s.m, s.err
}

func (s stubSettings) Upsert(_ context.Context, _, _ string) error { return nil }

func (s stubSettings) UpsertMany(_ context.Context, _ map[string]string) error { return nil }

var _ domainsettings.SettingsStore = (*stubSettings)(nil)

func newSvc(prov *stubProvider, m map[string]string) *Service {
	return NewService(prov, stubSettings{m: m}, nil)
}

func TestGet_Success(t *testing.T) {
	body := "### ✨ 新增\n\n* **media:** 补批量删除路由\n\n### 🐛 修复\n\n* 修复 405 错误\n"
	prov := &stubProvider{releases: []domainreleases.Release{
		{TagName: "v2.0.4", Name: "v2.0.4", PublishedAt: "2026-08-01", Body: body, HTMLURL: "https://github.com/o/r/releases/v2.0.4"},
		{TagName: "v2.0.3", Name: "v2.0.3", Body: "", HTMLURL: "https://github.com/o/r/releases/v2.0.3"},
	}}
	svc := newSvc(prov, map[string]string{
		"github_username": "octocat",
		"github_token":    "tk",
		"releases_repo":   "violet",
	})

	got, err := svc.Get(context.Background())
	require.NoError(t, err)
	require.NotNil(t, got)

	assert.Equal(t, "v2.0.4", got.CurrentVersion)
	require.Len(t, got.Releases, 2)

	assert.Len(t, got.Releases[0].Categories, 2)
	assert.False(t, got.Releases[0].Breaking)

	assert.Nil(t, got.Releases[1].Categories)
	assert.False(t, got.Releases[1].Breaking)

	assert.True(t, prov.called)
	assert.Equal(t, "octocat", prov.gotOwner)
	assert.Equal(t, "violet", prov.gotRepo)
	assert.Equal(t, "tk", prov.gotToken)
}

func TestGet_OwnerRepoFormat_SplitsSlash(t *testing.T) {
	prov := &stubProvider{releases: []domainreleases.Release{
		{TagName: "v1.0.0", Body: ""},
	}}
	svc := newSvc(prov, map[string]string{
		"github_username": "personal-user",
		"releases_repo":   "VOD-Studio/violet",
	})

	_, err := svc.Get(context.Background())
	require.NoError(t, err)

	assert.Equal(t, "VOD-Studio", prov.gotOwner)
	assert.Equal(t, "violet", prov.gotRepo)
}

func TestGet_EmptyRepo_ReturnsEmpty(t *testing.T) {
	prov := &stubProvider{}
	svc := newSvc(prov, map[string]string{
		"github_username": "octocat",
		"github_token":    "tk",
	})

	got, err := svc.Get(context.Background())
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Empty(t, got.Releases)
	assert.Empty(t, got.CurrentVersion)
	assert.False(t, prov.called)
}

func TestGet_ProviderError_NilRedis_FallsBackToEmpty(t *testing.T) {
	prov := &stubProvider{err: assert.AnError}
	svc := newSvc(prov, map[string]string{
		"github_username": "octocat",
		"releases_repo":   "violet",
	})

	got, err := svc.Get(context.Background())
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Empty(t, got.Releases)
}

func TestGet_SettingsError_Propagates(t *testing.T) {
	errSettings := assert.AnError
	svc := NewService(&stubProvider{}, stubSettings{err: errSettings}, nil)

	got, err := svc.Get(context.Background())
	require.ErrorIs(t, err, errSettings)
	assert.Nil(t, got)
}
