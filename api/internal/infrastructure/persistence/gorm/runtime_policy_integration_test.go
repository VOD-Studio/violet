package gorm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	appsettings "blog-api/internal/application/settings"
	domainsettings "blog-api/internal/domain/settings"
	settingshttp "blog-api/internal/interfaces/http/handler/settings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func persistedRunnerDefaults() domainsettings.CodeRunnerPolicy {
	return domainsettings.CodeRunnerPolicy{Enabled: true, MaxCPUCores: 2, MaxMemoryMB: 256, MaxTimeoutSecs: 30, MaxOutputBytes: 1 << 20, MaxSourceBytes: 64 << 10, MaxConcurrent: 2, QueueTimeoutSecs: 30, TaskTTLSecs: 3600}
}

func TestRuntimePolicyIntegrationConcurrentCAS(t *testing.T) {
	store := NewRuntimePolicyStore(setupIntegrationDB(t))
	ctx := context.Background()
	first, err := store.CompareAndSwap(ctx, domainsettings.UploadQueueGroup, 0, json.RawMessage(`{"max_concurrent_files":3}`))
	require.NoError(t, err)
	var successes atomic.Int32
	var conflicts atomic.Int32
	var wg sync.WaitGroup
	for range 16 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := store.CompareAndSwap(ctx, domainsettings.UploadQueueGroup, first.Version, json.RawMessage(`{"max_concurrent_files":6}`))
			if err == nil {
				successes.Add(1)
			} else if errors.Is(err, domainsettings.ErrRuntimeConflict) {
				conflicts.Add(1)
			} else {
				t.Errorf("持久化失败：%v", err)
			}
		}()
	}
	wg.Wait()
	assert.Equal(t, int32(1), successes.Load())
	assert.Equal(t, int32(15), conflicts.Load())
	record, err := store.Load(ctx, domainsettings.UploadQueueGroup)
	require.NoError(t, err)
	assert.Equal(t, uint64(2), record.Version)
	assert.JSONEq(t, `{"max_concurrent_files":6}`, string(record.Overrides))
}

func TestRuntimePolicyIntegrationHTTPAtomicResetAndRestart(t *testing.T) {
	db := setupIntegrationDB(t)
	store := NewRuntimePolicyStore(db)
	ctx := context.Background()
	policies := appsettings.NewRuntimePolicies(store, persistedRunnerDefaults(), nil)
	require.NoError(t, policies.Initialize(ctx))
	handler := settingshttp.NewRuntimeHandler(policies)
	put := func(body string) *httptest.ResponseRecorder {
		t.Helper()
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPut, "/admin/settings/image", bytes.NewBufferString(body))
		handler.UpdateImage(recorder, request)
		return recorder
	}
	assert.Equal(t, http.StatusBadRequest, put(`{"expected_version":0,"values":{"thumbnail_width":450,"webp_quality":0}}`).Code)
	record, err := store.Load(ctx, domainsettings.ImageGroup)
	require.NoError(t, err)
	assert.Zero(t, record.Version)
	saved := put(`{"expected_version":0,"values":{"thumbnail_width":450}}`)
	require.Equal(t, http.StatusOK, saved.Code, saved.Body.String())
	assert.Equal(t, http.StatusConflict, put(`{"expected_version":0,"values":{"thumbnail_width":500}}`).Code)
	restarted := appsettings.NewRuntimePolicies(NewRuntimePolicyStore(db), persistedRunnerDefaults(), nil)
	require.NoError(t, restarted.Initialize(ctx))
	value, version := restarted.Image()
	assert.Equal(t, 450, value.ThumbnailWidth)
	assert.Equal(t, uint64(1), version)
	reset := put(`{"expected_version":1,"reset":true}`)
	require.Equal(t, http.StatusOK, reset.Code, reset.Body.String())
	record, err = store.Load(ctx, domainsettings.ImageGroup)
	require.NoError(t, err)
	assert.Equal(t, uint64(2), record.Version)
	assert.JSONEq(t, `{}`, string(record.Overrides))
	value, version = policies.Image()
	assert.Equal(t, 300, value.ThumbnailWidth)
	assert.Equal(t, uint64(2), version)
}

func TestRuntimePolicyIntegrationFailedApplyAndLegacyPreservation(t *testing.T) {
	db := setupIntegrationDB(t)
	ctx := context.Background()
	legacy := NewSettingsStore(db)
	require.NoError(t, legacy.UpsertMany(ctx, map[string]string{"code_runner_enabled": "false", "code_runner_max_cpu_cores": "1.25", "code_runner_max_memory_mb": "0", "code_runner_languages": "go,rust"}))
	store := NewRuntimePolicyStore(db)
	policies := appsettings.NewRuntimePolicies(store, persistedRunnerDefaults(), nil)
	require.NoError(t, policies.Initialize(ctx))
	runner, _ := policies.CodeRunner()
	assert.False(t, runner.Enabled)
	assert.Equal(t, 1.25, runner.MaxCPUCores)
	assert.Equal(t, uint64(256), runner.MaxMemoryMB)
	assert.Equal(t, []string{"go", "rust"}, runner.Languages)
	policies.SetImageValidator(func(value domainsettings.ImagePolicy) error {
		if value.WebPMode == "lossy" {
			return errors.New("编码依赖不可用")
		}
		return nil
	})
	version := uint64(0)
	view, err := policies.UpdateImage(ctx, appsettings.RuntimeUpdate{ExpectedVersion: &version, Values: json.RawMessage(`{"webp_mode":"lossy"}`)})
	require.NoError(t, err)
	assert.Equal(t, "failed", view.Runtime.Status)
	assert.Equal(t, "lossless", view.Runtime.Values.WebPMode)
	assert.Equal(t, uint64(0), view.Runtime.Version)
	record, err := store.Load(ctx, domainsettings.ImageGroup)
	require.NoError(t, err)
	assert.Equal(t, uint64(1), record.Version)
	assert.JSONEq(t, `{"webp_mode":"lossy"}`, string(record.Overrides))
	failedRestart := appsettings.NewRuntimePolicies(store, persistedRunnerDefaults(), nil)
	failedRestart.SetImageValidator(func(value domainsettings.ImagePolicy) error {
		if value.WebPMode == "lossy" {
			return errors.New("编码依赖不可用")
		}
		return nil
	})
	require.NoError(t, failedRestart.Initialize(ctx))
	fallback, fallbackVersion := failedRestart.Image()
	assert.Equal(t, "lossless", fallback.WebPMode)
	assert.Equal(t, uint64(0), fallbackVersion)
	failedView, err := failedRestart.GetImage(ctx)
	require.NoError(t, err)
	assert.Equal(t, "failed", failedView.Runtime.Status)
	assert.Equal(t, uint64(1), failedView.Version)
	restarted := appsettings.NewRuntimePolicies(store, persistedRunnerDefaults(), nil)
	require.NoError(t, restarted.Initialize(ctx))
	image, imageVersion := restarted.Image()
	assert.Equal(t, "lossy", image.WebPMode)
	assert.Equal(t, uint64(1), imageVersion)
}
