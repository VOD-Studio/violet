package series

import (
	"context"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	domain "blog-api/internal/domain/series"
	"blog-api/internal/domain/shared"
)

// 领域/用例错误（映射见 internal/interfaces/http/response/error.go 的 httpStatusForCode）
var (
	// ErrSlugTaken 书 slug 已被占用。Conflict → HTTP 409。
	ErrSlugTaken = shared.Conflict("该 slug 已被其他书使用")

	// ErrNotOwner 操作者不是书的主人（owner-only 写约束）。Forbidden → HTTP 403。
	ErrNotOwner = shared.Forbidden("只能操作自己创建的书")

	// ErrSectionNotEmpty 卷内仍有章节，拒绝删除。Conflict → HTTP 409。
	ErrSectionNotEmpty = shared.Conflict("卷内仍有章节，请先移出或摘除全部章节")

	// ErrPostNotAttachable 文章不可挂入：不存在、软删、或不是操作者自己的文章。
	ErrPostNotAttachable = shared.BadRequest("文章不存在或不可挂入（只能挂自己的文章）")

	// ErrPostInOtherSeries 文章已挂在别的书里（一章只属一书）。
	ErrPostInOtherSeries = shared.Conflict("该文章已挂入其他书，请先从原书摘除")
)

// Service 系列书用例服务。
type Service struct {
	repo domain.SeriesRepository
	bus  appshared.EventBus
}

// NewService 构造系列书用例服务。bus 发布 series.* 事件（审计订阅者消费）。
func NewService(repo domain.SeriesRepository, bus appshared.EventBus) *Service {
	return &Service{repo: repo, bus: bus}
}

// ============================================================
// 公开用例
// ============================================================

// ListPublished 公开书架分页（仅 published）。
func (s *Service) ListPublished(ctx context.Context, page, limit int) ([]SeriesDTO, int64, error) {
	q := shared.PageQuery{Page: page, Limit: limit}.Normalize()
	result, err := s.repo.FindPublishedPage(ctx, q)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]SeriesDTO, 0, len(result.Items))
	for _, item := range result.Items {
		chapters, err := s.repo.FindChapters(ctx, item.ID())
		if err != nil {
			return nil, 0, err
		}
		dto := toSeriesDTO(item)
		fillChapterCounts(&dto, chapters)
		dtos = append(dtos, dto)
	}
	return dtos, result.Total, nil
}

// GetBySlug 公开书籍详情（仅 published 章节；draft 书 → 404）。
func (s *Service) GetBySlug(ctx context.Context, slug string) (SeriesDetailDTO, error) {
	series, err := s.repo.FindBySlug(ctx, slug)
	if err != nil {
		return SeriesDetailDTO{}, err
	}
	if !series.IsPublished() {
		return SeriesDetailDTO{}, domain.ErrNotFound
	}
	return s.buildDetail(ctx, series, true)
}

// GetChapterContextBySlug 文章 slug → 书籍上下文（归属、序号、相邻章导航）。
//
// 文章不属于任何书、或所属书未发布时返回 (nil, nil)（handler 输出 null）。
// 相邻章仅为 published 章节：draft/archived 章节在导航中被跳过。
func (s *Service) GetChapterContextBySlug(ctx context.Context, postSlug string) (*ChapterContextDTO, error) {
	seriesID, err := s.repo.FindSeriesIDByPostSlug(ctx, postSlug)
	if err != nil {
		return nil, err
	}
	if seriesID == nil {
		return nil, nil
	}
	series, err := s.repo.FindByID(ctx, *seriesID)
	if err != nil {
		return nil, err
	}
	if !series.IsPublished() {
		return nil, nil
	}

	chapters, err := s.repo.FindChapters(ctx, series.ID())
	if err != nil {
		return nil, err
	}
	ordered := domain.OrderedChapters(series.Sections(), chapters)
	visible := make([]domain.Chapter, 0, len(ordered))
	for _, ch := range ordered {
		if ch.IsPublished() {
			visible = append(visible, ch)
		}
	}
	dto := &ChapterContextDTO{
		Series:        SeriesRefDTO{Slug: series.Slug(), Title: series.Title()},
		TotalChapters: len(visible),
	}
	for i, ch := range visible {
		if ch.Slug != postSlug {
			continue
		}
		dto.ChapterNo = i + 1
		if i > 0 {
			dto.Prev = &ChapterNavDTO{Slug: visible[i-1].Slug, Title: visible[i-1].Title}
		}
		if i+1 < len(visible) {
			dto.Next = &ChapterNavDTO{Slug: visible[i+1].Slug, Title: visible[i+1].Title}
		}
		return dto, nil
	}
	// 文章挂了书但不在可见序列（draft/archived）：仍给归属，不给序号与导航
	return dto, nil
}

// ============================================================
// 管理用例（owner-only 写约束）
// ============================================================

// ListAdmin 管理书列表（全部状态）。
func (s *Service) ListAdmin(ctx context.Context, page, limit int) ([]SeriesAdminDTO, int64, error) {
	q := shared.PageQuery{Page: page, Limit: limit}.Normalize()
	result, err := s.repo.FindPage(ctx, q)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]SeriesAdminDTO, 0, len(result.Items))
	for _, item := range result.Items {
		chapters, err := s.repo.FindChapters(ctx, item.ID())
		if err != nil {
			return nil, 0, err
		}
		dto := toAdminDTO(item)
		dto.TotalChapterCount = int64(len(chapters))
		fillChapterCounts(&dto.SeriesDTO, chapters)
		dtos = append(dtos, dto)
	}
	return dtos, result.Total, nil
}

// GetAdmin 管理书籍详情（含全部状态章节，标注 status）。
func (s *Service) GetAdmin(ctx context.Context, id string) (SeriesDetailDTO, error) {
	sid, err := shared.ParseID(id)
	if err != nil {
		return SeriesDetailDTO{}, err
	}
	series, err := s.repo.FindByID(ctx, sid)
	if err != nil {
		return SeriesDetailDTO{}, err
	}
	return s.buildDetail(ctx, series, false)
}

// buildDetail 查章节并组装详情目录（ChapterCount 按视角口径计数）。
func (s *Service) buildDetail(ctx context.Context, series *domain.Series, publicView bool) (SeriesDetailDTO, error) {
	chapters, err := s.repo.FindChapters(ctx, series.ID())
	if err != nil {
		return SeriesDetailDTO{}, err
	}
	dto := buildDetailDTO(series, chapters, publicView)
	dto.ChapterCount = int64(len(dto.RootChapters))
	for _, sec := range dto.Sections {
		dto.ChapterCount += int64(len(sec.Chapters))
	}
	fillChapterCounts(&dto.SeriesDTO, chapters)
	return dto, nil
}

// CreateInput 建书入参。
type CreateInput struct {
	// UserID 操作者（成为书的 owner，创建后不可变）
	UserID string
	Title  string
	Slug   string
	// Description 简介（可空）
	Description string
	// CoverImage 封面图 URL（可空）
	CoverImage string
}

// Create 建书（draft 起步）。
func (s *Service) Create(ctx context.Context, in CreateInput) (SeriesAdminDTO, error) {
	uid, err := shared.ParseID(in.UserID)
	if err != nil {
		return SeriesAdminDTO{}, err
	}
	if taken, err := s.repo.ExistsBySlug(ctx, in.Slug, shared.ID{}); err != nil {
		return SeriesAdminDTO{}, err
	} else if taken {
		return SeriesAdminDTO{}, ErrSlugTaken
	}
	series, err := domain.NewSeries(shared.NewID(), uid, in.Title, in.Slug, in.Description, in.CoverImage)
	if err != nil {
		return SeriesAdminDTO{}, err
	}
	if err := s.repo.Save(ctx, series); err != nil {
		return SeriesAdminDTO{}, err
	}
	s.publishEvents(ctx, series)
	return toAdminDTO(series), nil
}

// UpdateInput 编辑书入参（PATCH）。
type UpdateInput struct {
	// UserID 操作者（须为 owner）
	UserID string
	// Title/Description/CoverImage 传指针：nil=不改该字段（PATCH 语义）
	Title       *string
	Description *string
	CoverImage  *string
	// Publish 状态变更意图：nil=不改；true=发布；false=收回
	Publish *bool
}

// Update 编辑书字段与发布状态（slug/authorID 不可改）。
func (s *Service) Update(ctx context.Context, id string, in UpdateInput) (SeriesAdminDTO, error) {
	sid, err := shared.ParseID(id)
	if err != nil {
		return SeriesAdminDTO{}, err
	}
	series, err := s.loadOwned(ctx, sid, in.UserID)
	if err != nil {
		return SeriesAdminDTO{}, err
	}
	title := series.Title()
	description := series.Description()
	coverImage := series.CoverImage()
	if in.Title != nil {
		title = *in.Title
	}
	if in.Description != nil {
		description = *in.Description
	}
	if in.CoverImage != nil {
		coverImage = *in.CoverImage
	}
	if err := series.Update(domain.UpdateParams{
		Title:       title,
		Description: description,
		CoverImage:  coverImage,
	}); err != nil {
		return SeriesAdminDTO{}, err
	}
	if in.Publish != nil {
		if *in.Publish {
			err = series.Publish()
		} else {
			err = series.Unpublish()
		}
		if err != nil {
			return SeriesAdminDTO{}, err
		}
	}
	if err := s.repo.Save(ctx, series); err != nil {
		return SeriesAdminDTO{}, err
	}
	s.publishEvents(ctx, series)
	return toAdminDTO(series), nil
}

// Delete 解散书（解绑全部章节，文章原样保留）。
func (s *Service) Delete(ctx context.Context, id, userID string) error {
	sid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	series, err := s.loadOwned(ctx, sid, userID)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, sid); err != nil {
		return err
	}
	// 物理删除后聚合不存在，事件手动构造发布（同 friendlink 先例）
	s.publish(ctx, domain.NewSeriesDeleted(sid, series.Title()))
	return nil
}

// AddSectionInput 建卷入参。
type AddSectionInput struct {
	UserID string
	// Title 卷名
	Title string
}

// AddSection 建卷（排到末尾）。
func (s *Service) AddSection(ctx context.Context, id string, in AddSectionInput) (SeriesAdminDTO, error) {
	sid, err := shared.ParseID(id)
	if err != nil {
		return SeriesAdminDTO{}, err
	}
	series, err := s.loadOwned(ctx, sid, in.UserID)
	if err != nil {
		return SeriesAdminDTO{}, err
	}
	if err := series.AddSection(shared.NewID(), in.Title); err != nil {
		return SeriesAdminDTO{}, err
	}
	if err := s.repo.Save(ctx, series); err != nil {
		return SeriesAdminDTO{}, err
	}
	s.publishEvents(ctx, series)
	return toAdminDTO(series), nil
}

// RemoveSection 删卷（非空卷拒绝：先移出或摘除全部章节）。
func (s *Service) RemoveSection(ctx context.Context, seriesID, sectionID, userID string) error {
	sid, err := shared.ParseID(seriesID)
	if err != nil {
		return err
	}
	secID, err := shared.ParseID(sectionID)
	if err != nil {
		return err
	}
	series, err := s.loadOwned(ctx, sid, userID)
	if err != nil {
		return err
	}
	if !series.HasSection(secID) {
		return domain.ErrSectionNotFound
	}
	count, err := s.repo.CountChaptersInSection(ctx, secID)
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrSectionNotEmpty
	}
	if err := series.RemoveSection(secID); err != nil {
		return err
	}
	if err := s.repo.Save(ctx, series); err != nil {
		return err
	}
	s.publishEvents(ctx, series)
	return nil
}

// ReorderSections 卷全量调序。
func (s *Service) ReorderSections(ctx context.Context, seriesID string, orderedSectionIDs []string, userID string) error {
	sid, err := shared.ParseID(seriesID)
	if err != nil {
		return err
	}
	series, err := s.loadOwned(ctx, sid, userID)
	if err != nil {
		return err
	}
	ids := make([]shared.ID, 0, len(orderedSectionIDs))
	for _, raw := range orderedSectionIDs {
		id, err := shared.ParseID(raw)
		if err != nil {
			return err
		}
		ids = append(ids, id)
	}
	if err := series.ReorderSections(ids); err != nil {
		return err
	}
	if err := s.repo.Save(ctx, series); err != nil {
		return err
	}
	s.publishEvents(ctx, series)
	return nil
}

// AttachInput 挂章入参。
type AttachInput struct {
	UserID string
	// PostIDs 挂入的文章 ID 列表（按给定顺序依次落位）
	PostIDs []string
	// SectionID 挂入的卷；空串=书根
	SectionID string
	// AfterPostID 可选：挂到该章之后；空串=挂到所在范围末尾。
	// 该章须已在目标范围内；否则按末尾处理
	AfterPostID string
}

// AttachChapters 批量挂章（已挂本书的文章 = 移动到新范围/新位置）。
//
// 校验链：owner → 卷存在 → 文章存在且是 owner 自己的（软删视为不存在）
// → 未挂其他书 → 计算落位（after 或末尾）→ 事务内全树重写。
func (s *Service) AttachChapters(ctx context.Context, seriesID string, in AttachInput) (SeriesDetailDTO, error) {
	sid, err := shared.ParseID(seriesID)
	if err != nil {
		return SeriesDetailDTO{}, err
	}
	series, err := s.loadOwned(ctx, sid, in.UserID)
	if err != nil {
		return SeriesDetailDTO{}, err
	}
	uid, err := shared.ParseID(in.UserID)
	if err != nil {
		return SeriesDetailDTO{}, err
	}

	var sectionID *shared.ID
	if in.SectionID != "" {
		secID, err := shared.ParseID(in.SectionID)
		if err != nil {
			return SeriesDetailDTO{}, err
		}
		if !series.HasSection(secID) {
			return SeriesDetailDTO{}, domain.ErrSectionNotFound
		}
		sectionID = &secID
	}

	postIDs := make([]shared.ID, 0, len(in.PostIDs))
	seen := make(map[shared.ID]struct{}, len(in.PostIDs))
	for _, raw := range in.PostIDs {
		pid, err := shared.ParseID(raw)
		if err != nil {
			return SeriesDetailDTO{}, err
		}
		if _, dup := seen[pid]; dup {
			return SeriesDetailDTO{}, shared.BadRequest("挂章列表存在重复文章")
		}
		seen[pid] = struct{}{}
		postIDs = append(postIDs, pid)
	}
	if len(postIDs) == 0 {
		return SeriesDetailDTO{}, shared.BadRequest("至少选择一章")
	}

	metas, err := s.repo.FindPostMeta(ctx, postIDs)
	if err != nil {
		return SeriesDetailDTO{}, err
	}
	metaByPost := make(map[shared.ID]domain.PostMeta, len(metas))
	for _, m := range metas {
		metaByPost[m.PostID] = m
	}
	for _, pid := range postIDs {
		meta, ok := metaByPost[pid]
		if !ok || meta.AuthorID != uid {
			return SeriesDetailDTO{}, ErrPostNotAttachable
		}
		if meta.SeriesID != nil && !meta.SeriesID.Equal(sid) {
			return SeriesDetailDTO{}, ErrPostInOtherSeries
		}
	}

	// 现有章节 → 计算目标范围新顺序（排除本次移动的章节后插入新章）
	chapters, err := s.repo.FindChapters(ctx, sid)
	if err != nil {
		return SeriesDetailDTO{}, err
	}
	ordered := domain.OrderedChapters(series.Sections(), chapters)

	var afterID *shared.ID
	if in.AfterPostID != "" {
		if aid, err := shared.ParseID(in.AfterPostID); err == nil {
			afterID = &aid
		}
	}
	inScope := func(c domain.Chapter) bool {
		if sectionID == nil {
			return c.SectionID == nil
		}
		return c.SectionID != nil && c.SectionID.Equal(*sectionID)
	}
	// keptIDs：目标范围内不参与本次移动的既有章节（保持相对顺序）
	keptIDs := make([]shared.ID, 0, len(ordered))
	insertAt := -1 // 新章插入点（keptIDs 下标）；-1=末尾
	for _, ch := range ordered {
		if !inScope(ch) {
			continue
		}
		_, moving := seen[ch.PostID]
		if afterID != nil && ch.PostID.Equal(*afterID) {
			if moving {
				// after 章本身要移走：新章占其原位
				insertAt = len(keptIDs)
			} else {
				// after 章保留：新章紧随其后
				keptIDs = append(keptIDs, ch.PostID)
				insertAt = len(keptIDs)
			}
			continue
		}
		if !moving {
			keptIDs = append(keptIDs, ch.PostID)
		}
	}
	newScope := make([]shared.ID, 0, len(keptIDs)+len(postIDs))
	if insertAt < 0 || insertAt >= len(keptIDs) {
		newScope = append(newScope, keptIDs...)
		newScope = append(newScope, postIDs...)
	} else {
		newScope = append(newScope, keptIDs[:insertAt]...)
		newScope = append(newScope, postIDs...)
		newScope = append(newScope, keptIDs[insertAt:]...)
	}

	// 无条件写三列（repo.AttachChapters 不带 series_id 条件）：新章的
	// series_id 尚为 NULL，ReorderChapters 的 WHERE series_id 条件不命中新章。
	// 目标范围全量落位（新章 + 既有章的新序）；被移走章节留在原范围，
	// 其 order 出现空洞无害（展示序按相对大小排列）。
	assignments := make([]domain.ChapterAssignment, 0, len(newScope))
	for i, pid := range newScope {
		assignments = append(assignments, domain.ChapterAssignment{
			PostID:    pid,
			SectionID: sectionID,
			Order:     i,
		})
	}
	if err := s.repo.AttachChapters(ctx, sid, assignments); err != nil {
		return SeriesDetailDTO{}, err
	}
	return s.GetAdmin(ctx, seriesID)
}

// DetachChapter 摘章（归属解除，文章不受影响）。
func (s *Service) DetachChapter(ctx context.Context, seriesID, postID, userID string) error {
	sid, err := shared.ParseID(seriesID)
	if err != nil {
		return err
	}
	pid, err := shared.ParseID(postID)
	if err != nil {
		return err
	}
	if _, err := s.loadOwned(ctx, sid, userID); err != nil {
		return err
	}
	metas, err := s.repo.FindPostMeta(ctx, []shared.ID{pid})
	if err != nil {
		return err
	}
	if len(metas) == 0 || metas[0].SeriesID == nil || !metas[0].SeriesID.Equal(sid) {
		return domain.ErrChapterNotInSeries
	}
	return s.repo.DetachChapter(ctx, sid, pid)
}

// ReorderChaptersInput 全树调序入参（PUT chapters/order）。
type ReorderChaptersInput struct {
	UserID string
	// Plans 各范围的新顺序全集：[{section_id, ordered_post_ids}]；
	// 必须覆盖书内全部章节，每章恰好出现一次
	Plans []ReorderScopeInput
}

// ReorderScopeInput 单个范围的调序。
type ReorderScopeInput struct {
	// SectionID 卷 ID；空串=书根
	SectionID string
	// OrderedPostIDs 该范围按新顺序排列的章节 ID 全集
	OrderedPostIDs []string
}

// ReorderChapters 全树全量调序（排序权威：一次性全量写入，PRD 难逆决策）。
//
// 章节出现在与原范围不同的 plan 里即跨卷移动。
func (s *Service) ReorderChapters(ctx context.Context, seriesID string, in ReorderChaptersInput) error {
	sid, err := shared.ParseID(seriesID)
	if err != nil {
		return err
	}
	series, err := s.loadOwned(ctx, sid, in.UserID)
	if err != nil {
		return err
	}

	chapters, err := s.repo.FindChapters(ctx, sid)
	if err != nil {
		return err
	}
	current := make(map[shared.ID]struct{}, len(chapters))
	for _, ch := range chapters {
		current[ch.PostID] = struct{}{}
	}

	plans := make([]domain.ReorderPlan, 0, len(in.Plans))
	covered := make(map[shared.ID]struct{}, len(chapters))
	for _, p := range in.Plans {
		var sectionID *shared.ID
		if p.SectionID != "" {
			secID, err := shared.ParseID(p.SectionID)
			if err != nil {
				return err
			}
			if !series.HasSection(secID) {
				return domain.ErrSectionNotFound
			}
			sectionID = &secID
		}
		ids := make([]shared.ID, 0, len(p.OrderedPostIDs))
		for _, raw := range p.OrderedPostIDs {
			pid, err := shared.ParseID(raw)
			if err != nil {
				return err
			}
			if _, ok := current[pid]; !ok {
				return shared.BadRequest("调序列表包含不属于本书的章节")
			}
			if _, dup := covered[pid]; dup {
				return shared.BadRequest("调序列表存在重复章节")
			}
			covered[pid] = struct{}{}
			ids = append(ids, pid)
		}
		plans = append(plans, domain.ReorderPlan{SectionID: sectionID, OrderedIDs: ids})
	}
	if len(covered) != len(current) {
		return shared.BadRequest("调序必须覆盖书内全部章节")
	}
	return s.repo.ReorderChapters(ctx, sid, plans)
}

// ============================================================
// 内部
// ============================================================

// loadOwned 加载并校验 owner（非 owner → 403，PRD owner-only 写约束）。
func (s *Service) loadOwned(ctx context.Context, id shared.ID, userID string) (*domain.Series, error) {
	uid, err := shared.ParseID(userID)
	if err != nil {
		return nil, err
	}
	series, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !series.AuthorID().Equal(uid) {
		return nil, ErrNotOwner
	}
	return series, nil
}

// publishEvents 发布聚合根内积累的领域事件（失败仅告警，不阻断用例）。
func (s *Service) publishEvents(ctx context.Context, series *domain.Series) {
	events := series.PullEvents()
	if len(events) == 0 {
		return
	}
	if err := s.bus.Publish(ctx, events); err != nil {
		log.Warn().Err(err).Str("series", series.Slug()).Msg("发布 series 领域事件失败")
	}
}

// publish 发布单个手动构造的事件。
func (s *Service) publish(ctx context.Context, event shared.DomainEvent) {
	if err := s.bus.Publish(ctx, []shared.DomainEvent{event}); err != nil {
		log.Warn().Err(err).Msg("发布 series 领域事件失败")
	}
}
