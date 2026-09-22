package chat

import (
	"context"
	"sort"
	"strings"
	"testing"
	"time"

	appshared "blog-api/internal/application/shared"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	domainuser "blog-api/internal/domain/user"
)

type fakeBotRepo struct {
	domainchat.BotRepository
	bots            map[domainshared.ID]*domainchat.Bot
	tokenLookupCall int
	writeOrder      *[]string
}

func newFakeBotRepo() *fakeBotRepo {
	return &fakeBotRepo{bots: map[domainshared.ID]*domainchat.Bot{}}
}

func (r *fakeBotRepo) Save(_ context.Context, bot *domainchat.Bot) error {
	r.bots[bot.ID()] = bot
	if r.writeOrder != nil {
		*r.writeOrder = append(*r.writeOrder, "bot")
	}
	return nil
}

func (r *fakeBotRepo) FindByID(_ context.Context, id domainshared.ID) (*domainchat.Bot, error) {
	if bot, ok := r.bots[id]; ok {
		return bot, nil
	}
	return nil, domainchat.ErrBotNotFound
}

func (r *fakeBotRepo) FindByUserID(_ context.Context, userID domainshared.ID) (*domainchat.Bot, error) {
	for _, bot := range r.bots {
		if bot.UserID().Equal(userID) {
			return bot, nil
		}
	}
	return nil, domainchat.ErrBotNotFound
}

func (r *fakeBotRepo) FindByToken(_ context.Context, tokenHash string) (*domainchat.Bot, error) {
	r.tokenLookupCall++
	for _, bot := range r.bots {
		if bot.TokenHash() == tokenHash {
			return bot, nil
		}
	}
	return nil, domainchat.ErrBotNotFound
}

func (r *fakeBotRepo) ListByUserIDs(_ context.Context, userIDs []domainshared.ID) ([]*domainchat.Bot, error) {
	wanted := make(map[domainshared.ID]struct{}, len(userIDs))
	for _, id := range userIDs {
		wanted[id] = struct{}{}
	}
	var out []*domainchat.Bot
	for _, bot := range r.bots {
		if _, ok := wanted[bot.UserID()]; ok {
			out = append(out, bot)
		}
	}
	return out, nil
}

func (r *fakeBotRepo) ListPage(_ context.Context, q domainshared.PageQuery) (domainshared.PageResult[*domainchat.Bot], error) {
	q = q.Normalize()
	all := make([]*domainchat.Bot, 0, len(r.bots))
	for _, bot := range r.bots {
		all = append(all, bot)
	}
	sort.Slice(all, func(i, j int) bool { return all[i].CreatedAt.After(all[j].CreatedAt) })
	total := int64(len(all))
	start := q.Offset()
	if start > len(all) {
		start = len(all)
	}
	end := start + q.Limit
	if end > len(all) {
		end = len(all)
	}
	return domainshared.NewPageResult(q, all[start:end], total), nil
}

func (r *fakeBotRepo) Delete(_ context.Context, id domainshared.ID) error {
	if _, ok := r.bots[id]; !ok {
		return domainchat.ErrBotNotFound
	}
	delete(r.bots, id)
	return nil
}

type fakeUserStore struct {
	domainuser.UserRepository
	users      map[domainshared.ID]*domainuser.User
	taken      map[string]struct{}
	writeOrder *[]string
}

func newFakeUserStore() *fakeUserStore {
	return &fakeUserStore{users: map[domainshared.ID]*domainuser.User{}, taken: map[string]struct{}{}}
}

func (s *fakeUserStore) Save(_ context.Context, user *domainuser.User) error {
	s.users[user.GetID()] = user
	s.taken[user.Username().String()] = struct{}{}
	if s.writeOrder != nil {
		*s.writeOrder = append(*s.writeOrder, "user")
	}
	return nil
}

func (s *fakeUserStore) FindByID(_ context.Context, id domainshared.ID) (*domainuser.User, error) {
	if user, ok := s.users[id]; ok {
		return user, nil
	}
	return nil, domainuser.ErrNotFound
}

func (s *fakeUserStore) FindByIDs(_ context.Context, ids []domainshared.ID) ([]*domainuser.User, error) {
	var out []*domainuser.User
	for _, id := range ids {
		if user, ok := s.users[id]; ok {
			out = append(out, user)
		}
	}
	return out, nil
}

func (s *fakeUserStore) ExistsByUsername(_ context.Context, username domainuser.Username) (bool, error) {
	_, ok := s.taken[username.String()]
	return ok, nil
}

func (s *fakeUserStore) FindByUsername(_ context.Context, username domainuser.Username) (*domainuser.User, error) {
	for _, user := range s.users {
		if user.Username().Equal(username) {
			return user, nil
		}
	}
	return nil, domainuser.ErrNotFound
}

func (s *fakeUserStore) Delete(_ context.Context, id domainshared.ID) error {
	delete(s.users, id)
	return nil
}

// ListContacts 实现 chat.UserRepository 端口；bot 相关用例不触及联系人查询。
func (s *fakeUserStore) ListContacts(context.Context, string, domainshared.ID, string, domainshared.ID, int) ([]*domainuser.User, error) {
	return nil, nil
}

type captureBus struct {
	events []domainshared.DomainEvent
}

func (b *captureBus) Publish(_ context.Context, events []domainshared.DomainEvent) error {
	b.events = append(b.events, events...)
	return nil
}

func (b *captureBus) Subscribe(string, appshared.EventHandler) {}

func (b *captureBus) has(event any) bool {
	for _, published := range b.events {
		switch published.(type) {
		case domainchat.BotCreated, domainchat.BotRenamed, domainchat.BotAvatarUpdated,
			domainchat.BotDeleted, domainchat.BotEnabled, domainchat.BotDisabled,
			domainchat.BotTokenRegenerated, domainchat.BotTokenViewed,
			domainuser.UserRegistered, domainuser.UserStatusChanged:
			if sameEventType(published, event) {
				return true
			}
		}
	}
	return false
}

func sameEventType(got, want any) bool {
	typeName := func(v any) string {
		switch v.(type) {
		case domainchat.BotCreated:
			return "bot.created"
		case domainchat.BotRenamed:
			return "bot.renamed"
		case domainchat.BotAvatarUpdated:
			return "bot.avatar"
		case domainchat.BotDeleted:
			return "bot.deleted"
		case domainchat.BotEnabled:
			return "bot.enabled"
		case domainchat.BotDisabled:
			return "bot.disabled"
		case domainchat.BotTokenRegenerated:
			return "bot.token"
		case domainchat.BotTokenViewed:
			return "bot.token.viewed"
		case domainuser.UserRegistered:
			return "user.registered"
		case domainuser.UserStatusChanged:
			return "user.status"
		}
		return ""
	}
	return typeName(got) == typeName(want)
}

// newBotService 用逐次前进的假钟：每次取时间都往后走一分钟，
// 使「改动后 updated_at 必须前进」这类断言真的可断，而不是恒等于 created_at。
func newBotService(t *testing.T) (*BotService, *fakeBotRepo, *fakeUserStore, *captureBus) {
	t.Helper()
	base := time.Date(2026, 9, 22, 10, 0, 0, 0, time.UTC)
	ticks := 0
	now := func() time.Time {
		ticks++
		return base.Add(time.Duration(ticks) * time.Minute)
	}
	bots := newFakeBotRepo()
	users := newFakeUserStore()
	bus := &captureBus{}
	files := &mockFileRepo{files: map[domainshared.ID]*domainupload.File{}}
	return NewBotService(bots, users, files, bus, now), bots, users, bus
}

func TestCreateBotReturnsPlaintextToken(t *testing.T) {
	svc, bots, users, bus := newBotService(t)
	var order []string
	users.writeOrder = &order
	bots.writeOrder = &order

	dto, err := svc.CreateBot(context.Background(), CreateBotInput{Name: "  Saber  ", Username: "saber_bot"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(dto.Token, "violet_bot_") {
		t.Fatalf("token 未带前缀: %s", dto.Token)
	}
	if dto.Name != "Saber" || dto.Username != "saber_bot" {
		t.Fatalf("dto = %+v", dto)
	}
	// 先建用户再建凭证：chat_bots.user_id 是指向 users 的外键，反序必然违约。
	if strings.Join(order, ",") != "user,bot" || len(bots.bots) != 1 {
		t.Fatalf("虚拟用户与 bot 应按序落库，writeOrder=%v bots=%d", order, len(bots.bots))
	}

	var stored *domainchat.Bot
	for _, bot := range bots.bots {
		stored = bot
	}
	if stored.TokenHash() == dto.Token {
		t.Fatal("库里存的必须是哈希而非明文")
	}
	if _, err := svc.FindByToken(context.Background(), dto.Token); err != nil {
		t.Fatalf("明文 token 必须能鉴权: %v", err)
	}

	user := users.users[stored.UserID()]
	if user == nil {
		t.Fatal("虚拟用户未落库")
	}
	if user.PasswordHash().String() != "" {
		t.Fatal("bot 虚拟用户不得设密码，否则可被密码登录")
	}
	if !strings.HasSuffix(user.Email().String(), "@bot.violet.invalid") {
		t.Fatalf("邮箱应落在保留域: %s", user.Email().String())
	}
	if user.DisplayName().String() != "Saber" {
		t.Fatalf("display_name 应同步 bot 名: %s", user.DisplayName().String())
	}
	if !user.IsActive() || !user.EmailVerified() {
		t.Fatal("虚拟用户需 active 才会出现在联系人搜索，邮箱由系统置为已验证")
	}
	if !bus.has(domainchat.BotCreated{}) || !bus.has(domainuser.UserRegistered{}) {
		t.Fatalf("创建应发 BotCreated + UserRegistered 供审计，实得 %d 条", len(bus.events))
	}
}

func TestCreateBotRejectsBeforeWriting(t *testing.T) {
	ctx := context.Background()
	svc, bots, users, _ := newBotService(t)

	if _, err := svc.CreateBot(ctx, CreateBotInput{Name: "Saber", Username: "taken"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateBot(ctx, CreateBotInput{Name: "Clone", Username: "taken"}); err != domainuser.ErrUsernameExists {
		t.Fatalf("重名应返回 ErrUsernameExists, got %v", err)
	}
	if _, err := svc.CreateBot(ctx, CreateBotInput{Name: "Saber", Username: "中文用户名"}); err == nil {
		t.Fatal("非法用户名必须拒绝")
	}
	if _, err := svc.CreateBot(ctx, CreateBotInput{Name: "   ", Username: "blank-name"}); err == nil {
		t.Fatal("空显示名必须拒绝")
	}
	if len(bots.bots) != 1 || len(users.users) != 1 {
		t.Fatalf("被拒绝的创建不得留下记录: bots=%d users=%d", len(bots.bots), len(users.users))
	}
}

// TestCreateBotReclaimsRevokedBotUsername 吊销后同名重建必须可用。
//
// 吊销只删凭证、留着虚拟用户保历史署名，用户名因此一直占在 users 上；
// 若注册路径见名就判冲突，管理员就再也注册不回这个 bot，只能被迫改名。
func TestCreateBotReclaimsRevokedBotUsername(t *testing.T) {
	ctx := context.Background()
	svc, bots, users, bus := newBotService(t)

	first, err := svc.CreateBot(ctx, CreateBotInput{Name: "Saber", Username: "saber"})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteBot(ctx, domainshared.MustParseID(first.ID)); err != nil {
		t.Fatal(err)
	}

	second, err := svc.CreateBot(ctx, CreateBotInput{Name: "Saber", Username: "saber"})
	if err != nil {
		t.Fatalf("吊销过的同名 bot 应可重新注册: %v", err)
	}
	// 复用同一个虚拟用户：历史消息的 sender_id 仍指向新 bot，署名不断。
	if second.UserID != first.UserID {
		t.Fatalf("应复用吊销前的虚拟用户，got %s want %s", second.UserID, first.UserID)
	}
	if len(users.users) != 1 || len(bots.bots) != 1 {
		t.Fatalf("回收不得多出用户或凭证行: users=%d bots=%d", len(users.users), len(bots.bots))
	}
	reclaimed := users.users[domainshared.MustParseID(second.UserID)]
	if !reclaimed.IsActive() {
		t.Fatal("回收须把虚拟用户重新启用，否则联系人搜索仍搜不到它")
	}
	if second.Token == "" || second.Token == first.Token {
		t.Fatal("重新注册须签发新凭据，旧 token 不能复活")
	}
	if _, err := svc.FindByToken(ctx, second.Token); err != nil {
		t.Fatalf("新 token 必须能鉴权: %v", err)
	}
	if _, err := svc.FindByToken(ctx, first.Token); err == nil {
		t.Fatal("吊销后旧 token 不得仍可鉴权")
	}
	if !bus.has(domainchat.BotCreated{}) || !bus.has(domainuser.UserStatusChanged{}) {
		t.Fatalf("回收应发 BotCreated 与用户重新启用事件供审计，实得 %d 条", len(bus.events))
	}
}

// TestCreateBotRejectsForeignUsername 只有「无凭证的 bot 空壳」能被回收，其余占用一律冲突。
//
// 抢名等于抢署名：被禁用的真用户、还挂着凭证的 bot（哪怕禁用）、以及邮箱
// 蹭上 bot 域名但本地部分对不上 ID 的账号，都不能被注册路径接管。
func TestCreateBotRejectsForeignUsername(t *testing.T) {
	ctx := context.Background()
	svc, _, users, _ := newBotService(t)

	bannedID := domainshared.NewID()
	banned := domainuser.NewUser(bannedID, mustEmail(t, "banned@example.com"), mustUsername(t, "banned"), domainuser.NewPasswordHash("$2y$hash"))
	banned.Deactivate()
	if err := users.Save(ctx, banned); err != nil {
		t.Fatal(err)
	}
	// 邮箱形如 bot 虚拟用户，但本地部分的 ID 不是自己的 ID。
	impostor := domainuser.NewUser(domainshared.NewID(), mustEmail(t, "bot+"+bannedID.String()+"@"+botUserEmailDomain), mustUsername(t, "impostor"), domainuser.NewPasswordHash("$2y$hash"))
	impostor.Deactivate()
	if err := users.Save(ctx, impostor); err != nil {
		t.Fatal(err)
	}
	live, err := svc.CreateBot(ctx, CreateBotInput{Name: "Live", Username: "live_bot"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.UpdateBot(ctx, UpdateBotInput{ID: domainshared.MustParseID(live.ID), Enabled: ptr(false)}); err != nil {
		t.Fatal(err)
	}

	for _, username := range []string{"banned", "impostor", "live_bot"} {
		if _, err := svc.CreateBot(ctx, CreateBotInput{Name: "Takeover", Username: username}); err != domainuser.ErrUsernameExists {
			t.Fatalf("%s 不可回收，应返回 ErrUsernameExists, got %v", username, err)
		}
	}
	if _, err := users.FindByID(ctx, bannedID); err != nil {
		t.Fatalf("被拒绝的注册不得动到既有账号: %v", err)
	}
}

// TestCreateBotReclaimResetsAvatar 回收时未选头像必须清掉上一任的头像。
//
// 注册表单是空的、界面却显示旧图，管理员看到的就不是他刚提交的 bot。
func TestCreateBotReclaimResetsAvatar(t *testing.T) {
	ctx := context.Background()
	svc, _, users, _ := newBotService(t)
	ready, _ := domainupload.NewFile(domainshared.NewID(), domainshared.NewID(), domainupload.PurposeAvatar, "a.png", "/p", "/u/a.png", 10, "image/png", "h")
	svc.files.(*mockFileRepo).files[ready.ID()] = ready

	first, err := svc.CreateBot(ctx, CreateBotInput{Name: "Saber", Username: "saber", AvatarID: ready.ID()})
	if err != nil {
		t.Fatal(err)
	}
	if first.AvatarURL != "/u/a.png" {
		t.Fatalf("前置条件：注册时应带上头像, got %q", first.AvatarURL)
	}
	if err := svc.DeleteBot(ctx, domainshared.MustParseID(first.ID)); err != nil {
		t.Fatal(err)
	}

	second, err := svc.CreateBot(ctx, CreateBotInput{Name: "Saber", Username: "saber"})
	if err != nil {
		t.Fatal(err)
	}
	if second.AvatarID != "" || second.AvatarURL != "" {
		t.Fatalf("重新注册未选头像，须清掉旧头像: %+v", second)
	}
	if users.users[domainshared.MustParseID(second.UserID)].AvatarURL() != "" {
		t.Fatal("虚拟用户的 avatar_url 未同步清空")
	}
}

// mustEmail 测试用邮箱构造，非法即 fail。
func mustEmail(t *testing.T, s string) domainuser.Email {
	t.Helper()
	email, err := domainuser.ParseEmail(s)
	if err != nil {
		t.Fatal(err)
	}
	return email
}

// mustUsername 测试用用户名构造，非法即 fail。
func mustUsername(t *testing.T, s string) domainuser.Username {
	t.Helper()
	username, err := domainuser.ParseUsername(s)
	if err != nil {
		t.Fatal(err)
	}
	return username
}

// ptr 取字面量地址，供 UpdateBotInput 的可选指针字段使用。
func ptr[T any](v T) *T { return &v }

func TestCreateBotValidatesAvatarFile(t *testing.T) {
	ctx := context.Background()
	svc, _, users, _ := newBotService(t)
	owner := domainshared.NewID()

	pending, _ := domainupload.NewFile(domainshared.NewID(), owner, domainupload.PurposeAvatar, "a.png", "/p", "/u/a.png", 10, "image/png", "h")
	notAnImage, _ := domainupload.NewFile(domainshared.NewID(), owner, domainupload.PurposeAvatar, "s.pdf", "/p", "/u/s.pdf", 10, "application/pdf", "h")
	ready, _ := domainupload.NewFile(domainshared.NewID(), owner, domainupload.PurposeAvatar, "b.png", "/p", "/u/b.png", 10, "image/png", "h")
	files := svc.files.(*mockFileRepo)
	files.files[notAnImage.ID()] = notAnImage
	files.files[ready.ID()] = ready

	if _, err := svc.CreateBot(ctx, CreateBotInput{Name: "A", Username: "avatar_none", AvatarID: domainshared.NewID()}); err == nil {
		t.Fatal("不存在的头像文件必须拒绝")
	}
	if _, err := svc.CreateBot(ctx, CreateBotInput{Name: "A", Username: "avatar_pdf", AvatarID: notAnImage.ID()}); err == nil {
		t.Fatal("非图片必须拒绝")
	}
	if _, err := svc.CreateBot(ctx, CreateBotInput{Name: "A", Username: "avatar_pending", AvatarID: pending.ID()}); err == nil {
		t.Fatal("未就绪的头像必须拒绝（pending 状态未入库校验）")
	}
	dto, err := svc.CreateBot(ctx, CreateBotInput{Name: "A", Username: "avatar_ok", AvatarID: ready.ID()})
	if err != nil {
		t.Fatal(err)
	}
	if dto.AvatarID != ready.ID().String() || dto.AvatarURL != "/u/b.png" {
		t.Fatalf("头像应同步到 avatar_url: %+v", dto)
	}
	if users.users[domainshared.MustParseID(dto.UserID)].AvatarURL() != "/u/b.png" {
		t.Fatal("虚拟用户 avatar_url 未同步")
	}
}

func TestBotServiceFindByTokenShortCircuitsBlank(t *testing.T) {
	ctx := context.Background()
	svc, bots, _, _ := newBotService(t)
	for _, blank := range []string{"", "   ", "\t"} {
		if _, err := svc.FindByToken(ctx, blank); err != domainchat.ErrBotNotFound {
			t.Fatalf("空 token 应判不存在: %q -> %v", blank, err)
		}
	}
	if bots.tokenLookupCall != 0 {
		t.Fatalf("空 token 不该打到仓储: %d 次", bots.tokenLookupCall)
	}
}

func TestRegenerateTokenInvalidatesPrevious(t *testing.T) {
	ctx := context.Background()
	svc, _, _, bus := newBotService(t)
	created, err := svc.CreateBot(ctx, CreateBotInput{Name: "Saber", Username: "saber"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.FindByToken(ctx, created.Token); err != nil {
		t.Fatal(err)
	}

	rotated, err := svc.RegenerateToken(ctx, domainshared.MustParseID(created.ID))
	if err != nil {
		t.Fatal(err)
	}
	if rotated.Token == created.Token || rotated.Token == "" {
		t.Fatalf("重置必须产出新明文: %q", rotated.Token)
	}
	if _, err := svc.FindByToken(ctx, created.Token); err != domainchat.ErrBotNotFound {
		t.Fatal("旧 token 必须立即失效")
	}
	if _, err := svc.FindByToken(ctx, rotated.Token); err != nil {
		t.Fatal("新 token 应可用")
	}
	if !bus.has(domainchat.BotTokenRegenerated{}) {
		t.Fatal("token 重置需审计")
	}
}

func TestRevealTokenReturnsCurrentCredentialAndAudits(t *testing.T) {
	ctx := context.Background()
	svc, _, _, bus := newBotService(t)
	created, err := svc.CreateBot(ctx, CreateBotInput{Name: "Saber", Username: "saber"})
	if err != nil {
		t.Fatal(err)
	}
	bus.events = nil

	revealed, err := svc.RevealToken(ctx, domainshared.MustParseID(created.ID))
	if err != nil {
		t.Fatal(err)
	}
	if revealed.Token != created.Token {
		t.Fatalf("查看到的必须是当前生效的那份凭据: %q != %q", revealed.Token, created.Token)
	}
	if _, err := svc.FindByToken(ctx, revealed.Token); err != nil {
		t.Fatal("查看凭据不得轮换它")
	}
	if !bus.has(domainchat.BotTokenViewed{}) {
		t.Fatal("查看凭据需审计")
	}
}

func TestRevealTokenRejectsCredentialWithoutCiphertext(t *testing.T) {
	// 密文列上线前建的 bot（或密钥已换）拿不到明文：必须报错引导重置，
	// 不能返一个空 token 把空串当成可用凭据展示给持有方。
	ctx := context.Background()
	svc, bots, _, bus := newBotService(t)
	created, err := svc.CreateBot(ctx, CreateBotInput{Name: "Saber", Username: "saber"})
	if err != nil {
		t.Fatal(err)
	}
	id := domainshared.MustParseID(created.ID)
	blind := domainchat.ReconstructBot(id, bots.bots[id].UserID(), "Saber", nil,
		bots.bots[id].TokenHash(), "", true, time.Now(), time.Now())
	bots.bots[id] = blind

	if _, err := svc.RevealToken(ctx, id); err == nil {
		t.Fatal("无可查看凭据时应报错")
	}
	if bus.has(domainchat.BotTokenViewed{}) {
		t.Fatal("未成功取出明文就不该记查看事件")
	}
	if _, err := svc.FindByToken(ctx, created.Token); err != nil {
		t.Fatal("拿不到明文不影响旧凭据鉴权")
	}
}

func TestUpdateBotSyncsProfileAndState(t *testing.T) {
	ctx := context.Background()
	svc, bots, users, bus := newBotService(t)
	created, err := svc.CreateBot(ctx, CreateBotInput{Name: "Saber", Username: "saber"})
	if err != nil {
		t.Fatal(err)
	}
	botID := domainshared.MustParseID(created.ID)
	userID := domainshared.MustParseID(created.UserID)
	savesBefore := bots.tokenLookupCall

	newName := "Lancer"
	enabled := false
	cleared := ""
	dto, err := svc.UpdateBot(ctx, UpdateBotInput{ID: botID, Name: &newName, Enabled: &enabled, AvatarID: &cleared})
	if err != nil {
		t.Fatal(err)
	}
	if dto.Name != "Lancer" || dto.Enabled || dto.AvatarID != "" || dto.Token != "" {
		t.Fatalf("dto = %+v", dto)
	}
	if dto.UpdatedAt == dto.CreatedAt {
		t.Fatal("改动后 updated_at 必须前进")
	}
	if users.users[userID].DisplayName().String() != "Lancer" {
		t.Fatal("display_name 未随改名同步")
	}
	if !bus.has(domainchat.BotRenamed{}) || !bus.has(domainchat.BotDisabled{}) {
		t.Fatal("改名与停用都需发事件")
	}

	// 全 nil 入参：不改任何东西，也不写库。
	before := savesBefore
	if _, err := svc.UpdateBot(ctx, UpdateBotInput{ID: botID}); err != nil {
		t.Fatal(err)
	}
	if bots.tokenLookupCall != before {
		t.Fatal("无改动的 PATCH 不应触发写")
	}
}

func TestDeleteBotRevokesCredentialAndHidesUser(t *testing.T) {
	ctx := context.Background()
	svc, bots, users, bus := newBotService(t)
	created, err := svc.CreateBot(ctx, CreateBotInput{Name: "Saber", Username: "saber"})
	if err != nil {
		t.Fatal(err)
	}
	botID := domainshared.MustParseID(created.ID)
	userID := domainshared.MustParseID(created.UserID)

	if err := svc.DeleteBot(ctx, botID); err != nil {
		t.Fatal(err)
	}
	if _, ok := bots.bots[botID]; ok {
		t.Fatal("凭证未吊销")
	}
	user := users.users[userID]
	if user == nil {
		t.Fatal("虚拟用户必须保留：删用户会级联删掉它发过的消息")
	}
	if user.IsActive() {
		t.Fatal("虚拟用户应停用，从联系人搜索里消失")
	}
	if !bus.has(domainuser.UserStatusChanged{}) || !bus.has(domainchat.BotDeleted{}) {
		t.Fatal("吊销凭证与停用虚拟用户都需审计")
	}
	if err := svc.DeleteBot(ctx, botID); err != domainchat.ErrBotNotFound {
		t.Fatalf("重复删除应返回 ErrBotNotFound, got %v", err)
	}
}

func TestListBotsSkipsBotsWithoutUser(t *testing.T) {
	ctx := context.Background()
	svc, _, users, _ := newBotService(t)
	first, err := svc.CreateBot(ctx, CreateBotInput{Name: "One", Username: "one"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateBot(ctx, CreateBotInput{Name: "Two", Username: "two"}); err != nil {
		t.Fatal(err)
	}
	orphanID := domainshared.MustParseID(first.UserID)
	delete(users.users, orphanID)

	page, err := svc.ListBots(ctx, domainshared.PageQuery{Page: 1, Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 2 {
		t.Fatalf("Total 应是仓储口径的总数: %d", page.Total)
	}
	if len(page.Items) != 1 || page.Items[0].Name != "Two" {
		t.Fatalf("缺虚拟用户的 bot 应被跳过: %+v", page.Items)
	}
}
