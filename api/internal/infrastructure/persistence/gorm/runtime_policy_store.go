package gorm

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	domainsettings "blog-api/internal/domain/settings"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// RuntimePolicyStore 使用 site_settings 单行保存一个组的完整覆盖。
type RuntimePolicyStore struct{ db *gorm.DB }

func NewRuntimePolicyStore(db *gorm.DB) *RuntimePolicyStore { return &RuntimePolicyStore{db: db} }

func runtimeKey(group domainsettings.RuntimeGroup) string { return "runtime." + string(group) }

func (s *RuntimePolicyStore) Load(ctx context.Context, group domainsettings.RuntimeGroup) (domainsettings.RuntimeRecord, error) {
	var rows []SiteSetting
	if err := s.db.WithContext(ctx).Where("key = ?", runtimeKey(group)).Find(&rows).Error; err != nil {
		return domainsettings.RuntimeRecord{}, err
	}
	if len(rows) == 0 {
		return domainsettings.RuntimeRecord{Overrides: json.RawMessage(`{}`)}, nil
	}
	var record domainsettings.RuntimeRecord
	if err := json.Unmarshal([]byte(rows[0].Value), &record); err != nil {
		return record, fmt.Errorf("解析运行策略 %s: %w", group, err)
	}
	if record.Version == 0 || len(record.Overrides) == 0 {
		return record, fmt.Errorf("运行策略 %s 的持久化版本无效", group)
	}
	return record, nil
}

func (s *RuntimePolicyStore) CompareAndSwap(ctx context.Context, group domainsettings.RuntimeGroup, expected uint64, overrides json.RawMessage) (domainsettings.RuntimeRecord, error) {
	next := domainsettings.RuntimeRecord{Version: expected + 1, Overrides: overrides}
	if next.Version == 0 {
		return next, domainsettings.ErrRuntimeConflict
	}
	payload, err := json.Marshal(next)
	if err != nil {
		return next, err
	}
	row := SiteSetting{Key: runtimeKey(group), Value: string(payload), UpdatedAt: time.Now()}
	if expected == 0 {
		result := s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&row)
		if result.Error != nil {
			return next, result.Error
		}
		if result.RowsAffected != 1 {
			return next, domainsettings.ErrRuntimeConflict
		}
		return next, nil
	}
	result := s.db.WithContext(ctx).Model(&SiteSetting{}).Where("key = ? AND (value::jsonb ->> 'version')::bigint = ?", row.Key, expected).Updates(map[string]any{"value": row.Value, "updated_at": row.UpdatedAt})
	if result.Error != nil {
		return next, result.Error
	}
	if result.RowsAffected != 1 {
		return next, domainsettings.ErrRuntimeConflict
	}
	return next, nil
}

func (s *RuntimePolicyStore) LoadLegacyRunner(ctx context.Context) (map[string]string, error) {
	var rows []SiteSetting
	if err := s.db.WithContext(ctx).Where("key LIKE ?", "code_runner_%").Find(&rows).Error; err != nil {
		return nil, err
	}
	values := make(map[string]string, len(rows))
	for _, row := range rows {
		values[row.Key] = row.Value
	}
	return values, nil
}

func (s *RuntimePolicyStore) LoadEffective(ctx context.Context, group domainsettings.RuntimeGroup) (*domainsettings.RuntimeEffective, error) {
	var rows []SiteSetting
	if err := s.db.WithContext(ctx).Where("key = ?", "runtime.applied."+string(group)).Find(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	var effective domainsettings.RuntimeEffective
	if err := json.Unmarshal([]byte(rows[0].Value), &effective); err != nil {
		return nil, err
	}
	return &effective, nil
}

func (s *RuntimePolicyStore) SaveEffective(ctx context.Context, group domainsettings.RuntimeGroup, effective domainsettings.RuntimeEffective) error {
	payload, err := json.Marshal(effective)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Exec(`INSERT INTO site_settings (key,value,updated_at) VALUES (?,?,?)
 ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at
 WHERE (site_settings.value::jsonb ->> 'version')::bigint <= ?`,
		"runtime.applied."+string(group), string(payload), time.Now(), effective.Version).Error
}
