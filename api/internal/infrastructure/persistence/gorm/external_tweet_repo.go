package gorm

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/tweet"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

type ExternalTweetRepository struct{ db *gorm.DB }

func NewExternalTweetRepository(db *gorm.DB) *ExternalTweetRepository {
	return &ExternalTweetRepository{db: db}
}

var _ tweet.ExternalRepository = (*ExternalTweetRepository)(nil)

func (r *ExternalTweetRepository) Ensure(ctx context.Context, sourceID string, until time.Time) (*tweet.ExternalTweet, error) {
	po := model.ExternalTweet{
		ID: uuid.New(), Platform: "x", SourceID: sourceID,
		CanonicalURL: tweet.XCanonicalURL(sourceID, ""), Availability: tweet.ExternalUnavailable,
		ProtectedUntil: until, LastCheckedAt: time.Now().UTC(),
	}
	err := r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "platform"}, {Name: "source_id"}},
		DoUpdates: clause.Assignments(map[string]any{
			"protected_until": gorm.Expr("CASE WHEN external_tweets.protected_until < ? THEN ? ELSE external_tweets.protected_until END", until, until),
		}),
	}).Create(&po).Error
	if err != nil {
		return nil, shared.Internal("准备 X 原文记录失败", err)
	}
	po = model.ExternalTweet{}
	if err := r.db.WithContext(ctx).Where("platform = ? AND source_id = ?", "x", sourceID).First(&po).Error; err != nil {
		return nil, shared.Internal("查询 X 原文记录失败", err)
	}
	return externalToDomain(po)
}

func (r *ExternalTweetRepository) FindByID(ctx context.Context, id shared.ID) (*tweet.ExternalTweet, error) {
	var po model.ExternalTweet
	if err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, shared.NotFound("X 原文")
		}
		return nil, shared.Internal("查询 X 原文失败", err)
	}
	return externalToDomain(po)
}

func (r *ExternalTweetRepository) FindByIDs(ctx context.Context, ids []shared.ID) ([]*tweet.ExternalTweet, error) {
	if len(ids) == 0 {
		return []*tweet.ExternalTweet{}, nil
	}
	uuids := make([]uuid.UUID, len(ids))
	for i, id := range ids {
		uuids[i] = id.UUID()
	}
	var pos []model.ExternalTweet
	if err := r.db.WithContext(ctx).Where("id IN ?", uuids).Find(&pos).Error; err != nil {
		return nil, shared.Internal("批量查询 X 原文失败", err)
	}
	return externalRows(pos)
}

func (r *ExternalTweetRepository) SaveSnapshot(ctx context.Context, t *tweet.ExternalTweet, expected string) (bool, error) {
	data, err := json.Marshal(t.Snapshot)
	if err != nil {
		return false, shared.Internal("序列化 X 原文失败", err)
	}
	var quotedID *uuid.UUID
	if t.QuotedID != nil {
		id := t.QuotedID.UUID()
		quotedID = &id
	}
	res := r.db.WithContext(ctx).Model(&model.ExternalTweet{}).
		Where("id = ? AND snapshot_version = ? AND taken_down = false", t.ID.UUID(), expected).
		Updates(map[string]any{
			"snapshot": datatypes.JSON(data), "canonical_url": t.CanonicalURL,
			"quoted_external_tweet_id": quotedID, "fetch_source": t.FetchSource,
			"snapshot_version": t.Version, "fingerprint": t.Fingerprint,
			"availability": t.Availability, "fetched_at": t.FetchedAt,
			"last_checked_at": t.LastCheckedAt, "last_error": "",
		})
	if res.Error != nil {
		return false, shared.Internal("更新 X 原文失败", res.Error)
	}
	return res.RowsAffected == 1, nil
}

func (r *ExternalTweetRepository) RecordFailure(ctx context.Context, id shared.ID, reason string, now time.Time) error {
	return r.db.WithContext(ctx).Model(&model.ExternalTweet{}).Where("id = ?", id.UUID()).
		Updates(map[string]any{"last_checked_at": now, "last_error": reason}).Error
}

func (r *ExternalTweetRepository) Withdraw(ctx context.Context, id shared.ID, availability string, now time.Time) error {
	return r.db.WithContext(ctx).Model(&model.ExternalTweet{}).Where("id = ?", id.UUID()).
		Updates(map[string]any{
			"snapshot": nil, "quoted_external_tweet_id": nil, "fingerprint": "",
			"snapshot_version": uuid.NewString(), "availability": availability,
			"last_checked_at": now, "last_error": availability,
			"taken_down": true,
		}).Error
}

func (r *ExternalTweetRepository) Protect(ctx context.Context, ids []shared.ID, until time.Time) error {
	uuids := make([]uuid.UUID, len(ids))
	for i, id := range ids {
		uuids[i] = id.UUID()
	}
	res := r.db.WithContext(ctx).Model(&model.ExternalTweet{}).Where("id IN ?", uuids).
		Update("protected_until", gorm.Expr("CASE WHEN protected_until < ? THEN ? ELSE protected_until END", until, until))
	if res.Error != nil {
		return shared.Internal("保留 X 预览资源失败", res.Error)
	}
	if res.RowsAffected != int64(len(ids)) {
		return shared.Conflict("原文记录已变化，请重新预览")
	}
	return nil
}

func (r *ExternalTweetRepository) FindDue(ctx context.Context, before time.Time, limit int) ([]*tweet.ExternalTweet, error) {
	var pos []model.ExternalTweet
	err := r.db.WithContext(ctx).Where("taken_down = false AND last_checked_at < ?", before).
		Where("EXISTS (SELECT 1 FROM tweets WHERE tweets.external_tweet_id = external_tweets.id) OR EXISTS (SELECT 1 FROM external_tweets AS parent WHERE parent.quoted_external_tweet_id = external_tweets.id)").
		Order("last_checked_at, id").Limit(limit).Find(&pos).Error
	if err != nil {
		return nil, shared.Internal("查询待刷新 X 原文失败", err)
	}
	return externalRows(pos)
}

func (r *ExternalTweetRepository) FindUnused(ctx context.Context, before time.Time, limit int) ([]*tweet.ExternalTweet, error) {
	var pos []model.ExternalTweet
	err := r.db.WithContext(ctx).Where("taken_down = false AND protected_until < ?", before).
		Where("NOT EXISTS (SELECT 1 FROM tweets WHERE tweets.external_tweet_id = external_tweets.id)").
		Where("NOT EXISTS (SELECT 1 FROM external_tweets AS parent WHERE parent.quoted_external_tweet_id = external_tweets.id)").
		Order("protected_until, id").Limit(limit).Find(&pos).Error
	if err != nil {
		return nil, shared.Internal("查询孤立 X 原文失败", err)
	}
	return externalRows(pos)
}

func (r *ExternalTweetRepository) DeleteUnused(ctx context.Context, id shared.ID, before time.Time) (bool, error) {
	deleted := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var po model.ExternalTweet
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&po, "id = ?", id.UUID()).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if po.TakenDown || !po.ProtectedUntil.Before(before) {
			return nil
		}
		var count int64
		if err := tx.Model(&model.Tweet{}).Where("external_tweet_id = ?", id.UUID()).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return nil
		}
		if err := tx.Model(&model.ExternalTweet{}).Where("quoted_external_tweet_id = ?", id.UUID()).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return nil
		}
		if err := tx.Delete(&po).Error; err != nil {
			return err
		}
		deleted = true
		return nil
	})
	return deleted, err
}

func externalRows(pos []model.ExternalTweet) ([]*tweet.ExternalTweet, error) {
	result := make([]*tweet.ExternalTweet, 0, len(pos))
	for _, po := range pos {
		t, err := externalToDomain(po)
		if err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, nil
}

func (r *ExternalTweetRepository) AssetVersions(ctx context.Context) (map[string]string, error) {
	var rows []struct {
		ID              uuid.UUID
		SnapshotVersion string
	}
	if err := r.db.WithContext(ctx).Model(&model.ExternalTweet{}).Select("id, snapshot_version").Where("availability = ? AND taken_down = false", tweet.ExternalAvailable).Find(&rows).Error; err != nil {
		return nil, err
	}
	versions := make(map[string]string, len(rows))
	for _, row := range rows {
		versions[row.ID.String()] = row.SnapshotVersion
	}
	return versions, nil
}

func externalToDomain(po model.ExternalTweet) (*tweet.ExternalTweet, error) {
	t := &tweet.ExternalTweet{
		ID: shared.IDFromUUID(po.ID), SourceID: po.SourceID, CanonicalURL: po.CanonicalURL,
		FetchSource: po.FetchSource, Version: po.SnapshotVersion, Fingerprint: po.Fingerprint,
		Availability: po.Availability, LastCheckedAt: po.LastCheckedAt, LastError: po.LastError,
		ProtectedUntil: po.ProtectedUntil, TakenDown: po.TakenDown,
	}
	if po.FetchedAt != nil {
		t.FetchedAt = *po.FetchedAt
	}
	if po.QuotedExternalTweetID != nil {
		id := shared.IDFromUUID(*po.QuotedExternalTweetID)
		t.QuotedID = &id
	}
	if len(po.Snapshot) > 0 && string(po.Snapshot) != "null" {
		if err := json.Unmarshal(po.Snapshot, &t.Snapshot); err != nil {
			return nil, shared.Internal("读取 X 原文快照失败", err)
		}
	}
	return t, nil
}
