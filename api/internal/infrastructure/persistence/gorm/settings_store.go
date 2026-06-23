// Package gorm 提供 settings 模块的 GORM 存储实现。
package gorm

import (
	"context"
	"time"

	"gorm.io/gorm"
)

// SiteSetting 站点配置 PO（key-value 表）
type SiteSetting struct {
	Key       string    `gorm:"primaryKey;type:varchar(100)" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	UpdatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (SiteSetting) TableName() string { return "site_settings" }

// SettingsStore 实现领域 SettingsStore 端口
type SettingsStore struct{ db *gorm.DB }

// NewSettingsStore 创建配置存储
func NewSettingsStore(db *gorm.DB) *SettingsStore {
	return &SettingsStore{db: db}
}

// GetAll 读取全部配置键值对
func (s *SettingsStore) GetAll(ctx context.Context) (map[string]string, error) {
	var rows []SiteSetting
	if err := s.db.WithContext(ctx).Find(&rows).Error; err != nil {
		return nil, err
	}
	m := make(map[string]string, len(rows))
	for _, r := range rows {
		m[r.Key] = r.Value
	}
	return m, nil
}

// Upsert 写入或更新单个配置
func (s *SettingsStore) Upsert(ctx context.Context, key, value string) error {
	row := SiteSetting{Key: key, Value: value, UpdatedAt: time.Now()}
	return s.db.WithContext(ctx).Save(&row).Error
}

// UpsertMany 批量写入或更新多个配置（单事务，原子）
// 替代应用层逐键 Upsert 的循环，避免中途失败导致配置部分更新。
func (s *SettingsStore) UpsertMany(ctx context.Context, kvs map[string]string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		for k, v := range kvs {
			row := SiteSetting{Key: k, Value: v, UpdatedAt: now}
			if err := tx.Save(&row).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
