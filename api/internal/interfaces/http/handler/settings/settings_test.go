package settings

import (
	"bytes"
	"context"
	"encoding/json"
	"maps"
	"net/http"
	"net/http/httptest"
	"testing"

	authcmd "blog-api/internal/application/auth/command"
	appsettings "blog-api/internal/application/settings"
	domainsettings "blog-api/internal/domain/settings"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubSettingsStore struct {
	all      map[string]string
	versions map[domainsettings.Group]int64
}

func (s *stubSettingsStore) LoadValues(context.Context) (map[string]string, error) {
	return maps.Clone(s.all), nil
}
func (s *stubSettingsStore) ReadGroup(_ context.Context, group domainsettings.Group) (domainsettings.GroupRecord, error) {
	values := make(map[string]string)
	for _, key := range group.Keys() {
		if value, ok := s.all[key]; ok {
			values[key] = value
		}
	}
	return domainsettings.GroupRecord{Version: s.versions[group], Values: values}, nil
}
func (s *stubSettingsStore) ChangeGroup(ctx context.Context, group domainsettings.Group, expected int64, change func(map[string]string) (map[string]string, error)) (domainsettings.GroupRecord, error) {
	if expected != s.versions[group] {
		return domainsettings.GroupRecord{}, domainsettings.ErrVersionConflict
	}
	current, _ := s.ReadGroup(ctx, group)
	values, err := change(current.Values)
	if err != nil {
		return current, err
	}
	for _, key := range group.Keys() {
		delete(s.all, key)
	}
	maps.Copy(s.all, values)
	s.versions[group]++
	return domainsettings.GroupRecord{Version: s.versions[group], Values: values}, nil
}

func newSettingsHandler(values map[string]string) *Handler {
	if values == nil {
		values = make(map[string]string)
	}
	store := &stubSettingsStore{all: values, versions: make(map[domainsettings.Group]int64)}
	defaults := domainsettings.SiteSettings{SiteName: "Violet", SiteURL: "https://violet.dev", PostsPerPage: 10,
		HomeFootprintEnabled: true, HomeFootprintAggregationDays: 7, GoogleLoginEnabled: true, GithubLoginEnabled: true,
		CustomEmojiMaxPerUser: 100, CodeRunnerEnabled: true, CodeRunnerMaxCPUCores: 2, CodeRunnerMaxMemoryMB: 1024,
		CodeRunnerMaxTimeoutSecs: 30, CodeRunnerMaxSourceBytes: 65536, CodeRunnerMaxOutputBytes: 1048576}
	return NewHandler(appsettings.NewService(store, infraeventbus.NewInMemory(), defaults), authcmd.NewOAuthCredentials("", "", ""), nil)
}
func newJSONRequest(method, target, body string) *http.Request {
	req := httptest.NewRequest(method, target, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestPublicSettingsDoesNotExposeSecrets(t *testing.T) {
	h := newSettingsHandler(map[string]string{"site_name": "Actual blog", "github_token": "private-github-token", "llm_api_key": "private-llm-key", "footer_github_url": "https://github.com/owner/repository"})
	rr := httptest.NewRecorder()
	h.GetPublicSettings(rr, httptest.NewRequest(http.MethodGet, "/settings", nil))
	require.Equal(t, http.StatusOK, rr.Code)
	var result struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &result))
	assert.Equal(t, "Actual blog", result.Data["site_name"])
	assert.Equal(t, "https://github.com/owner/repository", result.Data["footer_github_url"])
	assert.NotContains(t, rr.Body.String(), "private-github-token")
	assert.NotContains(t, rr.Body.String(), "private-llm-key")
}

func TestUpdateRequiresVersionAndStrictObject(t *testing.T) {
	for _, body := range []string{"", "<<<", `{"values":{"site_name":"New"}}`, `{"expected_version":null,"values":{}}`, `{"expected_version":0,"values":null}`, `{"expected_version":0,"values":{},"extra":true}`, `{"expected_version":0,"values":{}} {}`} {
		h := newSettingsHandler(nil)
		rr := httptest.NewRecorder()
		h.UpdateGeneral(rr, newJSONRequest(http.MethodPut, "/admin/settings/general", body))
		assert.Equal(t, http.StatusBadRequest, rr.Code, body)
	}
}

func TestGeneralUpdateVersionConflictAndFieldDetails(t *testing.T) {
	h := newSettingsHandler(nil)
	rr := httptest.NewRecorder()
	h.UpdateGeneral(rr, newJSONRequest(http.MethodPut, "/admin/settings/general", `{"expected_version":0,"values":{"site_name":"Updated"}}`))
	require.Equal(t, http.StatusOK, rr.Code)
	var saved struct {
		Data struct {
			Values appsettings.GeneralView `json:"values"`
			Meta   appsettings.GroupMeta   `json:"meta"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &saved))
	assert.Equal(t, "Updated", saved.Data.Values.SiteName)
	assert.Equal(t, int64(1), saved.Data.Meta.AppliedVersion)
	stale := httptest.NewRecorder()
	h.UpdateGeneral(stale, newJSONRequest(http.MethodPut, "/admin/settings/general", `{"expected_version":0,"values":{"site_name":"Stale"}}`))
	assert.Equal(t, http.StatusConflict, stale.Code)
	invalid := httptest.NewRecorder()
	h.UpdateGeneral(invalid, newJSONRequest(http.MethodPut, "/admin/settings/general", `{"expected_version":1,"values":{"posts_per_page":0}}`))
	require.Equal(t, http.StatusBadRequest, invalid.Code)
	var failure struct {
		Details map[string][]string `json:"details"`
	}
	require.NoError(t, json.Unmarshal(invalid.Body.Bytes(), &failure))
	assert.Contains(t, failure.Details, "posts_per_page")
}
