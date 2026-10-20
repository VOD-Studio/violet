package gorm

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
)

type musicPlaylistRow struct {
	ID                      string `gorm:"primaryKey"`
	Name, CoverURL, Creator string
	TrackCount              int
	Enabled                 bool
	Position                int
}

func (musicPlaylistRow) TableName() string { return "music_featured_playlists" }
func (r musicPlaylistRow) featured() music.FeaturedPlaylist {
	return music.FeaturedPlaylist{Playlist: music.Playlist{ID: r.ID, Name: r.Name, CoverURL: r.CoverURL, TrackCount: r.TrackCount, Creator: r.Creator}, Enabled: r.Enabled, Position: r.Position}
}
func listMusicPlaylists(db *gorm.DB) ([]music.FeaturedPlaylist, error) {
	var rows []musicPlaylistRow
	if err := db.Order("position ASC, id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	result := make([]music.FeaturedPlaylist, len(rows))
	for i, row := range rows {
		result[i] = row.featured()
	}
	return result, nil
}
func (r *MusicRepository) ListFeatured(ctx context.Context) ([]music.FeaturedPlaylist, error) {
	return listMusicPlaylists(r.db.WithContext(ctx))
}
func (r *MusicRepository) AddFeatured(ctx context.Context, p music.Playlist) (music.FeaturedPlaylist, error) {
	var result music.FeaturedPlaylist
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := lockMusicAccount(tx); err != nil {
			return err
		}
		all, err := listMusicPlaylists(tx)
		if err != nil {
			return err
		}
		position := 0
		for _, existing := range all {
			if existing.ID == p.ID {
				return shared.Conflict("歌单已加入展示")
			}
			if existing.Position >= position {
				position = existing.Position + 1
			}
		}
		row := musicPlaylistRow{ID: p.ID, Name: p.Name, CoverURL: p.CoverURL, TrackCount: p.TrackCount, Creator: p.Creator, Enabled: true, Position: position}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		result = row.featured()
		return nil
	})
	return result, err
}
func (r *MusicRepository) SetEnabled(ctx context.Context, id string, enabled bool) (music.FeaturedPlaylist, error) {
	var result music.FeaturedPlaylist
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := lockMusicAccount(tx); err != nil {
			return err
		}
		var row musicPlaylistRow
		if err := tx.First(&row, "id = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return shared.NotFound("展示歌单")
			}
			return err
		}
		if err := tx.Model(&row).Update("enabled", enabled).Error; err != nil {
			return err
		}
		row.Enabled = enabled
		result = row.featured()
		return nil
	})
	return result, err
}
func (r *MusicRepository) OrderFeatured(ctx context.Context, ids []string) ([]music.FeaturedPlaylist, error) {
	var result []music.FeaturedPlaylist
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := lockMusicAccount(tx); err != nil {
			return err
		}
		all, err := listMusicPlaylists(tx)
		if err != nil {
			return err
		}
		if err := music.ValidateOrder(all, ids); err != nil {
			return err
		}
		for position, id := range ids {
			if err := tx.Model(&musicPlaylistRow{}).Where("id = ?", id).Update("position", position).Error; err != nil {
				return err
			}
		}
		result, err = listMusicPlaylists(tx)
		return err
	})
	return result, err
}
func (r *MusicRepository) RemoveFeatured(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := lockMusicAccount(tx); err != nil {
			return err
		}
		result := tx.Where("id = ?", id).Delete(&musicPlaylistRow{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return shared.NotFound("展示歌单")
		}
		return nil
	})
}
