package settings

import (
	"context"
	"encoding/json"
	"maps"
	"testing"

	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type memorySettings struct {
	values        map[string]string
	versions      map[domainsettings.Group]int64
	failLoad      error
	corruptCommit bool
}

func (m *memorySettings) LoadValues(context.Context) (map[string]string, error) {
	return maps.Clone(m.values), m.failLoad
}
func (m *memorySettings) ReadGroup(_ context.Context, group domainsettings.Group) (domainsettings.GroupRecord, error) {
	values := make(map[string]string)
	for _, key := range group.Keys() {
		if value, ok := m.values[key]; ok {
			values[key] = value
		}
	}
	return domainsettings.GroupRecord{Version: m.versions[group], Values: values}, m.failLoad
}
func (m *memorySettings) ChangeGroup(ctx context.Context, group domainsettings.Group, expected int64, change func(map[string]string) (map[string]string, error)) (domainsettings.GroupRecord, error) {
	if m.versions[group] != expected {
		return domainsettings.GroupRecord{}, domainsettings.ErrVersionConflict
	}
	previous, err := m.ReadGroup(ctx, group)
	if err != nil {
		return previous, err
	}
	values, err := change(previous.Values)
	if err != nil {
		return previous, err
	}
	for _, key := range group.Keys() {
		delete(m.values, key)
	}
	maps.Copy(m.values, values)
	m.versions[group]++
	if m.corruptCommit {
		values["posts_per_page"] = "invalid"
	}
	return domainsettings.GroupRecord{Version: m.versions[group], Values: values}, nil
}

func testDefaults() domainsettings.SiteSettings {
	return domainsettings.SiteSettings{SiteName: "Deployment", SiteURL: "https://deployment.example", PostsPerPage: 10,
		HomeFootprintEnabled: true, HomeFootprintAggregationDays: 7, GoogleLoginEnabled: true, GithubLoginEnabled: true,
		CustomEmojiMaxPerUser: 125, CodeRunnerEnabled: true, CodeRunnerMaxCPUCores: 2,
		CodeRunnerMaxMemoryMB: 1024, CodeRunnerMaxTimeoutSecs: 30, CodeRunnerMaxOutputBytes: 1048576, CodeRunnerMaxSourceBytes: 65536}
}
func newSvc() (*Service, *memorySettings) {
	store := &memorySettings{values: make(map[string]string), versions: make(map[domainsettings.Group]int64)}
	return NewService(store, infraeventbus.NewInMemory(), testDefaults()), store
}
func patch(raw string) map[string]json.RawMessage {
	var values map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		panic(err)
	}
	return values
}

func TestUpdateGroupPreservesOmissionsAndSeparatesSavedVersion(t *testing.T) {
	svc, store := newSvc()
	store.values["github_username"] = "contributions-owner"
	store.values["github_token"] = "private-token"
	ctx := context.Background()
	got, err := svc.UpdateGroup(ctx, domainsettings.General, 0, patch(`{"site_name":"New","footer_github_url":"https://user:password@GitHub.com//VOD-Studio/violet/?q=private#readme","comments_enabled":false,"custom_emoji_max_per_user":0}`))
	require.NoError(t, err)
	assert.Equal(t, int64(1), got.Meta.SavedVersion)
	assert.Equal(t, got.Meta.SavedVersion, got.Meta.AppliedVersion)
	public, err := svc.GetPublic(ctx)
	require.NoError(t, err)
	assert.Equal(t, "https://github.com/VOD-Studio/violet", public["footer_github_url"])
	assert.Equal(t, "contributions-owner", public["github_username"])
	assert.Equal(t, false, public["comments_enabled"])
	assert.NotContains(t, public, "github_token")
	settings, err := svc.GetAll(ctx)
	require.NoError(t, err)
	assert.Zero(t, settings.CustomEmojiMaxPerUser)
	assert.Equal(t, "private-token", settings.GitHubToken)
	_, err = svc.UpdateGroup(ctx, domainsettings.General, 0, patch(`{"site_name":"Stale"}`))
	require.ErrorIs(t, err, domainsettings.ErrVersionConflict)
	settings, err = svc.GetAll(ctx)
	require.NoError(t, err)
	assert.Equal(t, "New", settings.SiteName)
}

func TestInvalidGroupUpdateIsAtomic(t *testing.T) {
	for _, raw := range []string{
		`{"site_name":"Should not save","posts_per_page":0}`,
		`{"site_name":"Should not save","home_footprint_aggregation_days":32}`,
		`{"site_name":"Should not save","footer_github_url":"javascript:alert(1)"}`,
		`{"site_name":"Should not save","github_token":"cross-group"}`,
		`{"site_name":"Should not save","footer_text":null}`,
		`{"site_name":"Should not save","comments_enabled":"false"}`,
	} {
		t.Run(raw, func(t *testing.T) {
			svc, _ := newSvc()
			_, err := svc.UpdateGroup(context.Background(), domainsettings.General, 0, patch(raw))
			require.Error(t, err)
			got, err := svc.GetGroup(context.Background(), domainsettings.General)
			require.NoError(t, err)
			assert.Equal(t, "Deployment", got.Values.(GeneralView).SiteName)
			assert.Zero(t, got.Meta.SavedVersion)
		})
	}
}

func TestAboutStringCannotResetSavedObject(t *testing.T) {
	svc, _ := newSvc()
	ctx := context.Background()
	saved, err := svc.UpdateGroup(ctx, domainsettings.About, 0, patch(`{"about_config":{"sections":[{"id":"bio","enabled":true}]}}`))
	require.NoError(t, err)
	_, err = svc.UpdateGroup(ctx, domainsettings.About, saved.Meta.SavedVersion, patch(`{"about_config":"null"}`))
	require.Error(t, err)
	current, err := svc.GetGroup(ctx, domainsettings.About)
	require.NoError(t, err)
	assert.Equal(t, saved, current)
}

func TestSecretsAreWriteOnlyAndResetRestoresDeploymentValues(t *testing.T) {
	svc, _ := newSvc()
	ctx := context.Background()
	first, err := svc.UpdateGroup(ctx, domainsettings.Github, 0, patch(`{"github_token":"private-token","github_username":"owner"}`))
	require.NoError(t, err)
	encoded, err := json.Marshal(first)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "private-token")
	assert.True(t, first.Values.(GithubView).GitHubTokenSet)
	second, err := svc.UpdateGroup(ctx, domainsettings.Github, 1, patch(`{"releases_repo":"violet"}`))
	require.NoError(t, err)
	assert.True(t, second.Values.(GithubView).GitHubTokenSet)
	third, err := svc.UpdateGroup(ctx, domainsettings.Github, 2, patch(`{"github_token":""}`))
	require.NoError(t, err)
	assert.False(t, third.Values.(GithubView).GitHubTokenSet)
	_, err = svc.UpdateGroup(ctx, domainsettings.General, 0, patch(`{"custom_emoji_max_per_user":0}`))
	require.NoError(t, err)
	reset, err := svc.ResetGroup(ctx, domainsettings.General, 1)
	require.NoError(t, err)
	assert.Equal(t, 125, reset.Values.(GeneralView).CustomEmojiMaxPerUser)
	assert.Equal(t, "deployment_default", reset.Meta.Sources["custom_emoji_max_per_user"])
	github, err := svc.GetGroup(ctx, domainsettings.Github)
	require.NoError(t, err)
	assert.Equal(t, "owner", github.Values.(GithubView).GitHubUsername)
	assert.Equal(t, int64(3), github.Meta.SavedVersion)
}

func TestInitializationReloadAndSnapshotsCannotMutateEffectiveValues(t *testing.T) {
	svc, store := newSvc()
	store.values["about_config"] = `{"sections":[]}`
	ctx := context.Background()
	require.NoError(t, svc.Initialize(ctx))
	got, err := svc.GetAll(ctx)
	require.NoError(t, err)
	got.AboutConfig[0] = '['
	raw, err := svc.RuntimeReader().GetAll(ctx)
	require.NoError(t, err)
	raw["site_name"] = "mutated"
	unchanged, err := svc.GetAll(ctx)
	require.NoError(t, err)
	assert.Equal(t, "Deployment", unchanged.SiteName)
	assert.JSONEq(t, `{"sections":[]}`, string(unchanged.AboutConfig))
	store.values["site_name"] = "Reloaded"
	require.NoError(t, svc.Initialize(ctx))
	loaded, err := svc.GetAll(ctx)
	require.NoError(t, err)
	assert.Equal(t, "Reloaded", loaded.SiteName)
	store.failLoad = shared.Internal("database offline", nil)
	require.Error(t, svc.Initialize(ctx))
	retained, err := svc.GetAll(ctx)
	require.NoError(t, err)
	assert.Equal(t, "Reloaded", retained.SiteName)
}

func TestApplyFailureRetainsOldEffectiveVersion(t *testing.T) {
	svc, store := newSvc()
	require.NoError(t, svc.Initialize(context.Background()))
	store.corruptCommit = true
	saved, err := svc.UpdateGroup(context.Background(), domainsettings.General, 0, patch(`{"site_name":"Saved"}`))
	require.NoError(t, err)
	assert.Equal(t, "failed", saved.Meta.Status)
	assert.Equal(t, int64(1), saved.Meta.SavedVersion)
	assert.Zero(t, saved.Meta.AppliedVersion)
	effective, err := svc.GetAll(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "Deployment", effective.SiteName)
}
