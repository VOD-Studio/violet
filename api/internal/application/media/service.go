// Package media 提供 emoji/music/upload 三个模块的 application 层用例。
//
// 三个模块合并到一个包，避免过多小文件，各自独立的 Service 结构体。
package media

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

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

// EmojiService 表情用例服务
type EmojiService struct {
	repo     domainemoji.EmojiGroupRepository
	emojiDir string
}

// NewEmojiService 构造表情服务
//
// emojiDir 为表情文件存储目录（如 "uploads/emojis"）
func NewEmojiService(repo domainemoji.EmojiGroupRepository, emojiDir string) *EmojiService {
	return &EmojiService{repo: repo, emojiDir: emojiDir}
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
	// 返回相对 URL（与静态文件服务前缀对应）
	url := "/" + s.emojiDir + "/" + newName
	return &EmojiUploadResult{URL: url, Filename: newName, Size: size, MimeType: finalMIME}, nil
}

func emojiGroupToDTO(g *domainemoji.EmojiGroup) EmojiGroupDTO {
	emojis := make([]EmojiDTO, 0, len(g.Emojis()))
	for _, e := range g.Emojis() {
		emojis = append(emojis, emojiToDTO(e))
	}
	return EmojiGroupDTO{
		ID: g.ID(), Name: g.Name(), Source: g.Source(),
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
	CreatedAt    string `json:"created_at"`
}

// UploadService 文件上传用例服务
type UploadService struct {
	fileRepo    domainupload.FileRepository
	sessionRepo domainupload.UploadSessionRepository
	storage     domainupload.ChunkStorage
	chunkDir    string
}

// NewUploadService 构造上传服务
func NewUploadService(fileRepo domainupload.FileRepository, sessionRepo domainupload.UploadSessionRepository, storage domainupload.ChunkStorage, chunkDir string) *UploadService {
	return &UploadService{fileRepo: fileRepo, sessionRepo: sessionRepo, storage: storage, chunkDir: chunkDir}
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

	// 秒传检查
	if in.FileHash != "" {
		if f, err := s.fileRepo.FindByHash(ctx, in.FileHash); err == nil && f != nil {
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
func (s *UploadService) SaveChunk(ctx context.Context, uploadID string, index int, data []byte) error {
	sid, err := shared.ParseID(uploadID)
	if err != nil {
		return err
	}
	session, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return err
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

	// 最终路径
	ext := strings.ToLower(filepath.Ext(session.FileName()))
	fileUUID := shared.NewID()
	finalPath, fileURL := s.storage.BuildPath(session.Purpose(), session.MimeType(), fileUUID.String(), ext)
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

	// 缩略图 + 尺寸
	width, height := 0, 0
	storageDir := session.Purpose()
	if storageDir == "material" {
		storageDir = filepath.Join(storageDir, mimeToCategory(session.MimeType()))
	}
	if strings.HasPrefix(session.MimeType(), "image/") {
		width, height = s.storage.ImageDimensions(finalPath)
	}
	thumbnail := s.storage.GenerateThumbnail(finalPath, fileUUID.String(), storageDir, session.MimeType())

	// File 记录
	f, err := domainupload.NewFile(fileUUID, uid, session.Purpose(), session.FileName(), finalPath, fileURL, fileSize, session.MimeType(), session.FileHash())
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
func (s *UploadService) CancelUpload(ctx context.Context, uploadID string) error {
	sid, err := shared.ParseID(uploadID)
	if err != nil {
		return err
	}
	session, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return err
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
func (s *UploadService) GetUploadStatus(ctx context.Context, uploadID string) (*InitSessionResult, error) {
	sid, err := shared.ParseID(uploadID)
	if err != nil {
		return nil, err
	}
	session, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return nil, err
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

// CheckInstantUpload 秒传检查
func (s *UploadService) CheckInstantUpload(ctx context.Context, hash string) (*FileDTO, bool, error) {
	f, err := s.fileRepo.FindByHash(ctx, hash)
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

// UploadThumbnailInput 上传缩略图入参
type UploadThumbnailInput struct {
	FileID   string
	FileName string
	MimeType string
	Content  []byte
}

// UploadThumbnail 为指定文件上传缩略图，返回缩略图 URL
func (s *UploadService) UploadThumbnail(ctx context.Context, in UploadThumbnailInput) (string, error) {
	fid, err := shared.ParseID(in.FileID)
	if err != nil {
		return "", err
	}
	f, err := s.fileRepo.FindByID(ctx, fid)
	if err != nil {
		return "", err
	}
	// 缩略图存到文件同目录，命名 fileUUID_thumb.<ext>
	ext := strings.ToLower(filepath.Ext(in.FileName))
	thumbName := fid.String() + "_thumb" + ext
	storageDir := f.Purpose()
	thumbPath := filepath.Join("uploads", storageDir, thumbName)
	if err := s.storage.EnsureDir(filepath.Dir(thumbPath)); err != nil {
		return "", shared.Internal("创建缩略图目录失败", err)
	}
	if err := os.WriteFile(thumbPath, in.Content, 0o644); err != nil {
		return "", shared.Internal("保存缩略图失败", err)
	}
	url := "/uploads/" + storageDir + "/" + thumbName
	f.SetThumbnail(url)
	if err := s.fileRepo.Save(ctx, f); err != nil {
		return "", err
	}
	return url, nil
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
