package gallery

import (
	"strings"
	"testing"
	"time"

	"blog-api/internal/domain/shared"
)

func newTestItems(n int) []GalleryItem {
	items := make([]GalleryItem, n)
	for i := range items {
		items[i] = NewGalleryItem(shared.NewID(), "")
	}
	return items
}

func newTestGallery(t *testing.T) *Gallery {
	t.Helper()
	g, err := NewGallery(shared.NewID(), shared.NewID(), "深秋的濑户内海", "跳岛五日", nil, newTestItems(3))
	if err != nil {
		t.Fatalf("NewGallery: %v", err)
	}
	return g
}

func TestNewGalleryValidation(t *testing.T) {
	owner := shared.NewID()
	cases := []struct {
		name    string
		title   string
		desc    string
		items   []GalleryItem
		wantErr error
	}{
		{"合法", "濑户内海", "", newTestItems(1), nil},
		{"标题空白", "   ", "", newTestItems(1), ErrTitleRequired},
		{"标题超长", strings.Repeat("字", TitleMaxRunes+1), "", newTestItems(1), ErrTitleTooLong},
		{"标题刚好上限", strings.Repeat("字", TitleMaxRunes), "", newTestItems(1), nil},
		{"描述超长", "濑户内海", strings.Repeat("字", DescriptionMaxRunes+1), newTestItems(1), ErrDescriptionTooLong},
		{"空图集", "濑户内海", "", nil, ErrItemsRequired},
		{"超 50 项", "濑户内海", "", newTestItems(ItemsMax+1), ErrItemsTooMany},
		{"刚好 50 项", "濑户内海", "", newTestItems(ItemsMax), nil},
		{"caption 超长", "濑户内海", "", []GalleryItem{NewGalleryItem(shared.NewID(), strings.Repeat("字", CaptionMaxRunes+1))}, ErrCaptionTooLong},
		{"caption 刚好上限", "濑户内海", "", []GalleryItem{NewGalleryItem(shared.NewID(), strings.Repeat("字", CaptionMaxRunes))}, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := NewGallery(shared.NewID(), owner, c.title, c.desc, nil, c.items)
			if c.wantErr == nil && err != nil {
				t.Fatalf("want ok, got %v", err)
			}
			if c.wantErr != nil && err != c.wantErr {
				t.Fatalf("want %v, got %v", c.wantErr, err)
			}
		})
	}
}

func TestNewGallery_RecordsCreatedEvent(t *testing.T) {
	g := newTestGallery(t)
	events := g.PullEvents()
	if len(events) != 1 {
		t.Fatalf("want 1 event, got %d", len(events))
	}
	created, ok := events[0].(GalleryCreated)
	if !ok {
		t.Fatalf("want GalleryCreated, got %T", events[0])
	}
	if created.Title != "深秋的濑户内海" || created.ItemCount != 3 {
		t.Fatalf("unexpected payload: %+v", created)
	}
	if created.AggregateID() != g.ID() {
		t.Fatalf("event aggregate id mismatch")
	}
	// PullEvents 后清空
	if rest := g.PullEvents(); len(rest) != 0 {
		t.Fatalf("events should be drained, got %d", len(rest))
	}
}

func TestGallery_Update(t *testing.T) {
	g := newTestGallery(t)
	g.PullEvents()

	err := g.Update(UpdateParams{Title: "新标题", Description: "新描述"})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if g.Title() != "新标题" || g.Description() != "新描述" {
		t.Fatalf("fields not updated: %q %q", g.Title(), g.Description())
	}
	events := g.PullEvents()
	if len(events) != 1 {
		t.Fatalf("want 1 event, got %d", len(events))
	}
	updated := events[0].(GalleryUpdated)
	if len(updated.Changes) != 2 {
		t.Fatalf("want 2 changes, got %+v", updated.Changes)
	}

	// 同值再调：无事件
	if err := g.Update(UpdateParams{Title: "新标题", Description: "新描述"}); err != nil {
		t.Fatalf("Update same: %v", err)
	}
	if events := g.PullEvents(); len(events) != 0 {
		t.Fatalf("same-value update should record no event, got %d", len(events))
	}
}

func TestGallery_UpdateCover(t *testing.T) {
	g := newTestGallery(t)
	g.PullEvents()
	cover := shared.NewID()

	if err := g.Update(UpdateParams{Title: g.Title(), Description: g.Description(), CoverFileID: &cover}); err != nil {
		t.Fatalf("Update cover: %v", err)
	}
	if g.CoverFileID() == nil || *g.CoverFileID() != cover {
		t.Fatalf("cover not set: %v", g.CoverFileID())
	}

	// 显式清空（回退首项封面）
	if err := g.Update(UpdateParams{Title: g.Title(), Description: g.Description(), ClearCover: true}); err != nil {
		t.Fatalf("clear cover: %v", err)
	}
	if g.CoverFileID() != nil {
		t.Fatalf("cover not cleared: %v", g.CoverFileID())
	}

	// 非法字段仍校验
	if err := g.Update(UpdateParams{Title: strings.Repeat("字", TitleMaxRunes+1)}); err != ErrTitleTooLong {
		t.Fatalf("want ErrTitleTooLong, got %v", err)
	}
}

func TestGallery_SetItems(t *testing.T) {
	g := newTestGallery(t)
	g.PullEvents()

	replacements := []GalleryItem{
		NewGalleryItem(shared.NewID(), "港口"),
		NewGalleryItem(shared.NewID(), "晚霞"),
	}
	if err := g.SetItems(replacements); err != nil {
		t.Fatalf("SetItems: %v", err)
	}
	items := g.Items()
	if len(items) != 2 || items[0].Caption() != "港口" {
		t.Fatalf("items not replaced: %+v", items)
	}
	// 返回副本：外部改动不影响内部状态
	items[0] = NewGalleryItem(shared.NewID(), "篡改")
	if g.Items()[0].Caption() != "港口" {
		t.Fatalf("Items should return a copy")
	}

	// 全同：无事件
	g.PullEvents()
	if err := g.SetItems(replacements); err != nil {
		t.Fatalf("SetItems same: %v", err)
	}
	if events := g.PullEvents(); len(events) != 0 {
		t.Fatalf("same items should record no event, got %d", len(events))
	}

	// 边界仍校验
	if err := g.SetItems(nil); err != ErrItemsRequired {
		t.Fatalf("want ErrItemsRequired, got %v", err)
	}
	if err := g.SetItems(newTestItems(ItemsMax + 1)); err != ErrItemsTooMany {
		t.Fatalf("want ErrItemsTooMany, got %v", err)
	}
}

func TestGallery_RemoveRestore(t *testing.T) {
	g := newTestGallery(t)
	g.PullEvents()

	if err := g.Remove(); err != nil {
		t.Fatalf("Remove: %v", err)
	}
	if !g.IsRemoved() || g.IsPublished() {
		t.Fatalf("status should be removed, got %s", g.Status())
	}
	if _, ok := g.PullEvents()[0].(GalleryRemoved); !ok {
		t.Fatalf("want GalleryRemoved event")
	}

	// 重复下架报错
	if err := g.Remove(); err != ErrAlreadyRemoved {
		t.Fatalf("want ErrAlreadyRemoved, got %v", err)
	}
	// removed 态不可编辑
	if err := g.Update(UpdateParams{Title: "x", Description: ""}); err != ErrRemovedReadOnly {
		t.Fatalf("want ErrRemovedReadOnly on Update, got %v", err)
	}
	if err := g.SetItems(newTestItems(1)); err != ErrRemovedReadOnly {
		t.Fatalf("want ErrRemovedReadOnly on SetItems, got %v", err)
	}

	if err := g.Restore(); err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if !g.IsPublished() {
		t.Fatalf("status should be published, got %s", g.Status())
	}
	if _, ok := g.PullEvents()[0].(GalleryRestored); !ok {
		t.Fatalf("want GalleryRestored event")
	}
	// 非 removed 态恢复报错
	if err := g.Restore(); err != ErrNotRemoved {
		t.Fatalf("want ErrNotRemoved, got %v", err)
	}
}

func TestReconstructGallery_NoSideEffects(t *testing.T) {
	id, owner := shared.NewID(), shared.NewID()
	items := newTestItems(2)
	g := ReconstructGallery(id, owner, "重建", "", nil, StatusRemoved, items, time.Now(), time.Now())
	if g.ID() != id || g.OwnerID() != owner || !g.IsRemoved() {
		t.Fatalf("reconstruct mismatch: %+v", g)
	}
	if events := g.PullEvents(); len(events) != 0 {
		t.Fatalf("reconstruct should record no events, got %d", len(events))
	}
}
