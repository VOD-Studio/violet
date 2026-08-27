package series

import (
	"context"
	"testing"

	appshared "blog-api/internal/application/shared"
	domain "blog-api/internal/domain/series"
	"blog-api/internal/domain/shared"
)

// stubRepo 内存仓储 stub：覆盖用例路径所需方法集。
type stubRepo struct {
	series  map[shared.ID]*domain.Series
	slugs   map[string]shared.ID
	metas   map[shared.ID]domain.PostMeta
	attachs []domain.ChapterAssignment
	plans   []domain.ReorderPlan
	// sectionChapterCount 模拟卷内章节数（key=sectionID）
	sectionChapterCount map[shared.ID]int64
	// chapterBySlug 文章 slug → Chapter
	chapters map[shared.ID][]domain.Chapter
}

func newStubRepo() *stubRepo {
	return &stubRepo{
		series:              make(map[shared.ID]*domain.Series),
		slugs:               make(map[string]shared.ID),
		metas:               make(map[shared.ID]domain.PostMeta),
		sectionChapterCount: make(map[shared.ID]int64),
		chapters:            make(map[shared.ID][]domain.Chapter),
	}
}

func (s *stubRepo) Save(ctx context.Context, ser *domain.Series) error {
	s.series[ser.ID()] = ser
	s.slugs[ser.Slug()] = ser.ID()
	return nil
}

func (s *stubRepo) FindByID(ctx context.Context, id shared.ID) (*domain.Series, error) {
	ser, ok := s.series[id]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return ser, nil
}

func (s *stubRepo) FindSlugsByIDs(ctx context.Context, ids []shared.ID) (map[shared.ID]string, error) {
	out := make(map[shared.ID]string, len(ids))
	for _, id := range ids {
		if ser, ok := s.series[id]; ok {
			out[id] = ser.Slug()
		}
	}
	return out, nil
}

func (s *stubRepo) FindPageByAuthor(ctx context.Context, authorID shared.ID, q shared.PageQuery) (shared.PageResult[*domain.Series], error) {
	items := make([]*domain.Series, 0)
	for _, ser := range s.series {
		if ser.AuthorID().Equal(authorID) {
			items = append(items, ser)
		}
	}
	return shared.PageResult[*domain.Series]{Items: items, Total: int64(len(items))}, nil
}

func (s *stubRepo) FindBySlug(ctx context.Context, slug string) (*domain.Series, error) {
	id, ok := s.slugs[slug]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return s.series[id], nil
}

func (s *stubRepo) ExistsBySlug(ctx context.Context, slug string, excludeID shared.ID) (bool, error) {
	id, ok := s.slugs[slug]
	if !ok {
		return false, nil
	}
	if !excludeID.IsZero() && id.Equal(excludeID) {
		return false, nil // 自己的 slug 不算占用（编辑场景）
	}
	return true, nil
}

func (s *stubRepo) FindPublishedPage(ctx context.Context, q shared.PageQuery) (shared.PageResult[*domain.Series], error) {
	items := make([]*domain.Series, 0)
	for _, ser := range s.series {
		if ser.IsPublished() {
			items = append(items, ser)
		}
	}
	return shared.NewPageResult(q, items, int64(len(items))), nil
}
func (s *stubRepo) FindPage(ctx context.Context, q shared.PageQuery) (shared.PageResult[*domain.Series], error) {
	items := make([]*domain.Series, 0, len(s.series))
	for _, ser := range s.series {
		items = append(items, ser)
	}
	return shared.NewPageResult(q, items, int64(len(items))), nil
}

func (s *stubRepo) Delete(ctx context.Context, id shared.ID) error {
	if _, ok := s.series[id]; !ok {
		return domain.ErrNotFound
	}
	delete(s.series, id)
	return nil
}

func (s *stubRepo) FindChapters(ctx context.Context, seriesID shared.ID) ([]domain.Chapter, error) {
	return s.chapters[seriesID], nil
}

func (s *stubRepo) FindSeriesIDByPostSlug(ctx context.Context, postSlug string) (*shared.ID, error) {
	for sid, chapters := range s.chapters {
		for _, ch := range chapters {
			if ch.Slug == postSlug {
				id := sid
				return &id, nil
			}
		}
	}
	return nil, nil
}

func (s *stubRepo) FindPostMeta(ctx context.Context, postIDs []shared.ID) ([]domain.PostMeta, error) {
	metas := make([]domain.PostMeta, 0, len(postIDs))
	for _, id := range postIDs {
		if m, ok := s.metas[id]; ok {
			metas = append(metas, m)
		}
	}
	return metas, nil
}
func (s *stubRepo) AttachChapters(ctx context.Context, seriesID shared.ID, assignments []domain.ChapterAssignment) error {
	s.attachs = append(s.attachs, assignments...)
	// 模拟真实仓储写 posts 三列：按 assignment 更新内存章节视图
	for _, a := range assignments {
		ch := domain.Chapter{PostID: a.PostID, Status: "published", SectionID: a.SectionID, ChapterOrder: a.Order}
		s.chapters[seriesID] = append(s.chapters[seriesID], ch)
	}
	return nil
}

func (s *stubRepo) DetachChapter(ctx context.Context, seriesID shared.ID, postID shared.ID) error {
	remaining := make([]domain.Chapter, 0, len(s.chapters[seriesID]))
	for _, ch := range s.chapters[seriesID] {
		if ch.PostID != postID {
			remaining = append(remaining, ch)
		}
	}
	s.chapters[seriesID] = remaining
	return nil
}
func (s *stubRepo) ReorderChapters(ctx context.Context, seriesID shared.ID, plans []domain.ReorderPlan) error {
	s.plans = plans
	// 按 plan 重写内存章节（模拟 DB：posts 行本来存在，挂章/调序即写三列）
	var rebuilt []domain.Chapter
	byPost := make(map[shared.ID]domain.Chapter)
	for _, ch := range s.chapters[seriesID] {
		byPost[ch.PostID] = ch
	}
	for _, plan := range plans {
		for i, pid := range plan.OrderedIDs {
			ch, ok := byPost[pid]
			if !ok {
				// posts 行本来就在（文章表），无章节视图时从 metas 补建
				meta := s.metas[pid]
				ch = domain.Chapter{PostID: pid, Status: meta.Status}
			}
			ch.SectionID = plan.SectionID
			ch.ChapterOrder = i
			rebuilt = append(rebuilt, ch)
		}
	}
	s.chapters[seriesID] = rebuilt
	return nil
}

func (s *stubRepo) CountChaptersInSection(ctx context.Context, sectionID shared.ID) (int64, error) {
	return s.sectionChapterCount[sectionID], nil
}

func (s *stubRepo) ChapterStatsBySeries(ctx context.Context, seriesIDs []shared.ID) (map[shared.ID]domain.ChapterStats, error) {
	out := make(map[shared.ID]domain.ChapterStats, len(seriesIDs))
	for _, id := range seriesIDs {
		var st domain.ChapterStats
		for _, ch := range s.chapters[id] {
			st.Total++
			if ch.IsPublished() {
				st.PublishedCount++
				if ch.PublishedAt.After(st.LatestPublishedAt) {
					st.LatestPublishedAt = ch.PublishedAt
				}
			}
		}
		out[id] = st
	}
	return out, nil
}

// stubBus 事件总线 stub。
type stubBus struct{ events []shared.DomainEvent }

func (b *stubBus) Publish(ctx context.Context, events []shared.DomainEvent) error {
	b.events = append(b.events, events...)
	return nil
}
func (b *stubBus) Subscribe(eventName string, h appshared.EventHandler) {}

// Compile 校验 stub 满足仓储接口（若接口不匹配会在编译期暴露）。
var _ domain.SeriesRepository = (*stubRepo)(nil)

func newTestService(t *testing.T) (*Service, *stubRepo, *stubBus) {
	t.Helper()
	repo := newStubRepo()
	bus := &stubBus{}
	return NewService(repo, bus), repo, bus
}

// seedBook 建一本已发布书 + 两卷 + 若干章节。
func seedBook(t *testing.T, svc *Service, repo *stubRepo) (*domain.Series, shared.ID, shared.ID) {
	t.Helper()
	author := shared.NewID()
	dto, err := svc.Create(context.Background(), CreateInput{
		UserID: author.String(), Title: "Java 笔记", Slug: "java-notes", Description: "d",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	sid, _ := shared.ParseID(dto.ID)
	if _, err := svc.Update(context.Background(), dto.ID, UpdateInput{UserID: author.String(), Publish: boolPtr(true)}); err != nil {
		t.Fatalf("Publish: %v", err)
	}
	// 卷
	if _, err := svc.AddSection(context.Background(), dto.ID, AddSectionInput{UserID: author.String(), Title: "第一部"}); err != nil {
		t.Fatalf("AddSection: %v", err)
	}
	if _, err := svc.AddSection(context.Background(), dto.ID, AddSectionInput{UserID: author.String(), Title: "第二部"}); err != nil {
		t.Fatalf("AddSection: %v", err)
	}
	book, _ := repo.FindByID(context.Background(), sid)
	secs := book.Sections()
	return book, secs[0].ID(), secs[1].ID()
}

func TestOwnerOnlyWrite(t *testing.T) {
	svc, repo, _ := newTestService(t)
	book, _, _ := seedBook(t, svc, repo)
	owner := book.AuthorID()
	stranger := shared.NewID()

	if _, err := svc.Update(context.Background(), book.ID().String(), UpdateInput{UserID: stranger.String(), Publish: boolPtr(true)}); err != ErrNotOwner {
		t.Fatalf("want ErrNotOwner, got %v", err)
	}
	if _, err := svc.Update(context.Background(), book.ID().String(), UpdateInput{UserID: owner.String(), Publish: boolPtr(true)}); err == nil {
		// book 已 published，重复发布应 Conflict 而非 403 —— 证明通过了 owner 校验
		t.Fatalf("已发布书重复发布应报 Conflict")
	}
}
func boolPtr(b bool) *bool { return &b }

func seedPost(t *testing.T, repo *stubRepo, author shared.ID, slug string) shared.ID {
	t.Helper()
	pid := shared.NewID()
	repo.metas[pid] = domain.PostMeta{PostID: pid, AuthorID: author, Status: "published"}
	return pid
}

func TestCreateSlugTaken(t *testing.T) {
	svc, repo, _ := newTestService(t)
	author := shared.NewID()
	if _, err := svc.Create(context.Background(), CreateInput{UserID: author.String(), Title: "A", Slug: "dup"}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := svc.Create(context.Background(), CreateInput{UserID: author.String(), Title: "B", Slug: "dup"}); err != ErrSlugTaken {
		t.Fatalf("want ErrSlugTaken, got %v", err)
	}
	_ = repo
}

func TestRemoveSectionNotEmpty(t *testing.T) {
	svc, repo, bus := newTestService(t)
	book, secA, _ := seedBook(t, svc, repo)
	owner := book.AuthorID()
	p1 := seedPost(t, repo, owner, "c1")
	if _, err := svc.AttachChapters(context.Background(), book.ID().String(), AttachInput{
		UserID: owner.String(), PostIDs: []string{p1.String()}, SectionID: secA.String(),
	}); err != nil {
		t.Fatalf("Attach: %v", err)
	}
	repo.sectionChapterCount[secA] = 1
	if err := svc.RemoveSection(context.Background(), book.ID().String(), secA.String(), owner.String()); err != ErrSectionNotEmpty {
		t.Fatalf("want ErrSectionNotEmpty, got %v", err)
	}
	_ = bus
}

func TestAttachForeignPostRejected(t *testing.T) {
	svc, repo, _ := newTestService(t)
	book, _, _ := seedBook(t, svc, repo)
	owner := book.AuthorID()

	// 别人的文章 → ErrPostNotAttachable
	foreign := shared.NewID()
	repo.metas[foreign] = domain.PostMeta{PostID: foreign, AuthorID: shared.NewID(), Status: "published"}
	if _, err := svc.AttachChapters(context.Background(), book.ID().String(), AttachInput{
		UserID: owner.String(), PostIDs: []string{foreign.String()},
	}); err != ErrPostNotAttachable {
		t.Fatalf("want ErrPostNotAttachable, got %v", err)
	}

	// 已挂其他书 → ErrPostInOtherSeries
	mine := shared.NewID()
	otherBook := shared.NewID()
	repo.metas[mine] = domain.PostMeta{PostID: mine, AuthorID: owner, Status: "published", SeriesID: &otherBook}
	if _, err := svc.AttachChapters(context.Background(), book.ID().String(), AttachInput{
		UserID: owner.String(), PostIDs: []string{mine.String()},
	}); err != ErrPostInOtherSeries {
		t.Fatalf("want ErrPostInOtherSeries, got %v", err)
	}
}

func TestReorderChaptersCoverage(t *testing.T) {
	svc, repo, _ := newTestService(t)
	book, secA, _ := seedBook(t, svc, repo)
	owner := book.AuthorID()
	p1 := seedPost(t, repo, owner, "c1")
	p2 := seedPost(t, repo, owner, "c2")
	secAStr := secA.String()
	if _, err := svc.AttachChapters(context.Background(), book.ID().String(), AttachInput{
		UserID: owner.String(), PostIDs: []string{p1.String(), p2.String()}, SectionID: secAStr,
	}); err != nil {
		t.Fatalf("Attach: %v", err)
	}

	// 少覆盖一章 → 拒绝
	err := svc.ReorderChapters(context.Background(), book.ID().String(), ReorderChaptersInput{
		UserID: owner.String(),
		Plans:  []ReorderScopeInput{{SectionID: secAStr, OrderedPostIDs: []string{p1.String()}}},
	})
	if err == nil {
		t.Fatal("未覆盖全部章节应被拒绝")
	}

	// 全覆盖 + 跨卷（p2 移到书根）
	err = svc.ReorderChapters(context.Background(), book.ID().String(), ReorderChaptersInput{
		UserID: owner.String(),
		Plans: []ReorderScopeInput{
			{SectionID: "", OrderedPostIDs: []string{p2.String()}},
			{SectionID: secAStr, OrderedPostIDs: []string{p1.String()}},
		},
	})
	if err != nil {
		t.Fatalf("跨卷调序: %v", err)
	}
	chapters := repo.chapters[book.ID()]
	for _, ch := range chapters {
		if ch.PostID.Equal(p2) && ch.SectionID != nil {
			t.Fatal("p2 应已移到书根")
		}
		if ch.PostID.Equal(p1) && (ch.SectionID == nil || !ch.SectionID.Equal(secA)) {
			t.Fatal("p1 应仍在卷A")
		}
	}
}

func TestChapterContextNavigation(t *testing.T) {
	svc, repo, _ := newTestService(t)
	book, _, _ := seedBook(t, svc, repo)
	owner := book.AuthorID()

	p1 := seedPost(t, repo, owner, "ch-1")
	p2 := seedPost(t, repo, owner, "ch-2")
	p3 := seedPost(t, repo, owner, "ch-3")
	if _, err := svc.AttachChapters(context.Background(), book.ID().String(), AttachInput{
		UserID: owner.String(), PostIDs: []string{p1.String(), p2.String(), p3.String()},
	}); err != nil {
		t.Fatalf("Attach: %v", err)
	}
	// 模拟持久化后的章节视图（stub Attach 不写 chapters，直接造）
	secNil := (*shared.ID)(nil)
	_ = secNil
	repo.chapters[book.ID()] = []domain.Chapter{
		{PostID: p1, Slug: "ch-1", Title: "一", Status: "published", ChapterOrder: 0},
		{PostID: p2, Slug: "ch-2", Title: "二", Status: "draft", ChapterOrder: 1},
		{PostID: p3, Slug: "ch-3", Title: "三", Status: "published", ChapterOrder: 2},
	}

	ctx, err := svc.GetChapterContextBySlug(context.Background(), "ch-3")
	if err != nil || ctx == nil {
		t.Fatalf("ctx err=%v nil=%v", err, ctx == nil)
	}
	if ctx.TotalChapters != 2 || ctx.ChapterNo != 2 {
		t.Fatalf("draft 章应被跳过: no=%d total=%d", ctx.ChapterNo, ctx.TotalChapters)
	}
	if ctx.Prev == nil || ctx.Prev.Slug != "ch-1" {
		t.Fatalf("prev 应跳过 draft 指向 ch-1, got %+v", ctx.Prev)
	}
	if ctx.Next != nil {
		t.Fatal("末章 next 应为 nil")
	}

	// 首章 prev 为 nil
	first, _ := svc.GetChapterContextBySlug(context.Background(), "ch-1")
	if first.Prev != nil || first.ChapterNo != 1 {
		t.Fatalf("首章: prev=%v no=%d", first.Prev, first.ChapterNo)
	}

	// draft 章自身：有归属无导航
	draft, _ := svc.GetChapterContextBySlug(context.Background(), "ch-2")
	if draft == nil || draft.ChapterNo != 0 {
		t.Fatalf("draft 章应有归属无序号: %+v", draft)
	}
}

func TestGetBySlugDraftHidden(t *testing.T) {
	svc, _, _ := newTestService(t)
	author := shared.NewID()
	dto, err := svc.Create(context.Background(), CreateInput{UserID: author.String(), Title: "D", Slug: "draft-book"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := svc.GetBySlug(context.Background(), "draft-book"); err != domain.ErrNotFound {
		t.Fatalf("draft 书应 404, got %v", err)
	}
	_ = dto
}
