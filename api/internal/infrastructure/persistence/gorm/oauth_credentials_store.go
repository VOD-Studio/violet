package gorm

import (
	"context"
	"time"

	"blog-api/internal/application/auth/command"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// OAuthCredential PO：oauth_credentials 单行表（id 恒为 1）。
type OAuthCredential struct {
	ID                 int16     `gorm:"primaryKey"`
	GoogleClientID     string    `gorm:"type:text;not null;default:''"`
	GithubClientID     string    `gorm:"type:text;not null;default:''"`
	GithubClientSecret string    `gorm:"type:text;not null;default:''"`
	UpdatedAt          time.Time `gorm:"not null;default:now()"`
}

func (OAuthCredential) TableName() string { return "oauth_credentials" }

// OAuthCredentialsStore OAuth 凭据的 DB 存取（后台保存即持久，不依赖文件系统）。
type OAuthCredentialsStore struct{ db *gorm.DB }

func NewOAuthCredentialsStore(db *gorm.DB) *OAuthCredentialsStore {
	return &OAuthCredentialsStore{db: db}
}

// Load 读取凭据行；表为空（从未后台保存）返回零值。
func (s *OAuthCredentialsStore) Load(ctx context.Context) (command.OAuthCredentialsRecord, error) {
	var row OAuthCredential
	err := s.db.WithContext(ctx).First(&row, "id = ?", 1).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return command.OAuthCredentialsRecord{}, nil
		}
		return command.OAuthCredentialsRecord{}, err
	}
	return command.OAuthCredentialsRecord{
		GoogleClientID:     row.GoogleClientID,
		GithubClientID:     row.GithubClientID,
		GithubClientSecret: row.GithubClientSecret,
	}, nil
}

// Save upsert 凭据行（整行覆盖，空串=显式清空该字段）。
func (s *OAuthCredentialsStore) Save(ctx context.Context, rec command.OAuthCredentialsRecord) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"google_client_id", "github_client_id", "github_client_secret", "updated_at"}),
	}).Create(&OAuthCredential{
		ID: 1, GoogleClientID: rec.GoogleClientID, GithubClientID: rec.GithubClientID,
		GithubClientSecret: rec.GithubClientSecret, UpdatedAt: time.Now(),
	}).Error
}
