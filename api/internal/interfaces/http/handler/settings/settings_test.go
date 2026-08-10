// Package settings 提供 settings 模块的 HTTP handler 测试。
//
// settings.Handler 持有具体 *appsettings.Service（非接口），无法直接注入 stub service。
// 故构造真实 appsettings.Service，替换其依赖的 domainsettings.SettingsStore 为手写 stub。
package settings

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appsettings "blog-api/internal/application/settings"
	domainsettings "blog-api/internal/domain/settings"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
)

// stubSettingsStore 手写 stub，实现 domainsettings.SettingsStore。
type stubSettingsStore struct {
	all map[string]string
	err error
}

func (s *stubSettingsStore) GetAll(context.Context) (map[string]string, error) {
	return s.all, s.err
}

func (s *stubSettingsStore) Upsert(context.Context, string, string) error {
	return nil
}

func (s *stubSettingsStore) UpsertMany(context.Context, map[string]string) error {
	return nil
}

var _ domainsettings.SettingsStore = (*stubSettingsStore)(nil)

func newSettingsHandler(store *stubSettingsStore) *Handler {
	return NewHandler(appsettings.NewService(store, infraeventbus.NewInMemory()))
}

func newJSONRequest(method, target, body string) *http.Request {
	req := httptest.NewRequest(method, target, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

// =====================================================================
// GetPublicSettings（公开）—— 只暴露安全字段
// =====================================================================

func TestGetPublicSettings_OK_ReturnsPublicFields(t *testing.T) {
	store := &stubSettingsStore{all: map[string]string{
		"site_name":        "Violet Blog",
		"site_url":         "https://violet.dev",
	}}
	h := newSettingsHandler(store)

	rr := httptest.NewRecorder()
	h.GetPublicSettings(rr, httptest.NewRequest(http.MethodGet, "/settings", nil))

	require.Equal(t, http.StatusOK, rr.Code)

	var got struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Equal(t, "Violet Blog", got.Data["site_name"])
	assert.Equal(t, "https://violet.dev", got.Data["site_url"])
}

// TestGetPublicSettings_OmitsSensitiveFields 公开配置不得泄露敏感字段（如 github_token / llm_api_key）。
func TestGetPublicSettings_OmitsSensitiveFields(t *testing.T) {
	store := &stubSettingsStore{all: map[string]string{
		"site_name":    "Violet",
		"github_token": "secret-should-not-leak",
		"llm_api_key":  "sk-should-not-leak",
	}}
	h := newSettingsHandler(store)

	rr := httptest.NewRecorder()
	h.GetPublicSettings(rr, httptest.NewRequest(http.MethodGet, "/settings", nil))

	require.Equal(t, http.StatusOK, rr.Code)

	raw := rr.Body.String()
	assert.NotContains(t, raw, "secret-should-not-leak", "公开配置不得泄露 github_token")
	assert.NotContains(t, raw, "sk-should-not-leak", "公开配置不得泄露 llm_api_key")
}

// =====================================================================
// UpdateGeneral —— 参数校验（空 body → 400，不触达 service）
// =====================================================================

func TestUpdateGeneral_EmptyBody_Returns400(t *testing.T) {
	h := newSettingsHandler(&stubSettingsStore{})

	rr := httptest.NewRecorder()
	h.UpdateGeneral(rr, newJSONRequest(http.MethodPut, "/admin/settings/general", ""))

	assert.Equal(t, http.StatusBadRequest, rr.Code, "空 body 应 400")
}

func TestUpdateGeneral_InvalidJSON_Returns400(t *testing.T) {
	h := newSettingsHandler(&stubSettingsStore{})

	rr := httptest.NewRecorder()
	h.UpdateGeneral(rr, newJSONRequest(http.MethodPut, "/admin/settings/general", "<<<"))

	assert.Equal(t, http.StatusBadRequest, rr.Code, "非法 JSON 应 400")
}
