package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path"

	"github.com/bogem/id3v2"
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

// CreatePlaylist 创建歌单（导入链接，解析后存储）
func (s *MusicPlaylistAdminService) CreatePlaylist(ctx context.Context, input CreatePlaylistInput) (*PlaylistResponse, error) {
	log.Printf("[CreatePlaylist] 开始创建歌单, URL: %s", input.URL)

	// 使用已有的解析逻辑解析歌单链接
	playlistInfo, err := s.musicService.ParsePlaylistURL(input.URL)
	if err != nil {
		log.Printf("[CreatePlaylist] 解析歌单链接失败: %v", err)
		if err == ErrUnsupportedMusicURL {
			return nil, ErrUnsupportedMusicURL
		}
		return nil, fmt.Errorf("解析歌单链接失败: %w", err)
	}

	log.Printf("[CreatePlaylist] 解析成功: ID=%s, Platform=%s, Count=%d, Title=%s",
		playlistInfo.ID, playlistInfo.Platform, playlistInfo.Count, playlistInfo.Title)

	// 检查是否已存在相同平台和 ID 的歌单
	// 数据库直接使用 Meting API 的平台名称（netease/tencent）
	existing, err := s.queries.GetPlaylistByPlatformAndID(ctx, generated.GetPlaylistByPlatformAndIDParams{
		Platform:   playlistInfo.Platform,
		PlaylistID: playlistInfo.ID,
	})
	if err == nil && existing != nil {
		log.Printf("[CreatePlaylist] 歌单已存在: ID=%s", existing.ID)
		return nil, ErrPlaylistAlreadyExists
	}

	// 将歌曲列表序列化为 JSON
	songsJSON, err := json.Marshal(playlistInfo.Songs)
	if err != nil {
		log.Printf("[CreatePlaylist] 序列化歌曲列表失败: %v", err)
		return nil, fmt.Errorf("序列化歌曲列表失败: %w", err)
	}

	log.Printf("[CreatePlaylist] 序列化歌曲列表成功, 长度: %d bytes", len(songsJSON))

	// 创建歌单记录
	// 直接使用 Meting API 的平台名称（netease/tencent）
	params := generated.CreatePlaylistParams{
		Title:      playlistInfo.Title,
		Cover:      toNullString(playlistInfo.Cover),
		Creator:    toNullString(playlistInfo.Creator),
		Platform:   playlistInfo.Platform,
		PlaylistID: playlistInfo.ID,
		SongCount:  int32(playlistInfo.Count),
		Songs:      songsJSON,
		IsActive:   false, // 新创建的歌单默认不启用
	}

	playlist, err := s.queries.CreatePlaylist(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("创建歌单失败: %w", err)
	}

	return playlistToResponse(playlist, playlistInfo.Songs), nil
}

// UpdatePlaylistInput 更新歌单输入
type UpdatePlaylistInput struct {
	ID       uuid.UUID
	Title    *string
	IsActive *bool
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

// GetActivePlaylist 获取当前启用的歌单（前台用）
func (s *MusicPlaylistAdminService) GetActivePlaylist(ctx context.Context) (*PlaylistResponse, error) {
	playlist, err := s.queries.GetActivePlaylist(ctx)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNoActivePlaylist
		}
		return nil, fmt.Errorf("获取启用歌单失败: %w", err)
	}

	songs, err := parseSongsFromJSON(playlist.Songs)
	if err != nil {
		songs = []*SongInfo{}
	}

	return playlistToResponse(playlist, songs), nil
}

// GetAllActivePlaylists 获取所有启用的歌单列表（前台用）
func (s *MusicPlaylistAdminService) GetAllActivePlaylists(ctx context.Context) ([]*PlaylistResponse, error) {
	playlists, err := s.queries.GetAllActivePlaylists(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取启用歌单列表失败: %w", err)
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

// SetActivePlaylist 设置启用的歌单
// 先将所有歌单设置为不启用，再将指定歌单设置为启用
func (s *MusicPlaylistAdminService) SetActivePlaylist(ctx context.Context, id uuid.UUID) (*PlaylistResponse, error) {
	// 检查歌单是否存在
	_, err := s.queries.GetPlaylistByID(ctx, id)
	if err != nil {
		return nil, ErrPlaylistNotFound
	}

	// 先取消所有歌单的启用状态
	err = s.queries.SetActivePlaylist(ctx)
	if err != nil {
		return nil, fmt.Errorf("取消其他歌单启用状态失败: %w", err)
	}

	// 设置指定歌单为启用
	playlist, err := s.queries.SetPlaylistActive(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("设置歌单启用失败: %w", err)
	}

	songs, err := parseSongsFromJSON(playlist.Songs)
	if err != nil {
		songs = []*SongInfo{}
	}

	return playlistToResponse(playlist, songs), nil
}

// RefreshPlaylistSongs 刷新歌单歌曲列表（重新解析链接）
func (s *MusicPlaylistAdminService) RefreshPlaylistSongs(ctx context.Context, id uuid.UUID) (*PlaylistResponse, error) {
	// 获取现有歌单
	existing, err := s.queries.GetPlaylistByID(ctx, id)
	if err != nil {
		return nil, ErrPlaylistNotFound
	}

	// 构建歌单链接
	playlistURL := buildPlaylistURL(existing.Platform, existing.PlaylistID)

	// 重新解析歌单
	playlistInfo, err := s.musicService.ParsePlaylistURL(playlistURL)
	if err != nil {
		return nil, fmt.Errorf("重新解析歌单失败: %w", err)
	}

	// 序列化歌曲列表
	songsJSON, err := json.Marshal(playlistInfo.Songs)
	if err != nil {
		return nil, fmt.Errorf("序列化歌曲列表失败: %w", err)
	}

	// 更新歌曲列表
	params := generated.UpdatePlaylistSongsParams{
		ID:        id,
		Songs:     songsJSON,
		SongCount: int32(playlistInfo.Count),
	}

	playlist, err := s.queries.UpdatePlaylistSongs(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("更新歌单歌曲失败: %w", err)
	}

	return playlistToResponse(playlist, playlistInfo.Songs), nil
}

// ExtractAudioMetadata 从音频文件中提取 ID3 元数据
func (s *MusicPlaylistAdminService) ExtractAudioMetadata(filePath string) (*SongInfo, error) {
	tag, err := id3v2.Open(filePath, id3v2.Options{Parse: true})
	if err != nil {
		return nil, fmt.Errorf("打开音频文件失败: %w", err)
	}
	defer tag.Close()

	title := tag.Title()
	artist := tag.Artist()
	album := tag.Album()

	// 如果缺少必要字段，使用文件名作为标题
	if title == "" {
		fileBase := path.Base(filePath)
		ext := path.Ext(fileBase)
		title = fileBase[:len(fileBase)-len(ext)]
	}
	if artist == "" {
		artist = "未知艺术家"
	}

	// 提取封面
	cover := ""
	pictures := tag.GetFrames(tag.CommonID("Attached picture"))
	if len(pictures) > 0 {
		if apic, ok := pictures[0].(id3v2.PictureFrame); ok {
			_ = apic // 标记有封面，后续在 AddSongToPlaylist 中保存
			cover = "has_apic"
		}
	}

	return &SongInfo{
		ID:       uuid.New().String(),
		Title:    title,
		Artist:   artist,
		Album:    album,
		Cover:    cover,
		Duration: 0,
		Platform: "custom",
	}, nil
}

// CreateCustomPlaylist 创建自定义歌单
func (s *MusicPlaylistAdminService) CreateCustomPlaylist(ctx context.Context, title string) (*PlaylistResponse, error) {
	songsJSON, _ := json.Marshal([]*SongInfo{})

	params := generated.CreatePlaylistParams{
		Title:      title,
		Cover:      toNullString(""),
		Creator:    toNullString(""),
		Platform:   "custom",
		PlaylistID: fmt.Sprintf("custom-%s", uuid.New().String()),
		SongCount:  0,
		Songs:      songsJSON,
		IsActive:   false,
	}

	playlist, err := s.queries.CreatePlaylist(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("创建自定义歌单失败: %w", err)
	}

	return playlistToResponse(playlist, []*SongInfo{}), nil
}

// AddSongToPlaylist 向歌单添加歌曲
func (s *MusicPlaylistAdminService) AddSongToPlaylist(ctx context.Context, playlistID uuid.UUID, audioFilePath string, audioURL string) (*PlaylistResponse, error) {
	// 获取现有歌单
	existing, err := s.queries.GetPlaylistByID(ctx, playlistID)
	if err != nil {
		return nil, ErrPlaylistNotFound
	}

	// 解析当前歌曲列表
	songs, err := parseSongsFromJSON(existing.Songs)
	if err != nil {
		return nil, fmt.Errorf("解析歌曲列表失败: %w", err)
	}

	// 提取音频元数据
	songInfo, err := s.ExtractAudioMetadata(audioFilePath)
	if err != nil {
		return nil, fmt.Errorf("提取音频元数据失败: %w", err)
	}

	// 使用服务 URL 而非本地路径
	songInfo.URL = audioURL

	// 处理封面：如果从 ID3 提取到了 APIC 封面，保存到磁盘
	if songInfo.Cover == "has_apic" {
		tag, tagErr := id3v2.Open(audioFilePath, id3v2.Options{Parse: true})
		if tagErr == nil {
			pictures := tag.GetFrames(tag.CommonID("Attached picture"))
			if len(pictures) > 0 {
				if apic, ok := pictures[0].(id3v2.PictureFrame); ok {
					// 根据 MIME 类型确定扩展名
					ext := ".jpg"
					if apic.MimeType == "image/png" {
						ext = ".png"
					}
					coverFileName := fmt.Sprintf("%s%s", songInfo.ID, ext)
					coverDir := path.Join("uploads", "music", "covers")
					os.MkdirAll(coverDir, 0o755)
					coverPath := path.Join(coverDir, coverFileName)
					if writeErr := os.WriteFile(coverPath, apic.Picture, 0o644); writeErr == nil {
						songInfo.Cover = fmt.Sprintf("/uploads/music/covers/%s", coverFileName)
					}
				}
			}
			tag.Close()
		}
	} else {
		songInfo.Cover = ""
	}

	// 追加新歌曲
	songs = append(songs, songInfo)

	// 序列化并更新
	songsJSON, err := json.Marshal(songs)
	if err != nil {
		return nil, fmt.Errorf("序列化歌曲列表失败: %w", err)
	}

	params := generated.UpdatePlaylistSongsParams{
		ID:        playlistID,
		Songs:     songsJSON,
		SongCount: int32(len(songs)),
	}

	playlist, err := s.queries.UpdatePlaylistSongs(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("更新歌单歌曲失败: %w", err)
	}

	return playlistToResponse(playlist, songs), nil
}

// RemoveSongFromPlaylist 从歌单中移除歌曲
func (s *MusicPlaylistAdminService) RemoveSongFromPlaylist(ctx context.Context, playlistID uuid.UUID, songIndex int) (*PlaylistResponse, error) {
	// 获取现有歌单
	existing, err := s.queries.GetPlaylistByID(ctx, playlistID)
	if err != nil {
		return nil, ErrPlaylistNotFound
	}

	// 解析歌曲列表
	songs, err := parseSongsFromJSON(existing.Songs)
	if err != nil {
		return nil, fmt.Errorf("解析歌曲列表失败: %w", err)
	}

	// 验证索引
	if songIndex < 0 || songIndex >= len(songs) {
		return nil, fmt.Errorf("歌曲索引 %d 超出范围（共 %d 首）", songIndex, len(songs))
	}

	// 移除指定索引的歌曲
	songs = append(songs[:songIndex], songs[songIndex+1:]...)

	// 序列化并更新
	songsJSON, err := json.Marshal(songs)
	if err != nil {
		return nil, fmt.Errorf("序列化歌曲列表失败: %w", err)
	}

	params := generated.UpdatePlaylistSongsParams{
		ID:        playlistID,
		Songs:     songsJSON,
		SongCount: int32(len(songs)),
	}

	playlist, err := s.queries.UpdatePlaylistSongs(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("更新歌单歌曲失败: %w", err)
	}

	return playlistToResponse(playlist, songs), nil
}

// UpdateSongInPlaylist 更新歌单中的歌曲信息
func (s *MusicPlaylistAdminService) UpdateSongInPlaylist(ctx context.Context, playlistID uuid.UUID, songIndex int, title string, artist string, cover string, lrc string) (*PlaylistResponse, error) {
	existing, err := s.queries.GetPlaylistByID(ctx, playlistID)
	if err != nil {
		return nil, ErrPlaylistNotFound
	}

	songs, err := parseSongsFromJSON(existing.Songs)
	if err != nil {
		return nil, fmt.Errorf("解析歌曲列表失败: %w", err)
	}

	if songIndex < 0 || songIndex >= len(songs) {
		return nil, fmt.Errorf("歌曲索引 %d 超出范围（共 %d 首）", songIndex, len(songs))
	}

	songs[songIndex].Title = title
	songs[songIndex].Artist = artist
	songs[songIndex].Cover = cover
	songs[songIndex].Lrc = lrc

	songsJSON, err := json.Marshal(songs)
	if err != nil {
		return nil, fmt.Errorf("序列化歌曲列表失败: %w", err)
	}

	params := generated.UpdatePlaylistSongsParams{
		ID:        playlistID,
		Songs:     songsJSON,
		SongCount: int32(len(songs)),
	}

	playlist, err := s.queries.UpdatePlaylistSongs(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("更新歌单歌曲失败: %w", err)
	}

	return playlistToResponse(playlist, songs), nil
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