package gallery

import (
	"context"
	"testing"
	"time"

	appshared "blog-api/internal/application/shared"
	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

// ============================================================
// fakes
// ============================================================

// stubRepo 内存图集仓储。
type stubRepo struct {
	galleries map[shared.ID]*domaingallery.Gallery
}

func newStubRepo() *stubRepo {
	return &stubRepo{galleries: make(map[shared.ID]*domaingallery.Gallery)}
}

func (s *stubRepo) Save(_ context.Context, g *domaingallery.Gallery) error {
	s.galleries[g.ID()] = g
	return nil
}

func (s *stubRepo) FindByID(_ context.Context, id shared.ID) (*domaingallery.Gallery, error) {
	g, ok := s.galleries[id]
	if !ok {
		return nil, domaingallery.ErrGalleryNotFound
	}
	return g, nil
}

func (s *stubRepo) FindPublishedPage(_ context.Context, q shared.PageQuery) (shared.PageResult[*domaingallery.Gallery], error) {
	items := make([]*domaingallery.Gallery, 0)
	for _, g := range s.galleries {
		if g.IsPublished() {
			items = append(items, g)
		}
	}
	return shared.PageResult[*domaingallery.Gallery]{Items: items, Total: int64(len(items))}, nil
}

func (s *stubRepo) FindPageByOwner(_ context.Context, ownerID shared.ID, q shared.PageQuery) (shared.PageResult[*domaingallery.Gallery], error) {
	items := make([]*domaingallery.Gallery, 0)
	for _, g := range s.galleries {
		if g.OwnerID() == ownerID && g.IsPublished() {
			items = append(items, g)
		}
	}
	return shared.PageResult[*domaingallery.Gallery]{Items: items, Total: int64(len(items))}, nil
}

func (s *stubRepo) FindAdminPage(_ context.Context, q shared.PageQuery) (shared.PageResult[*domaingallery.Gallery], error) {
	items := make([]*domaingallery.Gallery, 0, len(s.galleries))
	for _, g := range s.galleries {
		items = append(items, g)
	}
	return shared.PageResult[*domaingallery.Gallery]{Items: items, Total: int64(len(items))}, nil
}

func (s *stubRepo) Delete(_ context.Context, id shared.ID) error {
	delete(s.galleries, id)
	return nil
}

// stubMedia 媒体端口 stub：refLog 记录引用计数调用序，checkErr 注入校验失败。
type stubMedia struct {
	files    map[shared.ID]*domainupload.File
	refLog   []refCall
	checkErr error
}

type refCall struct {
	id    shared.ID
	delta int
}

func newStubMedia() *stubMedia {
	return &stubMedia{files: make(map[shared.ID]*domainupload.File)}
}

func (m *stubMedia) addFile(id, ownerID shared.ID, mime string) {
	m.files[id] = domainupload.ReconstructFile(
		id, ownerID, "material", "a.jpg", "/x/a.jpg", "/uploads/a.jpg",
		1024, mime, "hash", nil, nil, "", domainupload.StatusReady, 0, "", "", nil,
		time.Now(), time.Now(),
	)
}

func (m *stubMedia) CheckFilesUsable(_ context.Context, fileIDs []shared.ID, ownerID shared.ID) error {
	return m.checkErr
}

func (m *stubMedia) UpdateRefCount(_ context.Context, fileID shared.ID, delta int) error {
	m.refLog = append(m.refLog, refCall{id: fileID, delta: delta})
	return nil
}

func (m *stubMedia) FindByIDs(_ context.Context, fileIDs []shared.ID) (map[shared.ID]*domainupload.File, error) {
	out := make(map[shared.ID]*domainupload.File, len(fileIDs))
	for _, id := range fileIDs {
		if f, ok := m.files[id]; ok {
			out[id] = f
		}
	}
	return out, nil
}

// refBalance 汇总某文件的引用计数净变化。
func (m *stubMedia) refBalance(id shared.ID) int {
	sum := 0
	for _, c := range m.refLog {
		if c.id == id {
			sum += c.delta
		}
	}
	return sum
}

// fakeUserRepo 最小用户仓储 fake（service 只用 FindByIDs/FindByUsername）。
type fakeUserRepo struct {
	byID       map[shared.ID]*domainuser.User
	byUsername map[string]*domainuser.User
}

func newFakeUserRepo() *fakeUserRepo {
	return &fakeUserRepo{byID: make(map[shared.ID]*domainuser.User), byUsername: make(map[string]*domainuser.User)}
}

func (f *fakeUserRepo) add(u *domainuser.User) {
	f.byID[u.GetID()] = u
	f.byUsername[u.Username().String()] = u
}

func (f *fakeUserRepo) FindByID(_ context.Context, id shared.ID) (*domainuser.User, error) {
	if u, ok := f.byID[id]; ok {
		return u, nil
	}
	return nil, domainuser.ErrNotFound
}

func (f *fakeUserRepo) FindByIDs(_ context.Context, ids []shared.ID) ([]*domainuser.User, error) {
	out := make([]*domainuser.User, 0, len(ids))
	for _, id := range ids {
		if u, ok := f.byID[id]; ok {
			out = append(out, u)
		}
	}
	return out, nil
}

func (f *fakeUserRepo) FindByEmail(context.Context, domainuser.Email) (*domainuser.User, error) {
	return nil, domainuser.ErrNotFound
}

func (f *fakeUserRepo) FindByUsername(_ context.Context, username domainuser.Username) (*domainuser.User, error) {
	if u, ok := f.byUsername[username.String()]; ok {
		return u, nil
	}
	return nil, domainuser.ErrNotFound
}

func (f *fakeUserRepo) ExistsByEmail(context.Context, domainuser.Email) (bool, error)     { return false, nil }
func (f *fakeUserRepo) ExistsByUsername(context.Context, domainuser.Username) (bool, error) {
	return false, nil
}
func (f *fakeUserRepo) Save(context.Context, *domainuser.User) error    { return nil }
func (f *fakeUserRepo) Delete(context.Context, shared.ID) error         { return nil }
func (f *fakeUserRepo) Count(context.Context) (int64, error)            { return 0, nil }

// stubPerm 权限端口 stub。
type stubPerm struct{ allow bool }

func (p stubPerm) HasPermission(_ string, _ bool, _ ...string) bool { return p.allow }

// stubBus 事件总线 stub。
type stubBus struct{ events []shared.DomainEvent }

func (b *stubBus) Publish(_ context.Context, events []shared.DomainEvent) error {
	b.events = append(b.events, events...)
	return nil
}
func (b *stubBus) Subscribe(string, appshared.EventHandler) {}

// ============================================================
// 测试夹具
// ============================================================

type fixture struct {
	svc   *Service
	repo  *stubRepo
	media *stubMedia
	users *fakeUserRepo
	bus   *stubBus
	owner *domainuser.User
	files []shared.ID
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	repo := newStubRepo()
	media := newStubMedia()
	users := newFakeUserRepo()
	bus := &stubBus{}
	svc := NewService(repo, media, users, stubPerm{allow: false}, bus)

	uname, err := domainuser.ParseUsername("owner")
	if err != nil {
		t.Fatalf("ParseUsername: %v", err)
	}
	email, err := domainuser.ParseEmail("owner@example.com")
	if err != nil {
		t.Fatalf("ParseEmail: %v", err)
	}
	owner := domainuser.NewUser(shared.NewID(), email, uname, domainuser.NewPasswordHash("x"))
	users.add(owner)
	files := []shared.ID{shared.NewID(), shared.NewID(), shared.NewID()}
	for _, id := range files {
		media.addFile(id, owner.GetID(), "image/jpeg")
	}
	return &fixture{svc: svc, repo: repo, media: media, users: users, bus: bus, owner: owner, files: files}
}

// ctxAs 注入 session 中间件同款身份上下文。
func ctxAs(userID shared.ID) context.Context {
	ctx := context.Background()
	return context.WithValue(ctx, middleware.UserIDKey, userID.String())
}

func (f *fixture) createInput(t *testing.T) CreateInput {
	t.Helper()
	return CreateInput{
		OwnerID: f.owner.GetID().String(),
		Title:   "深秋的濑户内海",
		Items: []ItemInput{
			{FileID: f.files[0].String()},
			{FileID: f.files[1].String(), Caption: "港口"},
		},
	}
}

func (f *fixture) create(t *testing.T) GalleryDetailDTO {
	t.Helper()
	dto, err := f.svc.Create(ctxAs(f.owner.GetID()), f.createInput(t))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	return dto
}

// ============================================================
// 用例
// ============================================================

func TestCreate_OK(t *testing.T) {
	f := newFixture(t)
	dto := f.create(t)

	if dto.Title != "深秋的濑户内海" || dto.ItemCount != 2 || len(dto.Items) != 2 {
		t.Fatalf("unexpected dto: %+v", dto)
	}
	if dto.Items[0].URL != "/uploads/a.jpg" || dto.Items[1].Caption != "港口" {
		t.Fatalf("items not assembled: %+v", dto.Items)
	}
	// 封面默认取首项
	if dto.CoverURL == "" {
		t.Fatalf("cover should default to first item")
	}
	// 引用计数 +1
	for _, id := range f.files[:2] {
		if got := f.media.refBalance(id); got != 1 {
			t.Fatalf("ref balance for %s = %d, want 1", id, got)
		}
	}
	// 创建事件发布
	if len(f.bus.events) != 1 {
		t.Fatalf("want 1 event, got %d", len(f.bus.events))
	}
	if _, ok := f.bus.events[0].(domaingallery.GalleryCreated); !ok {
		t.Fatalf("want GalleryCreated, got %T", f.bus.events[0])
	}
}

func TestCreate_CheckerRejects(t *testing.T) {
	f := newFixture(t)
	f.media.checkErr = shared.Forbidden("媒体文件不存在或不属于当前用户")
	_, err := f.svc.Create(ctxAs(f.owner.GetID()), f.createInput(t))
	if err == nil {
		t.Fatalf("want error")
	}
	// 校验失败不产生引用计数
	if len(f.media.refLog) != 0 {
		t.Fatalf("no ref changes expected, got %+v", f.media.refLog)
	}
}

func TestCreate_TypeRejected(t *testing.T) {
	f := newFixture(t)
	f.media.checkErr = shared.BadRequest("图集仅支持图片或 mp4/webm 视频")
	_, err := f.svc.Create(ctxAs(f.owner.GetID()), f.createInput(t))
	if err != f.media.checkErr {
		t.Fatalf("want type rejection propagated, got %v", err)
	}
}

func TestCreate_EmptyItems(t *testing.T) {
	f := newFixture(t)
	in := f.createInput(t)
	in.Items = nil
	_, err := f.svc.Create(ctxAs(f.owner.GetID()), in)
	if err != domaingallery.ErrItemsRequired {
		t.Fatalf("want ErrItemsRequired, got %v", err)
	}
}

func TestCreate_CoverNotInItems(t *testing.T) {
	f := newFixture(t)
	in := f.createInput(t)
	in.CoverFileID = f.files[2].String() // 不在 items 内
	_, err := f.svc.Create(ctxAs(f.owner.GetID()), in)
	if err != ErrCoverNotInItems {
		t.Fatalf("want ErrCoverNotInItems, got %v", err)
	}
}

func TestUpdate_ByOwner(t *testing.T) {
	f := newFixture(t)
	dto := f.create(t)
	f.media.refLog = nil

	newItems := []ItemInput{
		{FileID: f.files[1].String()},                     // 保留
		{FileID: f.files[2].String(), Caption: "晚霞"},     // 新增
	}
	updated, err := f.svc.Update(ctxAs(f.owner.GetID()), dto.ID, UpdateInput{
		Title:       "新标题",
		Description: "新描述",
		Items:       newItems,
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Title != "新标题" || len(updated.Items) != 2 {
		t.Fatalf("unexpected update: %+v", updated)
	}
	// 引用计数 diff：files[2] +1，files[0] -1，files[1] 不动
	if got := f.media.refBalance(f.files[2]); got != 1 {
		t.Fatalf("added file ref = %d, want 1", got)
	}
	if got := f.media.refBalance(f.files[0]); got != -1 {
		t.Fatalf("removed file ref = %d, want -1", got)
	}
	if got := f.media.refBalance(f.files[1]); got != 0 {
		t.Fatalf("kept file ref = %d, want 0", got)
	}
}

func TestUpdate_ForbiddenForOthers(t *testing.T) {
	f := newFixture(t)
	dto := f.create(t)
	other := shared.NewID()
	_, err := f.svc.Update(ctxAs(other), dto.ID, UpdateInput{Title: "劫持"})
	if err == nil {
		t.Fatalf("want 403")
	}
}

func TestUpdate_RemovedReadOnly(t *testing.T) {
	f := newFixture(t)
	dto := f.create(t)
	if err := f.svc.SetStatus(context.Background(), dto.ID, domaingallery.StatusRemoved); err != nil {
		t.Fatalf("SetStatus: %v", err)
	}
	_, err := f.svc.Update(ctxAs(f.owner.GetID()), dto.ID, UpdateInput{Title: "下架后编辑"})
	if err != domaingallery.ErrRemovedReadOnly {
		t.Fatalf("want ErrRemovedReadOnly, got %v", err)
	}
}

func TestDelete_ByOwner(t *testing.T) {
	f := newFixture(t)
	dto := f.create(t)
	f.media.refLog = nil

	if err := f.svc.Delete(ctxAs(f.owner.GetID()), dto.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := f.repo.FindByID(context.Background(), shared.MustParseID(dto.ID)); err != domaingallery.ErrGalleryNotFound {
		t.Fatalf("gallery should be gone, got %v", err)
	}
	// 全量解绑
	for _, id := range f.files[:2] {
		if got := f.media.refBalance(id); got != -1 {
			t.Fatalf("ref balance for %s = %d, want -1", id, got)
		}
	}
	// 删除事件由应用层手动构造发布
	var found bool
	for _, e := range f.bus.events {
		if _, ok := e.(domaingallery.GalleryDeleted); ok {
			found = true
		}
	}
	if !found {
		t.Fatalf("want GalleryDeleted event, got %+v", f.bus.events)
	}
}

func TestDelete_ForbiddenForOthers(t *testing.T) {
	f := newFixture(t)
	dto := f.create(t)
	err := f.svc.Delete(ctxAs(shared.NewID()), dto.ID)
	if err == nil {
		t.Fatalf("want 403")
	}
}

func TestDelete_AdminWithPermission(t *testing.T) {
	f := newFixture(t)
	f.svc = NewService(f.repo, f.media, f.users, stubPerm{allow: true}, f.bus)
	dto := f.create(t)
	// 非作者但持 gallery:delete-any
	if err := f.svc.Delete(ctxAs(shared.NewID()), dto.ID); err != nil {
		t.Fatalf("Delete with perm: %v", err)
	}
}

func TestSetStatus_RoundTrip(t *testing.T) {
	f := newFixture(t)
	dto := f.create(t)

	if err := f.svc.SetStatus(context.Background(), dto.ID, domaingallery.StatusRemoved); err != nil {
		t.Fatalf("remove: %v", err)
	}
	// removed 详情 404
	if _, err := f.svc.GetPublic(context.Background(), dto.ID); err != domaingallery.ErrGalleryNotFound {
		t.Fatalf("removed detail should 404, got %v", err)
	}
	if err := f.svc.SetStatus(context.Background(), dto.ID, domaingallery.StatusPublished); err != nil {
		t.Fatalf("restore: %v", err)
	}
	if _, err := f.svc.GetPublic(context.Background(), dto.ID); err != nil {
		t.Fatalf("restored detail should be visible, got %v", err)
	}
	// 非法状态
	if err := f.svc.SetStatus(context.Background(), dto.ID, "archived"); err == nil {
		t.Fatalf("want bad request for illegal status")
	}
	// 事件：removed + restored 各一条（创建 1 + 治理 2）
	if len(f.bus.events) != 3 {
		t.Fatalf("want 3 events, got %d", len(f.bus.events))
	}
}

func TestListByUsername_NotFound(t *testing.T) {
	f := newFixture(t)
	_, _, err := f.svc.ListByUsername(context.Background(), "ghost", shared.PageQuery{Page: 1, Limit: 20})
	if err == nil {
		t.Fatalf("want 404 for unknown username")
	}
}

func TestListPublished_OnlyPublished(t *testing.T) {
	f := newFixture(t)
	dto := f.create(t)
	if err := f.svc.SetStatus(context.Background(), dto.ID, domaingallery.StatusRemoved); err != nil {
		t.Fatalf("SetStatus: %v", err)
	}
	dtos, total, err := f.svc.ListPublished(context.Background(), shared.PageQuery{Page: 1, Limit: 20})
	if err != nil {
		t.Fatalf("ListPublished: %v", err)
	}
	if total != 0 || len(dtos) != 0 {
		t.Fatalf("removed gallery should not appear, got %d", total)
	}
	// 管理列表仍可见
	_, adminTotal, err := f.svc.ListAdmin(context.Background(), shared.PageQuery{Page: 1, Limit: 20})
	if err != nil || adminTotal != 1 {
		t.Fatalf("admin list should include removed, got %d %v", adminTotal, err)
	}
}

func TestListPublished_PreviewURLs(t *testing.T) {
	f := newFixture(t)
	// 视频放第 2 位（前 3 预览范围内）：无首帧应被跳过，预览只含 3 张图
	videoID := shared.NewID()
	f.media.addFile(videoID, f.owner.GetID(), "video/mp4")
	extraID := shared.NewID()
	f.media.addFile(extraID, f.owner.GetID(), "image/png")
	if _, err := f.svc.Create(ctxAs(f.owner.GetID()), CreateInput{
		OwnerID: f.owner.GetID().String(),
		Title:   "五项图集",
		Items: []ItemInput{
			{FileID: f.files[0].String()},
			{FileID: videoID.String()},
			{FileID: f.files[1].String()},
			{FileID: f.files[2].String()},
			{FileID: extraID.String()},
		},
	}); err != nil {
		t.Fatalf("Create: %v", err)
	}

	dtos, _, err := f.svc.ListPublished(context.Background(), shared.PageQuery{Page: 1, Limit: 20})
	if err != nil {
		t.Fatalf("ListPublished: %v", err)
	}
	if len(dtos) != 1 {
		t.Fatalf("want 1 gallery, got %d", len(dtos))
	}
	got := dtos[0].PreviewURLs
	// 前 3 项 = [图, 视频, 图]：视频无首帧跳过 → 2 张（位置截断不补位）
	if len(got) != 2 {
		t.Fatalf("want 2 preview urls, got %d: %v", len(got), got)
	}
	for _, u := range got {
		if u != "/uploads/a.jpg" {
			t.Fatalf("unexpected preview url %q", u)
		}
	}
}
