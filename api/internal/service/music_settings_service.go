package service

import (
	"context"

	"blog-api/internal/repository/generated"
)

// MusicSettingsService 音乐播放器设置业务服务
type MusicSettingsService struct {
	queries *generated.Queries
}

// NewMusicSettingsService 创建音乐设置服务实例
func NewMusicSettingsService(queries *generated.Queries) *MusicSettingsService {
	return &MusicSettingsService{
		queries: queries,
	}
}

// MusicSettingsResponse 音乐设置响应结构
type MusicSettingsResponse struct {
	ID            int32  `json:"id"`
	PlayerVersion string `json:"player_version"`
	UpdatedAt     string `json:"updated_at"`
}

// GetMusicSettings 获取音乐播放器设置
func (s *MusicSettingsService) GetMusicSettings(ctx context.Context) (*MusicSettingsResponse, error) {
	settings, err := s.queries.GetMusicSettings(ctx)
	if err != nil {
		return nil, err
	}

	return &MusicSettingsResponse{
		ID:            settings.ID,
		PlayerVersion: settings.PlayerVersion,
		UpdatedAt:     settings.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}, nil
}

// UpdatePlayerVersion 更新播放器版本
func (s *MusicSettingsService) UpdatePlayerVersion(ctx context.Context, playerVersion string) (*MusicSettingsResponse, error) {
	settings, err := s.queries.UpdatePlayerVersion(ctx, playerVersion)
	if err != nil {
		return nil, err
	}

	return &MusicSettingsResponse{
		ID:            settings.ID,
		PlayerVersion: settings.PlayerVersion,
		UpdatedAt:     settings.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}, nil
}