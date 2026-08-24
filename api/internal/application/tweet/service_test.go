package tweet

import (
	"context"
	"encoding/base64"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

// --- 测试替身 ---

// fakeTweetRepo 记录调用参数并返回预制数据。
// keyset 过滤正确性由 gorm 层 SQLite 契约测试覆盖，此处只验证 service 的
// limit+1 探测、裁剪与游标生成行为。
type fakeTweetRepo struct {
	tweets       []*domaintweet.Tweet // FindTimeline/FindByAuthor 预制返回
	gotLimit     int
	gotCursor    *domaintweet.Cursor
	gotAuthorID  *shared.ID
	saved        []*domaintweet.Tweet
	deleted      []shared.ID
	findByIDData map[string]*domaintweet.Tweet
	likes        map[string]bool // "tweetID:userID" -> bool
}

func (f *fakeTweetRepo) Save(_ context.Context, tw *domaintweet.Tweet) error {
	f.saved = append(f.saved, tw)
	return nil
}

func (f *fakeTweetRepo) FindByID(_ context.Context, id shared.ID) (*domaintweet.Tweet, error) {
	if tw, ok := f.findByIDData[id.String()]; ok {
		return tw, nil
	}
	return nil, domaintweet.ErrNotFound
}
func (f *fakeTweetRepo) FindByIDs(_ context.Context, ids []shared.ID) ([]*domaintweet.Tweet, error) {
	var res []*domaintweet.Tweet
	for _, id := range ids {
		if tw, ok := f.findByIDData[id.String()]; ok {
			res = append(res, tw)
		}
	}
	return res, nil
}
func (f *fakeTweetRepo) FindTimeline(_ context.Context, cursor *domaintweet.Cursor, limit int) ([]*domaintweet.Tweet, error) {
	f.gotCursor, f.gotLimit = cursor, limit
	return f.tweets, nil
}

func (f *fakeTweetRepo) FindByAuthor(_ context.Context, authorID shared.ID, cursor *domaintweet.Cursor, limit int) ([]*domaintweet.Tweet, error) {
	f.gotAuthorID, f.gotCursor, f.gotLimit = &authorID, cursor, limit
	return f.tweets, nil
}
func (f *fakeTweetRepo) FindByTopic(_ context.Context, tag string, cursor *domaintweet.Cursor, limit int) ([]*domaintweet.Tweet, error) {
	f.gotCursor, f.gotLimit = cursor, limit
	return f.tweets, nil
}
func (f *fakeTweetRepo) CountQuotesByTweetIDs(_ context.Context, _ []shared.ID) (map[string]int64, error) {
	return map[string]int64{}, nil
}

func (f *fakeTweetRepo) Delete(_ context.Context, id shared.ID) error {
	f.deleted = append(f.deleted, id)
	return nil
}
func (f *fakeTweetRepo) Like(_ context.Context, tweetID, userID shared.ID) error {
	if f.likes == nil {
		f.likes = make(map[string]bool)
	}
	f.likes[tweetID.String()+":"+userID.String()] = true
	return nil
}

func (f *fakeTweetRepo) Unlike(_ context.Context, tweetID, userID shared.ID) error {
	if f.likes != nil {
		delete(f.likes, tweetID.String()+":"+userID.String())
	}
	return nil
}

func (f *fakeTweetRepo) IsLiked(_ context.Context, tweetID, userID shared.ID) (bool, error) {
	if f.likes == nil {
		return false, nil
	}
	return f.likes[tweetID.String()+":"+userID.String()], nil
}

func (f *fakeTweetRepo) FindLikedTweetIDs(_ context.Context, userID shared.ID, tweetIDs []shared.ID) (map[string]bool, error) {
	res := make(map[string]bool)
	if f.likes == nil {
		return res, nil
	}
	for _, tid := range tweetIDs {
		if f.likes[tid.String()+":"+userID.String()] {
			res[tid.String()] = true
		}
	}
	return res, nil
}

// fakeUserRepo 只实现推文 service 用到的两个方法，其余 panic（未被调用）。
type fakeUserRepo struct {
	byIDs      map[string]*domainuser.User
	byUsername map[string]*domainuser.User
}

func (f *fakeUserRepo) FindByID(_ context.Context, id shared.ID) (*domainuser.User, error) {
	if u, ok := f.byIDs[id.String()]; ok {
		return u, nil
	}
	return nil, domainuser.ErrNotFound
}

func (f *fakeUserRepo) FindByIDs(_ context.Context, ids []shared.ID) ([]*domainuser.User, error) {
	out := make([]*domainuser.User, 0, len(ids))
	for _, id := range ids {
		if u, ok := f.byIDs[id.String()]; ok {
			out = append(out, u)
		}
	}
	return out, nil
}

func (f *fakeUserRepo) FindByUsername(_ context.Context, username domainuser.Username) (*domainuser.User, error) {
	if u, ok := f.byUsername[username.String()]; ok {
		return u, nil
	}
	return nil, domainuser.ErrNotFound
}

func (f *fakeUserRepo) FindByEmail(context.Context, domainuser.Email) (*domainuser.User, error) {
	panic("未使用")
}
func (f *fakeUserRepo) ExistsByEmail(context.Context, domainuser.Email) (bool, error) {
	panic("未使用")
}
func (f *fakeUserRepo) ExistsByUsername(context.Context, domainuser.Username) (bool, error) {
	panic("未使用")
}
func (f *fakeUserRepo) Save(context.Context, *domainuser.User) error { panic("未使用") }
func (f *fakeUserRepo) Delete(context.Context, shared.ID) error      { panic("未使用") }
func (f *fakeUserRepo) Count(context.Context) (int64, error)         { panic("未使用") }

// fakeImageChecker 图片归属校验替身：err 非 nil 时拒绝。
type fakeImageChecker struct {
	err      error
	gotURLs  []string
	gotOwner shared.ID
	called   bool
}

func (f *fakeImageChecker) CheckImagesOwnedBy(_ context.Context, urls []string, authorID shared.ID) error {
	f.called, f.gotURLs, f.gotOwner = true, urls, authorID
	return f.err
}

// fakePermChecker 权限替身：codes 全在 allowed 集合才放行。
type fakePermChecker struct{ allowed map[string]bool }

func (f fakePermChecker) HasPermission(_ string, _ bool, codes ...string) bool {
	for _, c := range codes {
		if !f.allowed[c] {
			return false
		}
	}
	return true
}

// fakeCommentRepo 推文评论仓储替身，内存存储。
type fakeCommentRepo struct {
	byID      map[string]*domaintweet.Comment
	tweets    map[string]*domaintweet.Tweet // CreateComment 校验推文存在用
	saved     []*domaintweet.Comment
	deleted   []shared.ID
	countByID map[string]int64 // tweetID -> count
}

func newFakeCommentRepo() *fakeCommentRepo {
	return &fakeCommentRepo{byID: map[string]*domaintweet.Comment{}, countByID: map[string]int64{}}
}

func (f *fakeCommentRepo) Save(_ context.Context, c *domaintweet.Comment) error {
	f.byID[c.ID().String()] = c
	f.saved = append(f.saved, c)
	return nil
}

func (f *fakeCommentRepo) FindByID(_ context.Context, id shared.ID) (*domaintweet.Comment, error) {
	if c, ok := f.byID[id.String()]; ok {
		return c, nil
	}
	return nil, domaintweet.ErrCommentNotFound
}

func (f *fakeCommentRepo) FindPage(_ context.Context, filter domaintweet.ListFilter, q shared.PageQuery) (shared.PageResult[*domaintweet.Comment], error) {
	if filter.ParentID != nil {
		parent, ok := f.byID[filter.ParentID.String()]
		if !ok {
			return shared.PageResult[*domaintweet.Comment]{}, domaintweet.ErrCommentNotFound
		}
		prefix := parent.ID().String() + "/"
		var reps []*domaintweet.Comment
		for _, c := range f.byID {
			if c.Depth() == 1 && len(c.Path()) > len(prefix) && c.Path()[:len(prefix)] == prefix {
				reps = append(reps, c)
			}
		}
		return shared.NewPageResult(q, reps, int64(len(reps))), nil
	}
	var tops []*domaintweet.Comment
	if filter.TweetID != nil {
		for _, c := range f.byID {
			if c.TweetID() == *filter.TweetID && c.Depth() == 0 {
				tops = append(tops, c)
			}
		}
	}
	// 简化：返回全部，不分页（分页正确性由 gorm 契约测试覆盖）
	return shared.NewPageResult(q, tops, int64(len(tops))), nil
}

func (f *fakeCommentRepo) CountByTweet(_ context.Context, tweetID shared.ID) (int64, error) {
	return f.countByID[tweetID.String()], nil
}

func (f *fakeCommentRepo) CountByTweetIDs(_ context.Context, tweetIDs []shared.ID) (map[string]int64, error) {
	res := make(map[string]int64, len(tweetIDs))
	for _, id := range tweetIDs {
		res[id.String()] = f.countByID[id.String()]
	}
	return res, nil
}

func (f *fakeCommentRepo) CountRepliesByParents(_ context.Context, parentIDs []shared.ID) (map[string]int64, error) {
	res := make(map[string]int64, len(parentIDs))
	for _, pid := range parentIDs {
		prefix := pid.String() + "/"
		for _, c := range f.byID {
			if c.Depth() == 1 && len(c.Path()) > len(prefix) && c.Path()[:len(prefix)] == prefix {
				res[pid.String()]++
			}
		}
	}
	return res, nil
}

func (f *fakeCommentRepo) Delete(_ context.Context, id shared.ID) error {
	if _, ok := f.byID[id.String()]; !ok {
		return domaintweet.ErrCommentNotFound
	}
	delete(f.byID, id.String())
	f.deleted = append(f.deleted, id)
	return nil
}

// captureBus 捕获发布的事件。
type captureBus struct{ events []shared.DomainEvent }

func (b *captureBus) Publish(_ context.Context, ev []shared.DomainEvent) error {
	b.events = append(b.events, ev...)
	return nil
}
func (b *captureBus) Subscribe(string, appshared.EventHandler) {}

// --- 构造辅助 ---

func newTestUser(t *testing.T, username string) *domainuser.User {
	t.Helper()
	uname, err := domainuser.ParseUsername(username)
	require.NoError(t, err)
	email, err := domainuser.ParseEmail(username + "@example.com")
	require.NoError(t, err)
	u := domainuser.NewUser(shared.NewID(), email, uname, domainuser.NewPasswordHash("x"))
	u.UpdateAvatarURL("/uploads/avatar/" + username + ".webp")
	return u
}

func newService(repo *fakeTweetRepo, users *fakeUserRepo, checker *fakeImageChecker, perm TweetPermissionChecker, bus appshared.EventBus) *Service {
	return NewService(repo, nil, users, checker, perm, nil, bus)
}

// newCommentService 构造带评论仓储的 service（评论用例测试用）。
func newCommentService(t *testing.T, repo *fakeTweetRepo, comments *fakeCommentRepo, users *fakeUserRepo, perm TweetPermissionChecker) *Service {
	t.Helper()
	return NewService(repo, comments, users, nil, perm, nil, appshared.NoopEventBus{})
}

// ctxWithUser 注入 session 中间件同款身份上下文。
func ctxWithUser(userID, role string, isBuiltin bool) context.Context {
	ctx := context.Background()
	ctx = context.WithValue(ctx, middleware.UserIDKey, userID)
	ctx = context.WithValue(ctx, middleware.UserRoleKey, role)
	ctx = context.WithValue(ctx, middleware.UserIsRootKey, isBuiltin)
	return ctx
}

// cannedTweets 造 n 条带显式递增时间的推文（reconstruct 保证时间确定性）。
func cannedTweets(authorID shared.ID, base time.Time, n int) []*domaintweet.Tweet {
	out := make([]*domaintweet.Tweet, 0, n)
	for i := range n {
		ts := base.Add(time.Duration(i) * time.Minute)
		out = append(out, domaintweet.ReconstructTweet(shared.NewID(), authorID, "推文", []string{}, nil, 0, ts, ts))
	}
	return out
}

// --- Create ---

func TestService_Create_Success(t *testing.T) {
	author := newTestUser(t, "alice")
	repo := &fakeTweetRepo{}
	users := &fakeUserRepo{byIDs: map[string]*domainuser.User{author.GetID().String(): author}}
	checker := &fakeImageChecker{}
	bus := &captureBus{}
	svc := newService(repo, users, checker, nil, bus)

	dto, err := svc.Create(context.Background(), CreateInput{
		AuthorID: author.GetID().String(),
		Content:  "第一条推文",
	})
	require.NoError(t, err)
	assert.NotEmpty(t, dto.ID)
	assert.Equal(t, "第一条推文", dto.Content)
	assert.Equal(t, []string{}, dto.Images, "空图片应序列化为 [] 而非 null")
	assert.Equal(t, "alice", dto.Author.Username)
	assert.Equal(t, "/uploads/avatar/alice.webp", dto.Author.AvatarURL)
	assert.NotEmpty(t, dto.CreatedAt)

	require.Len(t, repo.saved, 1)
	assert.False(t, checker.called, "无图片不应触发归属校验")

	// 创建事件已发布
	require.Len(t, bus.events, 1)
	assert.Equal(t, "tweet.created", bus.events[0].EventName())
}

func TestService_Create_WithImages_ChecksOwnership(t *testing.T) {
	author := newTestUser(t, "alice")
	repo := &fakeTweetRepo{}
	users := &fakeUserRepo{byIDs: map[string]*domainuser.User{author.GetID().String(): author}}
	checker := &fakeImageChecker{}
	svc := newService(repo, users, checker, nil, appshared.NoopEventBus{})

	images := []string{"/uploads/tweet/a.webp", "/uploads/tweet/b.webp"}
	dto, err := svc.Create(context.Background(), CreateInput{
		AuthorID: author.GetID().String(),
		Content:  "带图",
		Images:   images,
	})
	require.NoError(t, err)
	assert.Equal(t, images, dto.Images)
	require.True(t, checker.called)
	assert.Equal(t, images, checker.gotURLs)
	assert.Equal(t, author.GetID(), checker.gotOwner)
}

func TestService_Create_ImageOwnershipRejected(t *testing.T) {
	author := newTestUser(t, "alice")
	repo := &fakeTweetRepo{}
	users := &fakeUserRepo{}
	// 校验失败（非本人上传/文件不存在）：发布被拒且不落库
	checker := &fakeImageChecker{err: shared.Forbidden("图片不属于当前用户")}
	svc := newService(repo, users, checker, nil, appshared.NoopEventBus{})

	_, err := svc.Create(context.Background(), CreateInput{
		AuthorID: author.GetID().String(),
		Images:   []string{"/uploads/tweet/others.webp"},
	})
	require.Error(t, err)
	assert.Empty(t, repo.saved, "校验失败不应落库")
}

func TestService_Create_DomainInvariantRejected(t *testing.T) {
	repo := &fakeTweetRepo{}
	svc := newService(repo, &fakeUserRepo{}, &fakeImageChecker{}, nil, appshared.NoopEventBus{})

	// 空内容 + 空图片
	_, err := svc.Create(context.Background(), CreateInput{AuthorID: shared.NewID().String()})
	require.Error(t, err)
	assert.Empty(t, repo.saved)

	// 非法作者 ID
	_, err = svc.Create(context.Background(), CreateInput{AuthorID: "not-a-uuid", Content: "hi"})
	require.Error(t, err)
	assert.Empty(t, repo.saved)
}
func TestService_Create_WithQuote(t *testing.T) {
	author := newTestUser(t, "alice")
	quotedID := shared.NewID()
	now := time.Now()
	quotedTweet := domaintweet.ReconstructTweet(quotedID, author.GetID(), "原推文", nil, nil, 0, now, now)

	repo := &fakeTweetRepo{
		findByIDData: map[string]*domaintweet.Tweet{
			quotedID.String(): quotedTweet,
		},
	}
	users := &fakeUserRepo{byIDs: map[string]*domainuser.User{author.GetID().String(): author}}
	svc := newService(repo, users, nil, nil, appshared.NoopEventBus{})

	qidStr := quotedID.String()
	dto, err := svc.Create(context.Background(), CreateInput{
		AuthorID: author.GetID().String(),
		Content:  "引用转发",
		QuoteOf:  &qidStr,
	})
	require.NoError(t, err)
	require.NotNil(t, dto.QuoteOf)
	assert.Equal(t, qidStr, *dto.QuoteOf)
	require.NotNil(t, dto.QuotedTweet)
	assert.Equal(t, "原推文", dto.QuotedTweet.Content)
	assert.Equal(t, "alice", dto.QuotedTweet.Author.Username)

	// 不存在的引用推文拒绝
	badID := shared.NewID().String()
	_, err = svc.Create(context.Background(), CreateInput{
		AuthorID: author.GetID().String(),
		Content:  "引用转发",
		QuoteOf:  &badID,
	})
	require.Error(t, err)
}

// --- Delete 三分支 ---

// seedTweet 构造待删除推文并放入 repo。
func seedTweet(authorID shared.ID) *domaintweet.Tweet {
	return domaintweet.ReconstructTweet(shared.NewID(), authorID, "待删", []string{}, nil, 0, time.Now(), time.Now())
}

func TestService_Delete_ByAuthor(t *testing.T) {
	authorID := shared.NewID()
	tw := seedTweet(authorID)
	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{tw.ID().String(): tw}}
	bus := &captureBus{}
	svc := newService(repo, &fakeUserRepo{}, nil, nil, bus)

	err := svc.Delete(ctxWithUser(authorID.String(), "author", false), tw.ID().String())
	require.NoError(t, err)
	require.Len(t, repo.deleted, 1)
	assert.Equal(t, tw.ID(), repo.deleted[0])

	require.Len(t, bus.events, 1)
	deleted, ok := bus.events[0].(domaintweet.TweetDeleted)
	require.True(t, ok)
	assert.Equal(t, tw.ID(), deleted.AggregateID())
	assert.Equal(t, authorID, deleted.AuthorID)
}

func TestService_Delete_ByAdminWithPermission(t *testing.T) {
	tw := seedTweet(shared.NewID())
	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{tw.ID().String(): tw}}
	perm := fakePermChecker{allowed: map[string]bool{PermDeleteAny: true}}
	svc := newService(repo, &fakeUserRepo{}, nil, perm, appshared.NoopEventBus{})

	// 非作者 + 有 tweet:delete-any 权限 → 放行
	err := svc.Delete(ctxWithUser(shared.NewID().String(), "admin", false), tw.ID().String())
	require.NoError(t, err)
	assert.Len(t, repo.deleted, 1)
}

func TestService_Delete_ByBuiltinSuperAdmin(t *testing.T) {
	tw := seedTweet(shared.NewID())
	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{tw.ID().String(): tw}}
	// 超管通配短路：无权限码也放行
	svc := newService(repo, &fakeUserRepo{}, nil, nil, appshared.NoopEventBus{})

	err := svc.Delete(ctxWithUser(shared.NewID().String(), "superadmin", true), tw.ID().String())
	require.NoError(t, err)
	assert.Len(t, repo.deleted, 1)
}

func TestService_Delete_ForbiddenForOtherUser(t *testing.T) {
	tw := seedTweet(shared.NewID())
	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{tw.ID().String(): tw}}
	perm := fakePermChecker{allowed: map[string]bool{}}
	svc := newService(repo, &fakeUserRepo{}, nil, perm, appshared.NoopEventBus{})

	// 非作者 + 无权限 → 403，且不落删除
	err := svc.Delete(ctxWithUser(shared.NewID().String(), "author", false), tw.ID().String())
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeForbidden))
	assert.Empty(t, repo.deleted)
}

func TestService_Delete_NotFound(t *testing.T) {
	repo := &fakeTweetRepo{}
	svc := newService(repo, &fakeUserRepo{}, nil, nil, appshared.NoopEventBus{})

	err := svc.Delete(ctxWithUser(shared.NewID().String(), "author", false), shared.NewID().String())
	require.ErrorIs(t, err, domaintweet.ErrNotFound)
}

// --- GetByID ---

func TestService_GetByID(t *testing.T) {
	author := newTestUser(t, "alice")
	tw := seedTweet(author.GetID())
	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{tw.ID().String(): tw}}
	users := &fakeUserRepo{byIDs: map[string]*domainuser.User{author.GetID().String(): author}}
	svc := newService(repo, users, nil, nil, appshared.NoopEventBus{})

	dto, err := svc.GetByID(context.Background(), tw.ID().String())
	require.NoError(t, err)
	assert.Equal(t, tw.ID().String(), dto.ID)
	assert.Equal(t, "alice", dto.Author.Username)

	_, err = svc.GetByID(context.Background(), "bad-id")
	require.Error(t, err)

	_, err = svc.GetByID(context.Background(), shared.NewID().String())
	require.ErrorIs(t, err, domaintweet.ErrNotFound)
}

// --- ListTimeline cursor 分页 ---

func TestService_ListTimeline_PageTrimming(t *testing.T) {
	authorID := shared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)
	// repo 返回 limit+1 条（service 请求 limit+1 探测），期望裁剪到 limit
	repo := &fakeTweetRepo{tweets: cannedTweets(authorID, base, 3)}
	svc := newService(repo, &fakeUserRepo{}, nil, nil, appshared.NoopEventBus{})

	dtos, nextCursor, err := svc.ListTimeline(context.Background(), "", 2)
	require.NoError(t, err)
	assert.Equal(t, 3, repo.gotLimit, "service 应向 repo 请求 limit+1 探测")
	assert.Nil(t, repo.gotCursor, "空游标字符串应传 nil 游标（第一页）")
	require.Len(t, dtos, 2, "应裁剪掉第 limit+1 条")
	assert.NotEmpty(t, nextCursor, "有下一页应生成游标")

	// nextCursor 指向本页末条（倒序 = 时间最早那条）
	last := repo.tweets[1]
	decoded, err := decodeCursor(nextCursor)
	require.NoError(t, err)
	assert.Equal(t, last.ID(), decoded.ID)
	assert.True(t, last.CreatedAt().Equal(decoded.CreatedAt))
}

func TestService_ListByTopic(t *testing.T) {
	authorID := shared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)
	repo := &fakeTweetRepo{tweets: cannedTweets(authorID, base, 3)}
	svc := newService(repo, &fakeUserRepo{}, nil, nil, appshared.NoopEventBus{})

	dtos, nextCursor, err := svc.ListByTopic(context.Background(), "Golang", "", 2)
	require.NoError(t, err)
	assert.Len(t, dtos, 2)
	assert.NotEmpty(t, nextCursor)
}

func TestService_ListTimeline_LastPageNoCursor(t *testing.T) {
	authorID := shared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)
	// 恰好一页：repo 返回条数 == limit，无 hasMore
	repo := &fakeTweetRepo{tweets: cannedTweets(authorID, base, 2)}
	svc := newService(repo, &fakeUserRepo{}, nil, nil, appshared.NoopEventBus{})

	dtos, nextCursor, err := svc.ListTimeline(context.Background(), "", 2)
	require.NoError(t, err)
	assert.Len(t, dtos, 2)
	assert.Empty(t, nextCursor, "恰好一页无 nextCursor")

	// 空列表
	repo.tweets = nil
	dtos, nextCursor, err = svc.ListTimeline(context.Background(), "", 20)
	require.NoError(t, err)
	assert.Empty(t, dtos)
	assert.Empty(t, nextCursor)
}

func TestService_ListTimeline_CursorRoundTrip(t *testing.T) {
	authorID := shared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)
	repo := &fakeTweetRepo{tweets: cannedTweets(authorID, base, 1)}
	svc := newService(repo, &fakeUserRepo{}, nil, nil, appshared.NoopEventBus{})

	// 合法游标透传到 repo
	want := domaintweet.Cursor{CreatedAt: base, ID: shared.NewID()}
	_, _, err := svc.ListTimeline(context.Background(), encodeCursor(want), 10)
	require.NoError(t, err)
	require.NotNil(t, repo.gotCursor)
	assert.Equal(t, want.ID, repo.gotCursor.ID)
	assert.True(t, want.CreatedAt.Equal(repo.gotCursor.CreatedAt))

	// 非法游标 → 400 领域错误，不透传 repo
	repo.gotCursor = nil
	_, _, err = svc.ListTimeline(context.Background(), "!!!bad-cursor!!!", 10)
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest))
	assert.Nil(t, repo.gotCursor)
}

// --- ListByUser ---

func TestService_ListByUser(t *testing.T) {
	author := newTestUser(t, "alice")
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)
	repo := &fakeTweetRepo{tweets: cannedTweets(author.GetID(), base, 1)}
	users := &fakeUserRepo{
		byUsername: map[string]*domainuser.User{"alice": author},
		byIDs:      map[string]*domainuser.User{author.GetID().String(): author},
	}
	svc := newService(repo, users, nil, nil, appshared.NoopEventBus{})

	dtos, _, err := svc.ListByUser(context.Background(), "alice", "", 20)
	require.NoError(t, err)
	require.Len(t, dtos, 1)
	require.NotNil(t, repo.gotAuthorID)
	assert.Equal(t, author.GetID(), *repo.gotAuthorID, "应按解析出的作者 ID 过滤")
	assert.Equal(t, "alice", dtos[0].Author.Username)

	// 不存在的用户名 → 404 领域错误
	_, _, err = svc.ListByUser(context.Background(), "ghost_user", "", 20)
	require.ErrorIs(t, err, domainuser.ErrNotFound)
}
func TestService_GetUserProfile(t *testing.T) {
	author := newTestUser(t, "alice")
	displayName, err := domainuser.ParseDisplayName("Alice")
	require.NoError(t, err)
	author.UpdateDisplayName(displayName)
	users := &fakeUserRepo{
		byUsername: map[string]*domainuser.User{"alice": author},
		byIDs:      map[string]*domainuser.User{author.GetID().String(): author},
	}
	svc := newService(&fakeTweetRepo{}, users, nil, nil, appshared.NoopEventBus{})

	profile, err := svc.GetUserProfile(context.Background(), "alice")
	require.NoError(t, err)
	assert.Equal(t, author.GetID().String(), profile.ID)
	assert.Equal(t, "alice", profile.Username)
	assert.Equal(t, "Alice", profile.DisplayName)
	assert.NotEmpty(t, profile.CreatedAt)

	_, err = svc.GetUserProfile(context.Background(), "ghost_user")
	require.ErrorIs(t, err, domainuser.ErrNotFound)
}
func TestService_Like_Unlike(t *testing.T) {
	repo := &fakeTweetRepo{}
	svc := newService(repo, &fakeUserRepo{}, nil, nil, appshared.NoopEventBus{})

	userID := shared.NewID().String()
	tweetID := shared.NewID().String()

	err := svc.Like(context.Background(), userID, tweetID)
	require.NoError(t, err)
	assert.True(t, repo.likes[tweetID+":"+userID])

	err = svc.Unlike(context.Background(), userID, tweetID)
	require.NoError(t, err)
	assert.False(t, repo.likes[tweetID+":"+userID])

	// 结合 middleware.UserIDKey 测试 toDTOs 中的 is_liked
	tw := cannedTweets(shared.NewID(), time.Now(), 1)[0]
	repo.findByIDData = map[string]*domaintweet.Tweet{tw.ID().String(): tw}
	_ = svc.Like(context.Background(), userID, tw.ID().String())

	ctxWithUser := context.WithValue(context.Background(), middleware.UserIDKey, userID)
	dto, err := svc.GetByID(ctxWithUser, tw.ID().String())
	require.NoError(t, err)
	assert.True(t, dto.IsLiked)
}

// --- cursor 编解码边界 ---

func TestCursorCodec_InvalidInputs(t *testing.T) {
	// 非 base64
	_, err := decodeCursor("not-base64!!!")
	assert.Error(t, err)

	// 手工构造的坏分段
	for _, raw := range []string{
		"no-separator",
		"2026-08-07|not-a-uuid",
		"bad-time|" + shared.NewID().String(),
	} {
		s := base64.RawURLEncoding.EncodeToString([]byte(raw))
		_, err := decodeCursor(s)
		assert.Error(t, err, "输入 %q 应报错", raw)
	}
}

// --- 推文评论 service 测试 ---

func setupCommentService(t *testing.T, authorID shared.ID) (*Service, *fakeTweetRepo, *fakeCommentRepo, *fakeUserRepo) {
	t.Helper()
	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{}}
	comments := newFakeCommentRepo()
	users := &fakeUserRepo{byIDs: map[string]*domainuser.User{}, byUsername: map[string]*domainuser.User{}}
	// 用传入的 authorID 构造用户，保证 commentsToDTOs 的 FindByIDs 能命中
	uname, err := domainuser.ParseUsername("commenter")
	require.NoError(t, err)
	mail, err := domainuser.ParseEmail("commenter@example.com")
	require.NoError(t, err)
	u := domainuser.NewUser(authorID, mail, uname, domainuser.NewPasswordHash("x"))
	u.UpdateAvatarURL("/uploads/avatar/commenter.webp")
	users.byIDs[authorID.String()] = u
	svc := newCommentService(t, repo, comments, users, nil)
	return svc, repo, comments, users
}

func TestCreateComment_TopLevel(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	svc, repo, comments, _ := setupCommentService(t, authorID)
	repo.findByIDData[tweetID.String()] = tweet

	dto, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "  好文！  ",
	})
	require.NoError(t, err)
	assert.Equal(t, tweetID.String(), dto.TweetID)
	assert.Equal(t, "好文！", dto.Body, "正文应 trim")
	assert.Equal(t, int16(0), dto.Depth)
	assert.Empty(t, dto.ParentID)
	require.Len(t, comments.saved, 1)
	assert.Equal(t, int16(0), comments.saved[0].Depth())
	assert.Equal(t, comments.saved[0].ID().String()+"/", comments.saved[0].Path())
	assert.Equal(t, "commenter", dto.Author.Username, "作者资料应填充")
}

func TestCreateComment_Reply(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	svc, repo, comments, _ := setupCommentService(t, authorID)
	repo.findByIDData[tweetID.String()] = tweet

	// 先发顶层评论
	top, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "顶层",
	})
	require.NoError(t, err)

	// 回复顶层
	reply, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "回复", ParentID: top.ID,
	})
	require.NoError(t, err)
	assert.Equal(t, int16(1), reply.Depth)
	assert.Equal(t, top.ID, reply.ParentID)

	// 回复一条回复（两层扁平：depth 仍为 1）
	reply2, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "回复的回复", ParentID: reply.ID,
	})
	require.NoError(t, err)
	assert.Equal(t, int16(1), reply2.Depth, "两层扁平：回复回复仍 depth=1")
	assert.Equal(t, reply.ID, reply2.ParentID, "parent_id 指被回复者")

	require.Len(t, comments.saved, 3)
	// reply2 的 path 挂在顶层祖先下
	assert.Equal(t, top.ID+"/"+reply2.ID+"/", comments.saved[2].Path())
}

func TestCreateComment_TweetNotFound(t *testing.T) {
	authorID := shared.NewID()
	svc, _, _, _ := setupCommentService(t, authorID)

	_, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: shared.NewID().String(), AuthorID: authorID.String(), Body: "x",
	})
	assert.ErrorIs(t, err, domaintweet.ErrNotFound)
}

func TestCreateComment_EmptyBody(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	svc, repo, _, _ := setupCommentService(t, authorID)
	repo.findByIDData[tweetID.String()] = tweet

	_, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "   ",
	})
	assert.Error(t, err)
}

func TestCreateComment_ParentWrongTweet(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	otherTweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	svc, repo, comments, _ := setupCommentService(t, authorID)
	repo.findByIDData[tweetID.String()] = tweet

	// 在另一条推文下造一条评论作为 parent
	otherParent, err := domaintweet.NewComment(otherTweetID, authorID, "另一推文的评论")
	require.NoError(t, err)
	require.NoError(t, otherParent.SetParent(nil))
	comments.byID[otherParent.ID().String()] = otherParent

	_, err = svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "回复", ParentID: otherParent.ID().String(),
	})
	assert.Error(t, err, "跨推文回复应拒绝")
}

func TestCreateComment_ParentNotFound(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	svc, repo, _, _ := setupCommentService(t, authorID)
	repo.findByIDData[tweetID.String()] = tweet

	_, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "回复", ParentID: shared.NewID().String(),
	})
	assert.ErrorIs(t, err, domaintweet.ErrCommentNotFound)
}

func TestDeleteComment_Author(t *testing.T) {
	authorID := shared.NewID()
	otherID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	svc, repo, comments, _ := setupCommentService(t, authorID)
	repo.findByIDData[tweetID.String()] = tweet

	c, err := domaintweet.NewComment(tweetID, otherID, "他人的评论")
	require.NoError(t, err)
	require.NoError(t, c.SetParent(nil))
	comments.byID[c.ID().String()] = c

	// 作者本人删自己的
	err = svc.DeleteComment(ctxWithUser(otherID.String(), "", false), c.ID().String())
	require.NoError(t, err)
	assert.Contains(t, comments.deleted, c.ID())
}

func TestDeleteComment_NonAuthorForbidden(t *testing.T) {
	authorID := shared.NewID()
	otherID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	svc, repo, comments, _ := setupCommentService(t, authorID)
	repo.findByIDData[tweetID.String()] = tweet

	c, err := domaintweet.NewComment(tweetID, authorID, "作者的评论")
	require.NoError(t, err)
	require.NoError(t, c.SetParent(nil))
	comments.byID[c.ID().String()] = c

	// 他人删（无权限）→ 403
	err = svc.DeleteComment(ctxWithUser(otherID.String(), "", false), c.ID().String())
	assert.Error(t, err)
	assert.Len(t, comments.deleted, 0, "无权删除不应调用 repo.Delete")
}

func TestDeleteComment_AdminWithPermission(t *testing.T) {
	authorID := shared.NewID()
	adminID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{}}
	repo.findByIDData[tweetID.String()] = tweet
	comments := newFakeCommentRepo()
	users := &fakeUserRepo{byIDs: map[string]*domainuser.User{}, byUsername: map[string]*domainuser.User{}}
	users.byIDs[authorID.String()] = newTestUser(t, "author")
	// perm 放行 tweet:delete-any
	svc := newCommentService(t, repo, comments, users, fakePermChecker{allowed: map[string]bool{PermDeleteAny: true}})

	c, err := domaintweet.NewComment(tweetID, authorID, "作者的评论")
	require.NoError(t, err)
	require.NoError(t, c.SetParent(nil))
	comments.byID[c.ID().String()] = c

	err = svc.DeleteComment(ctxWithUser(adminID.String(), "admin", false), c.ID().String())
	require.NoError(t, err, "持 tweet:delete-any 的管理员可删任意评论")
	assert.Contains(t, comments.deleted, c.ID())
}

func TestDeleteComment_BuiltinSuperAdmin(t *testing.T) {
	authorID := shared.NewID()
	saID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	svc, repo, comments, _ := setupCommentService(t, authorID)
	repo.findByIDData[tweetID.String()] = tweet

	c, err := domaintweet.NewComment(tweetID, authorID, "作者的评论")
	require.NoError(t, err)
	require.NoError(t, c.SetParent(nil))
	comments.byID[c.ID().String()] = c

	// 内置超管通配短路（perm 为 nil 也放行）
	err = svc.DeleteComment(ctxWithUser(saID.String(), "", true), c.ID().String())
	require.NoError(t, err)
}

func TestDeleteComment_NotFound(t *testing.T) {
	authorID := shared.NewID()
	svc, _, _, _ := setupCommentService(t, authorID)

	err := svc.DeleteComment(ctxWithUser(authorID.String(), "", false), shared.NewID().String())
	assert.ErrorIs(t, err, domaintweet.ErrCommentNotFound)
}

func TestListComments(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	svc, repo, comments, _ := setupCommentService(t, authorID)
	repo.findByIDData[tweetID.String()] = tweet

	var tops = make([]*domaintweet.Comment, 0, 3)
	for range 3 {
		c, err := domaintweet.NewComment(tweetID, authorID, "顶层")
		require.NoError(t, err)
		require.NoError(t, c.SetParent(nil))
		comments.byID[c.ID().String()] = c
		tops = append(tops, c)
	}
	// 给第一条顶层评论挂 2 条回复（含回复的回复，path 同挂该顶层）
	for _, body := range []string{"回复1", "回复2"} {
		r, err := domaintweet.NewComment(tweetID, authorID, body)
		require.NoError(t, err)
		require.NoError(t, r.SetParent(tops[0]))
		comments.byID[r.ID().String()] = r
	}

	dtos, total, err := svc.ListComments(context.Background(), tweetID.String(), 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
	assert.Len(t, dtos, 3)
	repliesCount := map[string]int64{}
	for _, d := range dtos {
		assert.Equal(t, int16(0), d.Depth)
		repliesCount[d.ID] = d.RepliesCount
	}
	assert.Equal(t, int64(2), repliesCount[tops[0].ID().String()], "有回复的顶层评论应返回回复数")
	assert.Equal(t, int64(0), repliesCount[tops[1].ID().String()], "无回复的顶层评论回复数应为 0")
}

func TestListReplies(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	svc, repo, comments, _ := setupCommentService(t, authorID)
	repo.findByIDData[tweetID.String()] = tweet

	top, err := domaintweet.NewComment(tweetID, authorID, "顶层")
	require.NoError(t, err)
	require.NoError(t, top.SetParent(nil))
	comments.byID[top.ID().String()] = top

	for range 2 {
		r, err := domaintweet.NewComment(tweetID, authorID, "回复")
		require.NoError(t, err)
		require.NoError(t, r.SetParent(top))
		comments.byID[r.ID().String()] = r
	}

	dtos, total, err := svc.ListReplies(context.Background(), top.ID().String(), 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	assert.Len(t, dtos, 2)
	for _, d := range dtos {
		assert.Equal(t, int16(1), d.Depth)
	}
}

func TestTweetDTO_CommentCount(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())

	svc, repo, comments, _ := setupCommentService(t, authorID)
	repo.findByIDData[tweetID.String()] = tweet
	comments.countByID[tweetID.String()] = 5

	dto, err := svc.GetByID(context.Background(), tweetID.String())
	require.NoError(t, err)
	assert.Equal(t, 5, dto.CommentCount, "详情应返回评论数")
}

// --- 评论表情 / 图片（issue 推文评论表情图片）---

// fakeEmojiLookup emote 查表替身：按名字返回固定 EmojiRef。
type fakeEmojiLookup struct {
	refs map[string]EmojiRef
}

func (f *fakeEmojiLookup) FindByNames(_ context.Context, names []string) (map[string]EmojiRef, error) {
	out := make(map[string]EmojiRef, len(names))
	for _, n := range names {
		if ref, ok := f.refs[n]; ok {
			out[n] = ref
		}
	}
	return out, nil
}

// newCommentCapabilityService 构造带 checker + emojiLookup 的 service（评论图片/表情用例）。
// users 预置 authorID 对应评论者，保证 commentsToDTOs 作者资料命中。
func newCommentCapabilityService(t *testing.T, repo *fakeTweetRepo, comments *fakeCommentRepo, authorID shared.ID, checker TweetImageChecker, lookup EmojiLookup) *Service {
	t.Helper()
	users := &fakeUserRepo{byIDs: map[string]*domainuser.User{}}
	uname, err := domainuser.ParseUsername("commenter")
	require.NoError(t, err)
	mail, err := domainuser.ParseEmail("commenter@example.com")
	require.NoError(t, err)
	u := domainuser.NewUser(authorID, mail, uname, domainuser.NewPasswordHash("x"))
	users.byIDs[authorID.String()] = u
	return NewService(repo, comments, users, checker, nil, lookup, appshared.NoopEventBus{})
}

func TestCreateComment_WithPictures_PassesOwnershipAndSaves(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())
	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{tweetID.String(): tweet}}
	comments := newFakeCommentRepo()
	checker := &fakeImageChecker{}
	svc := newCommentCapabilityService(t, repo, comments, authorID, checker, nil)

	pics := []domaintweet.Picture{
		{URL: "/uploads/comment/a.webp", Width: 100, Height: 200, Size: 1024},
	}
	dto, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "带图评论", Pictures: pics,
	})
	require.NoError(t, err)
	// 归属校验：URL 与作者透传给 upload 域端口
	assert.True(t, checker.called, "图片归属校验应执行")
	assert.Equal(t, []string{"/uploads/comment/a.webp"}, checker.gotURLs)
	assert.Equal(t, authorID, checker.gotOwner)
	// 落库与 DTO 均带 pictures
	require.Len(t, comments.saved, 1)
	assert.Equal(t, pics, comments.saved[0].Pictures())
	require.Len(t, dto.Pictures, 1)
	assert.Equal(t, "/uploads/comment/a.webp", dto.Pictures[0].URL)
	assert.Equal(t, int64(1024), dto.Pictures[0].Size)
}

func TestCreateComment_PicturesOwnershipRejected(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())
	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{tweetID.String(): tweet}}
	comments := newFakeCommentRepo()
	checker := &fakeImageChecker{err: shared.Forbidden("推文图片不存在或不属于当前用户")}
	svc := newCommentCapabilityService(t, repo, comments, authorID, checker, nil)

	_, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "盗图",
		Pictures: []domaintweet.Picture{{URL: "/uploads/other/x.webp"}},
	})
	assert.Error(t, err, "非本人上传的图片应被拒绝")
	assert.Empty(t, comments.saved, "校验失败不落库")
}

func TestCreateComment_PictureOnly(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())
	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{tweetID.String(): tweet}}
	comments := newFakeCommentRepo()
	checker := &fakeImageChecker{}
	svc := newCommentCapabilityService(t, repo, comments, authorID, checker, nil)

	dto, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "",
		Pictures: []domaintweet.Picture{{URL: "/uploads/comment/a.webp", Width: 1, Height: 1, Size: 1}},
	})
	require.NoError(t, err, "纯图评论应允许")
	assert.Equal(t, "", dto.Body)
	require.Len(t, dto.Pictures, 1)
	assert.Equal(t, "/uploads/comment/a.webp", dto.Pictures[0].URL)
	require.Len(t, comments.saved, 1)
	assert.Empty(t, comments.saved[0].Body())
}

func TestCreateComment_TooManyPictures(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())
	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{tweetID.String(): tweet}}
	comments := newFakeCommentRepo()
	svc := newCommentCapabilityService(t, repo, comments, authorID, &fakeImageChecker{}, nil)

	pics := make([]domaintweet.Picture, domaintweet.MaxCommentPictures+1)
	for i := range pics {
		pics[i] = domaintweet.Picture{URL: "/uploads/comment/x.webp"}
	}
	_, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "图太多", Pictures: pics,
	})
	assert.Error(t, err, "超过 10 张应被聚合根拒绝")
	assert.Empty(t, comments.saved)
}

func TestListComments_EmoteEnriched(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	comments := newFakeCommentRepo()
	lookup := &fakeEmojiLookup{refs: map[string]EmojiRef{
		"[doge]": {URL: "https://emoji/doge.png", GifURL: "https://emoji/doge.gif", Size: 2},
	}}

	// 种子：一条带 [doge] 占位符 + 附图的顶层评论
	c := domaintweet.ReconstructComment(shared.NewID(), tweetID, authorID,
		"[doge] 表情 + 图", []domaintweet.Picture{{URL: "/uploads/comment/a.webp", Width: 1, Height: 1, Size: 1}},
		nil, 0, shared.NewID().String()+"/", time.Now(), time.Now())
	comments.byID[c.ID().String()] = c

	svc := newCommentCapabilityService(t, &fakeTweetRepo{}, comments, authorID, nil, lookup)
	dtos, total, err := svc.ListComments(context.Background(), tweetID.String(), 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, dtos, 1)
	// emote 映射按 body 占位符富化
	require.Contains(t, dtos[0].Emote, "[doge]")
	assert.Equal(t, "https://emoji/doge.png", dtos[0].Emote["[doge]"].URL)
	assert.Equal(t, 2, dtos[0].Emote["[doge]"].Size)
	// pictures 透传
	require.Len(t, dtos[0].Pictures, 1)
	assert.Equal(t, "/uploads/comment/a.webp", dtos[0].Pictures[0].URL)
}

func TestCreateComment_EmoteEnriched(t *testing.T) {
	authorID := shared.NewID()
	tweetID := shared.NewID()
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "hi", nil, nil, 0, time.Now(), time.Now())
	repo := &fakeTweetRepo{findByIDData: map[string]*domaintweet.Tweet{tweetID.String(): tweet}}
	comments := newFakeCommentRepo()
	lookup := &fakeEmojiLookup{refs: map[string]EmojiRef{"[dog]": {URL: "https://emoji/dog.png"}}}
	svc := newCommentCapabilityService(t, repo, comments, authorID, &fakeImageChecker{}, lookup)

	dto, err := svc.CreateComment(ctxWithUser(authorID.String(), "", false), CreateCommentInput{
		TweetID: tweetID.String(), AuthorID: authorID.String(), Body: "[dog] 汪汪",
	})
	require.NoError(t, err)
	require.Contains(t, dto.Emote, "[dog]", "创建返回的单条 DTO 也应富化 emote")
	assert.Equal(t, "https://emoji/dog.png", dto.Emote["[dog]"].URL)
}

func TestTweet_EmoteEnriched(t *testing.T) {
	author := newTestUser(t, "author")
	authorID := author.GetID()
	lookup := &fakeEmojiLookup{refs: map[string]EmojiRef{
		"[doge]":         {URL: "https://emoji/doge.png", GifURL: "https://emoji/doge.gif", Size: 2},
		"[cat]":          {URL: "https://emoji/cat.png", Size: 1},
		"[mycat:uuid-1]": {URL: "https://emoji/mycat.png", CustomEmojiID: "uuid-1", Relation: "owned"},
	}}
	users := &fakeUserRepo{byIDs: map[string]*domainuser.User{authorID.String(): author}}

	quotedID := shared.NewID()
	quoted := domaintweet.ReconstructTweet(quotedID, authorID, "原推 [cat]", []string{}, nil, 0, time.Now(), time.Now())

	mainID := shared.NewID()
	mainTw := domaintweet.ReconstructTweet(mainID, authorID, "转推 [doge] [mycat:uuid-1]", []string{}, &quotedID, 0, time.Now(), time.Now())

	repo := &fakeTweetRepo{
		findByIDData: map[string]*domaintweet.Tweet{
			mainID.String():   mainTw,
			quotedID.String(): quoted,
		},
		tweets: []*domaintweet.Tweet{mainTw},
	}

	svc := NewService(repo, nil, users, nil, nil, lookup, appshared.NoopEventBus{})

	// 1. GetByID 富化
	dto, err := svc.GetByID(context.Background(), mainID.String())
	require.NoError(t, err)
	require.Contains(t, dto.Emote, "[doge]")
	assert.Equal(t, "https://emoji/doge.png", dto.Emote["[doge]"].URL)
	require.Contains(t, dto.Emote, "[mycat:uuid-1]")
	assert.Equal(t, "owned", dto.Emote["[mycat:uuid-1]"].Relation)
	assert.NotContains(t, dto.Emote, "[cat]", "主推文不包含未引用的 [cat]")
	require.NotNil(t, dto.QuotedTweet)
	require.Contains(t, dto.QuotedTweet.Emote, "[cat]")
	assert.Equal(t, "https://emoji/cat.png", dto.QuotedTweet.Emote["[cat]"].URL)

	// 2. ListTimeline 富化
	dtos, _, err := svc.ListTimeline(context.Background(), "", 10)
	require.NoError(t, err)
	require.Len(t, dtos, 1)
	require.Contains(t, dtos[0].Emote, "[doge]")
	require.NotNil(t, dtos[0].QuotedTweet)
	require.Contains(t, dtos[0].QuotedTweet.Emote, "[cat]")
}
