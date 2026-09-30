package useradmin

import (
	"context"
	"strings"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	infraeventbus "blog-api/internal/infrastructure/eventbus"

	domainsession "blog-api/internal/domain/session"
	"blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

// fakeStore AdminUserStore 的内存 stub，记录调用参数与返回值。
type fakeStore struct {
	listRes       shared.PageResult[domainuser.User]
	listErr       error
	findByIDs     []*domainuser.User
	findErr       error
	findByIDUser  *domainuser.User
	byID          map[string]*domainuser.User
	emailExists    bool
	usernameExists bool
	googleExists   bool
	githubExists   bool
	affected      int64
	batchErr      error

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

}

type listStoreCall struct {
	filter ListFilter
	q      shared.PageQuery
}

func (f *fakeStore) FindPage(_ context.Context, filter ListFilter, q shared.PageQuery) (shared.PageResult[domainuser.User], error) {
	f.listCalls = append(f.listCalls, listStoreCall{filter, q})
	return f.listRes, f.listErr
}

func (f *fakeStore) FindByID(_ context.Context, id shared.ID) (*domainuser.User, error) {
	if f.byID != nil {
		if u, ok := f.byID[id.String()]; ok {
			return u, nil
		}
		return nil, errors.New("not in byID stub")
	}
	if f.findByIDUser != nil {
		return f.findByIDUser, nil
	}
	return nil, errors.New("not implemented in stub")
}

func (f *fakeStore) FindByIDs(_ context.Context, ids []shared.ID) ([]*domainuser.User, error) {
	f.findIDsCalls = append(f.findIDsCalls, ids)
	return f.findByIDs, f.findErr
}

func (f *fakeStore) ExistsByEmail(context.Context, domainuser.Email) (bool, error) {
	return f.emailExists, nil
}

func (f *fakeStore) Save(_ context.Context, u *domainuser.User) error {
	f.saveCalls = append(f.saveCalls, u)
	return nil
}

func (f *fakeStore) ExistsByUsername(context.Context, domainuser.Username) (bool, error) {
	return f.usernameExists, nil
}

func (f *fakeStore) ExistsByGoogleID(context.Context, string) (bool, error) {
	return f.googleExists, nil
}

func (f *fakeStore) ExistsByGithubID(context.Context, string) (bool, error) {
	return f.githubExists, nil
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

// noopHasher 仅满足 NewService 依赖，行为不被断言。
type noopHasher struct{}

func (noopHasher) Hash(_ string) (domainuser.PasswordHash, error) {
	return domainuser.NewPasswordHash("$2a$10$stub"), nil
}

// mustUser 构造一个测试用户聚合（值拷贝供 PageResult 使用）。
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
	return NewService(store, noopHasher{}, infraeventbus.NewInMemory(), nil, nil)
}

func TestService_Create_VerifiesEmailForAdminCreatedUser(t *testing.T) {
	store := &fakeStore{}
	svc := newTestService(store)

	dto, err := svc.Create(context.Background(), CreateInput{
		Username: "managed-user",
		Email:    "managed@example.com",
		Password: "Password123!",
		Role:     string(domainuser.RoleUser),
		IsActive: true,
	}, "root-1", string(domainuser.RoleSuperAdmin), true)
	if err != nil {
		t.Fatalf("Create 返回错误: %v", err)
	}
	if !dto.EmailVerified {
		t.Fatal("后台创建用户的邮箱应直接标记为已验证")
	}
	if len(store.saveCalls) != 1 || !store.saveCalls[0].EmailVerified() {
		t.Fatal("持久化聚合的邮箱应为已验证状态")
	}
}

// fakeSessionStore SessionStore 的测试 stub，仅记录 DeleteByUser 调用。
type fakeSessionStore struct {
	revoked []string
}

func (f *fakeSessionStore) Create(context.Context, *domainsession.Session, time.Duration) error {
	return nil
}
func (f *fakeSessionStore) Get(context.Context, domainsession.ID) (*domainsession.Session, error) {
	return nil, nil
}
func (f *fakeSessionStore) Touch(context.Context, *domainsession.Session, time.Duration) error {
	return nil
}
func (f *fakeSessionStore) DeleteForUser(context.Context, string, domainsession.ID) error {
	return nil
}
func (f *fakeSessionStore) DeleteByUser(_ context.Context, userID string) error {
	f.revoked = append(f.revoked, userID)
	return nil
}

func TestService_UpdateUserRole_RevokesSession(t *testing.T) {
	target := mustUser(t, "u1", "u1@example.com", domainuser.RoleUser, true)
	store := &fakeStore{findByIDUser: &target}
	sessions := &fakeSessionStore{}
	svc := NewService(store, noopHasher{}, infraeventbus.NewInMemory(), sessions, nil)

	err := svc.UpdateUserRole(context.Background(),
		target.GetID().String(), string(domainuser.RoleAdmin),
		"op-1", string(domainuser.RoleAdmin), true, "1.1.1.1", "ua")
	if err != nil {
		t.Fatalf("UpdateUserRole 返回错误: %v", err)
	}
	if len(sessions.revoked) != 1 || sessions.revoked[0] != target.GetID().String() {
		t.Errorf("角色变更后应吊销目标用户 session, 实际 revoked=%v", sessions.revoked)
	}
}

func TestService_Delete_RevokesSession(t *testing.T) {
	target := mustUser(t, "victim", "victim@example.com", domainuser.RoleUser, true)
	store := &fakeStore{findByIDUser: &target}
	sessions := &fakeSessionStore{}
	svc := NewService(store, noopHasher{}, infraeventbus.NewInMemory(), sessions, nil)

	err := svc.Delete(context.Background(),
		target.GetID().String(), "op-1", string(domainuser.RoleAdmin), true, "1.1.1.1", "ua")
	if err != nil {
		t.Fatalf("Delete 返回错误: %v", err)
	}
	if len(sessions.revoked) != 1 || sessions.revoked[0] != target.GetID().String() {
		t.Errorf("删除用户后应吊销其全部 session, 实际 revoked=%v", sessions.revoked)
	}
}

func TestService_Update_Email(t *testing.T) {
	cases := []struct {
		name        string
		input       *string
		emailExists bool
		wantEmail   string
		wantErr     string
	}{
		{name: "变更成功", input: new("new@example.com"), wantEmail: "new@example.com"},
		{name: "邮箱被占用返回冲突", input: new("new@example.com"), emailExists: true, wantErr: "邮箱已被注册", wantEmail: "u1@example.com"},
		{name: "与原值相同不触发变更", input: new("u1@example.com"), wantEmail: "u1@example.com"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			target := mustUser(t, "u1", "u1@example.com", domainuser.RoleUser, true)
			store := &fakeStore{findByIDUser: &target, emailExists: tc.emailExists}
			svc := newTestService(store)

			dto, err := svc.Update(context.Background(), UpdateInput{ID: target.GetID().String(), Email: tc.input},
				"op-1", string(domainuser.RoleAdmin), true)
			if tc.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
					t.Fatalf("期望错误含 %q, 实际 %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("Update 返回错误: %v", err)
			}
			if dto.Email != tc.wantEmail {
				t.Errorf("邮箱 want %s, got %s", tc.wantEmail, dto.Email)
			}
			if len(store.saveCalls) != 1 || store.saveCalls[0].Email().String() != tc.wantEmail {
				t.Errorf("持久化聚合邮箱不匹配: %+v", store.saveCalls)
			}
		})
	}
}

// Delete 为软删编排（置位+吊销凭证），Restore 带身份占用预检。
func TestService_SoftDeleteAndRestore(t *testing.T) {
	t.Run("注销置位并吊销 session", func(t *testing.T) {
		target := mustUser(t, "victim", "victim@example.com", domainuser.RoleUser, true)
		store := &fakeStore{findByIDUser: &target}
		sessions := &fakeSessionStore{}
		svc := NewService(store, noopHasher{}, infraeventbus.NewInMemory(), sessions, nil)

		err := svc.Delete(context.Background(),
			target.GetID().String(), "op-1", string(domainuser.RoleAdmin), true, "1.1.1.1", "ua")
		require.NoError(t, err)
		require.Len(t, store.saveCalls, 1, "软删应经 Save 持久化")
		assert.True(t, store.saveCalls[0].IsDeleted(), "持久化聚合应处于注销态")
		assert.Len(t, sessions.revoked, 1, "注销应吊销全部 session")
	})

	t.Run("恢复成功往返", func(t *testing.T) {
		target := mustUser(t, "victim", "victim@example.com", domainuser.RoleUser, true)
		target.Delete(time.Now())
		store := &fakeStore{findByIDUser: &target}
		svc := NewService(store, noopHasher{}, infraeventbus.NewInMemory(), nil, nil)

		dto, err := svc.Restore(context.Background(),
			target.GetID().String(), "op-1", string(domainuser.RoleAdmin), true, "1.1.1.1", "ua")
		require.NoError(t, err)
		assert.False(t, dto.IsDeleted, "恢复后 DTO 不应为注销态")
		require.Len(t, store.saveCalls, 1)
		assert.False(t, store.saveCalls[0].IsDeleted())
	})

	t.Run("身份被占用恢复返回冲突", func(t *testing.T) {
		target := mustUser(t, "victim", "victim@example.com", domainuser.RoleUser, true)
		target.Delete(time.Now())
		store := &fakeStore{findByIDUser: &target, emailExists: true}
		svc := NewService(store, noopHasher{}, infraeventbus.NewInMemory(), nil, nil)

		_, err := svc.Restore(context.Background(),
			target.GetID().String(), "op-1", string(domainuser.RoleAdmin), true, "1.1.1.1", "ua")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "邮箱")
		assert.Empty(t, store.saveCalls, "冲突时不得落库")
	})

	t.Run("未注销账号恢复返回 400", func(t *testing.T) {
		target := mustUser(t, "alive", "alive@example.com", domainuser.RoleUser, true)
		store := &fakeStore{findByIDUser: &target}
		svc := NewService(store, noopHasher{}, infraeventbus.NewInMemory(), nil, nil)

		_, err := svc.Restore(context.Background(),
			target.GetID().String(), "op-1", string(domainuser.RoleAdmin), true, "1.1.1.1", "ua")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "未处于注销状态")
	})
}

// MergeUsers 守卫：confirm 不匹配 / 相同 ID / root 参与 / merger 未装配。
func TestService_MergeUsers(t *testing.T) {
	primary := mustUser(t, "keepa", "keepa@example.com", domainuser.RoleUser, true)
	secondary := mustUser(t, "dupb", "dupb@example.com", domainuser.RoleUser, true)
	root := mustUser(t, "rootx", "rootx@example.com", domainuser.RoleUser, true)
	root.MarkAsRoot()

	t.Run("confirm 用户名不匹配拒绝", func(t *testing.T) {
		store := &fakeStore{findByIDUser: &primary}
		svc := NewService(store, noopHasher{}, infraeventbus.NewInMemory(), nil, nil)
		svc.SetMerger(&fakeMerger{})
		_, err := svc.MergeUsers(context.Background(), MergeInput{
			PrimaryID: primary.GetID().String(), SecondaryID: secondary.GetID().String(),
			ConfirmUsername: "wrong-name",
		}, "op-1", string(domainuser.RoleAdmin), true, "1.1.1.1", "ua")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "不匹配")
	})

	t.Run("主被合并方相同拒绝", func(t *testing.T) {
		svc := NewService(&fakeStore{}, noopHasher{}, infraeventbus.NewInMemory(), nil, nil)
		_, err := svc.MergeUsers(context.Background(), MergeInput{
			PrimaryID: primary.GetID().String(), SecondaryID: primary.GetID().String(),
			ConfirmUsername: "keepa",
		}, "op-1", string(domainuser.RoleAdmin), true, "1.1.1.1", "ua")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "不能相同")
	})

	t.Run("merger 未装配拒绝", func(t *testing.T) {
		byID := map[string]*domainuser.User{
			primary.GetID().String():   &primary,
			secondary.GetID().String(): &secondary,
		}
		svc := NewService(&fakeStore{byID: byID}, noopHasher{}, infraeventbus.NewInMemory(), nil, nil)
		_, err := svc.MergeUsers(context.Background(), MergeInput{
			PrimaryID: primary.GetID().String(), SecondaryID: secondary.GetID().String(),
			ConfirmUsername: "dupb",
		}, "op-1", string(domainuser.RoleAdmin), true, "1.1.1.1", "ua")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "未装配")
	})

	t.Run("root 参与拒绝", func(t *testing.T) {
		byID := map[string]*domainuser.User{
			root.GetID().String():      &root,
			secondary.GetID().String(): &secondary,
		}
		svc := NewService(&fakeStore{byID: byID}, noopHasher{}, infraeventbus.NewInMemory(), nil, nil)
		svc.SetMerger(&fakeMerger{})
		_, err := svc.MergeUsers(context.Background(), MergeInput{
			PrimaryID: root.GetID().String(), SecondaryID: secondary.GetID().String(),
			ConfirmUsername: "dupb",
		}, "op-1", string(domainuser.RoleAdmin), true, "1.1.1.1", "ua")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "超级管理员")
	})
}

// fakeMerger UserMerger 测试桩。
type fakeMerger struct{}

func (f *fakeMerger) Merge(context.Context, shared.ID, shared.ID) error { return nil }

func TestService_List_MapsToDTOs(t *testing.T) {
	u1 := mustUser(t, "alice", "alice@example.com", domainuser.RoleAdmin, true)
	u2 := mustUser(t, "bob", "bob@example.com", domainuser.RoleUser, false)
	store := &fakeStore{listRes: shared.PageResult[domainuser.User]{
		Items: []domainuser.User{u1, u2}, Total: 42, Page: 1, Limit: 20,
	}}
	svc := newTestService(store)

	result, err := svc.List(context.Background(), ListFilter{Role: "admin"}, shared.PageQuery{Page: 1, Limit: 20})
	if err != nil {
		t.Fatalf("List 返回错误: %v", err)
	}
	if result.Total != 42 {
		t.Errorf("Total = %d, want 42", result.Total)
	}
	if result.Page != 1 || result.Limit != 20 {
		t.Errorf("回显分页 = (%d,%d), want (1,20)", result.Page, result.Limit)
	}
	dtos := result.Items
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
		t.Fatalf("store.FindPage 调用 %d 次, want 1", len(store.listCalls))
	}
	lc := store.listCalls[0]
	if lc.filter.Role != "admin" {
		t.Errorf("透传 filter.Role = %q, want admin", lc.filter.Role)
	}
	if lc.q.Page != 1 || lc.q.Limit != 20 {
		t.Errorf("透传分页 = (%d,%d), want (1,20)", lc.q.Page, lc.q.Limit)
	}
}

func TestService_List_PropagatesStoreError(t *testing.T) {
	wantErr := errors.New("store unavailable")
	store := &fakeStore{listErr: wantErr}
	svc := newTestService(store)

	if _, err := svc.List(context.Background(), ListFilter{}, shared.PageQuery{Page: 1, Limit: 10}); !errors.Is(err, wantErr) {
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
