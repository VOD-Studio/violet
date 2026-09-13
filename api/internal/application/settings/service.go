// Package settings provides versioned settings and immutable runtime snapshots.
package settings

import (
	"context"
	"encoding/json"
	"maps"
	"sync"
	"sync/atomic"

	appshared "blog-api/internal/application/shared"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	"github.com/rs/zerolog/log"
)

// GroupMeta reports persisted versus this process's effective version.
type GroupMeta struct {
	SavedVersion   int64             `json:"saved_version"`
	AppliedVersion int64             `json:"applied_version"`
	Effect         string            `json:"effect"` // new_request | new_task | restart
	Status         string            `json:"status"` // applied | pending_restart | failed
	Sources        map[string]string `json:"sources"`
	Error          string            `json:"error,omitempty"`
}

type GroupSnapshot struct {
	Values any       `json:"values"` // One of the seven typed group views.
	Meta   GroupMeta `json:"meta"`
}

type runtimeSnapshot struct {
	values   domainsettings.SiteSettings
	raw      map[string]string
	versions map[domainsettings.Group]int64
}

type Service struct {
	store     domainsettings.VersionedStore
	bus       appshared.EventBus
	defaults  map[string]string
	mu        sync.Mutex
	effective atomic.Pointer[runtimeSnapshot]
	failures  map[domainsettings.Group]string
	// floor 部署侧安全底线；security 组校验时消费
	floor SecurityFloor
	// securityApplier 安全组生效后的热应用回调（刷新代理/CORS/Cookie 消费者）。
	// 不得回读 Service：确认路径在锁内调用，只消费传入快照。
	securityApplier func(domainsettings.SiteSettings)
	// securityPendingChange 待确认的安全组变更；仅内存，重启丢弃
	securityPendingChange *securityPending
	// securityDeploymentOnly 部署恢复模式：忽略 security 组数据库覆盖
	securityDeploymentOnly bool
}

func NewService(store domainsettings.VersionedStore, bus appshared.EventBus, defaults domainsettings.SiteSettings) *Service {
	return &Service{store: store, bus: bus, defaults: settingsMap(defaults), failures: make(map[domainsettings.Group]string)}
}

func (s *Service) Initialize(ctx context.Context) error {
	s.mu.Lock()
	err := s.initializeLocked(ctx)
	applier := s.securityApplier
	effective := s.effective.Load()
	s.mu.Unlock()
	if err != nil {
		return err
	}
	// 启动加载完成后立即把安全策略刷进运行时消费者。
	// 锁外调用（applier 不回读 Service）；快照取锁内指针，避免与并发提交交错。
	if applier != nil && effective != nil {
		applier(effective.values)
	}
	return nil
}

func (s *Service) initializeLocked(ctx context.Context) error {
	raw := maps.Clone(s.defaults)
	persisted, err := s.store.LoadValues(ctx)
	if err != nil {
		return err
	}
	maps.Copy(raw, persisted)
	versions := make(map[domainsettings.Group]int64)
	for _, group := range domainsettings.Groups() {
		record, err := s.store.ReadGroup(ctx, group)
		if err != nil {
			return err
		}
		values := s.resolve(group, record.Values)
		if err := validateGroup(group, values, s.floor); err != nil {
			return err
		}
		maps.Copy(raw, values)
		versions[group] = record.Version
	}
	s.effective.Store(&runtimeSnapshot{values: domainsettings.SiteSettings{}.MergeFrom(raw), raw: raw, versions: versions})
	clear(s.failures)
	return nil
}

// GetAll returns a detached typed effective snapshot; callers cannot mutate shared state.
func (s *Service) GetAll(ctx context.Context) (domainsettings.SiteSettings, error) {
	current := s.effective.Load()
	if current == nil {
		s.mu.Lock()
		if s.effective.Load() == nil {
			if err := s.initializeLocked(ctx); err != nil {
				s.mu.Unlock()
				return domainsettings.SiteSettings{}, err
			}
		}
		current = s.effective.Load()
		s.mu.Unlock()
	}
	values := current.values
	values.AboutConfig = append(json.RawMessage(nil), values.AboutConfig...)
	return values, nil
}

// RuntimeReader adapts existing key-based readers to the same effective snapshot, never the database.
func (s *Service) RuntimeReader() domainsettings.SettingsStore { return runtimeReader{s} }

type runtimeReader struct{ service *Service }

func (r runtimeReader) GetAll(ctx context.Context) (map[string]string, error) {
	if _, err := r.service.GetAll(ctx); err != nil {
		return nil, err
	}
	return maps.Clone(r.service.effective.Load().raw), nil
}

func (s *Service) GetGroup(ctx context.Context, group domainsettings.Group) (GroupSnapshot, error) {
	if _, err := s.GetAll(ctx); err != nil {
		return GroupSnapshot{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	record, err := s.store.ReadGroup(ctx, group)
	if err != nil {
		return GroupSnapshot{}, err
	}
	return s.groupSnapshot(group, record), nil
}

// UpdateGroup rejects unknown/null fields before entering the transaction; full validation occurs under the version lock.
func (s *Service) UpdateGroup(ctx context.Context, group domainsettings.Group, expected int64, patch map[string]json.RawMessage) (GroupSnapshot, error) {
	if group == domainsettings.Security {
		return GroupSnapshot{}, ErrSecurityConfirmationRequired
	}
	updates, err := decodePatch(group, patch)
	if err != nil {
		return GroupSnapshot{}, err
	}
	return s.changeGroup(ctx, group, expected, updates, false)
}

func (s *Service) ResetGroup(ctx context.Context, group domainsettings.Group, expected int64) (GroupSnapshot, error) {
	if group == domainsettings.Security {
		return GroupSnapshot{}, ErrSecurityConfirmationRequired
	}
	return s.changeGroup(ctx, group, expected, nil, true)
}

func (s *Service) changeGroup(ctx context.Context, group domainsettings.Group, expected int64, updates map[string]string, reset bool) (GroupSnapshot, error) {
	s.mu.Lock()
	floor := s.floor
	s.mu.Unlock()
	snapshot, _, err := s.changeGroupTracked(ctx, group, expected, updates, reset, floor)
	return snapshot, err
}

// changeGroupTracked 执行组级 CAS 写入并返回快照与实际变更键。
// security 组生效后触发热应用回调。
func (s *Service) changeGroupTracked(ctx context.Context, group domainsettings.Group, expected int64, updates map[string]string, reset bool, floor SecurityFloor) (GroupSnapshot, []string, error) {
	if _, err := s.GetAll(ctx); err != nil {
		return GroupSnapshot{}, nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	changedKeys := make([]string, 0)
	record, err := s.store.ChangeGroup(ctx, group, expected, func(previous map[string]string) (map[string]string, error) {
		next := maps.Clone(previous)
		if reset {
			next = make(map[string]string)
		} else {
			maps.Copy(next, updates)
		}
		if err := validateGroup(group, s.resolve(group, next), floor); err != nil {
			return nil, err
		}
		for _, key := range group.Keys() {
			before, hadBefore := previous[key]
			after, hasAfter := next[key]
			if hadBefore != hasAfter || before != after {
				changedKeys = append(changedKeys, key)
			}
		}
		return next, nil
	})
	if err != nil {
		return GroupSnapshot{}, nil, err
	}
	// Reconstruct before publication. Any application failure retains the previous pointer and version.
	values := s.resolve(group, record.Values)
	if err := validateGroup(group, values, floor); err != nil {
		s.failures[group] = "配置已保存但应用失败，请修正后重新保存"
		log.Error().Err(err).Str("group", string(group)).Msg("应用配置失败")
	} else {
		current := s.effective.Load()
		raw := maps.Clone(current.raw)
		maps.Copy(raw, values)
		versions := maps.Clone(current.versions)
		versions[group] = record.Version
		s.effective.Store(&runtimeSnapshot{values: domainsettings.SiteSettings{}.MergeFrom(raw), raw: raw, versions: versions})
		delete(s.failures, group)
		// 安全组在锁内串行热应用：以提交顺序刷运行时消费者，杜绝并发确认下
		// 「先提交 V2 被后应用的 V1 覆盖」的回退。applier 只消费传入快照。
		if group == domainsettings.Security && s.securityApplier != nil {
			s.securityApplier(domainsettings.SiteSettings{}.MergeFrom(raw))
		}
	}
	if s.bus != nil && len(changedKeys) > 0 {
		keys := make([]string, 0)
		for _, key := range changedKeys {
			if key != "github_token" && key != "llm_api_key" {
				keys = append(keys, key)
			}
		}
		if err := s.bus.Publish(ctx, []shared.DomainEvent{domainsettings.NewSettingsUpdated(keys)}); err != nil {
			log.Warn().Err(err).Msg("发布配置更新事件失败")
		}
	}
	return s.groupSnapshot(group, record), changedKeys, nil
}

func (s *Service) resolve(group domainsettings.Group, overrides map[string]string) map[string]string {
	values := make(map[string]string, len(group.Keys()))
	// 部署恢复模式（SECURITY_OVERRIDE_MODE=deployment）：忽略安全组数据库
	// 覆盖，仅用部署默认——管理员被错误安全组合锁死后绕过数据库恢复访问。
	if group == domainsettings.Security && s.securityDeploymentOnly {
		overrides = nil
	}
	for _, key := range group.Keys() {
		value, ok := overrides[key]
		if !ok {
			value = s.defaults[key]
		}
		values[key] = value
	}
	return values
}

func (s *Service) groupSnapshot(group domainsettings.Group, record domainsettings.GroupRecord) GroupSnapshot {
	saved := domainsettings.SiteSettings{}.MergeFrom(s.resolve(group, record.Values))
	meta := GroupMeta{SavedVersion: record.Version, AppliedVersion: s.effective.Load().versions[group], Effect: "new_request", Status: "applied", Sources: make(map[string]string)}
	if group == domainsettings.CodeRunner || group == domainsettings.LLM {
		meta.Effect = "new_task"
	}
	for _, key := range group.Keys() {
		source := "deployment_default"
		if _, ok := record.Values[key]; ok {
			source = "database"
		}
		meta.Sources[key] = source
	}
	if meta.AppliedVersion != meta.SavedVersion {
		meta.Status = "failed"
		meta.Error = "已保存版本尚未应用到当前进程"
	}
	if failure := s.failures[group]; failure != "" {
		meta.Status = "failed"
		meta.Error = failure
	}
	var view any
	switch group {
	case domainsettings.General:
		view = generalView(saved)
	case domainsettings.Auth:
		view = authView(saved)
	case domainsettings.Security:
		view = securityView(saved)
	case domainsettings.Github:
		view = githubView(saved)
	case domainsettings.Profile:
		view = profileView(saved)
	case domainsettings.About:
		view = aboutView(saved)
	case domainsettings.LLM:
		view = llmView(saved)
	case domainsettings.CodeRunner:
		view = codeRunnerView(saved)
	}
	return GroupSnapshot{Values: view, Meta: meta}
}

func (s *Service) GetPublic(ctx context.Context) (map[string]any, error) {
	settings, err := s.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"site_name":                       settings.SiteName,
		"site_url":                        settings.SiteURL,
		"posts_per_page":                  settings.PostsPerPage,
		"home_footprint_enabled":          settings.HomeFootprintEnabled,
		"home_footprint_aggregation_days": settings.HomeFootprintAggregationDays,
		"comments_enabled":                settings.CommentsEnabled,
		"comments_moderation":             settings.CommentsModeration,
		"google_login_enabled":            settings.GoogleLoginEnabled,
		"github_login_enabled":            settings.GithubLoginEnabled,
		"github_username":                 settings.GitHubUsername,
		"tech_stack":                      settings.TechStack,
		"bio":                             settings.Bio,
		"footer_text":                     settings.FooterText,
		"footer_github_url":               settings.FooterGitHubURL,
		"about_config":                    settings.AboutConfig,
		"avatar_url":                      settings.AvatarURL,
		"tagline":                         settings.Tagline,
		"profile_role":                    settings.ProfileRole,
		"profile_location":                settings.ProfileLocation,
		"available_for":                   settings.AvailableFor,
		"skills_strong":                   settings.SkillsStrong,
		"skills_learning":                 settings.SkillsLearning,
		"skills_interests":                settings.SkillsInterests,
		"social_twitter":                  settings.SocialTwitter,
		"social_mastodon":                 settings.SocialMastodon,
		"social_email":                    settings.SocialEmail,
		"social_rss":                      settings.SocialRss,
		"social_bilibili":                 settings.SocialBilibili,
		"code_runner_enabled":             settings.CodeRunnerEnabled,
	}, nil
}
