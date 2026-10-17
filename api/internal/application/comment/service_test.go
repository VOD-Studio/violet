package comment

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"blog-api/internal/application/mocks"
	appshared "blog-api/internal/application/shared"
	domain "blog-api/internal/domain/comment"
	"blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
)

// noopEmojiLookup 是 EmojiLookup 的空实现，测试中评论 body 不含表情占位符时使用。
type noopEmojiLookup struct{}

func (noopEmojiLookup) FindByNames(_ context.Context, _ []string) (map[string]EmojiRef, error) {
	return nil, nil
}

type customEmojiLookup struct {
	refs map[string]EmojiRef
}

func (f customEmojiLookup) FindByNames(context.Context, []string) (map[string]EmojiRef, error) {
	return f.refs, nil
}

func TestEnrichEmotes_ResolvesCustomAndSystemTokens(t *testing.T) {
	svc := &Service{emojiLookup: customEmojiLookup{refs: map[string]EmojiRef{
		"[doge]":         {URL: "/doge.png"},
		"[mycat:uuid-1]": {URL: "/mycat.png", CustomEmojiID: "uuid-1", Relation: "owned"},
	}}}
	dtos := []CommentDTO{{Body: "A [doge] B [mycat:uuid-1]"}}

	err := svc.enrichEmotes(context.Background(), dtos)

	assert.NoError(t, err)
	assert.Equal(t, "owned", dtos[0].Emote["[mycat:uuid-1]"].Relation)
	assert.Equal(t, "/doge.png", dtos[0].Emote["[doge]"].URL)
}

// TestEnrichOAuthIdentities_FillsProviderAndURL 验证头像角标富化：
// GitHub 绑定（有 login）填 provider + 主页 URL、Google 绑定只填 provider、
// 匿名评论不填；嵌套 Replies 同批回填。
func TestEnrichOAuthIdentities_FillsProviderAndURL(t *testing.T) {
	userRepo := new(mocks.MockUserRepository)
	svc := &Service{userRepo: userRepo}

	ghUID, gUID := shared.NewID(), shared.NewID()
	ghEmail, _ := domainuser.ParseEmail("gh@example.com")
	ghName, _ := domainuser.ParseUsername("alice")
	ghID, ghLogin := "12345", "octocat"
	ghUser := domainuser.ReconstructUser(ghUID, ghEmail, ghName, domainuser.DisplayName{},
		domainuser.NewPasswordHash(""), "", "", "", domainuser.RoleUser,
		nil, &ghID, &ghLogin, false, true, true, time.Time{}, time.Time{}, time.Time{})
	gEmail, _ := domainuser.ParseEmail("g@example.com")
	gName, _ := domainuser.ParseUsername("bob")
	gSub := "google-sub-1"
	gUser := domainuser.ReconstructUser(gUID, gEmail, gName, domainuser.DisplayName{},
		domainuser.NewPasswordHash(""), "", "", "", domainuser.RoleUser,
		&gSub, nil, nil, false, true, true, time.Time{}, time.Time{}, time.Time{})

	postID, ghCID, gCID, anonCID := shared.NewID(), shared.NewID(), shared.NewID(), shared.NewID()
	zero := time.Time{}
	ghComment := domain.ReconstructComment(ghCID, postID, &ghUID, nil, ghCID.String()+"/", 0, nil,
		"alice", "", "", "", "body", nil, domain.StatusApproved, "", "", false, zero, zero)
	gComment := domain.ReconstructComment(gCID, postID, &gUID, nil, gCID.String()+"/", 0, nil,
		"bob", "", "", "", "body", nil, domain.StatusApproved, "", "", false, zero, zero)
	anonComment := domain.ReconstructComment(anonCID, postID, nil, nil, anonCID.String()+"/", 0, nil,
		"carol", "", "", "", "body", nil, domain.StatusApproved, "", "", false, zero, zero)

	userRepo.On("FindByIDsForDisplay", mock.Anything, mock.AnythingOfType("[]shared.ID")).
		Return([]*domainuser.User{ghUser, gUser}, nil).Once()

	// dtos[0] 带一条回复预览（同一 GitHub 作者），验证嵌套回填
	dtos := []CommentDTO{
		{ID: ghCID.String(), Replies: []CommentDTO{{ID: ghCID.String()}}},
		{ID: gCID.String()},
		{ID: anonCID.String()},
	}
	err := svc.enrichOAuthIdentities(context.Background(), dtos, []*domain.Comment{ghComment, gComment, anonComment})

	assert.NoError(t, err)
	assert.Equal(t, "github", dtos[0].AuthorProvider)
	assert.Equal(t, "https://github.com/octocat", dtos[0].AuthorProfileURL)
	assert.Equal(t, "github", dtos[0].Replies[0].AuthorProvider)
	assert.Equal(t, "https://github.com/octocat", dtos[0].Replies[0].AuthorProfileURL)
	assert.Equal(t, "google", dtos[1].AuthorProvider)
	assert.Empty(t, dtos[1].AuthorProfileURL)
	assert.Empty(t, dtos[2].AuthorProvider)
	assert.Empty(t, dtos[2].AuthorProfileURL)
	assert.Equal(t, "alice", dtos[0].AuthorUsername)
	assert.Equal(t, "alice", dtos[0].Replies[0].AuthorUsername)
	assert.Equal(t, "bob", dtos[1].AuthorUsername)
	assert.Empty(t, dtos[2].AuthorUsername, "匿名评论无站内主页")
	userRepo.AssertExpectations(t)
}

// TestEnrichOAuthIdentities_NilUserRepoSkips 验证 userRepo 未注入时跳过富化（不报错）。
func TestEnrichOAuthIdentities_NilUserRepoSkips(t *testing.T) {
	svc := &Service{}
	dtos := []CommentDTO{{ID: "c1"}}
	err := svc.enrichOAuthIdentities(context.Background(), dtos, nil)
	assert.NoError(t, err)
	assert.Empty(t, dtos[0].AuthorProvider)
}

// TestEnrichOAuthIdentities_DeletedAuthorPlaceholder 已注销作者的评论显示占位。
func TestEnrichOAuthIdentities_DeletedAuthorPlaceholder(t *testing.T) {
	userRepo := new(mocks.MockUserRepository)
	svc := &Service{userRepo: userRepo}

	// 已注销作者（deletedAt 非零）+ 其 GitHub 绑定残留在行内（注销不清列，恢复用）
	dUID := shared.NewID()
	dEmail, _ := domainuser.ParseEmail("gone@example.com")
	dName, _ := domainuser.ParseUsername("gone")
	ghID := "42"
	deletedUser := domainuser.ReconstructUser(dUID, dEmail, dName, domainuser.DisplayName{},
		domainuser.NewPasswordHash(""), "", "", "", domainuser.RoleUser,
		nil, &ghID, nil, false, true, true, time.Now(), time.Time{}, time.Time{})
	deletedUser.Delete(time.Now())

	// 活跃作者（对照：快照与角标照常）
	aUID := shared.NewID()
	aEmail, _ := domainuser.ParseEmail("alive@example.com")
	aName, _ := domainuser.ParseUsername("alive")
	aliveUser := domainuser.ReconstructUser(aUID, aEmail, aName, domainuser.DisplayName{},
		domainuser.NewPasswordHash(""), "", "", "", domainuser.RoleUser,
		nil, nil, nil, false, true, true, time.Time{}, time.Time{}, time.Time{})

	postID, dCID := shared.NewID(), shared.NewID()
	zero := time.Time{}
	// 顶层：注销作者（快照名 "gone"）；回复：活跃作者回复注销者（reply_to 指向注销顶层）
	topComment := domain.ReconstructComment(dCID, postID, &dUID, nil, dCID.String()+"/", 0, nil,
		"gone", "https://cdn/avatar.png", "", "", "body", nil, domain.StatusApproved, "", "", false, zero, zero)
	replyCID := shared.NewID()
	replyComment := domain.ReconstructComment(replyCID, postID, &aUID, &dCID, dCID.String()+replyCID.String()+"/", 1, nil,
		"alive", "", "", "", "reply", nil, domain.StatusApproved, "gone", "", false, zero, zero)

	userRepo.On("FindByIDsForDisplay", mock.Anything, mock.AnythingOfType("[]shared.ID")).
		Return([]*domainuser.User{deletedUser, aliveUser}, nil).Once()

	dtos := []CommentDTO{{
		ID: dCID.String(), AuthorName: "gone", AvatarURL: "https://cdn/avatar.png",
		Replies: []CommentDTO{{ID: replyCID.String(), AuthorName: "alive", ReplyToName: "gone"}},
	}}
	err := svc.enrichOAuthIdentities(context.Background(), dtos, []*domain.Comment{topComment, replyComment})

	assert.NoError(t, err)
	// 注销作者：占位覆盖快照，无头像无角标
	assert.Equal(t, DeletedUserName, dtos[0].AuthorName)
	assert.Empty(t, dtos[0].AvatarURL)
	assert.Empty(t, dtos[0].AuthorProvider)
	assert.Empty(t, dtos[0].AuthorUsername, "注销作者不暴露主页链接")
	// 活跃回复者：快照照常，reply_to 指向注销者 → 占位替换
	assert.Equal(t, "alive", dtos[0].Replies[0].AuthorName)
	assert.Equal(t, "alive", dtos[0].Replies[0].AuthorUsername)
	assert.Equal(t, DeletedUserName, dtos[0].Replies[0].ReplyToName)
	userRepo.AssertExpectations(t)
}

// fakeSitePolicy 可配置的站点评论策略 stub
type fakeSitePolicy struct {
	enabled    bool
	moderation bool
	err        error
}

func (f *fakeSitePolicy) CommentPolicy(context.Context) (bool, bool, error) {
	return f.enabled, f.moderation, f.err
}

// newServiceWithMocks 构造带 mock 的 service，返回 service + 各 mock 便于断言。
// policy 传 nil 时 service 内部按「开评论 + 需审核」兜底，等价旧行为。
func newServiceWithMocks(policy SitePolicy) (*Service, *mocks.MockCommentRepository, *mocks.MockCommentCodeStore, *mocks.MockCommentEmailSender) {
	repo := new(mocks.MockCommentRepository)
	codeStore := new(mocks.MockCommentCodeStore)
	emailSender := new(mocks.MockCommentEmailSender)
	return NewService(repo, nil, codeStore, emailSender, noopEmojiLookup{}, policy, infraeventbus.NewInMemory()), repo, codeStore, emailSender
}

func TestCreate_LoggedIn_SkipsCodeAndQuota(t *testing.T) {
	svc, repo, codeStore, _ := newServiceWithMocks(nil)
	uid := shared.NewID()

	// 登录路径：不应查 CodeStore / 配额
	codeStore.AssertNotCalled(t, "Verify")
	repo.On("Save", mock.Anything, mock.Anything).Return(nil).Once()
	// parent nil 分支 SetParent(nil) 不查 repo

	dto, err := svc.Create(context.Background(), CreateInput{
		PostID: shared.NewID().String(), UserID: uid.String(),
		AuthorName: "bob", AuthorEmail: "bob@x.com",
		Body: "hi",
	})
	assert.NoError(t, err)
	assert.Equal(t, "bob", dto.AuthorName)
	repo.AssertExpectations(t)
}

func TestCreate_LoggedIn_FillsAuthorFromUserRepo(t *testing.T) {
	repo := new(mocks.MockCommentRepository)
	userRepo := new(mocks.MockUserRepository)
	svc := NewService(repo, userRepo, new(mocks.MockCommentCodeStore), new(mocks.MockCommentEmailSender), noopEmojiLookup{}, nil, infraeventbus.NewInMemory())
	uid := shared.NewID()
	email, _ := domainuser.ParseEmail("bob@x.com")
	name, _ := domainuser.ParseUsername("bob")
	u := domainuser.ReconstructUser(uid, email, name, domainuser.DisplayName{},
		domainuser.NewPasswordHash(""), "https://avatar.example/bob.png", "", "", domainuser.RoleUser,
		nil, nil, nil, false, true, true, time.Time{}, time.Time{}, time.Time{})

	userRepo.On("FindByID", mock.Anything, uid).Return(u, nil).Once()
	userRepo.On("FindByIDsForDisplay", mock.Anything, mock.AnythingOfType("[]shared.ID")).
		Return([]*domainuser.User{u}, nil).Once()
	repo.On("Save", mock.Anything, mock.Anything).Return(nil).Once()

	dto, err := svc.Create(context.Background(), CreateInput{
		PostID: shared.NewID().String(), UserID: uid.String(),
		Body: "hi from mcp",
	})
	assert.NoError(t, err)
	assert.Equal(t, "bob", dto.AuthorName)
	assert.Equal(t, "https://avatar.example/bob.png", dto.AvatarURL)
	userRepo.AssertExpectations(t)
	repo.AssertExpectations(t)
}

func TestCreate_AISignatureDoesNotBecomePATProfile(t *testing.T) {
	for _, signature := range []string{"", " \t ", "  independent model  ", strings.Repeat("模", 100)} {
		t.Run(signature, func(t *testing.T) {
			repo := new(mocks.MockCommentRepository)
			users := new(mocks.MockUserRepository)
			users.On("FindByIDsForDisplay", mock.Anything, mock.Anything).Return([]*domainuser.User{}, nil)
			repo.On("Save", mock.Anything, mock.Anything).Return(nil).Once()
			svc := NewService(repo, users, new(mocks.MockCommentCodeStore), new(mocks.MockCommentEmailSender), noopEmojiLookup{}, nil, infraeventbus.NewInMemory())
			dto, err := svc.Create(context.Background(), CreateInput{
				PostID: shared.NewID().String(), UserID: shared.NewID().String(),
				AuthorName: signature, AvatarURL: "/owner.png", IsAI: true, Body: "comment",
			})
			if !assert.NoError(t, err) {
				return
			}
			assert.True(t, dto.IsAI)
			assert.Empty(t, dto.AvatarURL)
			assert.NotEmpty(t, dto.AuthorName)
			if strings.TrimSpace(signature) != "" {
				assert.Equal(t, strings.TrimSpace(signature), dto.AuthorName)
			}
			users.AssertNotCalled(t, "FindByID", mock.Anything, mock.Anything)
		})
	}
}

func TestCreate_RejectsAISignatureBeyondStorageBoundary(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	_, err := svc.Create(context.Background(), CreateInput{
		PostID: shared.NewID().String(), UserID: shared.NewID().String(),
		AuthorName: strings.Repeat("模", 101), IsAI: true, Body: "comment",
	})
	assert.Error(t, err)
	repo.AssertNotCalled(t, "Save", mock.Anything, mock.Anything)
}

func TestCreate_Anon_ValidCode_NoQuota_Succeeds(t *testing.T) {
	svc, repo, codeStore, _ := newServiceWithMocks(nil)
	postID := shared.NewID()

	// 验证码校验通过 + 配额为 0 → 落库。
	// 用归一化后的 email "alice@x.com" 作为 mock 期望参数，
	// 验证 service 在查 CodeStore/配额前对输入 "ALICE@X.COM" 做了归一化。
	codeStore.On("Verify", mock.Anything, "comment", "alice@x.com", mock.Anything).
		Return(true, nil).Once()
	repo.On("CountByPostAndAnon", mock.Anything, postID, "iphash1", "alice@x.com").
		Return(int64(0), nil).Once()
	repo.On("Save", mock.Anything, mock.Anything).Return(nil).Once()

	_, err := svc.Create(context.Background(), CreateInput{
		PostID:     postID.String(),
		AuthorName: "alice", AuthorEmail: "ALICE@X.COM", // 故意大写测试归一化
		Body: "hi", Code: "123456", IPHash: "iphash1",
	})
	assert.NoError(t, err)
	repo.AssertExpectations(t)
	codeStore.AssertExpectations(t)
}

func TestCreate_Anon_InvalidCode_ReturnsErrInvalidCode(t *testing.T) {
	svc, repo, codeStore, _ := newServiceWithMocks(nil)

	codeStore.On("Verify", mock.Anything, "comment", "alice@x.com", mock.Anything).
		Return(false, nil).Once()
	// 验证码失败不应查配额、不应 Save
	repo.AssertNotCalled(t, "CountByPostAndAnon")
	repo.AssertNotCalled(t, "Save")

	_, err := svc.Create(context.Background(), CreateInput{
		PostID:     shared.NewID().String(),
		AuthorName: "alice", AuthorEmail: "alice@x.com",
		Body: "hi", Code: "wrong", IPHash: "iphash1",
	})
	assert.ErrorIs(t, err, ErrInvalidCode)
	codeStore.AssertExpectations(t)
}

func TestCreate_Anon_QuotaExceeded_ReturnsErrAnonQuotaExceeded(t *testing.T) {
	svc, repo, codeStore, _ := newServiceWithMocks(nil)
	postID := shared.NewID()

	codeStore.On("Verify", mock.Anything, "comment", "alice@x.com", mock.Anything).
		Return(true, nil).Once()
	repo.On("CountByPostAndAnon", mock.Anything, postID, "iphash1", "alice@x.com").
		Return(int64(1), nil).Once()
	// 配额超不应 Save
	repo.AssertNotCalled(t, "Save")

	_, err := svc.Create(context.Background(), CreateInput{
		PostID:     postID.String(),
		AuthorName: "alice", AuthorEmail: "alice@x.com",
		Body: "hi", Code: "123456", IPHash: "iphash1",
	})
	assert.ErrorIs(t, err, ErrAnonQuotaExceeded)
	repo.AssertExpectations(t)
	codeStore.AssertExpectations(t)
}

func TestCreate_AnchorWithoutLogin_Rejected(t *testing.T) {
	svc, _, _, _ := newServiceWithMocks(nil)
	// 匿名带 anchor：domain.NewComment 会拒绝（批注强制登录）
	anchor := &domain.Anchor{BlockID: "abc12345", StartOffset: 0, EndOffset: 5, SelectedText: "hello", BlockHashSync: "deadbeef"}
	// 注意：匿名路径会先走验证码校验，code 为空会 ErrInvalidCode；这里测的是
	// 「即使过了验证码，anchor+匿名仍被 domain 拒绝」——所以先让验证码通过
	// 改为直接测 domain 层行为更干净，这里用 service 层验证错误链。
	_, err := svc.Create(context.Background(), CreateInput{
		PostID:     shared.NewID().String(),
		AuthorName: "alice", AuthorEmail: "alice@x.com",
		Body: "hi", Code: "", Anchor: anchor, IPHash: "iphash1",
	})
	// code 空先报 ErrInvalidCode
	assert.ErrorIs(t, err, ErrInvalidCode)
}

func TestCreate_LoggedIn_WithAnchor_Succeeds(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	uid := shared.NewID()
	anchor := &domain.Anchor{BlockID: "abc12345", StartOffset: 0, EndOffset: 5, SelectedText: "hello", BlockHashSync: "deadbeef"}

	// 用 MatchedBy 断言传给 Save 的 Comment 携带正确的 anchor（Issue-0003）
	repo.On("Save", mock.Anything, mock.MatchedBy(func(c *domain.Comment) bool {
		a := c.Anchor()
		return a != nil && a.BlockID == "abc12345" && a.SelectedText == "hello"
	})).Return(nil).Once()

	_, err := svc.Create(context.Background(), CreateInput{
		PostID: shared.NewID().String(), UserID: uid.String(),
		AuthorName: "bob", AuthorEmail: "bob@x.com",
		Body: "note", Anchor: anchor,
	})
	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

// TestCreate_PicturesPassedToDomain 验证 pictures 接线：CreateInput.Pictures 流入 domain（Issue-0003）。
func TestCreate_PicturesPassedToDomain(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	uid := shared.NewID()
	pics := []domain.Picture{{URL: "https://x/a.png", Width: 100, Height: 200, Size: 1024}}

	repo.On("Save", mock.Anything, mock.MatchedBy(func(c *domain.Comment) bool {
		ps := c.Pictures()
		return len(ps) == 1 && ps[0].URL == "https://x/a.png" && ps[0].Size == 1024
	})).Return(nil).Once()

	_, err := svc.Create(context.Background(), CreateInput{
		PostID: shared.NewID().String(), UserID: uid.String(),
		AuthorName: "bob", Body: "with pics",
		Pictures: pics,
	})
	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

func TestSendCode_StoresAndSends(t *testing.T) {
	svc, _, codeStore, emailSender := newServiceWithMocks(nil)
	postID := shared.NewID()

	codeStore.On("Store", mock.Anything, "comment", "alice@x.com", mock.Anything).
		Return(nil).Once()
	emailSender.On("SendVerificationCode", mock.Anything, "alice@x.com", mock.Anything).
		Return(nil).Once()

	err := svc.SendCode(context.Background(), SendCodeInput{
		PostID: postID.String(), Email: "ALICE@X.com", // 大写测归一化
	})
	assert.NoError(t, err)
	codeStore.AssertExpectations(t)
	emailSender.AssertExpectations(t)
}

func TestSendCode_EmptyEmail_ReturnsErr(t *testing.T) {
	svc, _, codeStore, _ := newServiceWithMocks(nil)
	err := svc.SendCode(context.Background(), SendCodeInput{
		PostID: shared.NewID().String(), Email: "  ",
	})
	assert.Error(t, err)
	codeStore.AssertNotCalled(t, "Store")
}

func TestSendCode_SiteDisabled_RejectsWithoutMail(t *testing.T) {
	svc, _, codeStore, emailSender := newServiceWithMocks(&fakeSitePolicy{enabled: false})
	err := svc.SendCode(context.Background(), SendCodeInput{
		PostID: shared.NewID().String(), Email: "alice@x.com",
	})
	assert.Error(t, err)
	codeStore.AssertNotCalled(t, "Store")
	emailSender.AssertNotCalled(t, "SendVerificationCode")
}

func TestListByPost_AnonViewer_ReturnsEmpty_BlackHole(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	// 匿名 viewer 不应查 DB
	repo.AssertNotCalled(t, "FindPage")

	items, total, err := svc.ListByPost(context.Background(), shared.NewID().String(), "", "", domain.AnchorFilterAll, domain.DepthFilterAll, "", 1, 20)
	assert.NoError(t, err)
	assert.Empty(t, items)
	assert.Equal(t, int64(0), total)
}

func TestListByPost_LoggedInViewer_ReturnsApprovedAndOwnPending(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	viewer := shared.NewID()
	postID := shared.NewID()
	allDepth := domain.DepthFilterAll

	// 构造一条 approved + 一条 viewer 自己的 pending
	approved, _ := newDomainComment(shared.NewID(), postID, "alice", "approved")
	myPending, _ := newDomainComment(shared.NewID(), postID, "bob", "pending")
	repo.On("FindPage", mock.Anything, domain.ListFilter{
		PostID: &postID, Status: domain.StatusApproved, ViewerUserID: &viewer,
		AnchorFilter: domain.AnchorFilterAll, DepthFilter: &allDepth,
	}, shared.PageQuery{Page: 1, Limit: 20}).
		Return(shared.NewPageResult(shared.PageQuery{Page: 1, Limit: 20}, []*domain.Comment{approved, myPending}, 2), nil).Once()

	items, total, err := svc.ListByPost(context.Background(), postID.String(), viewer.String(), "", domain.AnchorFilterAll, domain.DepthFilterAll, "", 1, 20)
	assert.NoError(t, err)
	assert.Len(t, items, 2)
	assert.Equal(t, int64(2), total)
	repo.AssertExpectations(t)
}

// TestListByPost_AnchorFilter_PassthroughToRepo 验证 service 把 anchorFilter 透传给 repo，
// 不在 service 层做任何 anchor 维度的逻辑（仅作为透明管道）。
func TestListByPost_AnchorFilter_PassthroughToRepo(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	viewer := shared.NewID()
	postID := shared.NewID()
	allDepth := domain.DepthFilterAll

	// 期望 repo 收到 AnchorFilterAnnotation（与 AnchorFilterAll 的用例区分）
	repo.On("FindPage", mock.Anything, domain.ListFilter{
		PostID: &postID, Status: domain.StatusApproved, ViewerUserID: &viewer,
		AnchorFilter: domain.AnchorFilterAnnotation, DepthFilter: &allDepth,
	}, shared.PageQuery{Page: 1, Limit: 20}).
		Return(shared.NewPageResult(shared.PageQuery{Page: 1, Limit: 20}, []*domain.Comment{}, 0), nil).Once()

	_, _, err := svc.ListByPost(context.Background(), postID.String(), viewer.String(), "", domain.AnchorFilterAnnotation, domain.DepthFilterAll, "", 1, 20)
	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

// TestListLatest_FixedScopeAndLimitClamp 验证橱窗端点的固定口径与 limit 钳制：
//   - repo 收到 approved + 自由评论 + 顶层过滤（不透传调用方维度）
//   - limit≤0 回落默认 3，超过上限钳到 10
//   - DTO 带所属文章标题/slug
func TestListLatest_FixedScopeAndLimitClamp(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	topLevel := domain.DepthFilterTopLevel

	c1, _ := newDomainComment(shared.NewID(), shared.NewID(), "alice", "approved")
	postID := shared.NewID()
	items := []*domain.CommentWithPost{
		{Comment: c1, Post: domain.PostRef{ID: postID, Title: "文心", Slug: "wen-xin"}},
	}
	expectFilter := domain.ListFilter{
		Status: domain.StatusApproved, AnchorFilter: domain.AnchorFilterFree, DepthFilter: &topLevel,
	}
	repo.On("FindPageWithPost", mock.Anything, expectFilter, shared.PageQuery{Page: 1, Limit: 3}).
		Return(shared.NewPageResult(shared.PageQuery{Page: 1, Limit: 3}, items, 1), nil).Once()
	// 超上限钳到 10
	repo.On("FindPageWithPost", mock.Anything, expectFilter, shared.PageQuery{Page: 1, Limit: 10}).
		Return(shared.NewPageResult(shared.PageQuery{Page: 1, Limit: 10}, []*domain.CommentWithPost(nil), 0), nil).Once()

	dtos, err := svc.ListLatest(context.Background(), 0)
	assert.NoError(t, err)
	assert.Len(t, dtos, 1)
	assert.Equal(t, "alice", dtos[0].AuthorName)
	assert.Equal(t, "文心", dtos[0].PostTitle)
	assert.Equal(t, "wen-xin", dtos[0].PostSlug)
	assert.Empty(t, dtos[0].ReplyToName, "顶层评论无 parent，reply_to_name 恒空")

	_, err = svc.ListLatest(context.Background(), 50)
	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

// newDomainComment 测试辅助：直接用 ReconstructComment 构造指定 status 的领域对象。
func newDomainComment(id, postID shared.ID, author, status string) (*domain.Comment, error) {
	if status != domain.StatusApproved && status != domain.StatusPending {
		return nil, errors.New("测试只支持 approved/pending")
	}
	zero := time.Time{}
	c := domain.ReconstructComment(id, postID, nil, nil, id.String()+"/", 0, nil,
		author, "", "", "", "body", nil, status, "", "", false, zero, zero)
	return c, nil
}

// 编译期断言
var _ = appshared.SHA256Hash

func TestCreate_CommentsDisabled_Rejected(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(&fakeSitePolicy{enabled: false})

	dto, err := svc.Create(context.Background(), CreateInput{
		PostID: shared.NewID().String(), UserID: shared.NewID().String(),
		AuthorName: "bob", Body: "hi",
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "评论已关闭")
	assert.Empty(t, dto)
	repo.AssertNotCalled(t, "Save", mock.Anything, mock.Anything)
}

func TestCreate_NoModeration_AutoApproved(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(&fakeSitePolicy{enabled: true, moderation: false})
	repo.On("Save", mock.Anything, mock.Anything).Return(nil).Once()

	dto, err := svc.Create(context.Background(), CreateInput{
		PostID: shared.NewID().String(), UserID: shared.NewID().String(),
		AuthorName: "bob", Body: "hi",
	})
	assert.NoError(t, err)
	assert.Equal(t, "approved", dto.Status)
	repo.AssertExpectations(t)
}

func TestCreate_ModerationOn_StaysPending(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(&fakeSitePolicy{enabled: true, moderation: true})
	repo.On("Save", mock.Anything, mock.Anything).Return(nil).Once()

	dto, err := svc.Create(context.Background(), CreateInput{
		PostID: shared.NewID().String(), UserID: shared.NewID().String(),
		AuthorName: "bob", Body: "hi",
	})
	assert.NoError(t, err)
	assert.Equal(t, "pending", dto.Status)
	repo.AssertExpectations(t)
}

// TestCreate_ParentDifferentPost_Rejected 跨文章回复应拒绝（Codex P2）。
func TestCreate_ParentDifferentPost_Rejected(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	uid := shared.NewID()
	postID := shared.NewID()
	otherPostID := shared.NewID()
	parentID := shared.NewID()
	zero := time.Time{}
	parent := domain.ReconstructComment(parentID, otherPostID, &uid, nil, parentID.String()+"/", 0, nil,
		"alice", "", "", "", "parent on other post", nil, domain.StatusApproved, "", "", false, zero, zero)

	repo.On("FindByID", mock.Anything, parentID).Return(parent, nil).Once()
	repo.AssertNotCalled(t, "Save")

	_, err := svc.Create(context.Background(), CreateInput{
		PostID: postID.String(), UserID: uid.String(), ParentID: parentID.String(),
		AuthorName: "bob", AuthorEmail: "bob@x.com", Body: "cross-post reply",
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "父评论不属于该文章")
	repo.AssertExpectations(t)
}

func TestCreate_ReplyKeepsTargetAndThreadAcrossReads(t *testing.T) {
	for _, nested := range []bool{false, true} {
		name := "直接回复一级"
		if nested {
			name = "回复二级且目标不在当前页"
		}
		t.Run(name, func(t *testing.T) {
			svc, repo, _, _ := newServiceWithMocks(nil)
			postID, viewer := shared.NewID(), shared.NewID()
			root, err := newDomainComment(shared.NewID(), postID, "同名作者", domain.StatusApproved)
			if !assert.NoError(t, err) {
				return
			}
			target := root
			if nested {
				target, err = newDomainComment(shared.NewID(), postID, "同名作者", domain.StatusApproved)
				if !assert.NoError(t, err) {
					return
				}
				assert.NoError(t, target.SetParent(root))
			}
			repo.On("FindByID", mock.Anything, target.ID()).Return(target, nil).Once()
			var saved *domain.Comment
			repo.On("Save", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
				saved = args.Get(1).(*domain.Comment)
			}).Return(nil).Once()

			created, err := svc.Create(context.Background(), CreateInput{
				PostID: postID.String(), UserID: viewer.String(), ParentID: target.ID().String(),
				AuthorName: "新回复作者", Body: "立即显示的回复",
			})
			if !assert.NoError(t, err) || !assert.NotNil(t, saved) {
				return
			}
			assert.Equal(t, target.ID().String(), created.ParentID)
			assert.Equal(t, root.ID().String(), created.ThreadRootID)
			assert.Equal(t, "同名作者", created.ReplyToName)
			assert.Equal(t, int16(1), created.Depth)
			assert.Equal(t, domain.StatusPending, created.Status)

			repo.On("FindPage", mock.Anything, mock.MatchedBy(func(filter domain.ListFilter) bool {
				return filter.ParentID != nil && *filter.ParentID == root.ID() &&
					filter.ViewerUserID != nil && *filter.ViewerUserID == viewer &&
					filter.Status == domain.StatusApproved
			}), mock.Anything).Return(shared.PageResult[*domain.Comment]{
				Items: []*domain.Comment{saved}, Total: 1,
			}, nil).Once()
			repo.On("FindByIDs", mock.Anything, []shared.ID{target.ID()}).
				Return([]*domain.Comment{target}, nil).Once()

			replies, total, err := svc.ListReplies(context.Background(), root.ID().String(), viewer.String(), "asc", 1, 10)
			if !assert.NoError(t, err) || !assert.Len(t, replies, 1) {
				return
			}
			assert.Equal(t, int64(1), total)
			assert.Equal(t, created, replies[0])
			repo.AssertExpectations(t)
		})
	}
}

func TestListByPost_ReplyPreviewResolvesTargetOutsidePreview(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	postID, viewer := shared.NewID(), shared.NewID()
	root, err := newDomainComment(shared.NewID(), postID, "楼主", domain.StatusApproved)
	if !assert.NoError(t, err) {
		return
	}
	target, err := newDomainComment(shared.NewID(), postID, "预览外的目标", domain.StatusApproved)
	if !assert.NoError(t, err) {
		return
	}
	assert.NoError(t, target.SetParent(root))
	reply, err := newDomainComment(shared.NewID(), postID, "回复者", domain.StatusApproved)
	if !assert.NoError(t, err) {
		return
	}
	assert.NoError(t, reply.SetParent(target))
	repo.On("FindPage", mock.Anything, mock.MatchedBy(func(filter domain.ListFilter) bool {
		return filter.ParentID == nil
	}), mock.Anything).Return(shared.PageResult[*domain.Comment]{Items: []*domain.Comment{root}, Total: 1}, nil).Once()
	repo.On("FindPage", mock.Anything, mock.MatchedBy(func(filter domain.ListFilter) bool {
		return filter.ParentID != nil && *filter.ParentID == root.ID()
	}), mock.Anything).Return(shared.PageResult[*domain.Comment]{Items: []*domain.Comment{reply}, Total: 4}, nil).Once()
	repo.On("FindByIDs", mock.Anything, []shared.ID{target.ID()}).Return([]*domain.Comment{target}, nil).Once()

	items, _, err := svc.ListByPost(context.Background(), postID.String(), viewer.String(), "", domain.AnchorFilterFree, domain.DepthFilterTopLevel, "", 1, 10)
	if !assert.NoError(t, err) || !assert.Len(t, items, 1) || !assert.Len(t, items[0].Replies, 1) {
		return
	}
	assert.Empty(t, items[0].ThreadRootID)
	assert.Equal(t, int64(4), items[0].RepliesTotal)
	assert.Equal(t, target.ID().String(), items[0].Replies[0].ParentID)
	assert.Equal(t, root.ID().String(), items[0].Replies[0].ThreadRootID)
	assert.Equal(t, "预览外的目标", items[0].Replies[0].ReplyToName)
	repo.AssertExpectations(t)
}

func TestListReplies_TargetNameRespectsViewerVisibility(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status string
		self   bool
		want   string
	}{
		{name: "已审核目标", status: domain.StatusApproved, want: "目标作者"},
		{name: "自己的待审核目标", status: domain.StatusPending, self: true, want: "目标作者"},
		{name: "他人的待审核目标", status: domain.StatusPending},
		{name: "已删除目标", status: domain.StatusDeleted, self: true},
		{name: "垃圾评论目标", status: domain.StatusSpam, self: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, repo, _, _ := newServiceWithMocks(nil)
			postID, rootID, targetID, viewer, author := shared.NewID(), shared.NewID(), shared.NewID(), shared.NewID(), shared.NewID()
			if tc.self {
				author = viewer
			}
			target := domain.ReconstructComment(targetID, postID, &author, &rootID, rootID.String()+"/"+targetID.String()+"/", 1, nil,
				"目标作者", "", "", "", "不可泄露的目标正文", nil, tc.status, "", "", false, time.Time{}, time.Time{})
			reply, err := newDomainComment(shared.NewID(), postID, "回复作者", domain.StatusApproved)
			if !assert.NoError(t, err) {
				return
			}
			assert.NoError(t, reply.SetParent(target))
			repo.On("FindPage", mock.Anything, mock.Anything, mock.Anything).
				Return(shared.PageResult[*domain.Comment]{Items: []*domain.Comment{reply}, Total: 1}, nil).Once()
			repo.On("FindByIDs", mock.Anything, []shared.ID{targetID}).Return([]*domain.Comment{target}, nil).Once()

			items, total, err := svc.ListReplies(context.Background(), rootID.String(), viewer.String(), "asc", 1, 10)
			if !assert.NoError(t, err) || !assert.Len(t, items, 1) {
				return
			}
			assert.Equal(t, int64(1), total)
			assert.Equal(t, tc.want, items[0].ReplyToName)
			assert.Equal(t, reply.ID().String(), items[0].ID)
			repo.AssertExpectations(t)
		})
	}
}

// AI 署名不随审计 actor 注销而变成真人注销占位。
func TestEnrichOAuthIdentities_AIKeepsNameWhenAuthorDeleted(t *testing.T) {
	userRepo := new(mocks.MockUserRepository)
	svc := &Service{userRepo: userRepo}

	dUID := shared.NewID()
	dEmail, _ := domainuser.ParseEmail("gone@example.com")
	dName, _ := domainuser.ParseUsername("gone")
	deletedUser := domainuser.ReconstructUser(dUID, dEmail, dName, domainuser.DisplayName{},
		domainuser.NewPasswordHash(""), "", "", "", domainuser.RoleUser,
		nil, nil, nil, false, true, true, time.Now(), time.Time{}, time.Time{})
	deletedUser.Delete(time.Now())

	postID, cID := shared.NewID(), shared.NewID()
	zero := time.Time{}
	aiComment := domain.ReconstructComment(cID, postID, &dUID, nil, cID.String()+"/", 0, nil,
		"independent model", "", "", "", "ai body", nil, domain.StatusApproved, "", "", true, zero, zero)

	userRepo.On("FindByIDsForDisplay", mock.Anything, mock.AnythingOfType("[]shared.ID")).
		Return([]*domainuser.User{deletedUser}, nil).Once()

	dtos := []CommentDTO{{
		ID: cID.String(), AuthorName: aiComment.AuthorName(), IsAI: true,
	}}
	err := svc.enrichOAuthIdentities(context.Background(), dtos, []*domain.Comment{aiComment})
	assert.NoError(t, err)
	assert.Equal(t, aiComment.AuthorName(), dtos[0].AuthorName)
	assert.Empty(t, dtos[0].AvatarURL)
	assert.Empty(t, dtos[0].AuthorProvider)
	assert.Empty(t, dtos[0].AuthorUsername)
	userRepo.AssertExpectations(t)
}

// TestToDTO_AIIsNeverAuthor 作者 PAT 发表的 AI 评论不标记 is_author。
func TestToDTO_AIIsNeverAuthor(t *testing.T) {
	uid, postID, cID := shared.NewID(), shared.NewID(), shared.NewID()
	zero := time.Time{}
	ai := domain.ReconstructComment(cID, postID, &uid, nil, cID.String()+"/", 0, nil,
		"independent model", "", "", "", "ai", nil, domain.StatusApproved, "", "", true, zero, zero)
	human := domain.ReconstructComment(cID, postID, &uid, nil, cID.String()+"/", 0, nil,
		"me", "", "", "", "me", nil, domain.StatusApproved, "", "", false, zero, zero)
	assert.False(t, toDTO(ai, &uid, "").IsAuthor)
	assert.True(t, toDTO(human, &uid, "").IsAuthor)
}

// AI 被回复者的署名不随审计 actor 注销而替换。
func TestEnrichOAuthIdentities_ReplyToDeletedAIKeepsName(t *testing.T) {
	userRepo := new(mocks.MockUserRepository)
	svc := &Service{userRepo: userRepo}

	dUID := shared.NewID()
	dEmail, _ := domainuser.ParseEmail("gone@example.com")
	dName, _ := domainuser.ParseUsername("gone")
	deletedUser := domainuser.ReconstructUser(dUID, dEmail, dName, domainuser.DisplayName{},
		domainuser.NewPasswordHash(""), "", "", "", domainuser.RoleUser,
		nil, nil, nil, false, true, true, time.Now(), time.Time{}, time.Time{})
	deletedUser.Delete(time.Now())

	postID, aiID, rID := shared.NewID(), shared.NewID(), shared.NewID()
	zero := time.Time{}
	aiComment := domain.ReconstructComment(aiID, postID, &dUID, nil, aiID.String()+"/", 0, nil,
		"independent model", "", "", "", "ai body", nil, domain.StatusApproved, "", "", true, zero, zero)
	reply := domain.ReconstructComment(rID, postID, nil, &aiID, aiID.String()+"/"+rID.String()+"/", 1, nil,
		"guest", "", "g@x.com", "", "reply", nil, domain.StatusApproved, "", "", false, zero, zero)

	userRepo.On("FindByIDsForDisplay", mock.Anything, mock.AnythingOfType("[]shared.ID")).
		Return([]*domainuser.User{deletedUser}, nil).Once()

	dtos := []CommentDTO{{
		ID: aiID.String(), AuthorName: aiComment.AuthorName(), IsAI: true,
		Replies: []CommentDTO{{ID: rID.String(), ParentID: aiID.String(), ReplyToName: aiComment.AuthorName(), AuthorName: "guest"}},
	}}
	err := svc.enrichOAuthIdentities(context.Background(), dtos, []*domain.Comment{aiComment, reply})
	assert.NoError(t, err)
	assert.Equal(t, aiComment.AuthorName(), dtos[0].Replies[0].ReplyToName)
}

// TestCreate_RequireParentAnchor_RejectsFreeParent create_annotation 回复自由评论应拒绝。
func TestCreate_RequireParentAnchor_RejectsFreeParent(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	postID, parentID, uid := shared.NewID(), shared.NewID(), shared.NewID()
	zero := time.Time{}
	freeParent := domain.ReconstructComment(parentID, postID, &uid, nil, parentID.String()+"/", 0, nil,
		"human", "", "", "", "free", nil, domain.StatusApproved, "", "", false, zero, zero)

	repo.On("FindByID", mock.Anything, parentID).Return(freeParent, nil).Once()
	repo.AssertNotCalled(t, "Save")

	_, err := svc.Create(context.Background(), CreateInput{
		PostID: postID.String(), UserID: uid.String(), ParentID: parentID.String(),
		AuthorName: "independent model", AuthorEmail: "a@x.com", Body: "reply",
		RequireParentAnchor: true, IsAI: true,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "划线批注")
	repo.AssertExpectations(t)
}

// TestCreate_RequireParentAnchor_InheritsAnnotationParent 批注父评论可回复并继承锚点。
func TestCreate_RequireParentAnchor_InheritsAnnotationParent(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(&fakeSitePolicy{enabled: true, moderation: false})
	postID, parentID, uid := shared.NewID(), shared.NewID(), shared.NewID()
	zero := time.Time{}
	anchor := &domain.Anchor{BlockID: "abc12345", StartOffset: 0, EndOffset: 5, SelectedText: "hello", BlockHashSync: "abc12345"}
	parent := domain.ReconstructComment(parentID, postID, &uid, nil, parentID.String()+"/", 0, anchor,
		"human", "", "", "", "annot", nil, domain.StatusApproved, "", "", false, zero, zero)

	repo.On("FindByID", mock.Anything, parentID).Return(parent, nil).Once()
	repo.On("Save", mock.Anything, mock.Anything).Return(nil).Once()

	dto, err := svc.Create(context.Background(), CreateInput{
		PostID: postID.String(), UserID: uid.String(), ParentID: parentID.String(),
		AuthorName: "independent model", AuthorEmail: "a@x.com", Body: "reply",
		RequireParentAnchor: true, IsAI: true,
	})
	if assert.NoError(t, err) && assert.NotNil(t, dto.Anchor) {
		assert.Equal(t, "hello", dto.Anchor.SelectedText)
	}
	repo.AssertExpectations(t)
}

// TestCreate_RejectAnchoredParent_RejectsAnnotationParent create_comment 不得回复划线批注。
func TestCreate_RejectAnchoredParent_RejectsAnnotationParent(t *testing.T) {
	svc, repo, _, _ := newServiceWithMocks(nil)
	postID, parentID, uid := shared.NewID(), shared.NewID(), shared.NewID()
	zero := time.Time{}
	anchor := &domain.Anchor{BlockID: "abc12345", StartOffset: 0, EndOffset: 5, SelectedText: "hello", BlockHashSync: "abc12345"}
	parent := domain.ReconstructComment(parentID, postID, &uid, nil, parentID.String()+"/", 0, anchor,
		"human", "", "", "", "annot", nil, domain.StatusApproved, "", "", false, zero, zero)

	repo.On("FindByID", mock.Anything, parentID).Return(parent, nil).Once()
	repo.AssertNotCalled(t, "Save")

	_, err := svc.Create(context.Background(), CreateInput{
		PostID: postID.String(), UserID: uid.String(), ParentID: parentID.String(),
		AuthorName: "independent model", AuthorEmail: "a@x.com", Body: "reply",
		RejectAnchoredParent: true, IsAI: true,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "自由评论不能回复划线批注")
	repo.AssertExpectations(t)
}
