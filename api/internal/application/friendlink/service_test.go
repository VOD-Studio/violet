package friendlink

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
	domain "blog-api/internal/domain/friendlink"
	"blog-api/internal/domain/shared"
)

// --- 测试替身（inline fakes，镜像 tweet service_test 先例） ---

// fakeRepo 记录调用参数并返回预制数据。
// SQL 排序/部分唯一索引正确性由 gorm 层覆盖，此处只验证 service 的
// 校验链顺序、409 判定与 DTO 映射行为。
type fakeRepo struct {
	approved     []*domain.FriendLink // FindApproved 预制返回
	byStatus     []*domain.FriendLink // FindByStatus 预制返回
	statusTotal  int64
	pendingTotal int64
	byIdentity   int64 // CountPendingByIdentity 预制返回
	urlExists    bool  // ExistsActiveByURL 预制返回
	byID         map[string]*domain.FriendLink
	saved        []*domain.FriendLink
	deleted      []shared.ID

	gotStatus    string
	gotPage      int
	gotLimit     int
	gotQuotaIP   string
	gotQuotaMail string
	gotURL       string
	gotExcludeID shared.ID
	urlChecked   bool // ExistsActiveByURL 是否被调用
}

func (f *fakeRepo) Save(_ context.Context, fl *domain.FriendLink) error {
	f.saved = append(f.saved, fl)
	if f.byID == nil {
		f.byID = map[string]*domain.FriendLink{}
	}
	f.byID[fl.ID().String()] = fl
	return nil
}

func (f *fakeRepo) FindByID(_ context.Context, id shared.ID) (*domain.FriendLink, error) {
	if fl, ok := f.byID[id.String()]; ok {
		return fl, nil
	}
	return nil, domain.ErrNotFound
}

func (f *fakeRepo) FindApproved(context.Context) ([]*domain.FriendLink, error) {
	return f.approved, nil
}

func (f *fakeRepo) FindByStatus(_ context.Context, status string, page, limit int) ([]*domain.FriendLink, int64, error) {
	f.gotStatus, f.gotPage, f.gotLimit = status, page, limit
	return f.byStatus, f.statusTotal, nil
}

func (f *fakeRepo) CountPending(context.Context) (int64, error) {
	return f.pendingTotal, nil
}

func (f *fakeRepo) CountPendingByIdentity(_ context.Context, ipHash, contactEmail string) (int64, error) {
	f.gotQuotaIP, f.gotQuotaMail = ipHash, contactEmail
	return f.byIdentity, nil
}

func (f *fakeRepo) ExistsActiveByURL(_ context.Context, url string, excludeID shared.ID) (bool, error) {
	f.urlChecked = true
	f.gotURL, f.gotExcludeID = url, excludeID
	return f.urlExists, nil
}

func (f *fakeRepo) Delete(_ context.Context, id shared.ID) error {
	f.deleted = append(f.deleted, id)
	delete(f.byID, id.String())
	return nil
}

// fakeCodeStore 记录 Verify/Store 调用参数。
type fakeCodeStore struct {
	verifyOK   bool
	verifyCall bool
	gotPrefix  string
	gotIdent   string
	storeCalls []string // "prefix:identifier"
}

func (f *fakeCodeStore) Store(_ context.Context, prefix, identifier, _ string) error {
	f.storeCalls = append(f.storeCalls, prefix+":"+identifier)
	return nil
}

func (f *fakeCodeStore) Verify(_ context.Context, prefix, identifier, _ string) (bool, error) {
	f.verifyCall = true
	f.gotPrefix, f.gotIdent = prefix, identifier
	return f.verifyOK, nil
}

// fakeEmailSender 记录发出的验证码。
type fakeEmailSender struct {
	sent []string // "email:code"
	err  error
}

func (f *fakeEmailSender) SendVerificationCode(_ context.Context, email, code string) error {
	f.sent = append(f.sent, email+":"+code)
	return f.err
}

// captureBus 捕获发布的事件。
type captureBus struct{ events []shared.DomainEvent }

func (b *captureBus) Publish(_ context.Context, ev []shared.DomainEvent) error {
	b.events = append(b.events, ev...)
	return nil
}
func (b *captureBus) Subscribe(string, appshared.EventHandler) {}

// --- 构造辅助 ---

func newService(repo *fakeRepo, codeStore *fakeCodeStore, sender *fakeEmailSender, bus appshared.EventBus) *Service {
	return NewService(repo, codeStore, sender, bus)
}

func applyInput() ApplyInput {
	return ApplyInput{
		Name:         "Wakaba 的博客",
		URL:          "https://wakaba.example.com",
		Description:  "记录折腾与生活",
		OwnerName:    "Wakaba",
		LinkbackURL:  "https://wakaba.example.com/friends",
		ContactEmail: "alice@x.com",
		Code:         "123456",
		IPHash:       "iphash1",
	}
}

// mustEntity 构造指定状态的实体（transition/Update 测试起点）。
func mustEntity(t *testing.T, status string) *domain.FriendLink {
	t.Helper()
	f, err := domain.NewFriendLink(domain.CreateParams{
		ID: shared.NewID(), Name: "Wakaba 的博客", URL: "https://wakaba.example.com",
		ContactEmail: "alice@x.com", IPHash: "iphash1",
	})
	require.NoError(t, err)
	switch status {
	case domain.StatusPending:
	case domain.StatusApproved:
		require.NoError(t, f.Approve())
	case domain.StatusRejected:
		require.NoError(t, f.Reject())
	case domain.StatusDisabled:
		require.NoError(t, f.Approve())
		require.NoError(t, f.Disable())
	}
	f.PullEvents() // 丢弃前置事件，断言只关心被测操作产生的事件
	require.Equal(t, status, f.Status())
	return f
}

func eventNames(events []shared.DomainEvent) []string {
	names := make([]string, 0, len(events))
	for _, e := range events {
		names = append(names, e.EventName())
	}
	return names
}

// ============================================================
// 公开用例
// ============================================================

// TestListPublic 仅透传 repo 的 approved 列表并映射为公开 DTO；
// 「仅 approved 且 sort_order 排序」由 repo/gorm 层保证，这里验证顺序保留与字段裁剪。
func TestListPublic(t *testing.T) {
	t.Run("映射公开 DTO 且保持 repo 返回顺序", func(t *testing.T) {
		first := mustEntity(t, domain.StatusApproved)
		second := mustEntity(t, domain.StatusApproved)
		repo := &fakeRepo{approved: []*domain.FriendLink{first, second}}
		svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, appshared.NoopEventBus{})

		dtos, err := svc.ListPublic(context.Background())
		require.NoError(t, err)
		require.Len(t, dtos, 2)
		assert.Equal(t, first.ID().String(), dtos[0].ID)
		assert.Equal(t, second.ID().String(), dtos[1].ID)
		assert.Equal(t, "Wakaba 的博客", dtos[0].Name)
		assert.Equal(t, "https://wakaba.example.com", dtos[0].URL)
	})

	t.Run("空列表返回空数组而非 nil（前端空态依赖 [] 序列化）", func(t *testing.T) {
		svc := newService(&fakeRepo{}, &fakeCodeStore{}, &fakeEmailSender{}, appshared.NoopEventBus{})
		dtos, err := svc.ListPublic(context.Background())
		require.NoError(t, err)
		assert.NotNil(t, dtos)
		assert.Empty(t, dtos)
	})
}

// TestApply_LoggedIn_SkipsCode 登录申请：UserID 非空 → 不查 CodeStore，直落库。
func TestApply_LoggedIn_SkipsCode(t *testing.T) {
	repo := &fakeRepo{}
	codeStore := &fakeCodeStore{}
	bus := &captureBus{}
	svc := newService(repo, codeStore, &fakeEmailSender{}, bus)
	uid := shared.NewID()

	in := applyInput()
	in.UserID = uid.String()
	in.Code = "" // 登录态忽略验证码

	dto, err := svc.Apply(context.Background(), in)
	require.NoError(t, err)
	assert.False(t, codeStore.verifyCall, "登录申请不应校验邮箱验证码")
	require.Len(t, repo.saved, 1)
	assert.Equal(t, uid.String(), repo.saved[0].UserID().String())
	assert.Equal(t, domain.StatusPending, repo.saved[0].Status(), "申请初始态 pending")
	assert.Equal(t, dto.ID, repo.saved[0].ID().String())
	assert.Equal(t, []string{"friendlink.created"}, eventNames(bus.events))
}

// TestApply_Anon_ValidCode_Succeeds 匿名申请：验证码通过 + 无配额/占用冲突 → 落库。
// 输入邮箱故意大写，验证 service 在查 CodeStore/配额前做归一化。
func TestApply_Anon_ValidCode_Succeeds(t *testing.T) {
	repo := &fakeRepo{}
	codeStore := &fakeCodeStore{verifyOK: true}
	svc := newService(repo, codeStore, &fakeEmailSender{}, appshared.NoopEventBus{})

	in := applyInput()
	in.ContactEmail = "ALICE@X.COM"

	_, err := svc.Apply(context.Background(), in)
	require.NoError(t, err)
	assert.Equal(t, "friendlink", codeStore.gotPrefix, "验证码场景前缀隔离")
	assert.Equal(t, "alice@x.com", codeStore.gotIdent, "CodeStore 查询用归一化邮箱")
	assert.Equal(t, "iphash1", repo.gotQuotaIP)
	assert.Equal(t, "alice@x.com", repo.gotQuotaMail, "配额查询用归一化邮箱")
	require.Len(t, repo.saved, 1)
	assert.Nil(t, repo.saved[0].UserID(), "匿名申请无 UserID")
}

// TestApply_Anon_InvalidCode 匿名验证码错误（无配额/占用冲突时）→ ErrInvalidCode，不落库。
func TestApply_Anon_InvalidCode(t *testing.T) {
	repo := &fakeRepo{}
	codeStore := &fakeCodeStore{verifyOK: false}
	svc := newService(repo, codeStore, &fakeEmailSender{}, appshared.NoopEventBus{})

	_, err := svc.Apply(context.Background(), applyInput())
	assert.ErrorIs(t, err, ErrInvalidCode)
	assert.Empty(t, repo.saved, "验证码失败不应落库")
	assert.Equal(t, shared.ID{}, repo.gotExcludeID)
	assert.True(t, codeStore.verifyCall, "无冲突时应走到验码")
}

// TestApply_Anon_MissingCode 匿名缺验证码 → ErrInvalidCode（不查 CodeStore）。
func TestApply_Anon_MissingCode(t *testing.T) {
	codeStore := &fakeCodeStore{}
	svc := newService(&fakeRepo{}, codeStore, &fakeEmailSender{}, appshared.NoopEventBus{})

	in := applyInput()
	in.Code = ""
	_, err := svc.Apply(context.Background(), in)
	assert.ErrorIs(t, err, ErrInvalidCode)
	assert.False(t, codeStore.verifyCall, "缺码应在 service 内短路，不查 CodeStore")
}

// TestApply_QuotaExceeded 同 (ip_hash, email) 已有 pending → 409 ErrPendingExists。
// 即使验证码错误也先 409：配额/占用判定在验码前，撞 409 不吞一次性验证码。
func TestApply_QuotaExceeded(t *testing.T) {
	repo := &fakeRepo{byIdentity: 1}
	codeStore := &fakeCodeStore{verifyOK: false}
	svc := newService(repo, codeStore, &fakeEmailSender{}, appshared.NoopEventBus{})

	_, err := svc.Apply(context.Background(), applyInput())
	assert.ErrorIs(t, err, ErrPendingExists)
	assert.Empty(t, repo.saved, "配额超限不应落库")
	assert.False(t, repo.urlChecked, "配额超限不应再查 URL 占用")
	assert.False(t, codeStore.verifyCall, "409 不应消费一次性验证码")
}

// TestApply_URLTaken 站点 URL 被非 rejected 记录占用 → 409 ErrURLTaken（不吞验证码）。
func TestApply_URLTaken(t *testing.T) {
	repo := &fakeRepo{urlExists: true}
	codeStore := &fakeCodeStore{verifyOK: false}
	svc := newService(repo, codeStore, &fakeEmailSender{}, appshared.NoopEventBus{})

	_, err := svc.Apply(context.Background(), applyInput())
	assert.ErrorIs(t, err, ErrURLTaken)
	assert.Equal(t, "https://wakaba.example.com", repo.gotURL)
	assert.Empty(t, repo.saved)
	assert.False(t, codeStore.verifyCall, "409 不应消费一次性验证码")
}

// TestApply_RejectedURLReapply 同 URL 的既有记录为 rejected 时不占位（ExistsActiveByURL
// 返回 false），重新申请放行。部分唯一索引语义由 gorm/迁移保证，这里验证 service
// 信任 repo 的判定结果放行落库。
func TestApply_RejectedURLReapply(t *testing.T) {
	repo := &fakeRepo{urlExists: false}
	svc := newService(repo, &fakeCodeStore{verifyOK: true}, &fakeEmailSender{}, appshared.NoopEventBus{})

	_, err := svc.Apply(context.Background(), applyInput())
	require.NoError(t, err)
	require.Len(t, repo.saved, 1)
	assert.Equal(t, "https://wakaba.example.com", repo.saved[0].URL())
}

// TestSendCode 验证码第一步：生成 → 以 friendlink 场景前缀存 CodeStore → 发邮件。
func TestSendCode(t *testing.T) {
	t.Run("场景前缀 friendlink 且邮箱归一化", func(t *testing.T) {
		codeStore := &fakeCodeStore{}
		sender := &fakeEmailSender{}
		svc := newService(&fakeRepo{}, codeStore, sender, appshared.NoopEventBus{})

		err := svc.SendCode(context.Background(), SendCodeInput{Email: " ALICE@X.COM "})
		require.NoError(t, err)
		require.Equal(t, []string{"friendlink:alice@x.com"}, codeStore.storeCalls)
		require.Len(t, sender.sent, 1)
		assert.Contains(t, sender.sent[0], "alice@x.com:")
	})

	t.Run("邮箱为空拒绝", func(t *testing.T) {
		codeStore := &fakeCodeStore{}
		svc := newService(&fakeRepo{}, codeStore, &fakeEmailSender{}, appshared.NoopEventBus{})
		err := svc.SendCode(context.Background(), SendCodeInput{Email: " "})
		require.Error(t, err)
		assert.Empty(t, codeStore.storeCalls)
	})

	t.Run("发邮件失败不阻塞（devMode 打日志场景）", func(t *testing.T) {
		sender := &fakeEmailSender{err: assert.AnError}
		svc := newService(&fakeRepo{}, &fakeCodeStore{}, sender, appshared.NoopEventBus{})
		assert.NoError(t, svc.SendCode(context.Background(), SendCodeInput{Email: "a@x.com"}))
	})
}

// ============================================================
// 后台管理用例
// ============================================================

func manualInput() ManualInput {
	return ManualInput{
		Name: "rua", URL: "https://rua.plus", Description: "折腾记录",
		OwnerName: "rua", SortOrder: 3,
	}
}

// TestCreateManual 手动添加：直接 approved 落库 + 发布创建事件。
func TestCreateManual(t *testing.T) {
	repo := &fakeRepo{}
	bus := &captureBus{}
	svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, bus)

	dto, err := svc.CreateManual(context.Background(), manualInput())
	require.NoError(t, err)
	require.Len(t, repo.saved, 1)
	assert.Equal(t, domain.StatusApproved, repo.saved[0].Status(), "手动添加直接 approved")
	assert.Equal(t, domain.StatusApproved, dto.Status)
	assert.Equal(t, 3, dto.SortOrder)
	assert.Equal(t, []string{"friendlink.created"}, eventNames(bus.events))
}

// TestCreateManual_URLTaken 手动添加同样受 URL 占用约束。
func TestCreateManual_URLTaken(t *testing.T) {
	repo := &fakeRepo{urlExists: true}
	svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, appshared.NoopEventBus{})

	_, err := svc.CreateManual(context.Background(), manualInput())
	assert.ErrorIs(t, err, ErrURLTaken)
	assert.Empty(t, repo.saved)
}

// TestTransitions_Admin 后台状态转换：加载 → 聚合根转换 → 落库 → 发事件。
func TestTransitions_Admin(t *testing.T) {
	cases := []struct {
		name      string
		from      string
		op        func(*Service, context.Context, string) error
		wantTo    string
		wantEvent string
	}{
		{"pending 批准", domain.StatusPending, (*Service).Approve, domain.StatusApproved, "friendlink.approved"},
		{"pending 拒绝", domain.StatusPending, (*Service).Reject, domain.StatusRejected, "friendlink.rejected"},
		{"approved 下柜", domain.StatusApproved, (*Service).Disable, domain.StatusDisabled, "friendlink.disabled"},
		{"disabled 恢复", domain.StatusDisabled, (*Service).Restore, domain.StatusApproved, "friendlink.restored"},
		{"rejected 改判批准", domain.StatusRejected, (*Service).Approve, domain.StatusApproved, "friendlink.approved"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			entity := mustEntity(t, tc.from)
			repo := &fakeRepo{byID: map[string]*domain.FriendLink{entity.ID().String(): entity}}
			bus := &captureBus{}
			svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, bus)

			require.NoError(t, tc.op(svc, context.Background(), entity.ID().String()))
			assert.Equal(t, tc.wantTo, entity.Status())
			require.Len(t, repo.saved, 1, "转换后应落库")
			assert.Equal(t, []string{tc.wantEvent}, eventNames(bus.events))
		})
	}
}

// TestTransition_Illegal 非法转换：聚合根拒绝，不落库不发事件。
func TestTransition_Illegal(t *testing.T) {
	entity := mustEntity(t, domain.StatusPending)
	repo := &fakeRepo{byID: map[string]*domain.FriendLink{entity.ID().String(): entity}}
	bus := &captureBus{}
	svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, bus)

	require.Error(t, svc.Disable(context.Background(), entity.ID().String()), "pending 不可直接下柜")
	assert.Equal(t, domain.StatusPending, entity.Status())
	assert.Empty(t, repo.saved)
	assert.Empty(t, bus.events)
}

// TestTransition_NotFound 转换不存在的友链 → ErrNotFound。
func TestTransition_NotFound(t *testing.T) {
	svc := newService(&fakeRepo{}, &fakeCodeStore{}, &fakeEmailSender{}, appshared.NoopEventBus{})
	assert.ErrorIs(t, svc.Approve(context.Background(), shared.NewID().String()), domain.ErrNotFound)
}

// TestUpdate 后台编辑：变更落库 + 发布 updated 事件；URL 变更时重做占用检查（排除自身）。
func TestUpdate(t *testing.T) {
	t.Run("字段变更落库并发布 updated 事件", func(t *testing.T) {
		entity := mustEntity(t, domain.StatusApproved)
		repo := &fakeRepo{byID: map[string]*domain.FriendLink{entity.ID().String(): entity}}
		bus := &captureBus{}
		svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, bus)

		in := manualInput()
		in.URL = entity.URL() // URL 不变
		dto, err := svc.Update(context.Background(), entity.ID().String(), in)
		require.NoError(t, err)
		assert.Equal(t, "rua", dto.Name)
		assert.Equal(t, 3, dto.SortOrder)
		assert.False(t, repo.urlChecked, "URL 未变更不应做占用检查")
		assert.Equal(t, []string{"friendlink.updated"}, eventNames(bus.events))
	})

	t.Run("URL 变更时占用检查排除自身", func(t *testing.T) {
		entity := mustEntity(t, domain.StatusApproved)
		repo := &fakeRepo{byID: map[string]*domain.FriendLink{entity.ID().String(): entity}}
		svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, appshared.NoopEventBus{})

		in := manualInput()
		in.URL = "https://new.rua.plus"
		_, err := svc.Update(context.Background(), entity.ID().String(), in)
		require.NoError(t, err)
		assert.True(t, repo.urlChecked)
		assert.Equal(t, entity.ID(), repo.gotExcludeID, "占用检查应排除自身")
	})

	t.Run("URL 变更撞占用拒绝", func(t *testing.T) {
		entity := mustEntity(t, domain.StatusApproved)
		repo := &fakeRepo{
			byID:      map[string]*domain.FriendLink{entity.ID().String(): entity},
			urlExists: true,
		}
		svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, appshared.NoopEventBus{})

		in := manualInput()
		in.URL = "https://taken.example.com"
		_, err := svc.Update(context.Background(), entity.ID().String(), in)
		assert.ErrorIs(t, err, ErrURLTaken)
		assert.Empty(t, repo.saved)
	})
}

// TestDelete 物理删除：任意状态可删，发布 deleted 事件（名称快照）。
func TestDelete(t *testing.T) {
	t.Run("删除成功发布 deleted 事件", func(t *testing.T) {
		entity := mustEntity(t, domain.StatusApproved)
		repo := &fakeRepo{byID: map[string]*domain.FriendLink{entity.ID().String(): entity}}
		bus := &captureBus{}
		svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, bus)

		require.NoError(t, svc.Delete(context.Background(), entity.ID().String()))
		require.Equal(t, []shared.ID{entity.ID()}, repo.deleted)
		require.Equal(t, []string{"friendlink.deleted"}, eventNames(bus.events))
		deleted, ok := bus.events[0].(domain.FriendLinkDeleted)
		require.True(t, ok)
		assert.Equal(t, "Wakaba 的博客", deleted.Name, "删除事件携带名称快照供审计")
	})

	t.Run("不存在返回 ErrNotFound", func(t *testing.T) {
		repo := &fakeRepo{}
		svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, appshared.NoopEventBus{})
		assert.ErrorIs(t, svc.Delete(context.Background(), shared.NewID().String()), domain.ErrNotFound)
		assert.Empty(t, repo.deleted)
	})
}

// TestListByStatus 后台列表：状态筛选与分页透传，非法状态拒绝。
func TestListByStatus(t *testing.T) {
	t.Run("筛选与分页透传并映射 admin DTO", func(t *testing.T) {
		entity := mustEntity(t, domain.StatusPending)
		repo := &fakeRepo{byStatus: []*domain.FriendLink{entity}, statusTotal: 7}
		svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, appshared.NoopEventBus{})

		dtos, total, err := svc.ListByStatus(context.Background(), "pending", 2, 20)
		require.NoError(t, err)
		assert.Equal(t, int64(7), total)
		require.Len(t, dtos, 1)
		assert.Equal(t, "pending", repo.gotStatus)
		assert.Equal(t, 2, repo.gotPage)
		assert.Equal(t, 20, repo.gotLimit)
		// admin DTO 带审核字段（公开 DTO 刻意不含）
		assert.Equal(t, domain.StatusPending, dtos[0].Status)
		assert.Equal(t, "alice@x.com", dtos[0].ContactEmail)
		assert.NotEmpty(t, dtos[0].CreatedAt)
	})

	t.Run("空串状态 = 全部", func(t *testing.T) {
		repo := &fakeRepo{}
		svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, appshared.NoopEventBus{})
		_, _, err := svc.ListByStatus(context.Background(), "", 1, 20)
		require.NoError(t, err)
		assert.Equal(t, "", repo.gotStatus)
	})

	t.Run("非法状态筛选拒绝", func(t *testing.T) {
		svc := newService(&fakeRepo{}, &fakeCodeStore{}, &fakeEmailSender{}, appshared.NoopEventBus{})
		_, _, err := svc.ListByStatus(context.Background(), "deleted", 1, 20)
		require.Error(t, err)
	})
}

// TestCountPending 待审核计数透传（后台菜单角标）。
func TestCountPending(t *testing.T) {
	repo := &fakeRepo{pendingTotal: 5}
	svc := newService(repo, &fakeCodeStore{}, &fakeEmailSender{}, appshared.NoopEventBus{})
	n, err := svc.CountPending(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int64(5), n)
}
