package apitoken

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	infraeventbus "blog-api/internal/infrastructure/eventbus"

	domainapitoken "blog-api/internal/domain/api_token"
	"blog-api/internal/domain/shared"
)

// fakeRepo TokenRepository 的内存 stub，记录调用参数与返回值。
type fakeRepo struct {
	saveErr    error
	findByUser []*domainapitoken.PAT
	findByErr  error

	saveCalls  []*domainapitoken.PAT
	deleteCalls []struct{ id, userID string }
}

func (f *fakeRepo) Save(_ context.Context, p *domainapitoken.PAT) error {
	f.saveCalls = append(f.saveCalls, p)
	return f.saveErr
}

func (f *fakeRepo) FindPageByUser(_ context.Context, _ string, q shared.PageQuery) (shared.PageResult[*domainapitoken.PAT], error) {
	return shared.PageResult[*domainapitoken.PAT]{}, nil
}

func (f *fakeRepo) FindByHash(_ context.Context, _ string) (*domainapitoken.PAT, error) {
	return nil, domainapitoken.ErrNotFound
}

func (f *fakeRepo) FindByUser(_ context.Context, _ string) ([]*domainapitoken.PAT, error) {
	return f.findByUser, f.findByErr
}

func (f *fakeRepo) Delete(_ context.Context, id, userID string) error {
	f.deleteCalls = append(f.deleteCalls, struct{ id, userID string }{id, userID})
	return nil
}

func TestService_Create_ReturnsPlaintextToken(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo, infraeventbus.NewInMemory())

	res, err := svc.Create(context.Background(), CreateInput{
		UserID: "user-1",
		Name:   "ci-token",
		Scopes: []string{domainapitoken.ScopePostsRead, domainapitoken.ScopePostsWrite},
	})
	if err != nil {
		t.Fatalf("Create 返回错误: %v", err)
	}

	// 明文 token 仅此一次返回，且带固定前缀
	tok := res.Token.PlaintextToken
	if tok == "" {
		t.Fatal("PlaintextToken 为空, want 一次性明文")
	}
	if !strings.HasPrefix(tok, domainapitoken.TokenPrefix) {
		t.Errorf("明文 token = %q, want 前缀 %s", tok, domainapitoken.TokenPrefix)
	}

	// DTO 元数据正确填充
	if res.Token.Name != "ci-token" {
		t.Errorf("Name = %q, want ci-token", res.Token.Name)
	}
	if len(res.Token.Scopes) != 2 {
		t.Fatalf("Scopes 长度 = %d, want 2", len(res.Token.Scopes))
	}
	if res.Token.ID == "" {
		t.Error("ID 为空, want 聚合根生成的 id")
	}

	// repo.Save 被调用一次，且持久化的聚合根不含明文（只存哈希）
	if len(repo.saveCalls) != 1 {
		t.Fatalf("repo.Save 调用 %d 次, want 1", len(repo.saveCalls))
	}
	saved := repo.saveCalls[0]
	if saved.TokenHash() == "" {
		t.Error("持久化聚合根 TokenHash 为空")
	}
	if saved.TokenHash() == tok {
		t.Error("持久化的应是哈希而非明文")
	}
}

func TestService_Create_PropagatesSaveError(t *testing.T) {
	wantErr := errors.New("disk full")
	repo := &fakeRepo{saveErr: wantErr}
	svc := NewService(repo, infraeventbus.NewInMemory())

	_, err := svc.Create(context.Background(), CreateInput{
		UserID: "user-1", Name: "t", Scopes: []string{domainapitoken.ScopePostsRead},
	})
	if !errors.Is(err, wantErr) {
		t.Errorf("err = %v, want %v", err, wantErr)
	}
}

func TestService_Create_RejectsInvalidScope(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo, infraeventbus.NewInMemory())

	if _, err := svc.Create(context.Background(), CreateInput{
		UserID: "user-1", Name: "t", Scopes: []string{"bogus:scope"},
	}); err == nil {
		t.Error("非法 scope 应返回错误")
	}
	if len(repo.saveCalls) != 0 {
		t.Errorf("非法 scope 不应触发 Save, 实际 %d 次", len(repo.saveCalls))
	}
}

func TestService_List_NeverExposesPlaintext(t *testing.T) {
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	exp := now.Add(24 * time.Hour)
	pats := []*domainapitoken.PAT{
		domainapitoken.Reconstruct("id-1", "user-1", "alpha", "hash-1",
			[]string{domainapitoken.ScopePostsRead}, exp, time.Time{}, now, true),
		domainapitoken.Reconstruct("id-2", "user-1", "beta", "hash-2",
			[]string{domainapitoken.ScopeCommentsRead}, time.Time{}, now, now, true),
	}
	repo := &fakeRepo{findByUser: pats}
	svc := NewService(repo, infraeventbus.NewInMemory())

	got, err := svc.List(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("List 返回错误: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("返回 %d 个 DTO, want 2", len(got))
	}
	for _, d := range got {
		if d.PlaintextToken != "" {
			t.Errorf("DTO %q PlaintextToken = %q, 列表场景必须恒为空", d.Name, d.PlaintextToken)
		}
	}
	// 元数据正确映射
	if got[0].ID != "id-1" || got[0].Name != "alpha" {
		t.Errorf("首条 DTO = %+v, want ID=id-1 Name=alpha", got[0])
	}
	if got[0].ExpiresAt == "" {
		t.Error("首条 ExpiresAt 为空, 应格式化过期时间")
	}
	// 永不过期（零值）→ ExpiresAt 留空
	if got[1].ExpiresAt != "" {
		t.Errorf("第二条 ExpiresAt = %q, 永不过期应为空", got[1].ExpiresAt)
	}
	// LastUsedAt 为零 → 留空；非零 → 格式化
	if got[0].LastUsedAt != "" {
		t.Errorf("首条 LastUsedAt = %q, 从未使用应为空", got[0].LastUsedAt)
	}
	if got[1].LastUsedAt == "" {
		t.Error("第二条 LastUsedAt 为空, 应格式化使用时间")
	}
}

func TestService_List_PropagatesFindError(t *testing.T) {
	wantErr := errors.New("db down")
	repo := &fakeRepo{findByErr: wantErr}
	svc := NewService(repo, infraeventbus.NewInMemory())

	if _, err := svc.List(context.Background(), "user-1"); !errors.Is(err, wantErr) {
		t.Errorf("err = %v, want %v", err, wantErr)
	}
}
