// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"blog-api/internal/repository/generated"
)

// 歌单管理相关错误定义
var (
	ErrPlaylistAlreadyExists = errors.New("歌单已存在")
	ErrNoActivePlaylist      = errors.New("没有启用的歌单")
)

// MusicPlaylistAdminService 歌单管理业务服务
type MusicPlaylistAdminService struct {
	queries      *generated.Queries
	musicService *MusicService
}

// NewMusicPlaylistAdminService 创建歌单管理服务实例
func NewMusicPlaylistAdminService(queries *generated.Queries, musicService *MusicService) *MusicPlaylistAdminService {
	return &MusicPlaylistAdminService{
		queries:      queries,
		musicService: musicService,
	}
}

// PlaylistResponse 歌单响应结构
type PlaylistResponse struct {
	ID         uuid.UUID   `json:"id"`
	Title      string      `json:"title"`
	Cover      string      `json:"cover,omitempty"`
	Creator    string      `json:"creator,omitempty"`
	Platform   string      `json:"platform"`
	PlaylistID string      `json:"playlist_id"`
	SongCount  int         `json:"song_count"`
	Songs      []*SongInfo `json:"songs"`
	IsActive   bool        `json:"is_active"`
	CreatedAt  string      `json:"created_at"`
	UpdatedAt  string       `json:"updated_at"`
}

// CreatePlaylistInput 创建歌单输入
type CreatePlaylistInput struct {
	URL string `json:"url"` // 歌单链接，用于解析
}

// UpdatePlaylistInput 更新歌单输入
type UpdatePlaylistInput struct {
	ID       uuid.UUID
	Title    *string
	IsActive *bool
}

// --- 辅助函数 ---

func nullStringValue(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

func playlistToResponse(p *generated.Playlist, songs []*SongInfo) *PlaylistResponse {
	return &PlaylistResponse{
		ID:         p.ID,
		Title:      p.Title,
		Cover:      nullStringValue(p.Cover),
		Creator:    nullStringValue(p.Creator),
		Platform:   p.Platform,
		PlaylistID: p.PlaylistID,
		SongCount:  int(p.SongCount),
		Songs:      songs,
		IsActive:   p.IsActive,
		CreatedAt:  p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:  p.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func parseSongsFromJSON(raw json.RawMessage) ([]*SongInfo, error) {
	if len(raw) == 0 {
		return []*SongInfo{}, nil
	}

	var songs []*SongInfo
	if err := json.Unmarshal(raw, &songs); err != nil {
		return nil, err
	}
	return songs, nil
}

func buildPlaylistURL(platform, playlistID string) string {
	switch platform {
	case "netease":
		return fmt.Sprintf("https://music.163.com/playlist?id=%s", playlistID)
	case "tencent":
		return fmt.Sprintf("https://y.qq.com/n/ryqq/playlist/%s", playlistID)
	default:
		return ""
	}
}
