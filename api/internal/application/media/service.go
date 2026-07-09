// Package media 提供 emoji/music/upload 三个模块的 application 层用例。
//
// 三个模块合并到一个包，避免过多小文件，各自独立的 Service 结构体。
package media

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

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
	CoverURL  string     `json:"cover_url"`
	SortOrder int        `json:"sort_order"`
	IsEnabled bool       `json:"is_enabled"`
	Emojis    []EmojiDTO `json:"emojis"`
}

// EmojiDTO 表情读模型
type EmojiDTO struct {
	ID          int32  `json:"id"`
	GroupID     int32  `json:"group_id,omitempty"`
	Name        string `json:"name"`
	URL         string `json:"url"`
	SourceURL   string `json:"source_url,omitempty"`
	GifURL      string `json:"gif_url,omitempty"`
	TextContent string `json:"text_content,omitempty"`
	SortOrder   int    `json:"sort_order,omitempty"`
}

// 表情图片上传限制
const maxEmojiSize = 10 * 1024 * 1024 // 10MB

var allowedEmojiExts = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true,
	".gif": true, ".webp": true, ".svg": true,
}

var allowedEmojiTypes = map[string]bool{
	"image/jpeg": true, "image/png": true, "image/gif": true,
	"image/webp": true, "image/svg+xml": true,
}

// extToMIME 扩展名到 MIME 推断
var extToMIME = map[string]string{
	".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
	".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
}

// ReseedRunner 执行 B站表情重新拉取（由 EmojiSeedService 实现，打破对 service 包的依赖）。
type ReseedRunner interface {
	Reseed(ctx context.Context, progress func(domainemoji.RefetchProgress)) error
}

// EmojiService 表情用例服务
type EmojiService struct {
	repo        domainemoji.EmojiGroupRepository
	emojiDir    string
	urlPrefix   string
	reseeder    ReseedRunner                   // 重新拉取执行器
	statusStore domainemoji.RefetchStatusStore // 重新拉取任务状态
}

// NewEmojiService 构造表情服务。
//
// emojiDir 为表情文件物理存储目录，urlPrefix 为上传 URL 前缀，二者解耦。
// reseeder/statusStore 用于「重新拉取」功能，可为 nil（禁用该功能）。
func NewEmojiService(
	repo domainemoji.EmojiGroupRepository,
	emojiDir, urlPrefix string,
	reseeder ReseedRunner,
	statusStore domainemoji.RefetchStatusStore,
) *EmojiService {
	return &EmojiService{
		repo: repo, emojiDir: emojiDir, urlPrefix: urlPrefix,
		reseeder: reseeder, statusStore: statusStore,
	}
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

// GetGroupByName 按名称获取分组（含表情）
func (s *EmojiService) GetGroupByName(ctx context.Context, name string) (EmojiGroupDTO, error) {
	g, err := s.repo.FindByName(ctx, name)
	if err != nil {
		return EmojiGroupDTO{}, err
	}
	return emojiGroupToDTO(g), nil
}

// CreateGroupInput 创建分组入参
type CreateGroupInput struct {
	Name      string
	Source    string
	CoverURL  string
	SortOrder int
	IsEnabled bool
}

// CreateGroup 创建表情分组
func (s *EmojiService) CreateGroup(ctx context.Context, in CreateGroupInput) (int32, error) {
	exists, err := s.repo.ExistsByName(ctx, in.Name, 0)
	if err != nil {
		return 0, err
	}
	if exists {
		return 0, domainemoji.ErrNameExists
	}
	g, err := domainemoji.NewEmojiGroup(0, in.Name, in.Source)
	if err != nil {
		return 0, err
	}
	g.SetCoverURL(in.CoverURL)
	g.SetSortOrder(in.SortOrder)
	if !in.IsEnabled {
		g.SetEnabled(false)
	}
	return s.repo.Save(ctx, g)
}

// UpdateGroupInput 更新分组入参（指针字段表部分更新）
type UpdateGroupInput struct {
	ID        int32
	Name      string
	Source    string
	CoverURL  *string
	SortOrder *int
	IsEnabled *bool
}

// UpdateGroup 更新分组
func (s *EmojiService) UpdateGroup(ctx context.Context, in UpdateGroupInput) error {
	g, err := s.repo.FindByID(ctx, in.ID)
	if err != nil {
		return err
	}
	if in.Name != "" && in.Name != g.Name() {
		exists, err := s.repo.ExistsByName(ctx, in.Name, in.ID)
		if err != nil {
			return err
		}
		if exists {
			return domainemoji.ErrNameExists
		}
		g.SetName(in.Name)
	}
	if in.Source != "" {
		g.SetSource(in.Source)
	}
	if in.CoverURL != nil {
		g.SetCoverURL(*in.CoverURL)
	}
	if in.SortOrder != nil {
		g.SetSortOrder(*in.SortOrder)
	}
	if in.IsEnabled != nil {
		g.SetEnabled(*in.IsEnabled)
	}
	_, err = s.repo.Save(ctx, g)
	return err
}

// SetEnabled 启用/禁用分组
func (s *EmojiService) SetEnabled(ctx context.Context, id int32, enabled bool) error {
	return s.repo.UpdateEnabled(ctx, id, enabled)
}

// BatchUpdateEnabled 批量启用/禁用分组
func (s *EmojiService) BatchUpdateEnabled(ctx context.Context, ids []int32, enabled bool) (int64, error) {
	if len(ids) == 0 {
		return 0, shared.BadRequest("分组 ID 列表不能为空")
	}
	return s.repo.BatchUpdateEnabled(ctx, ids, enabled)
}

// DeleteGroup 删除分组
func (s *EmojiService) DeleteGroup(ctx context.Context, id int32) error {
	return s.repo.Delete(ctx, id)
}

// ListEmojisByGroup 列出分组内表情
func (s *EmojiService) ListEmojisByGroup(ctx context.Context, groupID int32) ([]EmojiDTO, error) {
	emojis, err := s.repo.FindEmojisByGroup(ctx, groupID)
	if err != nil {
		return nil, err
	}
	dtos := make([]EmojiDTO, 0, len(emojis))
	for _, e := range emojis {
		dtos = append(dtos, emojiToDTO(e))
	}
	return dtos, nil
}

// CreateEmojiInput 创建表情入参
type CreateEmojiInput struct {
	GroupID     int32
	Name        string
	URL         string
	TextContent string
	GifURL      string
	SourceURL   string
	SortOrder   int
}

// CreateEmoji 在分组内创建表情
func (s *EmojiService) CreateEmoji(ctx context.Context, in CreateEmojiInput) (int32, error) {
	if in.Name == "" {
		return 0, shared.BadRequest("表情名称不能为空")
	}
	// 校验分组存在
	if _, err := s.repo.FindByID(ctx, in.GroupID); err != nil {
		return 0, err
	}
	e := domainemoji.NewEmoji(0, in.GroupID, in.Name, in.URL)
	e.Update(in.Name, in.URL, in.TextContent, in.GifURL, in.SourceURL, in.SortOrder)
	return s.repo.SaveEmoji(ctx, e)
}

// UpdateEmojiInput 更新表情入参
type UpdateEmojiInput struct {
	ID          int32
	Name        string
	URL         string
	TextContent string
	GifURL      string
	SourceURL   string
	SortOrder   int
}

// UpdateEmoji 更新表情
func (s *EmojiService) UpdateEmoji(ctx context.Context, in UpdateEmojiInput) error {
	e, err := s.repo.FindEmojiByID(ctx, in.ID)
	if err != nil {
		return err
	}
	e.Update(in.Name, in.URL, in.TextContent, in.GifURL, in.SourceURL, in.SortOrder)
	_, err = s.repo.SaveEmoji(ctx, e)
	return err
}

// DeleteEmoji 删除表情
func (s *EmojiService) DeleteEmoji(ctx context.Context, id int32) error {
	return s.repo.DeleteEmoji(ctx, id)
}

// Refetch 异步触发 B站表情重新拉取。立即返回当前状态(running)。
// 已有任务运行返回 shared.Conflict（→ 409）。
func (s *EmojiService) Refetch(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	if s.reseeder == nil || s.statusStore == nil {
		return nil, shared.BadRequest("重新拉取功能未配置")
	}
	if err := s.statusStore.Acquire(ctx); err != nil {
		return nil, err
	}
	// 异步执行，不继承请求 ctx（请求结束后任务继续）
	go func() {
		progress := func(p domainemoji.RefetchProgress) {
			if err := s.statusStore.SetProgress(context.Background(), p); err != nil {
				log.Warn().Err(err).Msg("上报重新拉取进度失败")
			}
		}
		if err := s.reseeder.Reseed(context.Background(), progress); err != nil {
			log.Error().Err(err).Msg("重新拉取失败")
			_ = s.statusStore.SetFailed(context.Background(), err.Error())
			return
		}
		_ = s.statusStore.SetDone(context.Background())
	}()
	return s.statusStore.Get(ctx)
}

// GetRefetchStatus 读取重新拉取任务状态（供前端轮询）。
func (s *EmojiService) GetRefetchStatus(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	if s.statusStore == nil {
		return &domainemoji.RefetchStatus{State: domainemoji.RefetchStateIdle}, nil
	}
	return s.statusStore.Get(ctx)
}

// EmojiUploadResult 表情上传结果
type EmojiUploadResult struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
	MimeType string `json:"mime_type"`
}

// UploadEmoji 上传表情文件到 emojiDir，返回可访问 URL
//
// 文件类型校验：扩展名 + MIME 双重校验；尺寸上限 10MB。
// 文件名用 UUID 保证唯一，不落库（仅返回 URL 供后续 CreateEmoji 引用）。
func (s *EmojiService) UploadEmoji(ctx context.Context, filename, mimeType string, size int64, content []byte) (*EmojiUploadResult, error) {
	_ = ctx
	ext := strings.ToLower(filepath.Ext(filename))
	if !allowedEmojiExts[ext] {
		return nil, shared.BadRequest("不支持的表情文件类型")
	}
	finalMIME := mimeType
	if finalMIME == "" {
		finalMIME = extToMIME[ext]
	}
	if finalMIME != "" && !allowedEmojiTypes[finalMIME] {
		return nil, shared.BadRequest("不支持的表情文件类型")
	}
	if size > maxEmojiSize {
		return nil, shared.BadRequest("表情文件过大（上限 10MB）")
	}
	if err := os.MkdirAll(s.emojiDir, 0o755); err != nil {
		return nil, shared.Internal("创建表情目录失败", err)
	}
	newName := uuid.New().String() + ext
	dst := filepath.Join(s.emojiDir, newName)
	if err := os.WriteFile(dst, content, 0o644); err != nil {
		return nil, shared.Internal("保存表情文件失败", err)
	}
	// URL 从 urlPrefix 派生，与物理目录解耦
	url := s.urlPrefix + "emojis/" + newName
	return &EmojiUploadResult{URL: url, Filename: newName, Size: size, MimeType: finalMIME}, nil
}

func emojiGroupToDTO(g *domainemoji.EmojiGroup) EmojiGroupDTO {
	emojis := make([]EmojiDTO, 0, len(g.Emojis()))
	for _, e := range g.Emojis() {
		emojis = append(emojis, emojiToDTO(e))
	}
	return EmojiGroupDTO{
		ID: g.ID(), Name: g.Name(), Source: g.Source(), CoverURL: g.CoverURL(),
		SortOrder: g.SortOrder(), IsEnabled: g.IsEnabled(), Emojis: emojis,
	}
}

func emojiGroupsToDTOs(groups []*domainemoji.EmojiGroup) []EmojiGroupDTO {
	dtos := make([]EmojiGroupDTO, 0, len(groups))
	for _, g := range groups {
		dtos = append(dtos, emojiGroupToDTO(g))
	}
	return dtos
}

func emojiToDTO(e domainemoji.Emoji) EmojiDTO {
	return EmojiDTO{
		ID: e.ID(), GroupID: e.GroupID(), Name: e.Name(), URL: e.URL(),
		SourceURL: e.SourceURL(), GifURL: e.GifURL(),
		TextContent: e.TextContent(), SortOrder: e.SortOrder(),
	}
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
	UpdatedAt  string             `json:"updated_at"`
}

// MusicService 音乐用例服务（公开解析 + admin 管理）
type MusicService struct {
	repo     domainmusic.PlaylistRepository
	provider domainmusic.MusicProvider
	db       MusicSettingsStore // 单行配置读写
}

// MusicSettingsStore 音乐设置存储端口（由 infrastructure 适配实现）
type MusicSettingsStore interface {
	GetPlayerVersion(ctx context.Context) (string, error)
	UpdatePlayerVersion(ctx context.Context, version string) error
}

// NewMusicService 构造音乐服务
func NewMusicService(repo domainmusic.PlaylistRepository, provider domainmusic.MusicProvider, db MusicSettingsStore) *MusicService {
	return &MusicService{repo: repo, provider: provider, db: db}
}

// --- 公开解析（前台） ---

// ParseEmbedURL 解析音乐链接
func (s *MusicService) ParseEmbedURL(rawURL string) (domainmusic.EmbedInfo, error) {
	return s.provider.ParseEmbedURL(rawURL)
}

// Search 搜索歌曲
func (s *MusicService) Search(keyword string, limit int) ([]domainmusic.Song, error) {
	return s.provider.Search(keyword, limit)
}

// FetchLyrics 获取歌词
func (s *MusicService) FetchLyrics(platform, songID string) (string, error) {
	return s.provider.FetchLyrics(platform, songID)
}

// FetchSongDetail 获取歌曲详情
func (s *MusicService) FetchSongDetail(platform, songID string) (*domainmusic.Song, error) {
	return s.provider.FetchSongDetail(platform, songID)
}

// FetchSongMeta 获取歌曲元数据（封面+歌词）
func (s *MusicService) FetchSongMeta(platform, songID string) (*domainmusic.SongMeta, error) {
	return s.provider.FetchSongMeta(platform, songID)
}

// ParsePlaylistURL 解析歌单链接返回歌单元数据（公开前台）
func (s *MusicService) ParsePlaylistURL(rawURL string) (*domainmusic.PlaylistMeta, error) {
	return s.provider.FetchPlaylist(rawURL)
}

// --- 歌单查询（前台） ---

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

// GetPlaylist 获取歌单详情
func (s *MusicService) GetPlaylist(ctx context.Context, id string) (PlaylistDTO, error) {
	pid, err := shared.ParseID(id)
	if err != nil {
		return PlaylistDTO{}, err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return PlaylistDTO{}, err
	}
	return playlistToDTO(p), nil
}

// --- 歌单管理（后台） ---

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

// CreatePlaylistInput 创建歌单入参（解析第三方歌单链接导入）
type CreatePlaylistInput struct {
	URL string // 歌单链接
}

// CreatePlaylist 导入歌单（解析链接获取歌曲列表后创建）
func (s *MusicService) CreatePlaylist(ctx context.Context, in CreatePlaylistInput) (PlaylistDTO, error) {
	meta, err := s.provider.FetchPlaylist(in.URL)
	if err != nil {
		return PlaylistDTO{}, err
	}
	pid := shared.NewID()
	p, err := domainmusic.NewPlaylist(pid, meta.Title, meta.Platform, meta.PlaylistID)
	if err != nil {
		return PlaylistDTO{}, err
	}
	p.SetSongs(meta.Songs)
	if err := s.repo.Save(ctx, p); err != nil {
		return PlaylistDTO{}, err
	}
	return playlistToDTO(p), nil
}

// CreateCustomPlaylist 创建自定义空歌单
func (s *MusicService) CreateCustomPlaylist(ctx context.Context, title string) (PlaylistDTO, error) {
	pid := shared.NewID()
	p, err := domainmusic.NewPlaylist(pid, title, "custom", "")
	if err != nil {
		return PlaylistDTO{}, err
	}
	if err := s.repo.Save(ctx, p); err != nil {
		return PlaylistDTO{}, err
	}
	return playlistToDTO(p), nil
}

// UpdatePlaylistInput 更新歌单入参
type UpdatePlaylistInput struct {
	ID       string
	Title    *string
	IsActive *bool
}

// UpdatePlaylist 更新歌单
func (s *MusicService) UpdatePlaylist(ctx context.Context, in UpdatePlaylistInput) error {
	pid, err := shared.ParseID(in.ID)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	if in.IsActive != nil {
		p.SetActive(*in.IsActive)
	}
	// Title 通过重建更新（Playlist 聚合无 SetTitle，用 Reconstruct）
	if in.Title != nil && *in.Title != "" {
		rebuilt := domainmusic.ReconstructPlaylist(
			pid, *in.Title, p.Cover(), p.Creator(), p.Platform(), p.PlaylistID(),
			len(p.Songs()), p.Songs(), p.IsActive(),
		)
		p = rebuilt
	}
	return s.repo.Save(ctx, p)
}

// RefreshPlaylistSongs 刷新歌单歌曲（重新从第三方拉取）
func (s *MusicService) RefreshPlaylistSongs(ctx context.Context, id string) (PlaylistDTO, error) {
	pid, err := shared.ParseID(id)
	if err != nil {
		return PlaylistDTO{}, err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return PlaylistDTO{}, err
	}
	// 用 platform + playlistID 重新拉取
	meta, err := s.provider.FetchPlaylist(p.PlaylistID())
	if err != nil {
		return PlaylistDTO{}, err
	}
	p.SetSongs(meta.Songs)
	if err := s.repo.Save(ctx, p); err != nil {
		return PlaylistDTO{}, err
	}
	return playlistToDTO(p), nil
}

// AddSongInput 添加歌曲入参
type AddSongInput struct {
	PlaylistID string
	Name       string
	Artist     string
	URL        string
	Cover      string
}

// AddSong 添加歌曲到歌单
func (s *MusicService) AddSong(ctx context.Context, in AddSongInput) error {
	pid, err := shared.ParseID(in.PlaylistID)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	songs := append(p.Songs(), domainmusic.Song{
		Name: in.Name, Artist: in.Artist, URL: in.URL, Cover: in.Cover,
	})
	p.SetSongs(songs)
	return s.repo.Save(ctx, p)
}

// RemoveSong 从歌单移除指定索引歌曲
func (s *MusicService) RemoveSong(ctx context.Context, playlistID string, index int) error {
	pid, err := shared.ParseID(playlistID)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	songs := p.Songs()
	if index < 0 || index >= len(songs) {
		return shared.BadRequest("歌曲索引超出范围")
	}
	newSongs := append(songs[:index], songs[index+1:]...)
	p.SetSongs(newSongs)
	return s.repo.Save(ctx, p)
}

// UpdateSongInput 更新歌单内歌曲信息入参
type UpdateSongInput struct {
	PlaylistID string
	Index      int
	Name       string
	Artist     string
	Cover      string
	URL        string
}

// UpdateSong 更新歌单内指定索引歌曲
func (s *MusicService) UpdateSong(ctx context.Context, in UpdateSongInput) error {
	pid, err := shared.ParseID(in.PlaylistID)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	songs := p.Songs()
	if in.Index < 0 || in.Index >= len(songs) {
		return shared.BadRequest("歌曲索引超出范围")
	}
	song := songs[in.Index]
	if in.Name != "" {
		song.Name = in.Name
	}
	if in.Artist != "" {
		song.Artist = in.Artist
	}
	if in.Cover != "" {
		song.Cover = in.Cover
	}
	if in.URL != "" {
		song.URL = in.URL
	}
	songs[in.Index] = song
	p.SetSongs(songs)
	return s.repo.Save(ctx, p)
}

// MusicSettingsDTO 音乐设置读模型
type MusicSettingsDTO struct {
	PlayerVersion string `json:"player_version"`
}

// GetSettings 获取播放器设置
func (s *MusicService) GetSettings(ctx context.Context) (MusicSettingsDTO, error) {
	version, err := s.db.GetPlayerVersion(ctx)
	if err != nil {
		return MusicSettingsDTO{}, shared.Internal("获取播放器设置失败", err)
	}
	return MusicSettingsDTO{PlayerVersion: version}, nil
}

// UpdatePlayerVersion 更新播放器版本
func (s *MusicService) UpdatePlayerVersion(ctx context.Context, version string) error {
	if version == "" {
		return shared.BadRequest("播放器版本不能为空")
	}
	return s.db.UpdatePlayerVersion(ctx, version)
}

func playlistToDTO(p *domainmusic.Playlist) PlaylistDTO {
	return PlaylistDTO{
		ID: p.ID().String(), Title: p.Title(), Cover: p.Cover(),
		Creator: p.Creator(), Platform: p.Platform(), PlaylistID: p.PlaylistID(),
		SongCount: p.SongCount(), Songs: p.Songs(), IsActive: p.IsActive(),
	}
}

func playlistsToDTOs(playlists []*domainmusic.Playlist) []PlaylistDTO {
	dtos := make([]PlaylistDTO, 0, len(playlists))
	for _, p := range playlists {
		dtos = append(dtos, playlistToDTO(p))
	}
	return dtos
}

// ============================================================
// Upload Service
// ============================================================

// 文件上传限制
const maxFileSize = 1024 * 1024 * 1024 // 1GB

// allowedUploadTypes 支持的上传文件扩展名→MIME 映射
var allowedUploadTypes = map[string]string{
	".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
	".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
	".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
	".avi": "video/x-msvideo", ".mkv": "video/x-matroska",
	".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
	".flac": "audio/flac", ".aac": "audio/aac",
	".pdf": "application/pdf",
	".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".ppt": "application/vnd.ms-powerpoint", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	".zip": "application/zip", ".rar": "application/vnd.rar", ".7z": "application/x-7z-compressed",
	".md": "text/markdown",
}

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
	AltText      string `json:"alt_text"`
	Category     string `json:"category"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// UploadService 文件上传用例服务
type UploadService struct {
	fileRepo    domainupload.FileRepository
	sessionRepo domainupload.UploadSessionRepository
	storage     domainupload.ChunkStorage
	processor   domainupload.ImageProcessor
	chunkDir    string
	uploadDir   string // 上传根目录（缩略图等直写路径用）
	urlPrefix   string // 上传 URL 前缀
}

// NewUploadService 构造上传服务。
// uploadDir 为上传根目录，urlPrefix 为上传 URL 前缀，均用于缩略图等直写场景。
func NewUploadService(fileRepo domainupload.FileRepository, sessionRepo domainupload.UploadSessionRepository, storage domainupload.ChunkStorage, processor domainupload.ImageProcessor, chunkDir, uploadDir, urlPrefix string) *UploadService {
	return &UploadService{
		fileRepo:    fileRepo,
		sessionRepo: sessionRepo,
		storage:     storage,
		processor:   processor,
		chunkDir:    chunkDir,
		uploadDir:   uploadDir,
		urlPrefix:   urlPrefix,
	}
}

// InitSessionInput 初始化上传会话入参
type InitSessionInput struct {
	UserID    string
	FileName  string
	FileSize  int64
	FileHash  string
	MimeType  string
	ChunkSize int
	Purpose   string
}

// InitSessionResult 初始化上传会话结果
type InitSessionResult struct {
	Instant        bool   `json:"instant"`
	FileID         string `json:"file_id,omitempty"`
	URL            string `json:"url,omitempty"`
	UploadID       string `json:"upload_id,omitempty"`
	ChunkSize      int    `json:"chunk_size"`
	TotalChunks    int    `json:"total_chunks"`
	UploadedChunks []int  `json:"uploaded_chunks"`
}

// InitSession 初始化上传会话（秒传/续传/新建）
func (s *UploadService) InitSession(ctx context.Context, in InitSessionInput) (*InitSessionResult, error) {
	uid, err := shared.ParseID(in.UserID)
	if err != nil {
		return nil, err
	}
	ext := strings.ToLower(filepath.Ext(in.FileName))
	if _, ok := allowedUploadTypes[ext]; !ok {
		return nil, shared.BadRequest("不支持的文件类型")
	}
	if in.FileSize > maxFileSize {
		return nil, shared.BadRequest("文件过大（上限 1GB）")
	}
	purpose := in.Purpose
	if purpose == "" {
		purpose = "material"
	}

	// 秒传检查(仅命中自己上传过的文件,防越权秒传他人文件)
	if in.FileHash != "" {
		if f, err := s.fileRepo.FindByHash(ctx, in.FileHash, uid); err == nil && f != nil {
			return &InitSessionResult{Instant: true, FileID: f.ID().String(), URL: f.URL()}, nil
		}
	}

	chunkSize := in.ChunkSize
	if chunkSize <= 0 {
		chunkSize = 5 * 1024 * 1024
	}
	totalChunks := int((in.FileSize + int64(chunkSize) - 1) / int64(chunkSize))
	if totalChunks == 0 {
		totalChunks = 1
	}

	// 续传恢复
	if in.FileHash != "" {
		if existing, err := s.sessionRepo.FindByHash(ctx, in.FileHash, uid); err == nil && existing != nil {
			return &InitSessionResult{
				UploadID: existing.ID().String(), ChunkSize: existing.ChunkSize(),
				TotalChunks: existing.TotalChunks(), UploadedChunks: existing.UploadedChunks(),
			}, nil
		}
	}

	// 新建会话
	mimeType := in.MimeType
	if mimeType == "" {
		mimeType = allowedUploadTypes[ext]
	}
	sid := shared.NewID()
	tmpPath := filepath.Join(s.chunkDir, sid.String())
	session := domainupload.ReconstructUploadSession(
		sid, uid, in.FileName, in.FileSize, mimeType, in.FileHash,
		purpose, chunkSize, totalChunks, []int{}, domainupload.SessionActive, tmpPath,
		time.Now().Add(24*time.Hour), time.Time{}, time.Time{},
	)
	if err := s.storage.EnsureDir(tmpPath); err != nil {
		return nil, shared.Internal("创建分片目录失败", err)
	}
	if err := s.sessionRepo.Save(ctx, session); err != nil {
		_ = s.storage.CleanupDir(tmpPath)
		return nil, err
	}
	return &InitSessionResult{
		UploadID: sid.String(), ChunkSize: chunkSize,
		TotalChunks: totalChunks, UploadedChunks: []int{},
	}, nil
}

// SaveChunk 保存单个分片
func (s *UploadService) SaveChunk(ctx context.Context, uploadID string, index int, data []byte, callerID string) error {
	sid, err := shared.ParseID(uploadID)
	if err != nil {
		return err
	}
	session, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return err
	}
	// owner 校验:防越权操作他人上传会话
	cid, err := shared.ParseID(callerID)
	if err != nil {
		return shared.BadRequest("无效的调用者 ID")
	}
	if !session.UserID().Equal(cid) {
		return shared.Forbidden("无权操作他人上传会话")
	}
	if session.Status() != domainupload.SessionActive {
		return domainupload.ErrSessionNotActive
	}
	if index < 0 || index >= session.TotalChunks() {
		return domainupload.ErrChunkIndexInvalid
	}
	if err := s.storage.SaveChunk(session.TmpPath(), index, data); err != nil {
		return shared.Internal("保存分片失败", err)
	}
	return s.sessionRepo.AppendChunk(ctx, sid, index)
}

// MergeResult 合并上传结果
type MergeResult struct {
	FileID    string `json:"file_id"`
	URL       string `json:"url"`
	Thumbnail string `json:"thumbnail,omitempty"`
	Width     int    `json:"width,omitempty"`
	Height    int    `json:"height,omitempty"`
}

// CompleteUpload 合并所有分片为完整文件
func (s *UploadService) CompleteUpload(ctx context.Context, uploadID, userID string) (*MergeResult, error) {
	sid, err := shared.ParseID(uploadID)
	if err != nil {
		return nil, err
	}
	uid, err := shared.ParseID(userID)
	if err != nil {
		return nil, err
	}
	session, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return nil, err
	}
	// owner 校验:防越权操作他人上传会话
	if !session.UserID().Equal(uid) {
		return nil, shared.Forbidden("无权操作他人上传会话")
	}
	if !session.IsComplete() {
		return nil, domainupload.ErrUploadIncomplete
	}
	// CAS：active → merging
	ok, err := s.sessionRepo.UpdateStatus(ctx, sid, domainupload.SessionActive, domainupload.SessionMerging)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domainupload.ErrSessionNotActive
	}

	// 合并分片
	mergedPath := filepath.Join(session.TmpPath(), "merged")
	if err := s.storage.MergeChunks(session.TmpPath(), session.TotalChunks(), mergedPath); err != nil {
		_, _ = s.sessionRepo.UpdateStatus(ctx, sid, domainupload.SessionMerging, domainupload.SessionActive)
		return nil, shared.Internal("合并分片失败", err)
	}

	// 图片校验 + 转码(仅图片走转码;非图片跳过保持兼容)
	srcMime := session.MimeType()
	finalMime := srcMime
	finalExt := strings.ToLower(filepath.Ext(session.FileName()))
	if s.processor != nil && strings.HasPrefix(srcMime, "image/") {
		// 校验:非图片或损坏文件拒绝(不落盘)
		validMime, err := s.processor.Validate(mergedPath)
		if err != nil {
			_ = s.storage.CleanupDir(session.TmpPath())
			return nil, shared.BadRequest("图片校验失败: " + err.Error())
		}
		srcMime = validMime
		// 转 WebP(GIF/WebP 跳过;JPEG/PNG 仅更小时采用,否则回退)
		result, err := s.processor.Transcode(mergedPath, filepath.Dir(mergedPath), "transcoded", srcMime)
		if err != nil {
			_ = s.storage.CleanupDir(session.TmpPath())
			return nil, shared.Internal("图片转码失败", err)
		}
		mergedPath = result.Path
		finalMime = result.MimeType
		finalExt = result.Ext
	}

	// 最终路径(用转码后的 ext)
	fileUUID := shared.NewID()
	finalPath, fileURL, err := s.storage.BuildPath(session.Purpose(), time.Now(), fileUUID.String(), finalExt)
	if err != nil {
		return nil, shared.BadRequest("非法的上传用途路径: " + err.Error())
	}
	if err := s.storage.EnsureDir(filepath.Dir(finalPath)); err != nil {
		return nil, shared.Internal("创建文件目录失败", err)
	}
	if err := s.storage.Move(mergedPath, finalPath); err != nil {
		return nil, shared.Internal("移动文件失败", err)
	}
	fileSize, err := s.storage.FileSize(finalPath)
	if err != nil {
		fileSize = session.FileSize()
	}

	// 尺寸 + 缩略图(用 processor,若可用)
	width, height := 0, 0
	storageDir := session.Purpose()
	if storageDir == "material" {
		storageDir = filepath.Join(storageDir, mimeToCategory(finalMime))
	}
	var thumbnail string
	if s.processor != nil {
		if strings.HasPrefix(finalMime, "image/") {
			width, height = s.processor.Dimensions(finalPath)
		}
		thumbnail = s.processor.Thumbnail(finalPath, fileUUID.String(), storageDir, finalMime)
	} else {
		// processor 未注入(如测试)走 storage 兼容路径
		if strings.HasPrefix(finalMime, "image/") {
			width, height = s.storage.ImageDimensions(finalPath)
		}
		thumbnail = s.storage.GenerateThumbnail(finalPath, fileUUID.String(), storageDir, finalMime)
	}

	// File 记录(用转码后的 mime)
	f, err := domainupload.NewFile(fileUUID, uid, session.Purpose(), session.FileName(), finalPath, fileURL, fileSize, finalMime, session.FileHash())
	if err != nil {
		return nil, err
	}
	if width > 0 {
		f.SetDimensions(width, height)
	}
	if thumbnail != "" {
		f.SetThumbnail(thumbnail)
	}
	if err := s.fileRepo.Save(ctx, f); err != nil {
		return nil, err
	}

	_ = s.storage.CleanupDir(session.TmpPath())
	_, _ = s.sessionRepo.UpdateStatus(ctx, sid, domainupload.SessionMerging, domainupload.SessionCompleted)

	return &MergeResult{
		FileID: fileUUID.String(), URL: fileURL,
		Thumbnail: thumbnail, Width: width, Height: height,
	}, nil
}

// CancelUpload 取消上传
func (s *UploadService) CancelUpload(ctx context.Context, uploadID, callerID string) error {
	sid, err := shared.ParseID(uploadID)
	if err != nil {
		return err
	}
	session, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return err
	}
	// owner 校验:防越权操作他人上传会话
	cid, err := shared.ParseID(callerID)
	if err != nil {
		return shared.BadRequest("无效的调用者 ID")
	}
	if !session.UserID().Equal(cid) {
		return shared.Forbidden("无权操作他人上传会话")
	}
	if session.Status() != domainupload.SessionActive {
		return domainupload.ErrSessionNotActive
	}
	if session.TmpPath() != "" {
		_ = s.storage.CleanupDir(session.TmpPath())
	}
	return s.sessionRepo.Delete(ctx, sid)
}

// GetUploadStatus 查询上传状态（断点续传）
func (s *UploadService) GetUploadStatus(ctx context.Context, uploadID, callerID string) (*InitSessionResult, error) {
	sid, err := shared.ParseID(uploadID)
	if err != nil {
		return nil, err
	}
	session, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return nil, err
	}
	// owner 校验:防越权操作他人上传会话
	cid, err := shared.ParseID(callerID)
	if err != nil {
		return nil, shared.BadRequest("无效的调用者 ID")
	}
	if !session.UserID().Equal(cid) {
		return nil, shared.Forbidden("无权操作他人上传会话")
	}
	return &InitSessionResult{
		UploadID: session.ID().String(), ChunkSize: session.ChunkSize(),
		TotalChunks: session.TotalChunks(), UploadedChunks: session.UploadedChunks(),
	}, nil
}

// mimeToCategory MIME → 分类目录
func mimeToCategory(mimeType string) string {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return "image"
	case strings.HasPrefix(mimeType, "video/"):
		return "video"
	case strings.HasPrefix(mimeType, "audio/"):
		return "audio"
	default:
		return "file"
	}
}

// CheckInstantUpload 秒传检查(仅命中自己上传过的文件)
func (s *UploadService) CheckInstantUpload(ctx context.Context, hash, callerID string) (*FileDTO, bool, error) {
	cid, err := shared.ParseID(callerID)
	if err != nil {
		return nil, false, shared.BadRequest("无效的调用者 ID")
	}
	f, err := s.fileRepo.FindByHash(ctx, hash, cid)
	if err != nil {
		if err == domainupload.ErrFileNotFound {
			return nil, false, nil
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

// GetFile 按 ID 获取文件详情（公开，不限 owner）
func (s *UploadService) GetFile(ctx context.Context, id string) (*FileDTO, error) {
	fid, err := shared.ParseID(id)
	if err != nil {
		return nil, err
	}
	f, err := s.fileRepo.FindByID(ctx, fid)
	if err != nil {
		return nil, err
	}
	dto := fileToDTO(f)
	return &dto, nil
}

// BatchDeleteFiles 批量删除文件（软删除，返回成功删除数）
func (s *UploadService) BatchDeleteFiles(ctx context.Context, ids []string) (int, error) {
	if len(ids) == 0 {
		return 0, shared.BadRequest("文件 ID 列表不能为空")
	}
	deleted := 0
	for _, idStr := range ids {
		fid, err := shared.ParseID(idStr)
		if err != nil {
			continue
		}
		f, err := s.fileRepo.FindByID(ctx, fid)
		if err != nil {
			continue // 不存在跳过
		}
		if !f.CanPhysicallyDelete() {
			continue // 被引用跳过
		}
		if err := s.fileRepo.Delete(ctx, fid); err == nil {
			deleted++
		}
	}
	return deleted, nil
}

// ListAllFilesInput 全局文件列表查询入参（后台素材管理用）
type ListAllFilesInput struct {
	Page    int
	Limit   int
	Purpose string // 用途筛选
	// MIME 类型筛选：image / video / audio / file，后端转成前缀查询
	MimeCategory string
	Category     string // 自定义分类筛选
	Keyword      string // 关键词搜索（文件名）
}

// ListAllFiles 全局查询文件列表（后台素材管理，不限 owner）
func (s *UploadService) ListAllFiles(ctx context.Context, in ListAllFilesInput) ([]FileDTO, int64, error) {
	page := in.Page
	if page < 1 {
		page = 1
	}
	limit := in.Limit
	if limit < 1 || limit > 100 {
		limit = 20
	}
	// mimeCategory → mimePrefix 转换
	mimePrefix := ""
	switch in.MimeCategory {
	case "image":
		mimePrefix = "image/"
	case "video":
		mimePrefix = "video/"
	case "audio":
		mimePrefix = "audio/"
	case "file":
		// 「文件」指非媒体类型，用 NOT IN 排除图片/视频/音频（这里简化为不过滤，
		// 由前端在结果中按需展示；精确排除需仓储支持 NOT LIKE，暂不做）
	}
	result, err := s.fileRepo.FindAll(ctx, domainupload.FileListFilter{
		Purpose:    in.Purpose,
		Category:   in.Category,
		MimePrefix: mimePrefix,
		Keyword:    in.Keyword,
	}, page, limit)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]FileDTO, 0, len(result.Files))
	for _, f := range result.Files {
		dtos = append(dtos, fileToDTO(f))
	}
	return dtos, result.Total, nil
}

// UpdateFileMetadataInput 更新素材元数据入参
type UpdateFileMetadataInput struct {
	ID           string
	AltText      string // 描述/替代文本
	Category     string // 自定义分类
	OriginalName string // 重命名（空则不变）
}

// UpdateFileMetadata 更新素材元数据（描述/分类/文件名）
func (s *UploadService) UpdateFileMetadata(ctx context.Context, in UpdateFileMetadataInput) (FileDTO, error) {
	fid, err := shared.ParseID(in.ID)
	if err != nil {
		return FileDTO{}, err
	}
	f, err := s.fileRepo.FindByID(ctx, fid)
	if err != nil {
		return FileDTO{}, err
	}
	if len(in.AltText) > 500 {
		return FileDTO{}, shared.BadRequest("描述不能超过 500 字符")
	}
	if len(in.Category) > 50 {
		return FileDTO{}, shared.BadRequest("分类不能超过 50 字符")
	}
	f.UpdateMetadata(in.AltText, in.Category, in.OriginalName)
	if err := s.fileRepo.Save(ctx, f); err != nil {
		return FileDTO{}, err
	}
	return fileToDTO(f), nil
}

// UploadThumbnailInput 上传缩略图入参
type UploadThumbnailInput struct {
	FileID   string
	FileName string
	MimeType string
	Content  []byte
}

// UploadThumbnail 为指定文件上传缩略图，返回缩略图 URL
func (s *UploadService) UploadThumbnail(ctx context.Context, in UploadThumbnailInput, callerID string) (string, error) {
	fid, err := shared.ParseID(in.FileID)
	if err != nil {
		return "", err
	}
	f, err := s.fileRepo.FindByID(ctx, fid)
	if err != nil {
		return "", err
	}
	// owner 校验:防越权覆盖他人文件的缩略图
	cid, err := shared.ParseID(callerID)
	if err != nil {
		return "", shared.BadRequest("无效的调用者 ID")
	}
	if !f.OwnerID().Equal(cid) {
		return "", shared.Forbidden("无权操作他人文件")
	}
	// 缩略图存到文件同目录，命名 fileUUID_thumb.<ext>
	ext := strings.ToLower(filepath.Ext(in.FileName))
	thumbName := fid.String() + "_thumb" + ext
	storageDir := f.Purpose()
	thumbPath := filepath.Join(s.uploadDir, storageDir, thumbName)
	if err := s.storage.EnsureDir(filepath.Dir(thumbPath)); err != nil {
		return "", shared.Internal("创建缩略图目录失败", err)
	}
	if err := os.WriteFile(thumbPath, in.Content, 0o644); err != nil {
		return "", shared.Internal("保存缩略图失败", err)
	}
	url := s.urlPrefix + storageDir + "/" + thumbName
	f.SetThumbnail(url)
	if err := s.fileRepo.Save(ctx, f); err != nil {
		return "", err
	}
	return url, nil
}

// ReplaceMediaFileInput 覆盖素材原图入参(套用 UploadThumbnailInput 形状)
type ReplaceMediaFileInput struct {
	FileID   string
	FileName string
	MimeType string
	Content  []byte
}

// ReplaceMediaFile 用裁剪后的新文件覆盖调用者自己上传的素材记录。
//
// 流程:owner 校验 → 写临时文件 → 校验图片 → 转码 WebP → BuildPath/Move
// → 算 SHA-256 → ReplaceStoredFile 更新指针 → Save → 返回 DTO。
//
// 安全:fileHash 更新为新值,避免旧 hash 秒传误命中;旧物理文件保留。
// 仅静态图支持(GIF 转码丢动画且文件不变,覆盖无意义);收到 GIF 返回 BadRequest。
func (s *UploadService) ReplaceMediaFile(ctx context.Context, in ReplaceMediaFileInput, callerID string) (FileDTO, error) {
	fid, err := shared.ParseID(in.FileID)
	if err != nil {
		return FileDTO{}, err
	}
	f, err := s.fileRepo.FindByID(ctx, fid)
	if err != nil {
		return FileDTO{}, err
	}
	cid, err := shared.ParseID(callerID)
	if err != nil {
		return FileDTO{}, shared.BadRequest("无效的调用者 ID")
	}
	if !f.OwnerID().Equal(cid) {
		return FileDTO{}, shared.Forbidden("无权操作他人文件")
	}

	// GIF 不允许覆盖(转码丢动画,且文件字节不变覆盖无意义)
	if in.MimeType == "image/gif" {
		return FileDTO{}, shared.BadRequest("GIF 不支持覆盖原图")
	}

	// 写临时文件供 processor 校验/转码
	tmpDir := filepath.Join(s.uploadDir, ".replace-tmp", fid.String())
	if err := s.storage.EnsureDir(tmpDir); err != nil {
		return FileDTO{}, shared.Internal("创建临时目录失败", err)
	}
	ext := strings.ToLower(filepath.Ext(in.FileName))
	if ext == "" {
		ext = ".jpg"
	}
	tmpPath := filepath.Join(tmpDir, "src"+ext)
	if err := os.WriteFile(tmpPath, in.Content, 0o644); err != nil {
		return FileDTO{}, shared.Internal("写入临时文件失败", err)
	}
	defer s.storage.CleanupDir(tmpDir)

	// 校验真实图片 + 拒绝 GIF(sniff 后真 MIME 可能与声明不同)
	srcMime := in.MimeType
	if s.processor != nil {
		validMime, err := s.processor.Validate(tmpPath)
		if err != nil {
			return FileDTO{}, shared.BadRequest("图片校验失败: " + err.Error())
		}
		if validMime == "image/gif" {
			return FileDTO{}, shared.BadRequest("GIF 不支持覆盖原图")
		}
		srcMime = validMime
		// 转码 WebP(GIF 已挡,JPEG/PNG 仅更小时采用)
		result, err := s.processor.Transcode(tmpPath, tmpDir, "replaced", srcMime)
		if err != nil {
			return FileDTO{}, shared.Internal("图片转码失败", err)
		}
		tmpPath = result.Path
		srcMime = result.MimeType
		ext = result.Ext
	}

	// 最终路径(date 分段,新 fileUUID 避免与旧文件同名)
	fileUUID := shared.NewID()
	finalPath, fileURL, err := s.storage.BuildPath(f.Purpose(), time.Now(), fileUUID.String(), ext)
	if err != nil {
		return FileDTO{}, shared.BadRequest("非法的上传用途路径: " + err.Error())
	}
	if err := s.storage.EnsureDir(filepath.Dir(finalPath)); err != nil {
		return FileDTO{}, shared.Internal("创建文件目录失败", err)
	}
	if err := s.storage.Move(tmpPath, finalPath); err != nil {
		return FileDTO{}, shared.Internal("移动文件失败", err)
	}
	fileSize, err := s.storage.FileSize(finalPath)
	if err != nil {
		fileSize = int64(len(in.Content))
	}

	// 尺寸 + 缩略图
	width, height := 0, 0
	storageDir := f.Purpose()
	if storageDir == "material" {
		storageDir = filepath.Join(storageDir, mimeToCategory(srcMime))
	}
	var thumbnail string
	if s.processor != nil {
		width, height = s.processor.Dimensions(finalPath)
		thumbnail = s.processor.Thumbnail(finalPath, fileUUID.String(), storageDir, srcMime)
	} else {
		width, height = s.storage.ImageDimensions(finalPath)
		thumbnail = s.storage.GenerateThumbnail(finalPath, fileUUID.String(), storageDir, srcMime)
	}

	// SHA-256(无现成 helper,inline)
	sum := sha256.Sum256(in.Content)
	newHash := hex.EncodeToString(sum[:])

	// 更新实体指针
	var w, h *int
	if width > 0 {
		ww, hh := width, height
		w, h = &ww, &hh
	}
	f.ReplaceStoredFile(finalPath, fileURL, fileSize, srcMime, newHash, w, h, thumbnail)
	if err := s.fileRepo.Save(ctx, f); err != nil {
		return FileDTO{}, err
	}
	return fileToDTO(f), nil
}

func fileToDTO(f *domainupload.File) FileDTO {
	return FileDTO{
		ID: f.ID().String(), OwnerID: f.OwnerID().String(),
		Purpose: f.Purpose(), OriginalName: f.OriginalName(),
		URL: f.URL(), Size: f.Size(), MimeType: f.MimeType(),
		Thumbnail: f.Thumbnail(), Status: f.Status(),
		AltText: f.AltText(), Category: f.Category(),
		CreatedAt: f.CreatedAt().Format(time.RFC3339),
		UpdatedAt: f.UpdatedAt().Format(time.RFC3339),
	}
}
