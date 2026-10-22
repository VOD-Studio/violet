package settings

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"

	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type memoryRuntimeStore struct {
	mu        sync.Mutex
	records   map[domainsettings.RuntimeGroup]domainsettings.RuntimeRecord
	effective map[domainsettings.RuntimeGroup]domainsettings.RuntimeEffective
	legacy    map[string]string
	err       error
	loads     int
}

func newMemoryRuntimeStore() *memoryRuntimeStore {
	return &memoryRuntimeStore{records: map[domainsettings.RuntimeGroup]domainsettings.RuntimeRecord{}, effective: map[domainsettings.RuntimeGroup]domainsettings.RuntimeEffective{}, legacy: map[string]string{}}
}
func (s *memoryRuntimeStore) Load(_ context.Context, group domainsettings.RuntimeGroup) (domainsettings.RuntimeRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.loads++
	if s.err != nil {
		return domainsettings.RuntimeRecord{}, s.err
	}
	record, ok := s.records[group]
	if !ok {
		record.Overrides = json.RawMessage(`{}`)
	}
	record.Overrides = append(json.RawMessage{}, record.Overrides...)
	return record, nil
}
func (s *memoryRuntimeStore) CompareAndSwap(_ context.Context, group domainsettings.RuntimeGroup, expected uint64, overrides json.RawMessage) (domainsettings.RuntimeRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return domainsettings.RuntimeRecord{}, s.err
	}
	if s.records[group].Version != expected {
		return domainsettings.RuntimeRecord{}, domainsettings.ErrRuntimeConflict
	}
	record := domainsettings.RuntimeRecord{Version: expected + 1, Overrides: append(json.RawMessage{}, overrides...)}
	s.records[group] = record
	return record, nil
}
func (s *memoryRuntimeStore) LoadLegacyRunner(context.Context) (map[string]string, error) {
	return s.legacy, s.err
}
func (s *memoryRuntimeStore) LoadEffective(_ context.Context, group domainsettings.RuntimeGroup) (*domainsettings.RuntimeEffective, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return nil, s.err
	}
	value, ok := s.effective[group]
	if !ok {
		return nil, nil
	}
	value.Values = append(json.RawMessage{}, value.Values...)
	return &value, nil
}
func (s *memoryRuntimeStore) SaveEffective(_ context.Context, group domainsettings.RuntimeGroup, value domainsettings.RuntimeEffective) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return s.err
	}
	if previous, ok := s.effective[group]; !ok || previous.Version <= value.Version {
		value.Values = append(json.RawMessage{}, value.Values...)
		s.effective[group] = value
	}
	return nil
}
func runtimeTestDefaults() domainsettings.CodeRunnerPolicy {
	return domainsettings.CodeRunnerPolicy{Enabled: true, MaxCPUCores: 2, MaxMemoryMB: 256, MaxTimeoutSecs: 30, MaxOutputBytes: 1 << 20, MaxSourceBytes: 64 << 10, MaxConcurrent: 2, QueueTimeoutSecs: 30, TaskTTLSecs: 3600}
}
func runtimeInput(version uint64, values string) RuntimeUpdate {
	return RuntimeUpdate{ExpectedVersion: &version, Values: json.RawMessage(values)}
}
func testRuntimePolicies(t *testing.T, store *memoryRuntimeStore) *RuntimePolicies {
	t.Helper()
	p := NewRuntimePolicies(store, runtimeTestDefaults(), nil)
	require.NoError(t, p.Initialize(context.Background()))
	return p
}

func TestRuntimePoliciesAtomicValidationConflictResetAndRestart(t *testing.T) {
	ctx := context.Background()
	store := newMemoryRuntimeStore()
	p := testRuntimePolicies(t, store)
	initial, err := p.GetUploadQueue(ctx)
	require.NoError(t, err)
	assert.Equal(t, 3, initial.Values.MaxConcurrentFiles)
	_, err = p.UpdateUploadQueue(ctx, runtimeInput(0, `{"max_concurrent_files":0}`))
	require.Error(t, err)
	assert.Empty(t, store.records[domainsettings.UploadQueueGroup].Version)
	saved, err := p.UpdateUploadQueue(ctx, runtimeInput(0, `{"max_concurrent_files":6}`))
	require.NoError(t, err)
	assert.Equal(t, uint64(1), saved.Version)
	assert.Equal(t, "applied", saved.Runtime.Status)
	assert.Equal(t, "override", saved.Sources["max_concurrent_files"])
	_, err = p.UpdateUploadQueue(ctx, runtimeInput(0, `{"max_concurrent_files":2}`))
	assert.True(t, shared.IsDomainError(err, shared.CodeConflict))
	restarted := testRuntimePolicies(t, store)
	value, version := restarted.UploadQueue()
	assert.Equal(t, 6, value.MaxConcurrentFiles)
	assert.Equal(t, uint64(1), version)
	version = saved.Version
	reset, err := p.UpdateUploadQueue(ctx, RuntimeUpdate{ExpectedVersion: &version, Reset: true})
	require.NoError(t, err)
	assert.Equal(t, uint64(2), reset.Version)
	assert.Equal(t, 3, reset.Values.MaxConcurrentFiles)
	assert.Equal(t, "application", reset.Sources["max_concurrent_files"])
	assert.Equal(t, uint64(1), store.records[domainsettings.CodeRunnerGroup].Version)
}

func TestRuntimePoliciesFailedApplyKeepsEffectiveSnapshot(t *testing.T) {
	ctx := context.Background()
	p := testRuntimePolicies(t, newMemoryRuntimeStore())
	old, oldVersion := p.Image()
	p.SetImageValidator(func(value domainsettings.ImagePolicy) error {
		if value.WebPMode == "lossy" {
			return errors.New("编码器不可用")
		}
		return nil
	})
	saved, err := p.UpdateImage(ctx, runtimeInput(0, `{"webp_mode":"lossy"}`))
	require.NoError(t, err)
	assert.Equal(t, uint64(1), saved.Version)
	assert.Equal(t, "lossy", saved.Values.WebPMode)
	assert.Equal(t, "failed", saved.Runtime.Status)
	assert.Equal(t, oldVersion, saved.Runtime.Version)
	assert.Equal(t, old, saved.Runtime.Values)
	assert.Contains(t, saved.Runtime.Error, "编码器不可用")
	version := saved.Version
	reset, err := p.UpdateImage(ctx, RuntimeUpdate{ExpectedVersion: &version, Reset: true})
	require.NoError(t, err)
	assert.Equal(t, "applied", reset.Runtime.Status)
	assert.Equal(t, uint64(2), reset.Runtime.Version)
}

func TestRuntimePoliciesReadFailureIsNotDisabledOrDefault(t *testing.T) {
	ctx := context.Background()
	store := newMemoryRuntimeStore()
	p := testRuntimePolicies(t, store)
	before, version := p.CodeRunner()
	store.err = errors.New("数据库断开")
	view, err := p.GetCodeRunner(ctx)
	require.NoError(t, err)
	assert.Equal(t, "stale", view.Runtime.Status)
	assert.Equal(t, before, view.Runtime.Values)
	assert.Equal(t, version, view.Runtime.Version)
	require.Error(t, p.CodeRunnerError())
	_, err = p.UpdateCodeRunner(ctx, runtimeInput(version, `{"enabled":false}`))
	require.Error(t, err)
	store.err = nil
	view, err = p.GetCodeRunner(ctx)
	require.NoError(t, err)
	assert.Equal(t, "applied", view.Runtime.Status)
	require.NoError(t, p.CodeRunnerError())
}

func TestRuntimePoliciesLegacyValidOverridesAndEmptyLanguages(t *testing.T) {
	store := newMemoryRuntimeStore()
	store.legacy = map[string]string{"code_runner_enabled": "false", "code_runner_max_cpu_cores": "1.5", "code_runner_max_memory_mb": "0", "code_runner_max_timeout_secs": "999999", "code_runner_languages": "python,node", "code_runner_allow_network": "true"}
	p := testRuntimePolicies(t, store)
	value, version := p.CodeRunner()
	assert.False(t, value.Enabled)
	assert.Equal(t, 1.5, value.MaxCPUCores)
	assert.Equal(t, uint64(256), value.MaxMemoryMB)
	assert.Equal(t, uint64(30), value.MaxTimeoutSecs)
	assert.True(t, value.AllowNetwork)
	assert.Equal(t, []string{"python", "node"}, value.Languages)
	view, err := p.UpdateCodeRunner(context.Background(), runtimeInput(version, `{"enabled":true,"languages":[]}`))
	require.NoError(t, err)
	assert.Empty(t, view.Values.Languages)
	encoded, err := json.Marshal(view.Values)
	require.NoError(t, err)
	assert.Contains(t, string(encoded), `"languages":[]`)
	store.legacy["code_runner_enabled"] = "false"
	again := testRuntimePolicies(t, store)
	value, _ = again.CodeRunner()
	assert.True(t, value.Enabled)
	assert.Empty(t, value.Languages)
}

func TestRuntimePoliciesRateCatalogPartialRulesAndImmutableViews(t *testing.T) {
	ctx := context.Background()
	store := newMemoryRuntimeStore()
	p := NewRuntimePolicies(store, runtimeTestDefaults(), nil)
	policy := shared.RateLimitPolicy{Enabled: true, WindowSeconds: 60, MaxRequests: 20, FailureMode: "deny"}
	metadata := domainsettings.RateLimitMetadata{Title: "上传", Identity: "user", Endpoints: []string{"POST /uploads"}}
	require.NoError(t, p.RegisterRateLimit("upload", policy, metadata))
	metadata.Endpoints = []string{"PUT /uploads/{id}"}
	require.NoError(t, p.RegisterRateLimit("upload", policy, metadata))
	require.NoError(t, p.Initialize(ctx))
	view, err := p.UpdateRateLimit(ctx, runtimeInput(0, `{"rules":{"upload":{"max_requests":9}}}`))
	require.NoError(t, err)
	assert.Equal(t, int64(60), view.Values.Rules["upload"].WindowSeconds)
	assert.Len(t, view.Entries[0].Endpoints, 2)
	assert.Equal(t, "override", view.Sources["rules.upload.max_requests"])
	assert.Equal(t, "application", view.Sources["rules.upload.window_seconds"])
	view.Values.Rules["upload"] = shared.RateLimitPolicy{}
	view.Defaults.Rules["upload"] = shared.RateLimitPolicy{}
	current, _, ok := p.RateLimit("upload")
	assert.True(t, ok)
	assert.Equal(t, int64(9), current.MaxRequests)
	_, err = p.UpdateRateLimit(ctx, runtimeInput(1, `{"rules":{"upload":{"max_requests":5},"unknown":{"enabled":false}}}`))
	require.Error(t, err)
	current, version, _ := p.RateLimit("upload")
	assert.Equal(t, int64(9), current.MaxRequests)
	assert.Equal(t, uint64(1), version)
	before := store.loads
	for range 10 {
		p.RateLimit("upload")
		p.Image()
		p.UploadQueue()
		p.CodeRunner()
	}
	assert.Equal(t, before, store.loads)
}

func TestRuntimePoliciesRejectUnknownNullAndIncompleteWrites(t *testing.T) {
	ctx := context.Background()
	p := testRuntimePolicies(t, newMemoryRuntimeStore())
	for _, values := range []string{`{"unknown":1}`, `{"max_concurrent_files":null}`, `null`, `[]`, `{"max_concurrent_files":11}`} {
		_, err := p.UpdateUploadQueue(ctx, runtimeInput(0, values))
		require.Error(t, err, values)
	}
	_, err := p.UpdateUploadQueue(ctx, RuntimeUpdate{Values: json.RawMessage(`{}`)})
	require.Error(t, err)
	in := runtimeInput(0, `{}`)
	in.Reset = true
	_, err = p.UpdateUploadQueue(ctx, in)
	require.Error(t, err)
}

func TestRuntimePoliciesRestartRecoversLastValidatedImage(t *testing.T) {
	ctx := context.Background()
	store := newMemoryRuntimeStore()
	policies := testRuntimePolicies(t, store)
	_, err := policies.UpdateImage(ctx, runtimeInput(0, `{"thumbnail_width":450}`))
	require.NoError(t, err)
	validator := func(value domainsettings.ImagePolicy) error {
		if value.WebPMode == "lossy" {
			return errors.New("编码器不可用")
		}
		return nil
	}
	policies.SetImageValidator(validator)
	saved, err := policies.UpdateImage(ctx, runtimeInput(1, `{"webp_mode":"lossy","thumbnail_width":600}`))
	require.NoError(t, err)
	require.Equal(t, "failed", saved.Runtime.Status)
	restarted := NewRuntimePolicies(store, runtimeTestDefaults(), nil)
	restarted.SetImageValidator(validator)
	require.NoError(t, restarted.Initialize(ctx))
	value, version := restarted.Image()
	assert.Equal(t, 450, value.ThumbnailWidth)
	assert.Equal(t, "lossless", value.WebPMode)
	assert.Equal(t, uint64(1), version)
	view, err := restarted.GetImage(ctx)
	require.NoError(t, err)
	assert.Equal(t, uint64(2), view.Version)
	assert.Equal(t, 600, view.Values.ThumbnailWidth)
	assert.Equal(t, "failed", view.Runtime.Status)
}

func TestRuntimePoliciesCrossInstanceRefreshAndDefaultSources(t *testing.T) {
	ctx := context.Background()
	store := newMemoryRuntimeStore()
	first := testRuntimePolicies(t, store)
	second := testRuntimePolicies(t, store)
	first.SetCodeRunnerDefaultSources(map[string]string{"enabled": "application", "max_cpu_cores": "deployment"})
	view, err := first.GetCodeRunner(ctx)
	require.NoError(t, err)
	assert.Equal(t, "application", view.Sources["enabled"])
	assert.Equal(t, "deployment", view.Sources["max_cpu_cores"])
	_, err = first.UpdateUploadQueue(ctx, runtimeInput(0, `{"max_concurrent_files":8}`))
	require.NoError(t, err)
	value, _ := second.UploadQueue()
	assert.Equal(t, 3, value.MaxConcurrentFiles)
	refreshed, err := second.GetUploadQueue(ctx)
	require.NoError(t, err)
	assert.Equal(t, 8, refreshed.Runtime.Values.MaxConcurrentFiles)
	assert.Equal(t, uint64(1), refreshed.Runtime.Version)
}

func TestRuntimePoliciesNormalizeLegacyLanguageAliases(t *testing.T) {
	for _, tc := range []struct {
		raw  string
		want []string
	}{
		{"js", []string{"node"}},
		{" JAVASCRIPT ,node,js ", []string{"node"}},
		{"ts,typescript,bun", []string{"bun"}},
		{"rs,RUST", []string{"rust"}},
		{"js,ts,rs,python", []string{"node", "bun", "rust", "python"}},
	} {
		t.Run(tc.raw, func(t *testing.T) {
			store := newMemoryRuntimeStore()
			store.legacy["code_runner_languages"] = tc.raw
			policies := testRuntimePolicies(t, store)
			value, _ := policies.CodeRunner()
			assert.Equal(t, tc.want, value.Languages)
			restarted := testRuntimePolicies(t, store)
			value, _ = restarted.CodeRunner()
			assert.Equal(t, tc.want, value.Languages)
		})
	}
}

func TestRuntimePoliciesRejectUnknownLegacyLanguageWithoutBroadening(t *testing.T) {
	for _, raw := range []string{"ruby", "js,ruby"} {
		t.Run(raw, func(t *testing.T) {
			store := newMemoryRuntimeStore()
			store.legacy["code_runner_languages"] = raw
			policies := NewRuntimePolicies(store, runtimeTestDefaults(), nil)
			err := policies.Initialize(context.Background())
			require.Error(t, err)
			assert.Contains(t, err.Error(), "ruby")
			assert.Empty(t, store.records)
			assert.Error(t, policies.CodeRunnerError())
		})
	}
}

func TestRuntimePoliciesNormalizeDeploymentLanguageAliases(t *testing.T) {
	defaults := runtimeTestDefaults()
	defaults.Languages = []string{"js", "javascript", "ts", "rs"}
	policies := NewRuntimePolicies(newMemoryRuntimeStore(), defaults, nil)
	require.NoError(t, policies.Initialize(context.Background()))
	value, _ := policies.CodeRunner()
	assert.Equal(t, []string{"node", "bun", "rust"}, value.Languages)
	view, err := policies.GetCodeRunner(context.Background())
	require.NoError(t, err)
	assert.Equal(t, value.Languages, view.Defaults.Languages)

	defaults.Languages = []string{"js", "ruby"}
	policies = NewRuntimePolicies(newMemoryRuntimeStore(), defaults, nil)
	require.Error(t, policies.Initialize(context.Background()))
	assert.Error(t, policies.CodeRunnerError())
}

func TestRuntimePoliciesCapturedRateRulesKeepOneVersion(t *testing.T) {
	ctx := context.Background()
	policies := NewRuntimePolicies(newMemoryRuntimeStore(), runtimeTestDefaults(), nil)
	rule := shared.RateLimitPolicy{Enabled: true, WindowSeconds: 60, MaxRequests: 5, FailureMode: "deny"}
	for _, id := range []string{"window", "daily"} {
		require.NoError(t, policies.RegisterRateLimit(id, rule, domainsettings.RateLimitMetadata{
			Title:     id,
			Identity:  "user",
			Endpoints: []string{"POST /uploads"},
		}))
	}
	require.NoError(t, policies.Initialize(ctx))
	captured := policies.RateLimits()
	_, err := policies.UpdateRateLimit(ctx, runtimeInput(0, `{"rules":{"window":{"max_requests":4},"daily":{"max_requests":50}}}`))
	require.NoError(t, err)
	window, ok := captured.Lookup("window")
	require.True(t, ok)
	daily, ok := captured.Lookup("daily")
	require.True(t, ok)
	assert.Equal(t, int64(5), window.MaxRequests)
	assert.Equal(t, int64(5), daily.MaxRequests)
	assert.Zero(t, captured.Version())

	current := policies.RateLimits()
	window, ok = current.Lookup("window")
	require.True(t, ok)
	daily, ok = current.Lookup("daily")
	require.True(t, ok)
	assert.Equal(t, int64(4), window.MaxRequests)
	assert.Equal(t, int64(50), daily.MaxRequests)
	assert.Equal(t, uint64(1), current.Version())
}
