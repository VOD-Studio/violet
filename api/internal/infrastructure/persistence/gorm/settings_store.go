package gorm

import (
	"context"
	"database/sql"
	"time"

	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SiteSetting struct {
	Key       string    `gorm:"primaryKey;type:varchar(100)"`
	Value     string    `gorm:"type:text"`
	UpdatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`
}

func (SiteSetting) TableName() string { return "site_settings" }

type settingsGroupVersion struct {
	Group   string `gorm:"primaryKey;column:group_name"`
	Version int64
}

func (settingsGroupVersion) TableName() string { return "site_settings_groups" }

type SettingsStore struct{ db *gorm.DB }

func NewSettingsStore(db *gorm.DB) *SettingsStore { return &SettingsStore{db: db} }

func (s *SettingsStore) LoadValues(ctx context.Context) (map[string]string, error) {
	var rows []SiteSetting
	if err := s.db.WithContext(ctx).Find(&rows).Error; err != nil {
		return nil, err
	}
	values := make(map[string]string, len(rows))
	for _, row := range rows {
		values[row.Key] = row.Value
	}
	return values, nil
}

func (s *SettingsStore) ReadGroup(ctx context.Context, group domainsettings.Group) (domainsettings.GroupRecord, error) {
	var result domainsettings.GroupRecord
	if len(group.Keys()) == 0 {
		return result, shared.BadRequest("未知配置组")
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var version settingsGroupVersion
		if err := tx.Where("group_name = ?", string(group)).First(&version).Error; err != nil {
			return err
		}
		values, err := readSettingValues(tx, group.Keys())
		result = domainsettings.GroupRecord{Version: version.Version, Values: values}
		return err
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	return result, err
}

func (s *SettingsStore) ChangeGroup(ctx context.Context, group domainsettings.Group, expected int64, change func(map[string]string) (map[string]string, error)) (domainsettings.GroupRecord, error) {
	var result domainsettings.GroupRecord
	keys := group.Keys()
	if len(keys) == 0 || expected < 0 {
		return result, shared.BadRequest("无效配置组或版本")
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var version settingsGroupVersion
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("group_name = ?", string(group)).First(&version).Error; err != nil {
			return err
		}
		if version.Version != expected {
			return domainsettings.ErrVersionConflict
		}
		values, err := readSettingValues(tx, keys)
		if err != nil {
			return err
		}
		values, err = change(values)
		if err != nil {
			return err
		}
		allowed := make(map[string]bool, len(keys))
		for _, key := range keys {
			allowed[key] = true
		}
		for key := range values {
			if !allowed[key] {
				return shared.BadRequest("字段不属于当前配置组")
			}
		}
		if err := tx.Where("key IN ?", keys).Delete(&SiteSetting{}).Error; err != nil {
			return err
		}
		now := time.Now()
		for key, value := range values {
			if err := tx.Create(&SiteSetting{Key: key, Value: value, UpdatedAt: now}).Error; err != nil {
				return err
			}
		}
		version.Version++
		if err := tx.Save(&version).Error; err != nil {
			return err
		}
		result = domainsettings.GroupRecord{Version: version.Version, Values: values}
		return nil
	})
	return result, err
}

func readSettingValues(db *gorm.DB, keys []string) (map[string]string, error) {
	var rows []SiteSetting
	if err := db.Where("key IN ?", keys).Find(&rows).Error; err != nil {
		return nil, err
	}
	values := make(map[string]string, len(rows))
	for _, row := range rows {
		values[row.Key] = row.Value
	}
	return values, nil
}
