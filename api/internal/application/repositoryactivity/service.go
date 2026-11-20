// Package repositoryactivity 编排仓库进展，前台请求不会访问 GitHub。
package repositoryactivity

import (
	"context"
	"errors"
	"sync"
	"time"

	"blog-api/internal/domain/project"
	activity "blog-api/internal/domain/repositoryactivity"
	"blog-api/internal/domain/shared"
)

const (
	freshFor = 30 * time.Minute
	keepFor  = 24 * time.Hour
)

type projectReader interface {
	FindAll(ctx context.Context) ([]*project.Project, error)
	FindByID(ctx context.Context, id shared.ID) (*project.Project, error)
}

type Service struct {
	projects projectReader
	provider activity.Provider
	storage  activity.Repository
	now      func() time.Time
	syncMu   sync.Mutex
}

func NewService(projects projectReader, provider activity.Provider, storage activity.Repository) *Service {
	return &Service{projects: projects, provider: provider, storage: storage, now: time.Now}
}

// Browse 按站点日历日和项目降序读取日卡，每天最多预览六条提交。
func (s *Service) Browse(ctx context.Context, projectID *shared.ID, before *activity.Cursor, limit int) ([]activity.Day, activity.Health, error) {
	bindings, err := s.bindings(ctx, projectID)
	if err != nil {
		return nil, activity.Health{}, err
	}
	if len(bindings) == 0 {
		return []activity.Day{}, activity.Health{State: activity.StateUnconfigured}, nil
	}
	now := s.now()
	health, err := s.health(ctx, sourceKeys(bindings), now)
	if err != nil {
		return nil, activity.Health{}, err
	}
	if limit <= 0 {
		return []activity.Day{}, health, nil
	}
	days, err := s.storage.Browse(ctx, bindings, before, limit, now.Add(-keepFor))
	return days, health, err
}

func (s *Service) health(ctx context.Context, keys []string, now time.Time) (activity.Health, error) {
	sources, err := s.storage.Sources(ctx, keys)
	if err != nil {
		return activity.Health{}, err
	}
	till, err := s.storage.BlockedUntil(ctx, now)
	if err != nil {
		return activity.Health{}, err
	}
	return aggregateHealth(sources, len(keys), now, till != nil), nil
}

// GetDay 仅当项目仍关联当前可见的仓库时返回日详情。
func (s *Service) GetDay(ctx context.Context, projectID shared.ID, day string) (activity.Day, error) {
	if _, err := time.Parse(time.DateOnly, day); err != nil {
		return activity.Day{}, shared.BadRequest("日期格式应为 YYYY-MM-DD")
	}
	bindings, err := s.bindings(ctx, &projectID)
	if err != nil {
		return activity.Day{}, err
	}
	if len(bindings) == 0 {
		return activity.Day{}, activity.ErrNotFound
	}
	return s.storage.GetDay(ctx, bindings[0], day, s.now().Add(-keepFor))
}

func (s *Service) bindings(ctx context.Context, projectID *shared.ID) ([]activity.Binding, error) {
	if projectID != nil {
		p, err := s.projects.FindByID(ctx, *projectID)
		if errors.Is(err, project.ErrNotFound) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		if binding, ok := projectBinding(p); ok {
			return []activity.Binding{binding}, nil
		}
		return nil, nil
	}
	projects, err := s.projects.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	bindings := make([]activity.Binding, 0, len(projects))
	for _, p := range projects {
		if binding, ok := projectBinding(p); ok {
			bindings = append(bindings, binding)
		}
	}
	return bindings, nil
}

func projectBinding(p *project.Project) (activity.Binding, bool) {
	key, ok := activity.RepositoryKey(p.GithubURL())
	return activity.Binding{ProjectID: p.ID(), URL: p.GithubURL(), Key: key}, ok
}

func sourceKeys(bindings []activity.Binding) []string {
	seen := make(map[string]struct{}, len(bindings))
	keys := make([]string, 0, len(bindings))
	for _, b := range bindings {
		if _, found := seen[b.Key]; found {
			continue
		}
		seen[b.Key] = struct{}{}
		keys = append(keys, b.Key)
	}
	return keys
}

func aggregateHealth(sources map[string]activity.Source, sourceCount int, now time.Time, blocked bool) activity.Health {
	health := activity.Health{State: activity.StateReady}
	if len(sources) < sourceCount {
		health = sourceHealth(activity.Source{}, now, blocked)
	}
	for _, source := range sources {
		current := sourceHealth(source, now, blocked)
		if healthSeverity(current) > healthSeverity(health) {
			health.State, health.Reason = current.State, current.Reason
		}
		if current.LastSyncedAt != nil && (health.LastSyncedAt == nil || current.LastSyncedAt.After(*health.LastSyncedAt)) {
			health.LastSyncedAt = current.LastSyncedAt
		}
	}
	return health
}

func sourceHealth(source activity.Source, now time.Time, blocked bool) activity.Health {
	health := activity.Health{LastSyncedAt: source.SyncedAt}
	reason := source.Reason
	if source.Unavailable {
		health.State = activity.StateFailed
		reason = activity.ReasonFailed
	} else if source.Visible(now.Add(-keepFor)) {
		switch {
		case reason != "":
			health.State = activity.StateStale
		case source.SyncedAt == nil:
			health.State = activity.StateSyncing
		case source.SyncedAt.Before(now.Add(-freshFor)):
			health.State = activity.StateStale
			if blocked {
				reason = activity.ReasonLimited
			}
		default:
			health.State = activity.StateReady
		}
	} else {
		switch {
		case reason == activity.ReasonFailed:
			health.State = activity.StateFailed
		case reason == activity.ReasonLimited || blocked:
			health.State = activity.StateLimited
			reason = activity.ReasonLimited
		case source.DataAt != nil:
			health.State = activity.StateFailed
			reason = activity.ReasonFailed
		default:
			health.State = activity.StateSyncing
		}
	}
	if reason != "" {
		health.Reason = &reason
	}
	return health
}

func healthSeverity(health activity.Health) int {
	switch health.State {
	case activity.StateFailed:
		return 6
	case activity.StateLimited:
		return 5
	case activity.StateStale:
		if health.Reason == nil {
			return 2
		}
		if *health.Reason == activity.ReasonFailed {
			return 4
		}
		return 3
	case activity.StateSyncing:
		return 1
	default:
		return 0
	}
}
