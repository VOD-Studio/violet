package repositoryactivity

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	activity "blog-api/internal/domain/repositoryactivity"
)

const sweepInterval = 24 * time.Hour

// Sync 每轮只刷新一次当前仓库，保存分页进度供下轮继续。
func (s *Service) Sync(ctx context.Context) error {
	if !s.syncMu.TryLock() {
		return nil
	}
	defer s.syncMu.Unlock()

	bindings, err := s.bindings(ctx, nil)
	if err != nil || len(bindings) == 0 {
		return err
	}
	till, err := s.storage.BlockedUntil(ctx, s.now())
	if err != nil || till != nil {
		return err
	}
	keys := sourceKeys(bindings)
	sources, err := s.storage.Sources(ctx, keys)
	if err != nil {
		return err
	}
	sort.SliceStable(keys, func(i, j int) bool {
		return sources[keys[i]].AttemptedAt.Before(sources[keys[j]].AttemptedAt)
	})

	var failures error
	for _, key := range keys {
		state := sources[key]
		state.Key = key
		state.AttemptedAt = s.now()
		upstream, storeErr := s.refresh(ctx, &state)
		if storeErr != nil {
			return errors.Join(failures, fmt.Errorf("保存仓库 %s 的进展: %w", key, storeErr))
		}
		if upstream == nil {
			continue
		}
		if ctx.Err() != nil {
			return errors.Join(failures, ctx.Err())
		}
		limited, err := s.recordFailure(ctx, state, upstream)
		if err != nil {
			return errors.Join(failures, fmt.Errorf("记录仓库 %s 的同步失败: %w", key, err))
		}
		if !errors.Is(upstream, activity.ErrUnavailable) {
			failures = errors.Join(failures, fmt.Errorf("同步仓库 %s 的进展: %w", key, upstream))
		}
		if limited {
			break
		}
	}
	return failures
}

// refresh 只有上游失败才改变源状态，数据库错误直接返回。
func (s *Service) refresh(ctx context.Context, state *activity.Source) (upstream, storage error) {
	remote, err := s.provider.Inspect(ctx, state.Key)
	if err != nil {
		return err, nil
	}
	dropCommits := false
	if state.RepositoryID != remote.ID {
		*state = activity.Source{Key: state.Key, RepositoryID: remote.ID, AttemptedAt: state.AttemptedAt}
	} else if state.DefaultBranch != remote.DefaultBranch {
		state.Commits = activity.Stream{}
		dropCommits = true
	}
	state.DefaultBranch = remote.DefaultBranch
	verifiedAt := s.now()
	state.VerifiedAt = &verifiedAt
	state.Unavailable = false
	if err := s.storage.Save(ctx, *state, activity.Change{DropCommits: dropCommits}); err != nil {
		return nil, err
	}

	// 先写入两种最新活动，再续查各自的历史。
	if upstream, storage := s.refreshPage(ctx, state, remote, activity.KindCommit, false); upstream != nil || storage != nil {
		return upstream, storage
	}
	if upstream, storage := s.refreshPage(ctx, state, remote, activity.KindRelease, false); upstream != nil || storage != nil {
		return upstream, storage
	}
	if upstream, storage := s.refreshPage(ctx, state, remote, activity.KindCommit, true); upstream != nil || storage != nil {
		return upstream, storage
	}
	if upstream, storage := s.refreshPage(ctx, state, remote, activity.KindRelease, true); upstream != nil || storage != nil {
		return upstream, storage
	}

	syncedAt := s.now()
	state.SyncedAt = &syncedAt
	state.Reason, state.RetryAt = "", nil
	return nil, s.storage.Save(ctx, *state, activity.Change{})
}

func (s *Service) refreshPage(ctx context.Context, state *activity.Source, remote activity.Remote, kind string, history bool) (upstream, storage error) {
	stream := &state.Releases
	ref := ""
	if kind == activity.KindCommit {
		stream = &state.Commits
		ref = remote.DefaultBranch
	}
	page := 1
	if history {
		if stream.BackfillPage == 0 {
			return nil, nil
		}
		page, ref = stream.BackfillPage, stream.BackfillAnchor
	} else if stream.NextPage > 0 {
		page, ref = stream.NextPage, stream.PendingHead
	}

	var result activity.Page
	var err error
	if kind == activity.KindCommit {
		result, err = s.provider.Commits(ctx, remote, ref, page)
	} else {
		result, err = s.provider.Releases(ctx, remote, page)
	}
	if err != nil {
		return err, nil
	}
	completed := false
	if history {
		if result.HasNext {
			stream.BackfillPage++
		} else {
			stream.BackfillPage, stream.BackfillAnchor = 0, ""
			completed = true
		}
	} else {
		advanceHead(stream, result)
		if page == 1 && stream.BackfillPage == 0 && (stream.SweptAt.IsZero() || state.AttemptedAt.Sub(stream.SweptAt) >= sweepInterval) {
			// 完整对账补齐增量头部扫描遗漏的活动，例如合并引入的更早提交。
			stream.SweepStartedAt = state.AttemptedAt
			if result.HasNext {
				stream.BackfillPage = 2
				if kind == activity.KindCommit && len(result.Events) > 0 {
					stream.BackfillAnchor = result.Events[0].ID
				}
			} else {
				completed = true
			}
		}
	}
	if state.DataAt == nil {
		dataAt := s.now()
		state.DataAt = &dataAt
	}
	change := activity.Change{Events: result.Events, SeenAt: stream.SweepStartedAt}
	if completed {
		stream.SweptAt = state.AttemptedAt
		change.ReconciledKind = kind
	}
	return nil, s.storage.Save(ctx, *state, change)
}

func advanceHead(stream *activity.Stream, result activity.Page) {
	if !stream.Initialized {
		stream.Initialized = true
		if len(result.Events) > 0 {
			stream.Head = result.Events[0].ID
		}
		return
	}
	if stream.NextPage == 0 {
		if len(result.Events) == 0 || result.Events[0].ID == stream.Head {
			return
		}
		stream.PendingHead = result.Events[0].ID
		stream.NextPage = 1
	}
	if result.HasNext {
		found := false
		for _, event := range result.Events {
			if event.ID == stream.Head {
				found = true
				break
			}
		}
		if !found {
			stream.NextPage++
			return
		}
	}
	stream.Head, stream.PendingHead, stream.NextPage = stream.PendingHead, "", 0
}

func (s *Service) recordFailure(ctx context.Context, state activity.Source, failure error) (bool, error) {
	var rate *activity.RateLimitError
	limited := errors.As(failure, &rate)
	switch {
	case errors.Is(failure, activity.ErrUnavailable):
		state = activity.Source{Key: state.Key, AttemptedAt: state.AttemptedAt, Unavailable: true, Reason: activity.ReasonFailed}
	case limited:
		retryAt := rate.RetryAt
		if now := s.now(); !retryAt.After(now) {
			retryAt = now.Add(time.Minute)
		}
		state.Reason, state.RetryAt = activity.ReasonLimited, &retryAt
	default:
		state.Reason, state.RetryAt = activity.ReasonFailed, nil
	}
	return limited, s.storage.Save(ctx, state, activity.Change{})
}
