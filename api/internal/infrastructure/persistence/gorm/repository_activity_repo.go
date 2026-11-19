package gorm

import (
	"context"
	"errors"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	activity "blog-api/internal/domain/repositoryactivity"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

type RepositoryActivityRepository struct {
	db *gorm.DB
}

func NewRepositoryActivityRepository(db *gorm.DB) *RepositoryActivityRepository {
	return &RepositoryActivityRepository{db: db}
}

func (r *RepositoryActivityRepository) Sources(ctx context.Context, keys []string) (map[string]activity.Source, error) {
	var rows []model.RepositoryActivitySource
	if err := r.db.WithContext(ctx).Where("key IN ?", keys).Find(&rows).Error; err != nil {
		return nil, err
	}
	sources := make(map[string]activity.Source, len(rows))
	for _, row := range rows {
		sources[row.Key] = activity.Source{
			Key: row.Key, RepositoryID: row.RepositoryID, DefaultBranch: row.DefaultBranch,
			Unavailable: row.Unavailable, AttemptedAt: row.AttemptedAt, VerifiedAt: row.VerifiedAt,
			DataAt: row.DataAt, SyncedAt: row.SyncedAt, Reason: row.Reason, RetryAt: row.RetryAt,
			Commits: row.Commits.Data(), Releases: row.Releases.Data(),
		}
	}
	return sources, nil
}

func (r *RepositoryActivityRepository) BlockedUntil(ctx context.Context, now time.Time) (*time.Time, error) {
	var row model.RepositoryActivitySource
	err := r.db.WithContext(ctx).Select("retry_at").Where("reason = 'limited' AND retry_at > ?", now).
		Order("retry_at DESC").Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return row.RetryAt, err
}

func (r *RepositoryActivityRepository) Save(ctx context.Context, state activity.Source, change activity.Change) error {
	row := model.RepositoryActivitySource{
		Key: state.Key, RepositoryID: state.RepositoryID, DefaultBranch: state.DefaultBranch,
		Unavailable: state.Unavailable, AttemptedAt: state.AttemptedAt, VerifiedAt: state.VerifiedAt,
		DataAt: state.DataAt, SyncedAt: state.SyncedAt, Reason: state.Reason, RetryAt: state.RetryAt,
		Commits: datatypes.NewJSONType(state.Commits), Releases: datatypes.NewJSONType(state.Releases),
	}
	db := r.db.WithContext(ctx)
	if !change.DropCommits && len(change.Events) == 0 && change.ReconciledKind == "" {
		return upsertActivitySource(db, &row).Error
	}
	return db.Transaction(func(tx *gorm.DB) error {
		result := upsertActivitySource(tx, &row)
		if result.Error != nil || result.RowsAffected == 0 {
			return result.Error
		}
		if change.DropCommits {
			if err := tx.Where("repository_id = ? AND kind = ?", state.RepositoryID, activity.KindCommit).
				Delete(&model.RepositoryActivityEvent{}).Error; err != nil {
				return err
			}
		}
		if len(change.Events) > 0 {
			if err := upsertActivityEvents(tx, state.RepositoryID, change.Events, change.SeenAt); err != nil {
				return err
			}
		}
		if change.ReconciledKind != "" {
			return tx.Where("repository_id = ? AND kind = ? AND seen_at < ?", state.RepositoryID, change.ReconciledKind, change.SeenAt).
				Delete(&model.RepositoryActivityEvent{}).Error
		}
		return nil
	})
}

func upsertActivitySource(db *gorm.DB, row *model.RepositoryActivitySource) *gorm.DB {
	return db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		UpdateAll: true,
		// 其他实例上更晚开始的同步轮次已作出可见性判断时，不允许覆盖。
		Where: clause.Where{Exprs: []clause.Expression{clause.Expr{SQL: "repository_activity_sources.attempted_at <= EXCLUDED.attempted_at"}}},
	}).Create(row)
}

func upsertActivityEvents(db *gorm.DB, repositoryID int64, events []activity.Event, seenAt time.Time) error {
	type identity struct{ kind, id string }
	seen := make(map[identity]struct{}, len(events))
	rows := make([]model.RepositoryActivityEvent, 0, len(events))
	for _, event := range events {
		key := identity{event.Kind, event.ID}
		if _, duplicate := seen[key]; duplicate {
			continue
		}
		seen[key] = struct{}{}
		rows = append(rows, model.RepositoryActivityEvent{
			RepositoryID: repositoryID, Kind: event.Kind, SourceID: event.ID,
			Tag: event.Tag, Title: event.Title, URL: event.URL, OccurredAt: event.OccurredAt,
			SeenAt: seenAt,
		})
	}
	return db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "repository_id"}, {Name: "kind"}, {Name: "source_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"tag", "title", "url", "occurred_at", "seen_at"}),
		Where: clause.Where{Exprs: []clause.Expression{clause.Expr{SQL: `
			(repository_activity_events.tag, repository_activity_events.title, repository_activity_events.url,
			 repository_activity_events.occurred_at, repository_activity_events.seen_at)
			IS DISTINCT FROM (EXCLUDED.tag, EXCLUDED.title, EXCLUDED.url, EXCLUDED.occurred_at, EXCLUDED.seen_at)`}}},
	}).Create(&rows).Error
}

var _ activity.Repository = (*RepositoryActivityRepository)(nil)
