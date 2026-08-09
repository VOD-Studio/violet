package post

import (
	"context"
	"strconv"
	"testing"

	domain "blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
)

// fakeSlugRepo 只为 slug 冲突测试实现 ExistsBySlug,其余方法 panic。
// 测 resolveSlugConflict 只需要 ExistsBySlug,完整 PostRepository 的 mock
// 成本过高且与本次改动无关。
type fakeSlugRepo struct {
	existing map[string]bool // 模拟已占用的 slug 集合
	saved    *domain.Post    // 最近一次 Save 的文章（Create 测试断言用）
}

func (f *fakeSlugRepo) ExistsBySlug(_ context.Context, slug string) (bool, error) {
	return f.existing[slug], nil
}

// 其余方法未实现,调用即说明测试范围越界
func (f *fakeSlugRepo) FindByID(context.Context, shared.ID) (*domain.Post, error) {
	panic("not implemented")
}
func (f *fakeSlugRepo) FindBySlug(context.Context, string) (*domain.Post, error) {
	panic("not implemented")
}
func (f *fakeSlugRepo) FindPublished(context.Context, int, int, string) ([]*domain.Post, int64, error) {
	panic("not implemented")
}
func (f *fakeSlugRepo) FindAll(context.Context, int, int, string) ([]*domain.Post, int64, error) {
	panic("not implemented")
}
func (f *fakeSlugRepo) Search(context.Context, shared.ID, string, string, int, int) ([]*domain.Post, int64, error) {
	panic("not implemented")
}
func (f *fakeSlugRepo) SearchPublished(context.Context, string, int, int) ([]*domain.Post, int64, error) {
	panic("not implemented")
}
func (f *fakeSlugRepo) Save(ctx context.Context, p *domain.Post) error {
	f.saved = p
	return nil
}
func (f *fakeSlugRepo) SaveVersion(context.Context, *domain.PostVersion) error {
	return nil
}
func (f *fakeSlugRepo) Delete(context.Context, shared.ID) error           { panic("not implemented") }
func (f *fakeSlugRepo) Restore(context.Context, shared.ID) error          { panic("not implemented") }
func (f *fakeSlugRepo) HardDelete(context.Context, shared.ID) error       { panic("not implemented") }
func (f *fakeSlugRepo) IncrementViewAtomic(context.Context, shared.ID, string, string) error {
	panic("not implemented")
}
func (f *fakeSlugRepo) FindArchiveYears(context.Context) ([]int, error) { panic("not implemented") }
func (f *fakeSlugRepo) FindPublishedByYear(context.Context, int) ([]*domain.Post, error) {
	panic("not implemented")
}
func (f *fakeSlugRepo) FindVersionsByPostID(context.Context, shared.ID) ([]*domain.PostVersion, error) {
	panic("not implemented")
}
func (f *fakeSlugRepo) GetVersionByID(context.Context, shared.ID) (*domain.PostVersion, error) {
	panic("not implemented")
}
func (f *fakeSlugRepo) FindCollaboratorIDsByPostID(context.Context, shared.ID) ([]shared.ID, error) {
	panic("not implemented")
}
func (f *fakeSlugRepo) FindCollaboratorIDsByPostIDs(context.Context, []shared.ID) (map[string][]shared.ID, error) {
	panic("not implemented")
}

func newServiceWithFakeRepo(existing []string) *Service {
	m := make(map[string]bool, len(existing))
	for _, s := range existing {
		m[s] = true
	}
	return &Service{repo: &fakeSlugRepo{existing: m}}
}

func TestResolveSlugConflict_NoConflict(t *testing.T) {
	s := newServiceWithFakeRepo(nil)
	got, err := s.resolveSlugConflict(context.Background(), "my-post")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if got != "my-post" {
		t.Errorf("无冲突时应原样返回, got %q", got)
	}
}

func TestResolveSlugConflict_AppendsNumber(t *testing.T) {
	// "test" 已存在 → 应返回 "test-2"
	s := newServiceWithFakeRepo([]string{"test"})
	got, err := s.resolveSlugConflict(context.Background(), "test")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if got != "test-2" {
		t.Errorf("单次冲突应追加 -2, got %q", got)
	}
}

func TestResolveSlugConflict_AppendsUntilFree(t *testing.T) {
	// test / test-2 / test-3 全占,应返回 test-4
	s := newServiceWithFakeRepo([]string{"test", "test-2", "test-3"})
	got, err := s.resolveSlugConflict(context.Background(), "test")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if got != "test-4" {
		t.Errorf("连续占用应追加到首个空闲号, got %q", got)
	}
}

func TestResolveSlugConflict_ExhaustedReturnsError(t *testing.T) {
	// 构造 test 本身 + test-2 ~ test-99 全占用,应无法解析返回 ErrSlugConflict
	existing := []string{"test"}
	for i := 2; i <= 99; i++ {
		existing = append(existing, "test-"+strconv.Itoa(i))
	}
	s := newServiceWithFakeRepo(existing)
	_, err := s.resolveSlugConflict(context.Background(), "test")
	if err != domain.ErrSlugConflict {
		t.Errorf("99 个全占用应返回 ErrSlugConflict, got %v", err)
	}
}

// TestService_Create_EmptySlugAutoGenerate 订阅导入等调用方传空 slug 时,
// Create 应按标题自动生成 slug 而非报「slug 格式无效」。
func TestService_Create_EmptySlugAutoGenerate(t *testing.T) {
	s := newServiceWithFakeRepo(nil)
	dto, err := s.Create(context.Background(), CreateInput{
		AuthorID:   shared.NewID().String(),
		Title:      "我的第一篇文章",
		Slug:       "",
		ContentMD:  "正文",
		ContentHTML: "<p>正文</p>",
	})
	if err != nil {
		t.Fatalf("空 slug 应自动生成而非报错: %v", err)
	}
	if dto.Slug != "wo-de-di-yi-pian-wen-zhang" {
		t.Errorf("应按标题拼音生成 slug, got %q", dto.Slug)
	}
	if !domain.IsValidSlug(dto.Slug) {
		t.Errorf("自动生成的 slug %q 未通过 IsValidSlug", dto.Slug)
	}
	if s.repo.(*fakeSlugRepo).saved == nil {
		t.Fatal("Create 应保存文章")
	}
}
