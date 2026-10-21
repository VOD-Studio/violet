package gorm

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
)

type MusicRepository struct{ db *gorm.DB }

func NewMusicRepository(db *gorm.DB) *MusicRepository { return &MusicRepository{db: db} }

type musicAccountRow struct {
	ID                                           int
	Generation                                   int64
	SealedCookie, ProfileID, Nickname, AvatarURL string
	Expired                                      bool
}

func (musicAccountRow) TableName() string { return "music_account" }
func (r musicAccountRow) credential() music.Credential {
	return music.Credential{Generation: r.Generation, SealedCookie: r.SealedCookie, Profile: music.Profile{ID: r.ProfileID, Nickname: r.Nickname, AvatarURL: r.AvatarURL}, Expired: r.Expired}
}
func lockMusicAccount(tx *gorm.DB) (musicAccountRow, error) {
	var row musicAccountRow
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, "id = ?", 1).Error
	return row, err
}
func credentialValues(c music.Credential, generation int64) map[string]any {
	return map[string]any{"generation": generation, "sealed_cookie": c.SealedCookie, "profile_id": c.Profile.ID, "nickname": c.Profile.Nickname, "avatar_url": c.Profile.AvatarURL, "expired": c.Expired}
}
func (r *MusicRepository) Credential(ctx context.Context) (music.Credential, error) {
	var row musicAccountRow
	err := r.db.WithContext(ctx).First(&row, "id = ?", 1).Error
	return row.credential(), err
}
func (r *MusicRepository) ReplaceCredential(ctx context.Context, generation int64, c music.Credential) (bool, error) {
	result := r.db.WithContext(ctx).Model(&musicAccountRow{}).Where("id = 1 AND generation = ?", generation).Updates(credentialValues(c, generation+1))
	return result.RowsAffected == 1, result.Error
}
func (r *MusicRepository) ClearCredential(ctx context.Context) (music.Credential, error) {
	var old music.Credential
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		row, err := lockMusicAccount(tx)
		if err != nil {
			return err
		}
		old = row.credential()
		return tx.Model(&musicAccountRow{}).Where("id = 1").Updates(credentialValues(music.Credential{}, row.Generation+1)).Error
	})
	return old, err
}
func (r *MusicRepository) CreateChallenge(ctx context.Context, c music.Challenge) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		row, err := lockMusicAccount(tx)
		if err != nil {
			return err
		}
		if row.Generation != c.Generation {
			return shared.Conflict("账号已发生变更，请重新获取二维码")
		}
		if err := tx.Table("music_login_challenges").Where("expires_at <= ? OR owner_id = ?", time.Now(), c.OwnerID).Delete(&music.Challenge{}).Error; err != nil {
			return err
		}
		return tx.Table("music_login_challenges").Create(&c).Error
	})
}
func (r *MusicRepository) FindChallenge(ctx context.Context, id, owner string) (*music.Challenge, error) {
	var c music.Challenge
	err := r.db.WithContext(ctx).Table("music_login_challenges").Where("id = ? AND owner_id = ? AND expires_at > ?", id, owner, time.Now()).Take(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	account, err := r.Credential(ctx)
	if err != nil {
		return nil, err
	}
	if account.Generation != c.Generation {
		return nil, nil
	}
	return &c, nil
}
func (r *MusicRepository) CancelChallenge(ctx context.Context, id, owner string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := lockMusicAccount(tx); err != nil {
			return err
		}
		return tx.Table("music_login_challenges").Where("id = ? AND owner_id = ?", id, owner).Delete(&music.Challenge{}).Error
	})
}
func (r *MusicRepository) ConfirmChallenge(ctx context.Context, c music.Challenge, credential music.Credential) (bool, error) {
	saved := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		row, err := lockMusicAccount(tx)
		if err != nil {
			return err
		}
		if row.Generation != c.Generation {
			return nil
		}
		// 删除挑战和写入凭据在同一事务内；取消也先锁唯一账号行。
		consumed := tx.Table("music_login_challenges").Where("id = ? AND owner_id = ? AND generation = ? AND expires_at > ?", c.ID, c.OwnerID, c.Generation, time.Now()).Delete(&music.Challenge{})
		if consumed.Error != nil {
			return consumed.Error
		}
		if consumed.RowsAffected != 1 {
			return nil
		}
		if err := tx.Model(&musicAccountRow{}).Where("id = 1").Updates(credentialValues(credential, row.Generation+1)).Error; err != nil {
			return err
		}
		saved = true
		return nil
	})
	return saved, err
}
