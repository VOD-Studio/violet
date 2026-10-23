package settings

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"slices"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	appshared "blog-api/internal/application/shared"
	domaincoderunner "blog-api/internal/domain/coderunner"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	"github.com/rs/zerolog/log"
)

var runtimeGroups = []domainsettings.RuntimeGroup{domainsettings.RateLimitGroup, domainsettings.ImageGroup, domainsettings.UploadQueueGroup, domainsettings.CodeRunnerGroup}

// RuntimeState 描述当前实例的实际生效状态。
type RuntimeState[T any] struct {
	// Version 是当前实例已应用版本，可落后于 RuntimeView.Version。
	Version uint64 `json:"version"`
	Values  T      `json:"values"`
	// Status 为 applied、stale（读取失败）或 failed（校验或准备失败）。
	Status string `json:"status"`
	// Activation 为 new_requests、new_tasks 或 browser_scheduling，不追改在途工作。
	Activation    string    `json:"activation"`
	InstanceID    string    `json:"instance_id"`
	AppliedAt     time.Time `json:"applied_at"`
	LastCheckedAt time.Time `json:"last_checked_at"`
	// Error 描述读取或应用失败；非空时 Values 仍为最近有效值。
	Error string `json:"error,omitempty"`
}

// RuntimePreset 是仅供草稿选择的完整场景参数。
type RuntimePreset[T any] struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Values      T      `json:"values"`
}

// RuntimeView 区分保存配置与本实例有效配置。
type RuntimeView[T any] struct {
	// Version 是最近读取的保存版本；0 表示尚无显式覆盖。
	Version uint64 `json:"version"`
	// Values 是保存覆盖与当前部署默认合并后的值，不保证已经应用。
	Values   T `json:"values"`
	Defaults T `json:"defaults"`
	// Sources 按字段路径记录 override、deployment 或 application；限流使用 rules.<id>.<field>。
	Sources map[string]string                  `json:"sources"`
	Runtime RuntimeState[T]                    `json:"runtime"`
	Presets []RuntimePreset[T]                 `json:"presets"`
	Entries []domainsettings.RateLimitMetadata `json:"entries,omitempty"`
	// Cleanup 仅图片组返回；未执行维护时其中的时间字段为 nil。
	Cleanup *domainsettings.ImageCacheMaintenance `json:"cleanup,omitempty"`
}

// RuntimeUpdate 保留字段省略与显式零值的区别。
type RuntimeUpdate struct {
	// ExpectedVersion 必填；0 可创建首个覆盖，版本不匹配时拒绝整组写入。
	ExpectedVersion *uint64 `json:"expected_version"`
	// Values 只更新出现的字段；嵌套限流规则深合并，null 不代表清空。
	Values json.RawMessage `json:"values,omitempty"`
	// Reset 清除整组显式覆盖，与 Values 互斥。
	Reset bool `json:"reset,omitempty"`
}

func (in *RuntimeUpdate) UnmarshalJSON(data []byte) error {
	type wire RuntimeUpdate
	var decoded wire
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&decoded); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	if fields == nil {
		return errors.New("请求必须是对象")
	}
	for key, value := range fields {
		if bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return fmt.Errorf("字段 %s 不能为 null", key)
		}
	}
	*in = RuntimeUpdate(decoded)
	return nil
}

type runtimeGroupState struct {
	record     domainsettings.RuntimeRecord
	saved      any
	effective  any
	version    uint64
	appliedAt  time.Time
	checkedAt  time.Time
	status     string
	applyError string
	readError  error
	ready      bool
}
type runtimeSnapshot map[domainsettings.RuntimeGroup]runtimeGroupState

// RuntimePolicies 管理固定四组策略，热路径仅访问不可变本地快照。
type RuntimePolicies struct {
	store                  domainsettings.RuntimePolicyStore
	bus                    appshared.EventBus
	mu                     sync.Mutex
	snapshot               atomic.Pointer[runtimeSnapshot]
	defaults               map[domainsettings.RuntimeGroup]any
	catalog                map[string]domainsettings.RateLimitMetadata
	runnerSources          map[string]string
	imageValidator         func(domainsettings.ImagePolicy) error
	imageMaintenanceStatus func() domainsettings.ImageCacheMaintenance
	instanceID             string
	initialized            bool
}

// NewRuntimePolicies 只构造快照；入口注册完毕后必须 Initialize，成功前不能接收请求。
func NewRuntimePolicies(store domainsettings.RuntimePolicyStore, defaults domainsettings.CodeRunnerPolicy, bus appshared.EventBus) *RuntimePolicies {
	if defaults.Languages == nil {
		defaults.Languages = []string{"python", "node", "go", "rust", "bun"}
	} else {
		defaults.Languages = slices.Clone(defaults.Languages)
	}
	hostname, _ := os.Hostname()
	p := &RuntimePolicies{store: store, bus: bus, defaults: map[domainsettings.RuntimeGroup]any{
		domainsettings.RateLimitGroup: domainsettings.RateLimitPolicy{Rules: map[string]shared.RateLimitPolicy{}},
		domainsettings.ImageGroup:     domainsettings.DefaultImagePolicy(), domainsettings.UploadQueueGroup: domainsettings.UploadQueuePolicy{MaxConcurrentFiles: 3}, domainsettings.CodeRunnerGroup: defaults,
	}, catalog: map[string]domainsettings.RateLimitMetadata{}, runnerSources: map[string]string{}, instanceID: fmt.Sprintf("%s:%d:%d", hostname, os.Getpid(), time.Now().UnixNano())}
	snapshot := runtimeSnapshot{}
	for _, group := range runtimeGroups {
		snapshot[group] = runtimeGroupState{record: domainsettings.RuntimeRecord{Overrides: json.RawMessage(`{}`)}, saved: p.defaults[group], effective: p.defaults[group], status: "stale", readError: errors.New("运行策略尚未完成初始化")}
	}
	p.snapshot.Store(&snapshot)
	return p
}

// SetImageValidator 必须在 Initialize 前注册，不得修改消费者当前状态。
func (p *RuntimePolicies) SetImageValidator(validator func(domainsettings.ImagePolicy) error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.imageValidator = validator
}

// SetImageMaintenanceStatus 接入专用缓存维护的只读状态。
func (p *RuntimePolicies) SetImageMaintenanceStatus(status func() domainsettings.ImageCacheMaintenance) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.imageMaintenanceStatus = status
}

// SetCodeRunnerDefaultSources 明确传入部署解析时记录的字段来源。
func (p *RuntimePolicies) SetCodeRunnerDefaultSources(sources map[string]string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for k, v := range sources {
		if v == "application" || v == "deployment" {
			p.runnerSources[k] = v
		}
	}
}

// RegisterRateLimit 只允许在路由绑定阶段注册实际使用的规则。
func (p *RuntimePolicies) RegisterRateLimit(id string, policy shared.RateLimitPolicy, metadata domainsettings.RateLimitMetadata) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.initialized {
		return errors.New("运行策略初始化后不能注册限流入口")
	}
	if id == "" || metadata.Identity == "" || len(metadata.Endpoints) == 0 {
		return errors.New("限流入口必须提供标识、身份和绑定端点")
	}
	if err := validateRuntime(domainsettings.RateLimitGroup, domainsettings.RateLimitPolicy{Rules: map[string]shared.RateLimitPolicy{id: policy}}); err != nil {
		return err
	}
	defaults := p.defaults[domainsettings.RateLimitGroup].(domainsettings.RateLimitPolicy)
	if old, exists := defaults.Rules[id]; exists {
		if old != policy || p.catalog[id].Identity != metadata.Identity {
			return fmt.Errorf("限流入口 %s 的默认值或身份冲突", id)
		}
		previous := p.catalog[id]
		for _, endpoint := range metadata.Endpoints {
			if !slices.Contains(previous.Endpoints, endpoint) {
				previous.Endpoints = append(previous.Endpoints, endpoint)
			}
		}
		sort.Strings(previous.Endpoints)
		p.catalog[id] = previous
	} else {
		defaults.Rules[id] = policy
		metadata.ID = id
		metadata.Endpoints = slices.Clone(metadata.Endpoints)
		sort.Strings(metadata.Endpoints)
		p.catalog[id] = metadata
	}
	return nil
}

// Initialize 在全部入口绑定后恢复持久化策略，失败时不允许启动服务。
func (p *RuntimePolicies) Initialize(ctx context.Context) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	defaults := p.defaults[domainsettings.CodeRunnerGroup].(domainsettings.CodeRunnerPolicy)
	languages, err := domaincoderunner.NormalizeLanguages(defaults.Languages)
	if err != nil {
		return err
	}
	defaults.Languages = languages
	p.defaults[domainsettings.CodeRunnerGroup] = defaults
	if err := validateRuntime(domainsettings.CodeRunnerGroup, p.defaults[domainsettings.CodeRunnerGroup]); err != nil {
		return err
	}
	if err := p.importLegacyRunner(ctx); err != nil {
		return err
	}
	for _, group := range runtimeGroups {
		if err := p.refreshLocked(ctx, group); err != nil {
			return err
		}
	}
	p.initialized = true
	return nil
}

// Run 每两秒刷新固定四行，调用者负责 goroutine 与取消生命周期。
func (p *RuntimePolicies) Run(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.mu.Lock()
			for _, group := range runtimeGroups {
				if err := p.refreshLocked(ctx, group); err != nil {
					log.Error().Err(err).Str("group", string(group)).Msg("刷新运行策略失败")
				}
			}
			p.mu.Unlock()
		}
	}
}

func (p *RuntimePolicies) replace(group domainsettings.RuntimeGroup, state runtimeGroupState) {
	previous := p.snapshot.Load()
	next := make(runtimeSnapshot, len(*previous))
	for k, v := range *previous {
		next[k] = v
	}
	next[group] = state
	p.snapshot.Store(&next)
}

func (p *RuntimePolicies) refreshLocked(ctx context.Context, group domainsettings.RuntimeGroup) error {
	state := (*p.snapshot.Load())[group]
	state.checkedAt = time.Now().UTC()
	record, err := p.store.Load(ctx, group)
	if err != nil {
		state.status = "stale"
		state.readError = err
		state.applyError = "读取已保存配置失败"
		p.replace(group, state)
		return err
	}
	state.readError = nil
	if state.ready && state.record.Version == record.Version && state.status == "applied" {
		p.replace(group, state)
		return nil
	}
	value, err := p.resolve(group, record.Overrides)
	if err != nil {
		state.status = "failed"
		state.readError = err
		state.applyError = "已保存配置无效"
		p.replace(group, state)
		return err
	}
	state.record = record
	state.saved = value
	if group == domainsettings.ImageGroup && p.imageValidator != nil {
		err = p.imageValidator(value.(domainsettings.ImagePolicy))
	}
	if err == nil {
		encoded, encodeErr := json.Marshal(value)
		if encodeErr != nil {
			err = encodeErr
		} else {
			err = p.store.SaveEffective(ctx, group, domainsettings.RuntimeEffective{Version: record.Version, Values: encoded})
		}
	}
	if err != nil {
		state.status = "failed"
		state.applyError = err.Error()
		if !state.ready {
			fallback, recoveryErr := p.store.LoadEffective(ctx, group)
			if recoveryErr == nil && fallback != nil && fallback.Version <= record.Version {
				recovered, validationErr := p.resolve(group, fallback.Values)
				if validationErr == nil && group == domainsettings.ImageGroup && p.imageValidator != nil {
					validationErr = p.imageValidator(recovered.(domainsettings.ImagePolicy))
				}
				if validationErr == nil {
					state.effective = recovered
					state.version = fallback.Version
					state.appliedAt = state.checkedAt
					state.ready = true
				}
			}
		}
		p.replace(group, state)
		log.Error().Err(err).Str("group", string(group)).Uint64("version", record.Version).Msg("应用运行策略失败")
		if !state.ready {
			return err
		}
		return nil
	}
	state.effective = value
	state.version = record.Version
	state.appliedAt = state.checkedAt
	state.status = "applied"
	state.applyError = ""
	state.ready = true
	p.replace(group, state)
	return nil
}

func (p *RuntimePolicies) RateLimit(id string) (shared.RateLimitPolicy, uint64, bool) {
	s := (*p.snapshot.Load())[domainsettings.RateLimitGroup]
	v, ok := s.effective.(domainsettings.RateLimitPolicy).Rules[id]
	return v, s.version, ok
}

// RateLimits 一次捕获全部规则，组合入口在同一版本内判定。
func (p *RuntimePolicies) RateLimits() shared.RateLimitSnapshot {
	state := (*p.snapshot.Load())[domainsettings.RateLimitGroup]
	return shared.NewRateLimitSnapshot(state.effective.(domainsettings.RateLimitPolicy).Rules, state.version)
}

func (p *RuntimePolicies) Image() (domainsettings.ImagePolicy, uint64) {
	s := (*p.snapshot.Load())[domainsettings.ImageGroup]
	return s.effective.(domainsettings.ImagePolicy), s.version
}
func (p *RuntimePolicies) UploadQueue() (domainsettings.UploadQueuePolicy, uint64) {
	s := (*p.snapshot.Load())[domainsettings.UploadQueueGroup]
	return s.effective.(domainsettings.UploadQueuePolicy), s.version
}
func (p *RuntimePolicies) CodeRunner() (domainsettings.CodeRunnerPolicy, uint64) {
	s := (*p.snapshot.Load())[domainsettings.CodeRunnerGroup]
	v := s.effective.(domainsettings.CodeRunnerPolicy)
	v.Languages = slices.Clone(v.Languages)
	return v, s.version
}
func (p *RuntimePolicies) CodeRunnerError() error {
	return (*p.snapshot.Load())[domainsettings.CodeRunnerGroup].readError
}
func (p *RuntimePolicies) UploadQueueError() error {
	return (*p.snapshot.Load())[domainsettings.UploadQueueGroup].readError
}

func (p *RuntimePolicies) save(ctx context.Context, group domainsettings.RuntimeGroup, in RuntimeUpdate) error {
	if in.ExpectedVersion == nil {
		return shared.BadRequest("expected_version 为必填字段")
	}
	if *in.ExpectedVersion >= 9007199254740991 {
		return shared.BadRequest("expected_version 超出可表示的版本范围")
	}
	if in.Reset && len(in.Values) > 0 {
		return shared.BadRequest("reset 与 values 不能同时提供")
	}
	if !in.Reset && len(in.Values) == 0 {
		return shared.BadRequest("必须提供 values 或 reset:true")
	}
	if err := p.refreshLocked(ctx, group); err != nil {
		return shared.Internal("读取运行策略失败", err)
	}
	state := (*p.snapshot.Load())[group]
	if state.record.Version != *in.ExpectedVersion {
		return shared.Conflict("配置已被其他管理员更新，请保留草稿并重新加载")
	}
	overrides := json.RawMessage(`{}`)
	if !in.Reset {
		var err error
		overrides, err = mergeRuntimeJSON(state.record.Overrides, in.Values)
		if err != nil {
			return shared.BadRequest(err.Error())
		}
	}
	if _, err := p.resolve(group, overrides); err != nil {
		return err
	}
	record, err := p.store.CompareAndSwap(ctx, group, *in.ExpectedVersion, overrides)
	if errors.Is(err, domainsettings.ErrRuntimeConflict) {
		return shared.Conflict("配置已被其他管理员更新，请保留草稿并重新加载")
	}
	if err != nil {
		return shared.Internal("保存运行策略失败", err)
	}
	if p.bus != nil {
		if err := p.bus.Publish(ctx, []shared.DomainEvent{domainsettings.NewSettingsUpdated([]string{"runtime." + string(group)})}); err != nil {
			log.Warn().Err(err).Msg("发布运行策略审计失败")
		}
	}
	// 保存已成功；应用失败通过运行状态返回，不能伪装保存失败。
	value, _ := p.resolve(group, record.Overrides)
	state.record = record
	state.saved = value
	state.status = "stale"
	p.replace(group, state)
	_ = p.refreshLocked(ctx, group)
	return nil
}

func mergeRuntimeJSON(base, patch json.RawMessage) (json.RawMessage, error) {
	var previous, updates map[string]json.RawMessage
	if err := json.Unmarshal(base, &previous); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(patch, &updates); err != nil || updates == nil {
		return nil, errors.New("values 必须是对象")
	}
	if previous == nil {
		previous = map[string]json.RawMessage{}
	}
	for key, value := range updates {
		if bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return nil, fmt.Errorf("字段 %s 不能为 null", key)
		}
		if len(value) > 0 && bytes.TrimSpace(value)[0] == '{' {
			old := previous[key]
			if len(old) == 0 {
				old = json.RawMessage(`{}`)
			}
			merged, err := mergeRuntimeJSON(old, value)
			if err != nil {
				return nil, err
			}
			previous[key] = merged
		} else {
			previous[key] = value
		}
	}
	return json.Marshal(previous)
}

func (p *RuntimePolicies) resolve(group domainsettings.RuntimeGroup, overrides json.RawMessage) (any, error) {
	base, _ := json.Marshal(p.defaults[group])
	merged, err := mergeRuntimeJSON(base, overrides)
	if err != nil {
		return nil, shared.BadRequest(err.Error())
	}
	var target any
	switch group {
	case domainsettings.RateLimitGroup:
		target = &domainsettings.RateLimitPolicy{}
	case domainsettings.ImageGroup:
		target = &domainsettings.ImagePolicy{}
	case domainsettings.UploadQueueGroup:
		target = &domainsettings.UploadQueuePolicy{}
	case domainsettings.CodeRunnerGroup:
		target = &domainsettings.CodeRunnerPolicy{}
	default:
		return nil, shared.BadRequest("未知运行策略分组")
	}
	decoder := json.NewDecoder(bytes.NewReader(merged))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return nil, shared.BadRequest("策略字段无效：" + err.Error())
	}
	var value any
	switch v := target.(type) {
	case *domainsettings.RateLimitPolicy:
		for id := range v.Rules {
			if _, ok := p.catalog[id]; !ok {
				return nil, shared.BadRequest("未知或未绑定的限流入口：" + id)
			}
		}
		value = *v
	case *domainsettings.ImagePolicy:
		value = *v
	case *domainsettings.UploadQueuePolicy:
		value = *v
	case *domainsettings.CodeRunnerPolicy:
		value = *v
	}
	if err := validateRuntime(group, value); err != nil {
		return nil, err
	}
	return value, nil
}
