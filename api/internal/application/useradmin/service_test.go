package useradmin

import (
	"context"
	"errors"
	"testing"

	"blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	domainuseradmin "blog-api/internal/domain/useradmin"
)

// fakeStore AdminUserStore 的内存 stub，记录调用参数与返回值。
type fakeStore struct {
	listRes   domainuseradmin.ListResult
	listErr   error
	findByIDs []*domainuser.User
	findErr   error
	affected  int64
	batchErr  error

	listCalls    []listStoreCall
	findIDsCalls [][]shared.ID
	batchStatus  []struct {
		ids      []shared.ID
		isActive bool
	}
	batchRole []struct {
		ids   []shared.ID
		role  string
	}
	saveCalls []*domainuser.User
	delCalls  []shared.ID
}

type listStoreCall struct {
	filter      ListFilter
	page, limit int
}

func (f *fakeStore) List(_ context.Context, filter ListFilter, page, limit int) (domainuseradmin.ListResult, error) {
	f.listCalls = append(f.listCalls, listStoreCall{filter, page, limit})
	return f.listRes, f.listErr
}

func (f *fakeStore) FindByID(_ context.Context, _ shared.ID) (*domainuser.User, error) {
	return nil, errors.New("not implemented in stub")
}

func (f *fakeStore) FindByIDs(_ context.Context, ids []shared.ID) ([]*domainuser.User, error) {
	f.findIDsCalls = append(f.findIDsCalls, ids)
	return f.findByIDs, f.findErr
}

func (f *fakeStore) Save(_ context.Context, u *domainuser.User) error {
	f.saveCalls = append(f.saveCalls, u)
	return nil
}

func (f *fakeStore) Delete(_ context.Context, id shared.ID) error {
	f.delCalls = append(f.delCalls, id)
	return nil
}

func (f *fakeStore) BatchUpdateStatus(_ context.Context, ids []shared.ID, isActive bool) (int64, error) {
	f.batchStatus = append(f.batchStatus, struct {
		ids      []shared.ID
		isActive bool
	}{ids, isActive})
	return f.affected, f.batchErr
}

func (f *fakeStore) BatchUpdateRole(_ context.Context, ids []shared.ID, role string) (int64, error) {
	f.batchRole = append(f.batchRole, struct {
		ids  []shared.ID
		role string
	}{ids, role})
	return f.affected, f.batchErr
}

// noopHasher / noopAudit 仅满足 NewService 依赖，行为不被断言。
type noopHasher struct{}

func (noopHasher) Hash(_ string) (domainuser.PasswordHash, error) {
	return domainuser.NewPasswordHash("$2a$10$stub"), nil
}

type noopAudit struct{ logErr error }

func (a noopAudit) Log(_ context.Context, _, _, _, _, _, _ string) error { return a.logErr }
func (a noopAudit) LogWithDetail(_ context.Context, _, _, _, _, _, _ string, _ map[string]any) error {
	return a.logErr
}

// mustUser 构造一个测试用户聚合（值拷贝供 ListResult 使用）。
func mustUser(t *testing.T, username, email string, role domainuser.Role, active bool) domainuser.User {
	t.Helper()
	em, _ := domainuser.ParseEmail(email)
	un, _ := domainuser.ParseUsername(username)
	u := domainuser.NewUser(shared.NewID(), em, un, domainuser.NewPasswordHash("$2a$10$h"))
	if err := u.ChangeRole(role); err != nil {
		t.Fatalf("ChangeRole(%s): %v", role, err)
	}
	if !active {
		u.Deactivate()
	}
	return *u
}

func newTestService(store *fakeStore) *Service {
	return NewService(store, noopHasher{}, noopAudit{})
}

func TestService_List_MapsToDTOs(t *testing.T) {
	u1 := mustUser(t, "alice", "alice@example.com", domainuser.RoleAdmin, true)
	u2 := mustUser(t, "bob", "bob@example.com", domainuser.RoleUser, false)
	store := &fakeStore{listRes: domainuseradmin.ListResult{Users: []domainuser.User{u1, u2}, Total: 42}}
	svc := newTestService(store)

	dtos, total, err := svc.List(context.Background(), ListFilter{Role: "admin"}, 1, 20)
	if err != nil {
		t.Fatalf("List 返回错误: %v", err)
	}
	if total != 42 {
		t.Errorf("Total = %d, want 42", total)
	}
	if len(dtos) != 2 {
		t.Fatalf("DTO 数量 = %d, want 2", len(dtos))
	}

	// 首个 DTO：admin + 启用
	first := dtos[0]
	if first.ID != u1.GetID().String() {
		t.Errorf("首条 ID = %q, want %s", first.ID, u1.GetID().String())
	}
	if first.Username != "alice" || first.Email != "alice@example.com" {
		t.Errorf("首条 Username/Email = %q/%q", first.Username, first.Email)
	}
	if first.Role != string(domainuser.RoleAdmin) {
		t.Errorf("首条 Role = %q, want admin", first.Role)
	}
	if !first.IsActive {
		t.Error("首条 IsActive = false, want true")
	}

	// 第二个 DTO：user + 禁用
	second := dtos[1]
	if second.Role != string(domainuser.RoleUser) {
		t.Errorf("第二条 Role = %q, want user", second.Role)
	}
	if second.IsActive {
		t.Error("第二条 IsActive = true, want false")
	}

	// 筛选与分页参数透传到 store
	if len(store.listCalls) != 1 {
		t.Fatalf("store.List 调用 %d 次, want 1", len(store.listCalls))
	}
	lc := store.listCalls[0]
	if lc.filter.Role != "admin" {
		t.Errorf("透传 filter.Role = %q, want admin", lc.filter.Role)
	}
	if lc.page != 1 || lc.limit != 20 {
		t.Errorf("透传分页 = (%d,%d), want (1,20)", lc.page, lc.limit)
	}
}

func TestService_List_PropagatesStoreError(t *testing.T) {
	wantErr := errors.New("store unavailable")
	store := &fakeStore{listErr: wantErr}
	svc := newTestService(store)

	if _, _, err := svc.List(context.Background(), ListFilter{}, 1, 10); !errors.Is(err, wantErr) {
		t.Errorf("err = %v, want %v", err, wantErr)
	}
}

func TestService_BatchUpdateStatus_EnableReturnsAffected(t *testing.T) {
	// 启用场景：跳过 FindByIDs 安全校验，直接调 store.BatchUpdateStatus
	id1 := shared.NewID().String()
	id2 := shared.NewID().String()
	store := &fakeStore{affected: 2}
	svc := newTestService(store)

	got, err := svc.BatchUpdateStatus(context.Background(),
		[]string{id1, id2}, true, "op-1", string(domainuser.RoleAdmin), false, "1.1.1.1", "ua")
	if err != nil {
		t.Fatalf("BatchUpdateStatus 返回错误: %v", err)
	}
	if got != 2 {
		t.Errorf("受影响行数 = %d, want 2", got)
	}
	// 启用场景不应触发 FindByIDs
	if len(store.findIDsCalls) != 0 {
		t.Errorf("启用场景不应调 FindByIDs, 实际 %d 次", len(store.findIDsCalls))
	}
	// store.BatchUpdateStatus 被调用且参数透传
	if len(store.batchStatus) != 1 {
		t.Fatalf("store.BatchUpdateStatus 调用 %d 次, want 1", len(store.batchStatus))
	}
	bs := store.batchStatus[0]
	if len(bs.ids) != 2 {
		t.Fatalf("透传 ids 长度 = %d, want 2", len(bs.ids))
	}
	if !bs.isActive {
		t.Error("透传 isActive = false, want true")
	}
}

func TestService_BatchUpdateStatus_RejectsInvalidID(t *testing.T) {
	store := &fakeStore{affected: 99}
	svc := newTestService(store)

	// 非法 ID 应在 parseIDs 阶段被拒，store 不被触碰
	if _, err := svc.BatchUpdateStatus(context.Background(),
		[]string{"not-a-uuid"}, true, "op-1", string(domainuser.RoleAdmin), false, "", ""); err == nil {
		t.Error("非法 ID 应返回错误")
	}
	if len(store.batchStatus) != 0 {
		t.Errorf("非法 ID 不应触发 store, 实际 %d 次", len(store.batchStatus))
	}
}
