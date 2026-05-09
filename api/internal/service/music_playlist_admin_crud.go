// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/repository/generated"
)

// CreatePlaylist 创建歌单（导入链接，解析后存储）
func (s *MusicPlaylistAdminService) CreatePlaylist(ctx context.Context, input CreatePlaylistInput) (*PlaylistResponse, error) {
	log.Info().Str("service", "MusicPlaylistAdminService").Str("operation", "CreatePlaylist").
		Str("url", input.URL).Msg("开始创建歌单")

	// 使用已有的解析逻辑解析歌单链接
	log.Info().Str("target", "MusicService").Msg("解析歌单链接")
	playlistInfo, err := s.musicService.ParsePlaylistURL(input.URL)
	if err != nil {
		log.Warn().Err(err).Str("url", input.URL).Msg("解析歌单链接失败")
		if err == ErrUnsupportedMusicURL {
			return nil, ErrUnsupportedMusicURL
		}
		return nil, fmt.Errorf("解析歌单链接失败: %w", err)
	}

	log.Info().Str("playlist_id", playlistInfo.ID).Str("platform", playlistInfo.Platform).
		Int("count", playlistInfo.Count).Str("title", playlistInfo.Title).Msg("歌单解析成功")

	// 检查是否已存在相同平台和 ID 的歌单
	// 数据库直接使用 Meting API 的平台名称（netease/tencent）
	log.Debug().Str("query", "GetPlaylistByPlatformAndID").Msg("检查歌单是否已存在")
	existing, err := s.queries.GetPlaylistByPlatformAndID(ctx, generated.GetPlaylistByPlatformAndIDParams{
		Platform:   playlistInfo.Platform,
		PlaylistID: playlistInfo.ID,
	})
	if err == nil && existing != nil {
		log.Warn().Str("playlist_id", existing.ID.String()).Msg("歌单已存在")
		return nil, ErrPlaylistAlreadyExists
	}

	// 将歌曲列表序列化为 JSON
	songsJSON, err := json.Marshal(playlistInfo.Songs)
	if err != nil {
		log.Error().Err(err).Msg("序列化歌曲列表失败")
		return nil, fmt.Errorf("序列化歌曲列表失败: %w", err)
	}

	log.Debug().Int("json_size", len(songsJSON)).Msg("歌曲列表序列化成功")

	// 创建歌单记录
	// 直接使用 Meting API 的平台名称（netease/tencent）
	params := generated.CreatePlaylistParams{
		Title:      playlistInfo.Title,
		Cover:      toSQLNullString(playlistInfo.Cover),
		Creator:    toSQLNullString(playlistInfo.Creator),
		Platform:   playlistInfo.Platform,
		PlaylistID: playlistInfo.ID,
		SongCount:  int32(playlistInfo.Count),
		Songs:      songsJSON,
		IsActive:   false, // 新创建的歌单默认不启用
	}

	log.Debug().Str("query", "CreatePlaylist").Msg("创建歌单记录")
	playlist, err := s.queries.CreatePlaylist(ctx, params)
	if err != nil {
		log.Error().Err(err).Str("title", playlistInfo.Title).Msg("创建歌单失败")
		return nil, fmt.Errorf("创建歌单失败: %w", err)
	}

	log.Info().Str("playlist_id", playlist.ID.String()).Str("title", playlistInfo.Title).Msg("歌单创建成功")
	return playlistToResponse(playlist, playlistInfo.Songs), nil
}

// UpdatePlaylist 更新歌单信息（标题、是否启用）
func (s *MusicPlaylistAdminService) UpdatePlaylist(ctx context.Context, input UpdatePlaylistInput) (*PlaylistResponse, error) {
	// 获取现有数据
	existing, err := s.queries.GetPlaylistByID(ctx, input.ID)
	if err != nil {
		return nil, ErrPlaylistNotFound
	}

	// 只更新提供的字段
	title := existing.Title
	if input.Title != nil {
		title = *input.Title
	}

	isActive := existing.IsActive
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	params := generated.UpdatePlaylistParams{
		ID:       input.ID,
		Title:    title,
		IsActive: isActive,
	}

	playlist, err := s.queries.UpdatePlaylist(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("更新歌单失败: %w", err)
	}

	// 解析歌曲列表
	songs, err := parseSongsFromJSON(playlist.Songs)
	if err != nil {
		songs = []*SongInfo{}
	}

	return playlistToResponse(playlist, songs), nil
}

// DeletePlaylist 删除歌单
func (s *MusicPlaylistAdminService) DeletePlaylist(ctx context.Context, id uuid.UUID) error {
	// 检查歌单是否存在
	_, err := s.queries.GetPlaylistByID(ctx, id)
	if err != nil {
		return ErrPlaylistNotFound
	}

	err = s.queries.DeletePlaylist(ctx, id)
	if err != nil {
		return fmt.Errorf("删除歌单失败: %w", err)
	}

	return nil
}

// ListPlaylists 获取歌单列表
func (s *MusicPlaylistAdminService) ListPlaylists(ctx context.Context) ([]*PlaylistResponse, error) {
	playlists, err := s.queries.ListPlaylists(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取歌单列表失败: %w", err)
	}

	responses := make([]*PlaylistResponse, 0, len(playlists))
	for _, p := range playlists {
		songs, err := parseSongsFromJSON(p.Songs)
		if err != nil {
			songs = []*SongInfo{}
		}
		responses = append(responses, playlistToResponse(p, songs))
	}

	return responses, nil
}
