// Package media 提供 emoji/music/upload 三个模块的 application 层用例。
//
// 三个模块合并到一个包，避免过多小文件，各自独立的 Service 结构体。
package media

import (
	"context"
	"time"

	domainemoji "blog-api/internal/domain/emoji"
	domainmusic "blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
)

// ============================================================
// Emoji Service
// ============================================================

// EmojiGroupDTO 表情分组读模型
type EmojiGroupDTO struct {
	ID        int32      `json:"id"`
	Name      string     `json:"name"`
	Source    string     `json:"source"`
	SortOrder int        `json:"sort_order"`
	IsEnabled bool       `json:"is_enabled"`
	Emojis    []EmojiDTO `json:"emojis"`
}

// EmojiDTO 表情读模型
type EmojiDTO struct {
	ID   int32  `json:"id"`
	Name string `json:"name"`
	URL  string `json:"url"`
}

// EmojiService 表情用例服务
type EmojiService struct {
	repo domainemoji.EmojiGroupRepository
}

// NewEmojiService 构造表情服务
func NewEmojiService(repo domainemoji.EmojiGroupRepository) *EmojiService {
	return &EmojiService{repo: repo}
}

// GetAll 获取所有启用的表情分组（前台）
func (s *EmojiService) GetAll(ctx context.Context) ([]EmojiGroupDTO, error) {
	groups, err := s.repo.FindAll(ctx, true)
	if err != nil {
		return nil, err
	}
	return emojiGroupsToDTOs(groups), nil
}

// GetAllAdmin 获取所有表情分组（后台，含禁用）
func (s *EmojiService) GetAllAdmin(ctx context.Context) ([]EmojiGroupDTO, error) {
	groups, err := s.repo.FindAll(ctx, false)
	if err != nil {
		return nil, err
	}
	return emojiGroupsToDTOs(groups), nil
}

// CreateGroupInput 创建分组入参
type CreateGroupInput struct {
	Name   string
	Source string
}

// CreateGroup 创建表情分组
func (s *EmojiService) CreateGroup(ctx context.Context, in CreateGroupInput) (int32, error) {
	g, err := domainemoji.NewEmojiGroup(0, in.Name, in.Source)
	if err != nil {
		return 0, err
	}
	return s.repo.Save(ctx, g)
}

// SetEnabled 启用/禁用分组
func (s *EmojiService) SetEnabled(ctx context.Context, id int32, enabled bool) error {
	return s.repo.UpdateEnabled(ctx, id, enabled)
}

// DeleteGroup 删除分组
func (s *EmojiService) DeleteGroup(ctx context.Context, id int32) error {
	return s.repo.Delete(ctx, id)
}

func emojiGroupsToDTOs(groups []*domainemoji.EmojiGroup) []EmojiGroupDTO {
	dtos := make([]EmojiGroupDTO, 0, len(groups))
	for _, g := range groups {
		emojis := make([]EmojiDTO, 0, len(g.Emojis()))
		for _, e := range g.Emojis() {
			emojis = append(emojis, EmojiDTO{ID: e.ID(), Name: e.Name(), URL: e.URL()})
		}
		dtos = append(dtos, EmojiGroupDTO{
			ID: g.ID(), Name: g.Name(), Source: g.Source(),
			SortOrder: g.SortOrder(), IsEnabled: g.IsEnabled(), Emojis: emojis,
		})
	}
	return dtos
}

// ============================================================
// Music Service
// ============================================================

// PlaylistDTO 歌单读模型
type PlaylistDTO struct {
	ID         string             `json:"id"`
	Title      string             `json:"title"`
	Cover      string             `json:"cover"`
	Creator    string             `json:"creator"`
	Platform   string             `json:"platform"`
	PlaylistID string             `json:"playlist_id"`
	SongCount  int                `json:"song_count"`
	Songs      []domainmusic.Song `json:"songs"`
	IsActive   bool               `json:"is_active"`
	CreatedAt  string             `json:"created_at"`
}

// MusicService 音乐用例服务
type MusicService struct {
	repo domainmusic.PlaylistRepository
}

// NewMusicService 构造音乐服务
func NewMusicService(repo domainmusic.PlaylistRepository) *MusicService {
	return &MusicService{repo: repo}
}

// GetActive 获取所有活跃歌单（前台播放器）
func (s *MusicService) GetActive(ctx context.Context) ([]PlaylistDTO, error) {
	playlists, err := s.repo.FindActive(ctx)
	if err != nil {
		return nil, err
	}
	return playlistsToDTOs(playlists), nil
}

// GetAll 获取所有歌单（后台管理）
func (s *MusicService) GetAll(ctx context.Context) ([]PlaylistDTO, error) {
	playlists, err := s.repo.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	return playlistsToDTOs(playlists), nil
}

// SetActive 设置活跃歌单
func (s *MusicService) SetActive(ctx context.Context, id string, active bool) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	p.SetActive(active)
	return s.repo.Save(ctx, p)
}

// DeletePlaylist 删除歌单
func (s *MusicService) DeletePlaylist(ctx context.Context, id string) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, pid)
}

func playlistsToDTOs(playlists []*domainmusic.Playlist) []PlaylistDTO {
	dtos := make([]PlaylistDTO, 0, len(playlists))
	for _, p := range playlists {
		dtos = append(dtos, PlaylistDTO{
			ID: p.ID().String(), Title: p.Title(), Cover: p.Cover(),
			Creator: p.Creator(), Platform: p.Platform(), PlaylistID: p.PlaylistID(),
			SongCount: p.SongCount(), Songs: p.Songs(), IsActive: p.IsActive(),
			CreatedAt: p.ID().String(), // placeholder
		})
	}
	_ = time.Now // avoid unused import
	return dtos
}

// ============================================================
// Upload Service
// ============================================================

// FileDTO 文件读模型
type FileDTO struct {
	ID           string `json:"id"`
	OwnerID      string `json:"owner_id"`
	Purpose      string `json:"purpose"`
	OriginalName string `json:"original_name"`
	URL          string `json:"url"`
	Size         int64  `json:"size"`
	MimeType     string `json:"mime_type"`
	Thumbnail    string `json:"thumbnail"`
	Status       string `json:"status"`
	CreatedAt    string `json:"created_at"`
}

// UploadService 文件上传用例服务
type UploadService struct {
	fileRepo    domainupload.FileRepository
	sessionRepo domainupload.UploadSessionRepository
}

// NewUploadService 构造上传服务
func NewUploadService(fileRepo domainupload.FileRepository, sessionRepo domainupload.UploadSessionRepository) *UploadService {
	return &UploadService{fileRepo: fileRepo, sessionRepo: sessionRepo}
}

// CheckInstantUpload 秒传检查（按哈希查找已存在文件）
func (s *UploadService) CheckInstantUpload(ctx context.Context, hash string) (*FileDTO, bool, error) {
	f, err := s.fileRepo.FindByHash(ctx, hash)
	if err != nil {
		if err == domainupload.ErrFileNotFound {
			return nil, false, nil // 无秒传文件
		}
		return nil, false, err
	}
	dto := fileToDTO(f)
	return &dto, true, nil
}

// ListByOwner 按用户列出文件
func (s *UploadService) ListByOwner(ctx context.Context, ownerID, purpose string, page, limit int) ([]FileDTO, int64, error) {
	oid, err := shared.ParseID(ownerID)
	if err != nil {
		return nil, 0, err
	}
	files, total, err := s.fileRepo.FindByOwner(ctx, oid, purpose, page, limit)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]FileDTO, 0, len(files))
	for _, f := range files {
		dtos = append(dtos, fileToDTO(f))
	}
	return dtos, total, nil
}

// DeleteFile 删除文件（需引用计数为 0）
func (s *UploadService) DeleteFile(ctx context.Context, id string) error {
	fid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	f, err := s.fileRepo.FindByID(ctx, fid)
	if err != nil {
		return err
	}
	if !f.CanPhysicallyDelete() {
		return domainupload.ErrFileInUse
	}
	return s.fileRepo.Delete(ctx, fid)
}

func fileToDTO(f *domainupload.File) FileDTO {
	return FileDTO{
		ID: f.ID().String(), OwnerID: f.OwnerID().String(),
		Purpose: f.Purpose(), OriginalName: f.OriginalName(),
		URL: f.URL(), Size: f.Size(), MimeType: f.MimeType(),
		Thumbnail: f.Thumbnail(), Status: f.Status(),
		CreatedAt: f.CreatedAt().Format(time.RFC3339),
	}
}
