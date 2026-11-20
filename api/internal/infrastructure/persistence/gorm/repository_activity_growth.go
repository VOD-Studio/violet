package gorm

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/datatypes"

	activity "blog-api/internal/domain/repositoryactivity"
)

func (r *RepositoryActivityRepository) Growth(ctx context.Context, bindings []activity.Binding, today string, cutoff time.Time) (activity.GrowthHistory, error) {
	history := activity.GrowthHistory{Weeks: []activity.GrowthWeek{}, Releases: []activity.Release{}}
	if len(bindings) == 0 {
		return history, nil
	}
	payload, err := activityBindingPayload(bindings)
	if err != nil {
		return history, err
	}
	var row struct {
		HistoryComplete bool
		FirstCommit     datatypes.JSON
		Weeks           datatypes.JSON
		Releases        datatypes.JSON
	}
	result := r.db.WithContext(ctx).Raw(repositoryActivityGrowth, payload, cutoff, cutoff, today).Scan(&row)
	if result.Error != nil || result.RowsAffected == 0 {
		return history, result.Error
	}
	history.HistoryComplete = row.HistoryComplete
	if row.HistoryComplete {
		if len(row.FirstCommit) > 0 {
			if err := json.Unmarshal(row.FirstCommit, &history.FirstCommit); err != nil {
				return history, fmt.Errorf("解析首次提交: %w", err)
			}
		}
		if err := json.Unmarshal(row.Weeks, &history.Weeks); err != nil {
			return history, fmt.Errorf("解析每周提交数: %w", err)
		}
	}
	if err := json.Unmarshal(row.Releases, &history.Releases); err != nil {
		return history, fmt.Errorf("解析公开版本: %w", err)
	}
	return history, nil
}

// DISTINCT 以仓库去重，不因多个公开项目指向同一仓库而重复计数。
// 完成标记和事件在同一条语句里读取，避免在切换分支时把部分回填读成完整历史。
const repositoryActivityGrowth = `
WITH source AS (
  SELECT DISTINCT s.repository_id,
         COALESCE((s.commits->>'swept_at')::timestamptz > TIMESTAMPTZ '0001-01-01T00:00:00Z'
              AND (s.releases->>'swept_at')::timestamptz > TIMESTAMPTZ '0001-01-01T00:00:00Z', false) AS history_complete
  ` + repositoryActivityVisibleBindings + `
), events AS NOT MATERIALIZED (
  SELECT e.kind, e.source_id, e.tag, e.title, e.url, e.occurred_at, e.activity_week
  FROM repository_activity_events e JOIN source USING (repository_id)
  WHERE e.activity_day <= CAST(? AS date)
)
SELECT history_complete,
       CASE WHEN history_complete THEN (
         SELECT jsonb_build_object('sha', source_id, 'title', title, 'url', url, 'occurred_at', occurred_at)
         FROM events WHERE kind = 'commit' ORDER BY occurred_at, source_id LIMIT 1
       ) END AS first_commit,
       CASE WHEN history_complete THEN COALESCE((
         SELECT jsonb_agg(jsonb_build_object('start', to_char(activity_week, 'YYYY-MM-DD'), 'commit_count', count)
                          ORDER BY activity_week)
         FROM (SELECT activity_week, count(*) FROM events WHERE kind = 'commit' GROUP BY activity_week) weeks
       ), '[]'::jsonb) END AS weeks,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object('tag', tag, 'title', title, 'url', url, 'occurred_at', occurred_at)
                          ORDER BY occurred_at DESC, source_id DESC)
         FROM events WHERE kind = 'release'
       ), '[]'::jsonb) AS releases
FROM source`
