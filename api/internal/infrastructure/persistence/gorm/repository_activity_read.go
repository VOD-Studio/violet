package gorm

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"

	activity "blog-api/internal/domain/repositoryactivity"
)

const dayCommitPreview = 6

func (r *RepositoryActivityRepository) Browse(ctx context.Context, bindings []activity.Binding, before *activity.Cursor, limit int, cutoff time.Time) ([]activity.Day, error) {
	return r.activityDays(ctx, bindings, before, "", limit, dayCommitPreview, cutoff)
}

func (r *RepositoryActivityRepository) GetDay(ctx context.Context, binding activity.Binding, day string, cutoff time.Time) (activity.Day, error) {
	days, err := r.activityDays(ctx, []activity.Binding{binding}, nil, day, 1, math.MaxInt64, cutoff)
	if err != nil {
		return activity.Day{}, err
	}
	if len(days) == 0 {
		return activity.Day{}, activity.ErrNotFound
	}
	return days[0], nil
}

type activityBindingRow struct {
	ProjectID uuid.UUID `json:"project_id"`
	GithubURL string    `json:"github_url"`
	Key       string    `json:"key"`
}

type activityDayRow struct {
	Day          string
	ProjectID    uuid.UUID
	ProjectTitle string
	ProjectSlug  string
	FirstAt      time.Time
	LastAt       time.Time
	CommitCount  int
	ReleaseCount int
	Commits      datatypes.JSON
	Releases     datatypes.JSON
}

func (r *RepositoryActivityRepository) activityDays(ctx context.Context, bindings []activity.Binding, before *activity.Cursor, day string, limit int, commitLimit int64, cutoff time.Time) ([]activity.Day, error) {
	if len(bindings) == 0 || limit <= 0 {
		return []activity.Day{}, nil
	}
	bound := make([]activityBindingRow, len(bindings))
	for i, binding := range bindings {
		bound[i] = activityBindingRow{ProjectID: binding.ProjectID.UUID(), GithubURL: binding.URL, Key: binding.Key}
	}
	payload, err := json.Marshal(bound)
	if err != nil {
		return nil, err
	}
	args := make([]any, 1, 8)
	args[0] = string(payload)
	predicate := ""
	switch {
	case day != "":
		predicate = "AND e.activity_day = CAST(? AS date)"
		args = append(args, day)
	case before != nil && before.ProjectID.IsZero():
		predicate = "AND e.activity_day < CAST(? AS date)"
		args = append(args, before.Day)
	case before != nil:
		// 按项目 UUID 将二元游标还原为可走索引的日期范围。
		predicate = "AND e.activity_day <= CAST(? AS date) - CASE WHEN p.id >= CAST(? AS uuid) THEN 1 ELSE 0 END"
		args = append(args, before.Day, before.ProjectID.UUID())
	}
	args = append(args, limit, cutoff, cutoff, limit, commitLimit)
	var rows []activityDayRow
	if err := r.db.WithContext(ctx).Raw(repositoryActivityDaysHead+predicate+repositoryActivityDaysTail, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	days := make([]activity.Day, len(rows))
	for i, row := range rows {
		result := &days[i]
		*result = activity.Day{
			Day: row.Day, Project: activity.Project{ID: row.ProjectID.String(), Title: row.ProjectTitle, Slug: row.ProjectSlug},
			FirstAt: row.FirstAt.In(activity.Location), LastAt: row.LastAt.In(activity.Location),
			CommitCount: row.CommitCount, ReleaseCount: row.ReleaseCount,
		}
		if err := json.Unmarshal(row.Commits, &result.Commits); err != nil {
			return nil, fmt.Errorf("解析每日提交: %w", err)
		}
		if err := json.Unmarshal(row.Releases, &result.Releases); err != nil {
			return nil, fmt.Errorf("解析每日发布: %w", err)
		}
		if len(result.Releases) > 0 && (len(result.Commits) == 0 || result.Releases[0].OccurredAt.After(result.Commits[0].OccurredAt)) {
			result.Summary = result.Releases[0].Title
		} else if len(result.Commits) > 0 {
			result.Summary = result.Commits[0].Title
		}
	}
	return days, nil
}

// 先选所需项目与日期，再聚合活动。重查在同一快照中的项目链接以拒绝过期映射。
const repositoryActivityDaysHead = `
WITH selected_days AS (
  SELECT p.id AS project_id, p.title AS project_title, p.slug AS project_slug, s.repository_id, d.activity_day
  FROM jsonb_to_recordset(CAST(? AS jsonb)) AS b(project_id uuid, github_url text, key text)
  JOIN projects p ON p.id = b.project_id AND p.github_url = b.github_url
  JOIN repository_activity_sources s ON s.key = b.key
  CROSS JOIN LATERAL (
    SELECT DISTINCT e.activity_day
    FROM repository_activity_events e
    WHERE e.repository_id = s.repository_id `

const repositoryActivityDaysTail = `
    ORDER BY e.activity_day DESC
    LIMIT ?
  ) d
  WHERE NOT s.unavailable AND s.verified_at >= ? AND COALESCE(s.synced_at, s.data_at) >= ?
  ORDER BY d.activity_day DESC, p.id DESC
  LIMIT ?
)
SELECT to_char(d.activity_day, 'YYYY-MM-DD') AS day, d.project_id, d.project_title, d.project_slug,
       a.first_at, a.last_at, a.commit_count, a.release_count, a.commits, a.releases
FROM selected_days d
CROSS JOIN LATERAL (
  SELECT min(e.occurred_at) AS first_at, max(e.occurred_at) AS last_at,
         count(*) FILTER (WHERE e.kind = 'commit') AS commit_count,
         count(*) FILTER (WHERE e.kind = 'release') AS release_count,
         COALESCE(jsonb_agg(jsonb_build_object('sha', e.source_id, 'title', e.title, 'url', e.url, 'occurred_at', e.occurred_at)
           ORDER BY e.kind_rank) FILTER (WHERE e.kind = 'commit' AND e.kind_rank <= ?), '[]'::jsonb) AS commits,
         COALESCE(jsonb_agg(jsonb_build_object('tag', e.tag, 'title', e.title, 'url', e.url, 'occurred_at', e.occurred_at)
           ORDER BY e.kind_rank) FILTER (WHERE e.kind = 'release'), '[]'::jsonb) AS releases
  FROM (
    SELECT e.kind, e.source_id, e.tag, e.title, e.url, e.occurred_at,
           row_number() OVER (PARTITION BY e.kind ORDER BY e.occurred_at DESC, e.source_id DESC) AS kind_rank
    FROM repository_activity_events e
    WHERE e.repository_id = d.repository_id AND e.activity_day = d.activity_day
  ) e
) a
ORDER BY d.activity_day DESC, d.project_id DESC`
