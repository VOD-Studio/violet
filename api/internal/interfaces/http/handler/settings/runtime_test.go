package settings

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	appsettings "blog-api/internal/application/settings"
	domainsettings "blog-api/internal/domain/settings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type runtimeHTTPStore struct {
	records   map[domainsettings.RuntimeGroup]domainsettings.RuntimeRecord
	effective map[domainsettings.RuntimeGroup]domainsettings.RuntimeEffective
}

func (s *runtimeHTTPStore) Load(_ context.Context, group domainsettings.RuntimeGroup) (domainsettings.RuntimeRecord, error) {
	record, ok := s.records[group]
	if !ok {
		record.Overrides = json.RawMessage(`{}`)
	}
	return record, nil
}
func (s *runtimeHTTPStore) CompareAndSwap(_ context.Context, group domainsettings.RuntimeGroup, version uint64, overrides json.RawMessage) (domainsettings.RuntimeRecord, error) {
	if s.records[group].Version != version {
		return domainsettings.RuntimeRecord{}, domainsettings.ErrRuntimeConflict
	}
	record := domainsettings.RuntimeRecord{Version: version + 1, Overrides: overrides}
	s.records[group] = record
	return record, nil
}
func (s *runtimeHTTPStore) LoadLegacyRunner(context.Context) (map[string]string, error) {
	return map[string]string{}, nil
}
func (s *runtimeHTTPStore) LoadEffective(_ context.Context, group domainsettings.RuntimeGroup) (*domainsettings.RuntimeEffective, error) {
	value, ok := s.effective[group]
	if !ok {
		return nil, nil
	}
	return &value, nil
}
func (s *runtimeHTTPStore) SaveEffective(_ context.Context, group domainsettings.RuntimeGroup, value domainsettings.RuntimeEffective) error {
	s.effective[group] = value
	return nil
}
func newHTTPRuntimePolicies() *appsettings.RuntimePolicies {
	defaults := domainsettings.CodeRunnerPolicy{Enabled: true, MaxCPUCores: 2, MaxMemoryMB: 256, MaxTimeoutSecs: 30, MaxOutputBytes: 1 << 20, MaxSourceBytes: 64 << 10, MaxConcurrent: 2, QueueTimeoutSecs: 30, TaskTTLSecs: 3600}
	policies := appsettings.NewRuntimePolicies(&runtimeHTTPStore{records: map[domainsettings.RuntimeGroup]domainsettings.RuntimeRecord{}, effective: map[domainsettings.RuntimeGroup]domainsettings.RuntimeEffective{}}, defaults, nil)
	if err := policies.Initialize(context.Background()); err != nil {
		panic(err)
	}
	return policies
}

func TestRuntimeHTTPStrictWriteAndConflict(t *testing.T) {
	policies := newHTTPRuntimePolicies()
	handler := NewRuntimeHandler(policies)
	for _, body := range []string{`{"values":{"max_concurrent_files":4}}`, `{"expected_version":0,"values":null}`, `{"expected_version":0,"values":{"unknown":2}}`, `{"expected_version":0,"reset":true,"values":{}}`, `{"expected_version":0,"extra":true,"values":{}}`, `{"expected_version":0,"values":{}} {}`} {
		recorder := httptest.NewRecorder()
		handler.UpdateUploadQueue(recorder, newJSONRequest(http.MethodPut, "/admin/settings/upload-queue", body))
		assert.Equal(t, http.StatusBadRequest, recorder.Code, body)
	}
	recorder := httptest.NewRecorder()
	handler.UpdateUploadQueue(recorder, newJSONRequest(http.MethodPut, "/admin/settings/upload-queue", `{"expected_version":0,"values":{"max_concurrent_files":0}}`))
	require.Equal(t, http.StatusBadRequest, recorder.Code)
	var invalid struct {
		Details map[string][]string `json:"details"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &invalid))
	assert.NotEmpty(t, invalid.Details["max_concurrent_files"])
	recorder = httptest.NewRecorder()
	handler.UpdateUploadQueue(recorder, newJSONRequest(http.MethodPut, "/admin/settings/upload-queue", `{"expected_version":0,"values":{"max_concurrent_files":6}}`))
	require.Equal(t, http.StatusOK, recorder.Code)
	recorder = httptest.NewRecorder()
	handler.UpdateUploadQueue(recorder, newJSONRequest(http.MethodPut, "/admin/settings/upload-queue", `{"expected_version":0,"reset":true}`))
	assert.Equal(t, http.StatusConflict, recorder.Code)
	recorder = httptest.NewRecorder()
	handler.GetUploadQueuePolicy(recorder, httptest.NewRequest(http.MethodGet, "/uploads/policy", nil))
	require.Equal(t, http.StatusOK, recorder.Code)
	var actual struct {
		Data struct {
			Version            uint64 `json:"version"`
			MaxConcurrentFiles int    `json:"max_concurrent_files"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &actual))
	assert.Equal(t, uint64(1), actual.Data.Version)
	assert.Equal(t, 6, actual.Data.MaxConcurrentFiles)
}
