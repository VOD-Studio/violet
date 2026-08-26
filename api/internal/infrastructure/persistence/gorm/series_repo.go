package gorm

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	domainseries "blog-api/internal/domain/series"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// SeriesRepository 系列书仓储 GORM 实现。
type SeriesRepository struct {
	db *gorm.DB
}

// NewSeriesRepository 构造仓储。
func NewSeriesRepository(db *gorm.DB) *SeriesRepository {
	return &SeriesRepository{db: db}
}

// Save 保存书：根字段按主键 upsert；卷精确 diff
// （删除 DB 有而聚合无的卷，upsert 聚合内全部卷——两阶段 sort_order 写入避开唯一索引中间态）。
func (r *SeriesRepository) Save(ctx context.Context, s *domainseries.Series) error {
	po := seriesToPO(s)
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&po).Error; err != nil {
			return err
		}
		var existing []model.SeriesSection
		if err := tx.Where("series_id = ?", po.ID).Find(&existing).Error; err != nil {
			return err
		}
		keep := make(map[string]struct{}, len(s.Sections()))
		for _, sec := range s.Sections() {
			keep[sec.ID().String()] = struct{}{}
		}
		for _, ex := range existing {
			if _, ok := keep[ex.ID.String()]; !ok {
				if err := tx.Delete(&model.SeriesSection{ID: ex.ID}).Error; err != nil {
					return err
				}
			}
		}
		// 两阶段：先全部挪到负偏移，再写目标位（uniq_series_sections_order 防中间态冲突）
		pos := make([]model.SeriesSection, 0, len(s.Sections()))
		for i, sec := range s.Sections() {
			pos = append(pos, seriesSectionToPO(po.ID, sec, -(i+1)))
		}
		if len(pos) > 0 {
			if err := tx.Save(&pos).Error; err != nil {
				return err
			}
			for i := range pos {
				pos[i].SortOrder = i
			}
			if err := tx.Save(&pos).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return domainshared.Internal("保存系列书失败", err)
	}
	return nil
}

// FindByID 按 ID 查找（含卷）。
func (r *SeriesRepository) FindByID(ctx context.Context, id domainshared.ID) (*domainseries.Series, error) {
	var po model.Series
	if err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domainseries.ErrNotFound
		}
		return nil, domainshared.Internal("查询系列书失败", err)
	}
	return r.reconstruct(ctx, po)
}

// FindBySlug 按 slug 查找（含卷）。
func (r *SeriesRepository) FindBySlug(ctx context.Context, slug string) (*domainseries.Series, error) {
	var po model.Series
	if err := r.db.WithContext(ctx).First(&po, "slug = ?", slug).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domainseries.ErrNotFound
		}
		return nil, domainshared.Internal("查询系列书失败", err)
	}
	return r.reconstruct(ctx, po)
}

// FindPublishedPage 公开书架分页：仅 published，created_at DESC。
func (r *SeriesRepository) FindPublishedPage(ctx context.Context, q domainshared.PageQuery) (domainshared.PageResult[*domainseries.Series], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.Series{}).Where("status = ?", domainseries.StatusPublished)
	var pos []model.Series
	total, err := countAndFind(query.Order("created_at DESC, id DESC"), q, &pos, "系列书")
	if err != nil {
		return domainshared.PageResult[*domainseries.Series]{}, err
	}
	items, err := r.reconstructList(ctx, pos)
	if err != nil {
		return domainshared.PageResult[*domainseries.Series]{}, err
	}
	return domainshared.NewPageResult(q, items, total), nil
}

// FindPage 管理列表分页：全部状态，created_at DESC。
func (r *SeriesRepository) FindPage(ctx context.Context, q domainshared.PageQuery) (domainshared.PageResult[*domainseries.Series], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.Series{})
	var pos []model.Series
	total, err := countAndFind(query.Order("created_at DESC, id DESC"), q, &pos, "系列书")
	if err != nil {
		return domainshared.PageResult[*domainseries.Series]{}, err
	}
	items, err := r.reconstructList(ctx, pos)
	if err != nil {
		return domainshared.PageResult[*domainseries.Series]{}, err
	}
	return domainshared.NewPageResult(q, items, total), nil
}

// ExistsBySlug slug 占用检查；excludeID 非零时排除自身。
func (r *SeriesRepository) ExistsBySlug(ctx context.Context, slug string, excludeID domainshared.ID) (bool, error) {
	query := r.db.WithContext(ctx).Model(&model.Series{}).Where("slug = ?", slug)
	if !excludeID.IsZero() {
		query = query.Where("id <> ?", excludeID.UUID())
	}
	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, domainshared.Internal("查询系列书 slug 失败", err)
	}
	return count > 0, nil
}

// Delete 物理删除书（卷级联删由 FK；章节解绑由 posts FK ON DELETE SET NULL）。
func (r *SeriesRepository) Delete(ctx context.Context, id domainshared.ID) error {
	res := r.db.WithContext(ctx).Delete(&model.Series{}, "id = ?", id.UUID())
	if res.Error != nil {
		return domainshared.Internal("删除系列书失败", res.Error)
	}
	if res.RowsAffected == 0 {
		return domainseries.ErrNotFound
	}
	return nil
}

// ============ 章节归属（posts 三列） ============

// chapterRow posts 章节读模型查询行。
type chapterRow struct {
	ID              uuid.UUID  `gorm:"column:id"`
	Slug            string     `gorm:"column:slug"`
	Title           string     `gorm:"column:title"`
	Status          string     `gorm:"column:status"`
	SeriesSectionID *uuid.UUID `gorm:"column:series_section_id"`
	ChapterOrder    *int       `gorm:"column:chapter_order"`
	PublishedAt     *time.Time `gorm:"column:published_at"`
}

// FindChapters 取书内全部章节（软删文章由 GORM DeletedAt 条件自动过滤）。
func (r *SeriesRepository) FindChapters(ctx context.Context, seriesID domainshared.ID) ([]domainseries.Chapter, error) {
	var rows []chapterRow
	err := r.db.WithContext(ctx).Model(&model.Post{}).
		Select("id, slug, title, status, series_section_id, chapter_order, published_at").
		Where("series_id = ?", seriesID.UUID()).
		Find(&rows).Error
	if err != nil {
		return nil, domainshared.Internal("查询书章节失败", err)
	}
	chapters := make([]domainseries.Chapter, 0, len(rows))
	for _, row := range rows {
		ch := domainseries.Chapter{
			PostID: domainshared.IDFromUUID(row.ID),
			Slug:   row.Slug,
			Title:  row.Title,
			Status: row.Status,
		}
		if row.SeriesSectionID != nil {
			sid := domainshared.IDFromUUID(*row.SeriesSectionID)
			ch.SectionID = &sid
		}
		if row.ChapterOrder != nil {
			ch.ChapterOrder = *row.ChapterOrder
		}
		if row.PublishedAt != nil {
			ch.PublishedAt = *row.PublishedAt
		}
		chapters = append(chapters, ch)
	}
	return chapters, nil
}

// FindSeriesIDByPostSlug 按文章 slug 反查挂入的书 ID；未挂书返回 nil。
func (r *SeriesRepository) FindSeriesIDByPostSlug(ctx context.Context, postSlug string) (*domainshared.ID, error) {
	var row struct {
		SeriesID *uuid.UUID `gorm:"column:series_id"`
	}
	err := r.db.WithContext(ctx).Model(&model.Post{}).
		Select("series_id").
		Where("slug = ?", postSlug).
		Take(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, domainshared.Internal("查询文章归属失败", err)
	}
	if row.SeriesID == nil {
		return nil, nil
	}
	id := domainshared.IDFromUUID(*row.SeriesID)
	return &id, nil
}

// FindPostMeta 批量取文章元数据（软删文章不返回）。
func (r *SeriesRepository) FindPostMeta(ctx context.Context, postIDs []domainshared.ID) ([]domainseries.PostMeta, error) {
	if len(postIDs) == 0 {
		return []domainseries.PostMeta{}, nil
	}
	uuids := make([]uuid.UUID, 0, len(postIDs))
	for _, id := range postIDs {
		uuids = append(uuids, id.UUID())
	}
	var rows []struct {
		ID       uuid.UUID  `gorm:"column:id"`
		AuthorID uuid.UUID  `gorm:"column:author_id"`
		Status   string     `gorm:"column:status"`
		SeriesID *uuid.UUID `gorm:"column:series_id"`
	}
	err := r.db.WithContext(ctx).Model(&model.Post{}).
		Select("id, author_id, status, series_id").
		Where("id IN ?", uuids).
		Find(&rows).Error
	if err != nil {
		return nil, domainshared.Internal("查询文章元数据失败", err)
	}
	metas := make([]domainseries.PostMeta, 0, len(rows))
	for _, row := range rows {
		meta := domainseries.PostMeta{
			PostID:   domainshared.IDFromUUID(row.ID),
			AuthorID: domainshared.IDFromUUID(row.AuthorID),
			Status:   row.Status,
		}
		if row.SeriesID != nil {
			sid := domainshared.IDFromUUID(*row.SeriesID)
			meta.SeriesID = &sid
		}
		metas = append(metas, meta)
	}
	return metas, nil
}

// AttachChapters 批量挂章（事务内逐章 UPDATE 三列）。
func (r *SeriesRepository) AttachChapters(ctx context.Context, seriesID domainshared.ID, assignments []domainseries.ChapterAssignment) error {
	if len(assignments) == 0 {
		return nil
	}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, a := range assignments {
			var sectionID any
			if a.SectionID != nil {
				sectionID = a.SectionID.UUID()
			}
			if err := tx.Model(&model.Post{}).
				Where("id = ?", a.PostID.UUID()).
				Updates(map[string]any{
					"series_id":         seriesID.UUID(),
					"series_section_id": sectionID,
					"chapter_order":     a.Order,
				}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return domainshared.Internal("挂章失败", err)
	}
	return nil
}

// DetachChapter 摘章：置空三列并重排同范围剩余章节。
func (r *SeriesRepository) DetachChapter(ctx context.Context, seriesID domainshared.ID, postID domainshared.ID) error {
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row struct {
			SeriesSectionID *uuid.UUID `gorm:"column:series_section_id"`
			ChapterOrder    *int       `gorm:"column:chapter_order"`
		}
		if err := tx.Model(&model.Post{}).
			Select("series_section_id, chapter_order").
			Where("id = ? AND series_id = ?", postID.UUID(), seriesID.UUID()).
			Take(&row).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return domainseries.ErrChapterNotInSeries
			}
			return err
		}
		if err := tx.Model(&model.Post{}).
			Where("id = ?", postID.UUID()).
			Updates(map[string]any{
				"series_id":         nil,
				"series_section_id": nil,
				"chapter_order":     nil,
			}).Error; err != nil {
			return err
		}
		// 重排同范围剩余章节（0..n-1 连续）
		scopeQuery := tx.Model(&model.Post{}).Where("series_id = ?", seriesID.UUID())
		if row.SeriesSectionID == nil {
			scopeQuery = scopeQuery.Where("series_section_id IS NULL")
		} else {
			scopeQuery = scopeQuery.Where("series_section_id = ?", *row.SeriesSectionID)
		}
		var rest []uuid.UUID
		if err := scopeQuery.Order("chapter_order ASC").Pluck("id", &rest).Error; err != nil {
			return err
		}
		for i, id := range rest {
			if err := tx.Model(&model.Post{}).
				Where("id = ?", id).
				Update("chapter_order", i).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, domainseries.ErrChapterNotInSeries) {
			return err
		}
		return domainshared.Internal("摘章失败", err)
	}
	return nil
}

// ReorderChapters 全树全量调序：事务内按 plan 重写 posts 归属三列。
//
// 两阶段 order 写入（先负偏移后目标位）避免同范围内换位时的中间态重复。
func (r *SeriesRepository) ReorderChapters(ctx context.Context, seriesID domainshared.ID, plans []domainseries.ReorderPlan) error {
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 阶段一：全部涉事章节挪到负偏移（-1 - index 全局唯一）
		offset := 0
		type assignment struct {
			postID    domainshared.ID
			sectionID *domainshared.ID
			order     int
		}
		final := make([]assignment, 0, 64)
		for _, plan := range plans {
			var sectionID any
			if plan.SectionID != nil {
				sectionID = plan.SectionID.UUID()
			}
			for i, pid := range plan.OrderedIDs {
				offset--
				if err := tx.Model(&model.Post{}).
					Where("id = ? AND series_id = ?", pid.UUID(), seriesID.UUID()).
					Updates(map[string]any{
						"series_section_id": sectionID,
						"chapter_order":     offset,
					}).Error; err != nil {
					return err
				}
				final = append(final, assignment{postID: pid, sectionID: plan.SectionID, order: i})
			}
		}
		// 阶段二：写目标位
		for _, a := range final {
			if err := tx.Model(&model.Post{}).
				Where("id = ?", a.postID.UUID()).
				Update("chapter_order", a.order).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return domainshared.Internal("章节调序失败", err)
	}
	return nil
}

// CountChaptersInSection 卷内章节数（含全部状态）。
func (r *SeriesRepository) CountChaptersInSection(ctx context.Context, sectionID domainshared.ID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.Post{}).
		Where("series_section_id = ?", sectionID.UUID()).
		Count(&count).Error
	if err != nil {
		return 0, domainshared.Internal("统计卷章节数失败", err)
	}
	return count, nil
}

// CountChaptersBySeries 批量书章节计数。
func (r *SeriesRepository) CountChaptersBySeries(ctx context.Context, seriesIDs []domainshared.ID) (map[domainshared.ID]int64, error) {
	result := make(map[domainshared.ID]int64, len(seriesIDs))
	if len(seriesIDs) == 0 {
		return result, nil
	}
	uuids := make([]uuid.UUID, 0, len(seriesIDs))
	for _, id := range seriesIDs {
		uuids = append(uuids, id.UUID())
	}
	var rows []struct {
		SeriesID uuid.UUID `gorm:"column:series_id"`
		Count    int64     `gorm:"column:cnt"`
	}
	err := r.db.WithContext(ctx).Model(&model.Post{}).
		Select("series_id, COUNT(*) AS cnt").
		Where("series_id IN ?", uuids).
		Group("series_id").
		Find(&rows).Error
	if err != nil {
		return nil, domainshared.Internal("统计书章节数失败", err)
	}
	for _, row := range rows {
		result[domainshared.IDFromUUID(row.SeriesID)] = row.Count
	}
	return result, nil
}

// ============ 转换器 ============

// seriesToPO 领域实体 → 持久化模型。
func seriesToPO(s *domainseries.Series) model.Series {
	po := model.Series{
		ID:          s.ID().UUID(),
		AuthorID:    s.AuthorID().UUID(),
		Title:       s.Title(),
		Slug:        s.Slug(),
		Description: s.Description(),
		CoverImage:  s.CoverImage(),
		Status:      s.Status(),
	}
	if t := s.CreatedAt(); !t.IsZero() {
		po.CreatedAt = t
		po.UpdatedAt = s.UpdatedAt()
	} else {
		now := time.Now()
		po.CreatedAt = now
		po.UpdatedAt = now
	}
	return po
}

// seriesSectionToPO 卷子实体 → 持久化模型（sortOrder 覆盖两阶段写入值）。
func seriesSectionToPO(seriesID uuid.UUID, sec *domainseries.SeriesSection, sortOrder int) model.SeriesSection {
	return model.SeriesSection{
		ID:        sec.ID().UUID(),
		SeriesID:  seriesID,
		Title:     sec.Title(),
		SortOrder: sortOrder,
	}
}

// reconstruct PO → 领域实体（含卷加载）。
func (r *SeriesRepository) reconstruct(ctx context.Context, po model.Series) (*domainseries.Series, error) {
	var secPOs []model.SeriesSection
	if err := r.db.WithContext(ctx).
		Where("series_id = ?", po.ID).
		Order("sort_order ASC").
		Find(&secPOs).Error; err != nil {
		return nil, domainshared.Internal("查询书卷失败", err)
	}
	sections := make([]*domainseries.SeriesSection, 0, len(secPOs))
	for _, sec := range secPOs {
		sections = append(sections, domainseries.ReconstructSection(
			domainshared.MustParseID(sec.ID.String()),
			sec.Title,
			sec.SortOrder,
		))
	}
	return domainseries.ReconstructSeries(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.AuthorID.String()),
		po.Title, po.Slug, po.Description, po.CoverImage, po.Status,
		sections,
		po.CreatedAt, po.UpdatedAt,
	), nil
}

// reconstructList 批量重建（逐本带卷；分页 ≤ limit 本，可接受）。
func (r *SeriesRepository) reconstructList(ctx context.Context, pos []model.Series) ([]*domainseries.Series, error) {
	items := make([]*domainseries.Series, 0, len(pos))
	for _, po := range pos {
		s, err := r.reconstruct(ctx, po)
		if err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, nil
}

// 编译期断言：仓储实现满足领域接口。
var _ domainseries.SeriesRepository = (*SeriesRepository)(nil)
