package service

import (
	"context"

	"github.com/rs/zerolog/log"

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
	log.Info().Str("service", "MusicSettingsService").Str("operation", "GetMusicSettings").Msg("获取音乐播放器设置")

	log.Debug().Str("query", "GetMusicSettings").Msg("执行数据库查询")
	settings, err := s.queries.GetMusicSettings(ctx)
	if err != nil {
		log.Error().Err(err).Msg("获取音乐设置失败")
		return nil, err
	}

	log.Info().Str("player_version", settings.PlayerVersion).Msg("音乐设置获取成功")
	return &MusicSettingsResponse{
		ID:            settings.ID,
		PlayerVersion: settings.PlayerVersion,
		UpdatedAt:     settings.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}, nil
}

// UpdatePlayerVersion 更新播放器版本
func (s *MusicSettingsService) UpdatePlayerVersion(ctx context.Context, playerVersion string) (*MusicSettingsResponse, error) {
	log.Info().Str("service", "MusicSettingsService").Str("operation", "UpdatePlayerVersion").
		Str("player_version", playerVersion).Msg("开始更新播放器版本")

	log.Debug().Str("query", "UpdatePlayerVersion").Msg("执行数据库更新")
	settings, err := s.queries.UpdatePlayerVersion(ctx, playerVersion)
	if err != nil {
		log.Error().Err(err).Str("player_version", playerVersion).Msg("更新播放器版本失败")
		return nil, err
	}

	log.Info().Str("player_version", playerVersion).Msg("播放器版本更新成功")
	return &MusicSettingsResponse{
		ID:            settings.ID,
		PlayerVersion: settings.PlayerVersion,
		UpdatedAt:     settings.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}, nil
}