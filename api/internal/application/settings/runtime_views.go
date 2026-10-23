package settings

import (
	"context"
	"encoding/json"
	"sort"

	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
)

func runtimeView[T any](p *RuntimePolicies, group domainsettings.RuntimeGroup) RuntimeView[T] {
	state := (*p.snapshot.Load())[group]
	defaults := clonePolicy(p.defaults[group].(T))
	values := clonePolicy(state.saved.(T))
	effective := clonePolicy(state.effective.(T))
	sources := map[string]string{}
	defaultJSON, _ := json.Marshal(defaults)
	var fields map[string]json.RawMessage
	_ = json.Unmarshal(defaultJSON, &fields)
	var overrides map[string]json.RawMessage
	_ = json.Unmarshal(state.record.Overrides, &overrides)
	if group == domainsettings.RateLimitGroup {
		var ruleOverrides map[string]map[string]json.RawMessage
		_ = json.Unmarshal(overrides["rules"], &ruleOverrides)
		for id, rule := range p.defaults[group].(domainsettings.RateLimitPolicy).Rules {
			raw, _ := json.Marshal(rule)
			var ruleFields map[string]json.RawMessage
			_ = json.Unmarshal(raw, &ruleFields)
			for field := range ruleFields {
				key := "rules." + id + "." + field
				sources[key] = "application"
				if _, ok := ruleOverrides[id][field]; ok {
					sources[key] = "override"
				}
			}
		}
	} else {
		for field := range fields {
			source := "application"
			if group == domainsettings.CodeRunnerGroup {
				source = "deployment"
				if declared, ok := p.runnerSources[field]; ok {
					source = declared
				}
			}
			if _, ok := overrides[field]; ok {
				source = "override"
			}
			sources[field] = source
		}
	}
	activation := "new_requests"
	if group == domainsettings.CodeRunnerGroup {
		activation = "new_tasks"
	}
	if group == domainsettings.UploadQueueGroup {
		activation = "browser_scheduling"
	}
	view := RuntimeView[T]{Version: state.record.Version, Values: values, Defaults: defaults, Sources: sources, Runtime: RuntimeState[T]{Version: state.version, Values: effective, Status: state.status, Activation: activation, InstanceID: p.instanceID, AppliedAt: state.appliedAt, LastCheckedAt: state.checkedAt, Error: state.applyError}, Presets: runtimePresets(defaults)}
	if group == domainsettings.RateLimitGroup {
		view.Entries = make([]domainsettings.RateLimitMetadata, 0, len(p.catalog))
		for _, entry := range p.catalog {
			entry.Endpoints = append([]string{}, entry.Endpoints...)
			view.Entries = append(view.Entries, entry)
		}
		sort.Slice(view.Entries, func(i, j int) bool { return view.Entries[i].ID < view.Entries[j].ID })
	}
	if group == domainsettings.ImageGroup && p.imageMaintenanceStatus != nil {
		status := p.imageMaintenanceStatus()
		view.Cleanup = &status
	}
	return view
}

func clonePolicy[T any](value T) T {
	raw, _ := json.Marshal(value)
	var cloned T
	_ = json.Unmarshal(raw, &cloned)
	return cloned
}

func runtimePresets[T any](defaults T) []RuntimePreset[T] {
	preset := func(id, label, description string, value any) RuntimePreset[T] {
		return RuntimePreset[T]{ID: id, Label: label, Description: description, Values: value.(T)}
	}
	switch d := any(defaults).(type) {
	case domainsettings.ImagePolicy:
		balanced, compact := d, d
		balanced.WebPMode = "lossy"
		balanced.WebPQuality = 80
		balanced.WebPMethod = 4
		compact.WebPMode = "lossy"
		compact.WebPQuality = 65
		compact.WebPMethod = 6
		return []RuntimePreset[T]{preset("lossless", "无损优先", "保持无损输出，保留透明通道与动画", d), preset("balanced", "均衡压缩", "静态图采用有损编码，兼顾质量与体积", balanced), preset("compact", "节省空间", "降低静态图质量并增加编码耗时，保留动画语义", compact)}
	case domainsettings.UploadQueuePolicy:
		return []RuntimePreset[T]{preset("low", "低并发", "每次调度一个文件", domainsettings.UploadQueuePolicy{MaxConcurrentFiles: 1}), preset("daily", "日常上传", "同时调度三个文件", d), preset("bulk", "批量上传", "同时调度六个文件，可能更早触发入口限流", domainsettings.UploadQueuePolicy{MaxConcurrentFiles: 6})}
	case domainsettings.CodeRunnerPolicy:
		economical, throughput := clonePolicy(d), clonePolicy(d)
		economical.MaxCPUCores = max(0.1, d.MaxCPUCores/2)
		economical.MaxMemoryMB = max(uint64(128), d.MaxMemoryMB/2)
		economical.MaxMemoryMB = min(economical.MaxMemoryMB, d.MaxMemoryMB)
		economical.MaxConcurrent = max(1, d.MaxConcurrent/2)
		throughput.MaxConcurrent = min(32, max(d.MaxConcurrent, d.MaxConcurrent*2))
		return []RuntimePreset[T]{preset("economical", "节约资源", "降低单任务与并发资源，不改变联网许可", economical), preset("deployment", "部署默认", "恢复当前部署的资源与语言默认值", d), preset("throughput", "高并发", "仅提高并发上限，不解除任务隔离与请求限流", throughput)}
	case domainsettings.RateLimitPolicy:
		strict, relaxed := clonePolicy(d), clonePolicy(d)
		for id, rule := range strict.Rules {
			rule.MaxRequests = max(int64(1), rule.MaxRequests/2)
			if rule.BurstRequests > 0 {
				rule.BurstRequests = max(int64(1), rule.BurstRequests/2)
			}
			strict.Rules[id] = rule
		}
		for id, rule := range relaxed.Rules {
			rule.MaxRequests = min(int64(1e9), rule.MaxRequests*2)
			if rule.BurstRequests > 0 {
				rule.BurstRequests = min(int64(1e9), rule.BurstRequests*2)
			}
			relaxed.Rules[id] = rule
		}
		return []RuntimePreset[T]{preset("strict", "严格防护", "减少窗口与突发额度，不额外启用日配额", strict), preset("current", "现有限额", "实际绑定入口的现有默认限额", d), preset("relaxed", "宽松限额", "增加窗口与突发额度，仍保留身份隔离", relaxed)}
	}
	return []RuntimePreset[T]{}
}

func getRuntimeView[T any](ctx context.Context, p *RuntimePolicies, group domainsettings.RuntimeGroup) (RuntimeView[T], error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if err := p.refreshLocked(ctx, group); err != nil && !(*p.snapshot.Load())[group].ready {
		return RuntimeView[T]{}, shared.Internal("读取运行策略失败", err)
	}
	return runtimeView[T](p, group), nil
}
func updateRuntimeView[T any](ctx context.Context, p *RuntimePolicies, group domainsettings.RuntimeGroup, in RuntimeUpdate) (RuntimeView[T], error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if err := p.save(ctx, group, in); err != nil {
		return RuntimeView[T]{}, err
	}
	return runtimeView[T](p, group), nil
}

func (p *RuntimePolicies) GetRateLimit(ctx context.Context) (RuntimeView[domainsettings.RateLimitPolicy], error) {
	return getRuntimeView[domainsettings.RateLimitPolicy](ctx, p, domainsettings.RateLimitGroup)
}
func (p *RuntimePolicies) UpdateRateLimit(ctx context.Context, in RuntimeUpdate) (RuntimeView[domainsettings.RateLimitPolicy], error) {
	return updateRuntimeView[domainsettings.RateLimitPolicy](ctx, p, domainsettings.RateLimitGroup, in)
}
func (p *RuntimePolicies) GetImage(ctx context.Context) (RuntimeView[domainsettings.ImagePolicy], error) {
	return getRuntimeView[domainsettings.ImagePolicy](ctx, p, domainsettings.ImageGroup)
}
func (p *RuntimePolicies) UpdateImage(ctx context.Context, in RuntimeUpdate) (RuntimeView[domainsettings.ImagePolicy], error) {
	return updateRuntimeView[domainsettings.ImagePolicy](ctx, p, domainsettings.ImageGroup, in)
}
func (p *RuntimePolicies) GetUploadQueue(ctx context.Context) (RuntimeView[domainsettings.UploadQueuePolicy], error) {
	return getRuntimeView[domainsettings.UploadQueuePolicy](ctx, p, domainsettings.UploadQueueGroup)
}
func (p *RuntimePolicies) UpdateUploadQueue(ctx context.Context, in RuntimeUpdate) (RuntimeView[domainsettings.UploadQueuePolicy], error) {
	return updateRuntimeView[domainsettings.UploadQueuePolicy](ctx, p, domainsettings.UploadQueueGroup, in)
}
func (p *RuntimePolicies) GetCodeRunner(ctx context.Context) (RuntimeView[domainsettings.CodeRunnerPolicy], error) {
	return getRuntimeView[domainsettings.CodeRunnerPolicy](ctx, p, domainsettings.CodeRunnerGroup)
}
func (p *RuntimePolicies) UpdateCodeRunner(ctx context.Context, in RuntimeUpdate) (RuntimeView[domainsettings.CodeRunnerPolicy], error) {
	return updateRuntimeView[domainsettings.CodeRunnerPolicy](ctx, p, domainsettings.CodeRunnerGroup, in)
}
