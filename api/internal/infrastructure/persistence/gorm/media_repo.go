package gorm

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"

	"blog-api/internal/domain/emoji"
	"blog-api/internal/domain/music"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/domain/upload"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// ============================================================
// EmojiGroupRepository
// ============================================================

type EmojiGroupRepository struct{ db *gorm.DB }

func NewEmojiGroupRepository(db *gorm.DB) *EmojiGroupRepository {
	return &EmojiGroupRepository{db: db}
}

func emojiGroupToPO(g *emoji.EmojiGroup) model.EmojiGroup {
	groupMetaBytes, _ := emojiMetaToBytes(g.Meta())
	po := model.EmojiGroup{
		ID: g.ID(), Name: g.Name(), Source: g.Source(), CoverURL: g.CoverURL(),
		SortOrder: g.SortOrder(), IsEnabled: g.IsEnabled(),
		Type: int(g.GroupType()),
		Meta: groupMetaBytes,
	}
	emojis := make([]model.Emoji, 0, len(g.Emojis()))
	for _, e := range g.Emojis() {
		metaBytes, _ := emojiMetaToBytes(e.Meta())
		emojis = append(emojis, model.Emoji{
			ID: e.ID(), GroupID: g.ID(), Name: e.Name(),
			URL: e.URL(), SourceURL: e.SourceURL(), GifURL: e.GifURL(),
			TextContent: e.TextContent(), SortOrder: e.SortOrder(),
			Meta: metaBytes,
		})
	}
	po.Emojis = emojis
	return po
}

func emojiGroupToDomain(po model.EmojiGroup) (*emoji.EmojiGroup, error) {
	groupMeta, _ := bytesToEmojiMeta(po.Meta)
	emojis := make([]emoji.Emoji, 0, len(po.Emojis))
	for _, e := range po.Emojis {
		meta, _ := bytesToEmojiMeta(e.Meta)
		emojis = append(emojis, emoji.ReconstructEmoji(
			e.ID, e.GroupID, e.Name, e.URL,
			e.SourceURL, e.GifURL, e.TextContent, e.SortOrder, meta,
		))
	}
	return emoji.ReconstructEmojiGroup(po.ID, po.Name, po.Source, po.CoverURL, po.SortOrder, po.IsEnabled, emoji.GroupType(po.Type), emojis, groupMeta), nil
}

func (r *EmojiGroupRepository) FindByID(ctx context.Context, id int32) (*emoji.EmojiGroup, error) {
	var po model.EmojiGroup
	if err := r.db.WithContext(ctx).Preload("Emojis").First(&po, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, emoji.ErrNotFound
		}
		return nil, domainshared.Internal("查询表情分组失败", err)
	}
	return emojiGroupToDomain(po)
}

func (r *EmojiGroupRepository) FindAll(ctx context.Context, enabledOnly bool) ([]*emoji.EmojiGroup, error) {
	query := r.db.WithContext(ctx).Preload("Emojis", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	})
	if enabledOnly {
		query = query.Where("is_enabled = ?", true)
	}
	var pos []model.EmojiGroup
	if err := query.Order("sort_order ASC, id ASC").Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询表情分组失败", err)
	}
	result := make([]*emoji.EmojiGroup, 0, len(pos))
	for _, po := range pos {
		g, _ := emojiGroupToDomain(po)
		result = append(result, g)
	}
	return result, nil
}

func (r *EmojiGroupRepository) FindByName(ctx context.Context, name string) (*emoji.EmojiGroup, error) {
	var po model.EmojiGroup
	if err := r.db.WithContext(ctx).Preload("Emojis").Where("name = ?", name).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, emoji.ErrNotFound
		}
		return nil, domainshared.Internal("查询表情分组失败", err)
	}
	return emojiGroupToDomain(po)
}

func (r *EmojiGroupRepository) Save(ctx context.Context, g *emoji.EmojiGroup) (int32, error) {
	po := emojiGroupToPO(g)
	if po.ID == 0 {
		if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
			return 0, domainshared.Internal("创建表情分组失败", err)
		}
	} else {
		if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
			return 0, domainshared.Internal("保存表情分组失败", err)
		}
	}
	return po.ID, nil
}

func (r *EmojiGroupRepository) Delete(ctx context.Context, id int32) error {
	result := r.db.WithContext(ctx).Delete(&model.EmojiGroup{}, id)
	if result.Error != nil {
		return domainshared.Internal("删除表情分组失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return emoji.ErrNotFound
	}
	return nil
}

func (r *EmojiGroupRepository) UpdateEnabled(ctx context.Context, id int32, enabled bool) error {
	result := r.db.WithContext(ctx).Model(&model.EmojiGroup{}).Where("id = ?", id).Update("is_enabled", enabled)
	if result.Error != nil {
		return domainshared.Internal("更新表情分组状态失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return emoji.ErrNotFound
	}
	return nil
}

// BatchUpdateEnabled 批量更新分组启用状态
func (r *EmojiGroupRepository) BatchUpdateEnabled(ctx context.Context, ids []int32, enabled bool) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result := r.db.WithContext(ctx).Model(&model.EmojiGroup{}).
		Where("id IN ?", ids).Update("is_enabled", enabled)
	if result.Error != nil {
		return 0, domainshared.Internal("批量更新表情分组状态失败", result.Error)
	}
	return result.RowsAffected, nil
}

// ExistsByName 名称是否已存在（排除自身）
func (r *EmojiGroupRepository) ExistsByName(ctx context.Context, name string, excludeID int32) (bool, error) {
	var count int64
	query := r.db.WithContext(ctx).Model(&model.EmojiGroup{}).Where("name = ?", name)
	if excludeID > 0 {
		query = query.Where("id <> ?", excludeID)
	}
	if err := query.Count(&count).Error; err != nil {
		return false, domainshared.Internal("查询分组名称存在性失败", err)
	}
	return count > 0, nil
}

// Count 统计分组总数
func (r *EmojiGroupRepository) Count(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.EmojiGroup{}).Count(&count).Error; err != nil {
		return 0, domainshared.Internal("统计表情分组数量失败", err)
	}
	return count, nil
}

// FindGroupsNeedingCover 查询指定来源下封面为空或仍为远程 URL 的分组
func (r *EmojiGroupRepository) FindGroupsNeedingCover(ctx context.Context, source string) ([]*emoji.EmojiGroup, error) {
	var pos []model.EmojiGroup
	if err := r.db.WithContext(ctx).
		Where("source = ? AND (cover_url IS NULL OR cover_url = '' OR cover_url LIKE 'http%')", source).
		Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询待回填封面分组失败", err)
	}
	result := make([]*emoji.EmojiGroup, 0, len(pos))
	for _, po := range pos {
		g, _ := emojiGroupToDomain(po)
		result = append(result, g)
	}
	return result, nil
}

// UpdateCoverURL 更新分组封面 URL
func (r *EmojiGroupRepository) UpdateCoverURL(ctx context.Context, id int32, coverURL string) error {
	result := r.db.WithContext(ctx).Model(&model.EmojiGroup{}).
		Where("id = ?", id).Update("cover_url", coverURL)
	if result.Error != nil {
		return domainshared.Internal("更新分组封面失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return emoji.ErrNotFound
	}
	return nil
}

// UpsertByName 按名称合并分组：存在则更新，不存在则新建。
// emoji_groups.name 有全局唯一约束，故按 name 单字段匹配（与 ExistsByName 语义一致）。
func (r *EmojiGroupRepository) UpsertByName(ctx context.Context, g *emoji.EmojiGroup) (int32, error) {
	var existing model.EmojiGroup
	err := r.db.WithContext(ctx).
		Where("name = ?", g.Name()).
		First(&existing).Error
	if err == nil {
		// 存在则更新 cover/sort/enabled/type/meta
		groupMetaBytes, _ := emojiMetaToBytes(g.Meta())
		updates := r.db.WithContext(ctx).Model(&model.EmojiGroup{}).
			Where("id = ?", existing.ID).
			Updates(map[string]any{
				"cover_url":  g.CoverURL(),
				"sort_order": g.SortOrder(),
				"is_enabled": g.IsEnabled(),
				"type":       int(g.GroupType()),
				"meta":       groupMetaBytes,
			})
		if updates.Error != nil {
			return 0, domainshared.Internal("upsert 更新表情分组失败", updates.Error)
		}
		return existing.ID, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, domainshared.Internal("upsert 查询表情分组失败", err)
	}
	// 不存在则新建
	po := emojiGroupToPO(g)
	if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
		return 0, domainshared.Internal("upsert 创建表情分组失败", err)
	}
	return po.ID, nil
}

// UpsertEmojiByName 按 groupID+name 合并表情：存在则更新，不存在则新建。
func (r *EmojiGroupRepository) UpsertEmojiByName(ctx context.Context, e emoji.Emoji) (int32, error) {
	var existing model.Emoji
	err := r.db.WithContext(ctx).
		Where("group_id = ? AND name = ?", e.GroupID(), e.Name()).
		First(&existing).Error
	if err == nil {
		metaBytes, _ := emojiMetaToBytes(e.Meta())
		updates := r.db.WithContext(ctx).Model(&model.Emoji{}).
			Where("id = ?", existing.ID).
			Updates(map[string]any{
				"url":        e.URL(),
				"source_url": e.SourceURL(),
				"gif_url":    e.GifURL(),
				"sort_order": e.SortOrder(),
				"meta":       metaBytes,
			})
		if updates.Error != nil {
			return 0, domainshared.Internal("upsert 更新表情失败", updates.Error)
		}
		return existing.ID, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, domainshared.Internal("upsert 查询表情失败", err)
	}
	metaBytes, _ := emojiMetaToBytes(e.Meta())
	po := model.Emoji{
		GroupID: e.GroupID(), Name: e.Name(), URL: e.URL(),
		SourceURL: e.SourceURL(), GifURL: e.GifURL(),
		TextContent: e.TextContent(), SortOrder: e.SortOrder(),
		Meta: metaBytes,
	}
	if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
		return 0, domainshared.Internal("upsert 创建表情失败", err)
	}
	return po.ID, nil
}

// FindEmojisByGroup 查询分组内所有表情
func (r *EmojiGroupRepository) FindEmojisByGroup(ctx context.Context, groupID int32) ([]emoji.Emoji, error) {
	var pos []model.Emoji
	if err := r.db.WithContext(ctx).Where("group_id = ?", groupID).
		Order("sort_order ASC, id ASC").Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询分组表情失败", err)
	}
	result := make([]emoji.Emoji, 0, len(pos))
	for _, e := range pos {
		meta, _ := bytesToEmojiMeta(e.Meta)
		result = append(result, emoji.ReconstructEmoji(
			e.ID, e.GroupID, e.Name, e.URL,
			e.SourceURL, e.GifURL, e.TextContent, e.SortOrder, meta,
		))
	}
	return result, nil
}

// FindEmojiByID 按 ID 查表情
func (r *EmojiGroupRepository) FindEmojiByID(ctx context.Context, id int32) (emoji.Emoji, error) {
	var po model.Emoji
	if err := r.db.WithContext(ctx).First(&po, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return emoji.Emoji{}, emoji.ErrEmojiNotFound
		}
		return emoji.Emoji{}, domainshared.Internal("查询表情失败", err)
	}
	meta, _ := bytesToEmojiMeta(po.Meta)
	return emoji.ReconstructEmoji(
		po.ID, po.GroupID, po.Name, po.URL,
		po.SourceURL, po.GifURL, po.TextContent, po.SortOrder, meta,
	), nil
}

// SaveEmoji 保存表情（新增或更新），返回 ID
func (r *EmojiGroupRepository) SaveEmoji(ctx context.Context, e emoji.Emoji) (int32, error) {
	metaBytes, _ := emojiMetaToBytes(e.Meta())
	po := model.Emoji{
		ID: e.ID(), GroupID: e.GroupID(), Name: e.Name(), URL: e.URL(),
		SourceURL: e.SourceURL(), GifURL: e.GifURL(),
		TextContent: e.TextContent(), SortOrder: e.SortOrder(),
		Meta: metaBytes,
	}
	if po.ID == 0 {
		if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
			return 0, domainshared.Internal("创建表情失败", err)
		}
		return po.ID, nil
	}
	result := r.db.WithContext(ctx).Model(&model.Emoji{}).Where("id = ?", po.ID).Updates(map[string]any{
		"name": po.Name, "url": po.URL, "source_url": po.SourceURL,
		"gif_url": po.GifURL, "text_content": po.TextContent, "sort_order": po.SortOrder,
		"meta": metaBytes,
	})
	if result.Error != nil {
		return 0, domainshared.Internal("更新表情失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return 0, emoji.ErrEmojiNotFound
	}
	return po.ID, nil
}

// DeleteEmoji 删除表情
func (r *EmojiGroupRepository) DeleteEmoji(ctx context.Context, id int32) error {
	result := r.db.WithContext(ctx).Delete(&model.Emoji{}, id)
	if result.Error != nil {
		return domainshared.Internal("删除表情失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return emoji.ErrEmojiNotFound
	}
	return nil
}

var _ emoji.EmojiGroupRepository = (*EmojiGroupRepository)(nil)

// ============================================================
// PlaylistRepository (Music)
// ============================================================

type PlaylistRepository struct{ db *gorm.DB }

func NewPlaylistRepository(db *gorm.DB) *PlaylistRepository {
	return &PlaylistRepository{db: db}
}

func playlistToPO(p *music.Playlist) (model.Playlist, error) {
	var songsJSON []byte
	if len(p.Songs()) > 0 {
		songsJSON, _ = json.Marshal(p.Songs())
	} else {
		songsJSON = []byte("[]")
	}
	po := model.Playlist{
		ID: p.ID().UUID(), Title: p.Title(), Cover: p.Cover(),
		Creator: p.Creator(), Platform: p.Platform(),
		PlaylistID: p.PlaylistID(), SongCount: p.SongCount(),
		Songs: songsJSON, IsActive: p.IsActive(),
	}
	return po, nil
}

func playlistToDomain(po model.Playlist) (*music.Playlist, error) {
	var songs []music.Song
	if len(po.Songs) > 0 {
		_ = json.Unmarshal(po.Songs, &songs)
	}
	return music.ReconstructPlaylist(
		domainshared.MustParseID(po.ID.String()),
		po.Title, po.Cover, po.Creator, po.Platform, po.PlaylistID,
		po.SongCount, songs, po.IsActive,
	), nil
}

func (r *PlaylistRepository) FindByID(ctx context.Context, id domainshared.ID) (*music.Playlist, error) {
	var po model.Playlist
	if err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, music.ErrNotFound
		}
		return nil, domainshared.Internal("查询歌单失败", err)
	}
	return playlistToDomain(po)
}

func (r *PlaylistRepository) FindActive(ctx context.Context) ([]*music.Playlist, error) {
	var pos []model.Playlist
	if err := r.db.WithContext(ctx).Where("is_active = ?", true).Order("created_at DESC").Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询活跃歌单失败", err)
	}
	result := make([]*music.Playlist, 0, len(pos))
	for _, po := range pos {
		p, _ := playlistToDomain(po)
		result = append(result, p)
	}
	return result, nil
}

func (r *PlaylistRepository) FindAll(ctx context.Context) ([]*music.Playlist, error) {
	var pos []model.Playlist
	if err := r.db.WithContext(ctx).Order("created_at DESC").Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询歌单列表失败", err)
	}
	result := make([]*music.Playlist, 0, len(pos))
	for _, po := range pos {
		p, _ := playlistToDomain(po)
		result = append(result, p)
	}
	return result, nil
}

func (r *PlaylistRepository) Save(ctx context.Context, p *music.Playlist) error {
	po, err := playlistToPO(p)
	if err != nil {
		return err
	}
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存歌单失败", err)
	}
	return nil
}

func (r *PlaylistRepository) Delete(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.Playlist{})
	if result.Error != nil {
		return domainshared.Internal("删除歌单失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return music.ErrNotFound
	}
	return nil
}

var _ music.PlaylistRepository = (*PlaylistRepository)(nil)

// ============================================================
// FileRepository (Upload)
// ============================================================

type FileRepository struct{ db *gorm.DB }

func NewFileRepository(db *gorm.DB) *FileRepository {
	return &FileRepository{db: db}
}

func fileToPO(f *upload.File) model.File {
	po := model.File{
		ID: f.ID().UUID(), OwnerID: f.OwnerID().UUID(), Purpose: f.Purpose(),
		OriginalName: f.OriginalName(), Path: f.Path(), URL: f.URL(),
		Size: f.Size(), MimeType: f.MimeType(), FileHash: f.FileHash(),
		Width: f.Width(), Height: f.Height(), Thumbnail: f.Thumbnail(),
		Status: f.Status(), RefCount: f.RefCount(), AltText: f.AltText(), Category: f.Category(),
		DeletedAt: f.DeletedAt(),
	}
	if c := f.CreatedAt(); !c.IsZero() {
		po.CreatedAt = c
		po.UpdatedAt = f.UpdatedAt()
	} else {
		po.CreatedAt = time.Now()
		po.UpdatedAt = time.Now()
	}
	return po
}

func fileToDomain(po model.File) (*upload.File, error) {
	return upload.ReconstructFile(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.OwnerID.String()),
		po.Purpose, po.OriginalName, po.Path, po.URL,
		po.Size, po.MimeType, po.FileHash,
		po.Width, po.Height, po.Thumbnail,
		po.Status, po.RefCount, po.AltText, po.Category, po.DeletedAt,
		po.CreatedAt, po.UpdatedAt,
	), nil
}

func (r *FileRepository) FindByID(ctx context.Context, id domainshared.ID) (*upload.File, error) {
	var po model.File
	if err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, upload.ErrFileNotFound
		}
		return nil, domainshared.Internal("查询文件失败", err)
	}
	return fileToDomain(po)
}

func (r *FileRepository) FindByHash(ctx context.Context, hash string, ownerID domainshared.ID) (*upload.File, error) {
	var po model.File
	if err := r.db.WithContext(ctx).
		Where("file_hash = ? AND owner_id = ? AND status = ?", hash, ownerID.UUID(), upload.StatusReady).
		First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, upload.ErrFileNotFound
		}
		return nil, domainshared.Internal("按哈希查询文件失败", err)
	}
	return fileToDomain(po)
}

// FindByURLs 按访问 URL 批量查找就绪文件（推文图片归属校验用）。
// 空输入直接返回空切片，不触库。
func (r *FileRepository) FindByURLs(ctx context.Context, urls []string) ([]*upload.File, error) {
	if len(urls) == 0 {
		return []*upload.File{}, nil
	}
	var pos []model.File
	if err := r.db.WithContext(ctx).
		Where("url IN ? AND status = ?", urls, upload.StatusReady).
		Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("按 URL 批量查询文件失败", err)
	}
	result := make([]*upload.File, 0, len(pos))
	for _, po := range pos {
		f, err := fileToDomain(po)
		if err != nil {
			return nil, err
		}
		result = append(result, f)
	}
	return result, nil
}

// FindByIDs 按 ID 批量查找文件（图集详情/列表组装用）。
// 不限状态：文件被软删后图集详情仍能拿到元数据兜底展示。
// 空输入直接返回空切片，不触库。
func (r *FileRepository) FindByIDs(ctx context.Context, ids []domainshared.ID) ([]*upload.File, error) {
	if len(ids) == 0 {
		return []*upload.File{}, nil
	}
	uuids := make([]string, 0, len(ids))
	for _, id := range ids {
		uuids = append(uuids, id.UUID().String())
	}
	var pos []model.File
	if err := r.db.WithContext(ctx).
		Where("id IN ?", uuids).
		Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("按 ID 批量查询文件失败", err)
	}
	result := make([]*upload.File, 0, len(pos))
	for _, po := range pos {
		f, err := fileToDomain(po)
		if err != nil {
			return nil, err
		}
		result = append(result, f)
	}
	return result, nil
}

// FindPage 分页列出文件（统一入口，created_at DESC + id DESC tiebreaker 防翻页漂移）。
//
// filter 字段语义见 domain FileListFilter 注释：OwnerID/Purpose 供用户素材
// 列表，其余维度供后台全局管理；默认排除软删除文件（IncludeDeleted=true 时包含）。
func (r *FileRepository) FindPage(ctx context.Context, filter upload.FileListFilter, q domainshared.PageQuery) (domainshared.PageResult[*upload.File], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.File{})
	if filter.OwnerID != nil {
		query = query.Where("owner_id = ?", filter.OwnerID.UUID())
	}
	if filter.Purpose != "" {
		query = query.Where("purpose = ?", filter.Purpose)
	}
	if filter.Category != "" {
		query = query.Where("category = ?", filter.Category)
	}
	if filter.MimePrefix != "" {
		query = query.Where("mime_type LIKE ?", filter.MimePrefix+"%")
	}
	if filter.Keyword != "" {
		query = query.Where("original_name ILIKE ?", "%"+filter.Keyword+"%")
	}
	if !filter.IncludeDeleted {
		query = query.Where("deleted_at IS NULL")
	}
	var pos []model.File
	total, err := countAndFind(query.Order("created_at DESC, id DESC"), q, &pos, "文件")
	if err != nil {
		return domainshared.PageResult[*upload.File]{}, err
	}
	files := make([]*upload.File, 0, len(pos))
	for _, po := range pos {
		f, _ := fileToDomain(po)
		files = append(files, f)
	}
	return domainshared.NewPageResult(q, files, total), nil
}

func (r *FileRepository) Save(ctx context.Context, f *upload.File) error {
	po := fileToPO(f)
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存文件失败", err)
	}
	return nil
}

func (r *FileRepository) Delete(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.File{})
	if result.Error != nil {
		return domainshared.Internal("删除文件失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return upload.ErrFileNotFound
	}
	return nil
}

func (r *FileRepository) UpdateRefCount(ctx context.Context, id domainshared.ID, delta int) error {
	// 统一用 + 号，delta 为负时靠参数负值实现减法（此前 op="" 拼出缺操作符的 SQL）
	result := r.db.WithContext(ctx).Model(&model.File{}).Where("id = ?", id.UUID()).
		Update("ref_count", gorm.Expr("GREATEST(ref_count + ?, 0)", delta))
	if result.Error != nil {
		return domainshared.Internal("更新引用计数失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return upload.ErrFileNotFound
	}
	return nil
}

var _ upload.FileRepository = (*FileRepository)(nil)

// ============================================================
// MusicSettingStore 音乐设置单行配置读写
// ============================================================

// MusicSettingStore 实现应用层 musicSettingsStore 端口
type MusicSettingStore struct{ db *gorm.DB }

// NewMusicSettingStore 创建音乐设置存储
func NewMusicSettingStore(db *gorm.DB) *MusicSettingStore {
	return &MusicSettingStore{db: db}
}

func (s *MusicSettingStore) GetPlayerVersion(ctx context.Context) (string, error) {
	var ms model.MusicSetting
	if err := s.db.WithContext(ctx).First(&ms, 1).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil
		}
		return "", err
	}
	return ms.PlayerVersion, nil
}

func (s *MusicSettingStore) UpdatePlayerVersion(ctx context.Context, version string) error {
	return s.db.WithContext(ctx).Model(&model.MusicSetting{}).
		Where("id = ?", 1).
		Updates(map[string]any{"player_version": version, "updated_at": time.Now()}).Error
}
