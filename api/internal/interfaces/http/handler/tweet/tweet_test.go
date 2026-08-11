// handler HTTP 层测试。
//
// Handler 持有具体 *apptweet.Service（非接口），故构造真实 Service、
// stub 其仓储依赖（同 subscription handler 测试模式）。
// 401（匿名写操作）由路由层 SessionAuth 保证，不在 handler 测试范围。
package tweet

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
	apptweet "blog-api/internal/application/tweet"
	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

// stubTweetRepo 内嵌接口保持编译通过，仅覆盖用到的查询方法。
type stubTweetRepo struct {
	domaintweet.TweetRepository
	timeline []*domaintweet.Tweet
	byID     map[string]*domaintweet.Tweet
	saved    []*domaintweet.Tweet
	deleted  []shared.ID
}

func (s *stubTweetRepo) Save(_ context.Context, tw *domaintweet.Tweet) error {
	s.saved = append(s.saved, tw)
	return nil
}

func (s *stubTweetRepo) FindByID(_ context.Context, id shared.ID) (*domaintweet.Tweet, error) {
	if tw, ok := s.byID[id.String()]; ok {
		return tw, nil
	}
	return nil, domaintweet.ErrNotFound
}
func (s *stubTweetRepo) FindByIDs(_ context.Context, ids []shared.ID) ([]*domaintweet.Tweet, error) {
	out := make([]*domaintweet.Tweet, 0, len(ids))
	for _, id := range ids {
		if tw, ok := s.byID[id.String()]; ok {
			out = append(out, tw)
		}
	}
	return out, nil
}

func (s *stubTweetRepo) FindTimeline(_ context.Context, _ *domaintweet.Cursor, _ int) ([]*domaintweet.Tweet, error) {
	return s.timeline, nil
}
func (s *stubTweetRepo) FindByTopic(_ context.Context, _ string, _ *domaintweet.Cursor, _ int) ([]*domaintweet.Tweet, error) {
	return s.timeline, nil
}
func (s *stubTweetRepo) CountQuotesByTweetIDs(_ context.Context, _ []shared.ID) (map[string]int64, error) {
	return map[string]int64{}, nil
}

func (s *stubTweetRepo) Delete(_ context.Context, id shared.ID) error {
	s.deleted = append(s.deleted, id)
	return nil
}
func (s *stubTweetRepo) Like(_ context.Context, _, _ shared.ID) error { return nil }
func (s *stubTweetRepo) Unlike(_ context.Context, _, _ shared.ID) error { return nil }
func (s *stubTweetRepo) IsLiked(_ context.Context, _, _ shared.ID) (bool, error) { return false, nil }
func (s *stubTweetRepo) FindLikedTweetIDs(_ context.Context, _ shared.ID, _ []shared.ID) (map[string]bool, error) { return map[string]bool{}, nil }

// stubUserRepo 只覆盖 FindByIDs（作者资料填充）。
type stubUserRepo struct {
	domainuser.UserRepository
	users map[string]*domainuser.User
}

func (s *stubUserRepo) FindByIDs(_ context.Context, ids []shared.ID) ([]*domainuser.User, error) {
	out := make([]*domainuser.User, 0, len(ids))
	for _, id := range ids {
		if u, ok := s.users[id.String()]; ok {
			out = append(out, u)
		}
	}
	return out, nil
}
func (s *stubUserRepo) FindByUsername(_ context.Context, username domainuser.Username) (*domainuser.User, error) {
	for _, u := range s.users {
		if u.Username().String() == username.String() {
			return u, nil
		}
	}
	return nil, domainuser.ErrNotFound
}

// stubCommentRepo 推文评论仓储 stub，内嵌接口保持编译通过，覆盖用到的方法。
type stubCommentRepo struct {
	domaintweet.CommentRepository
	byID    map[string]*domaintweet.Comment
	saved   []*domaintweet.Comment
	deleted []shared.ID
	counts  map[string]int64 // tweetID -> count
}

func newStubCommentRepo() *stubCommentRepo {
	return &stubCommentRepo{byID: map[string]*domaintweet.Comment{}, counts: map[string]int64{}}
}

func (s *stubCommentRepo) Save(_ context.Context, c *domaintweet.Comment) error {
	s.byID[c.ID().String()] = c
	s.saved = append(s.saved, c)
	return nil
}

func (s *stubCommentRepo) FindByID(_ context.Context, id shared.ID) (*domaintweet.Comment, error) {
	if c, ok := s.byID[id.String()]; ok {
		return c, nil
	}
	return nil, domaintweet.ErrCommentNotFound
}

func (s *stubCommentRepo) FindByTweet(_ context.Context, tweetID shared.ID, _, _ int) ([]*domaintweet.Comment, int64, error) {
	var tops []*domaintweet.Comment
	for _, c := range s.byID {
		if c.TweetID() == tweetID && c.Depth() == 0 {
			tops = append(tops, c)
		}
	}
	return tops, int64(len(tops)), nil
}

func (s *stubCommentRepo) FindReplies(_ context.Context, parentID shared.ID, _, _ int) ([]*domaintweet.Comment, int64, error) {
	parent, ok := s.byID[parentID.String()]
	if !ok {
		return nil, 0, domaintweet.ErrCommentNotFound
	}
	prefix := parent.ID().String() + "/"
	var reps []*domaintweet.Comment
	for _, c := range s.byID {
		if c.Depth() == 1 && len(c.Path()) > len(prefix) && c.Path()[:len(prefix)] == prefix {
			reps = append(reps, c)
		}
	}
	return reps, int64(len(reps)), nil
}

func (s *stubCommentRepo) CountByTweet(_ context.Context, tweetID shared.ID) (int64, error) {
	return s.counts[tweetID.String()], nil
}

func (s *stubCommentRepo) CountByTweetIDs(_ context.Context, ids []shared.ID) (map[string]int64, error) {
	res := make(map[string]int64, len(ids))
	for _, id := range ids {
		res[id.String()] = s.counts[id.String()]
	}
	return res, nil
}

func (s *stubCommentRepo) CountRepliesByParents(_ context.Context, parentIDs []shared.ID) (map[string]int64, error) {
	res := make(map[string]int64, len(parentIDs))
	for _, pid := range parentIDs {
		prefix := pid.String() + "/"
		for _, c := range s.byID {
			if c.Depth() == 1 && len(c.Path()) > len(prefix) && c.Path()[:len(prefix)] == prefix {
				res[pid.String()]++
			}
		}
	}
	return res, nil
}

func (s *stubCommentRepo) Delete(_ context.Context, id shared.ID) error {
	if _, ok := s.byID[id.String()]; !ok {
		return domaintweet.ErrCommentNotFound
	}
	delete(s.byID, id.String())
	s.deleted = append(s.deleted, id)
	return nil
}

var (
	authorID   = shared.MustParseID("00000000-0000-0000-0000-0000000000aa")
	sampleTime = time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)
)

func sampleTweet() *domaintweet.Tweet {
	return domaintweet.ReconstructTweet(
		shared.MustParseID("00000000-0000-0000-0000-000000000001"),
		authorID, "示例推文", []string{}, nil, 0, sampleTime, sampleTime,
	)
}

func newTestHandler(repo *stubTweetRepo) *Handler {
	users := &stubUserRepo{users: map[string]*domainuser.User{}}
	uname, _ := domainuser.ParseUsername("alice")
	email, _ := domainuser.ParseEmail("alice@example.com")
	users.users[authorID.String()] = domainuser.NewUser(authorID, email, uname, domainuser.NewPasswordHash("x"))
	svc := apptweet.NewService(repo, nil, users, nil, nil, nil, appshared.NoopEventBus{})
	return NewHandler(svc)
}

// newCommentTestHandler 构造带评论仓储的 handler（评论 handler 测试用）。
func newCommentTestHandler(repo *stubTweetRepo, comments *stubCommentRepo) *Handler {
	users := &stubUserRepo{users: map[string]*domainuser.User{}}
	uname, _ := domainuser.ParseUsername("alice")
	email, _ := domainuser.ParseEmail("alice@example.com")
	users.users[authorID.String()] = domainuser.NewUser(authorID, email, uname, domainuser.NewPasswordHash("x"))
	svc := apptweet.NewService(repo, comments, users, nil, nil, nil, appshared.NoopEventBus{})
	return NewHandler(svc)
}

// withIdentity 给请求注入 session 中间件同款身份上下文。
func withIdentity(r *http.Request, userID string) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID)
	return r.WithContext(ctx)
}

func TestListTimeline_OK(t *testing.T) {
	repo := &stubTweetRepo{timeline: []*domaintweet.Tweet{sampleTweet()}}
	h := newTestHandler(repo)

	req := httptest.NewRequest(http.MethodGet, "/tweets?limit=10", nil)
	rr := httptest.NewRecorder()
	h.ListTimeline(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	var body struct {
		Data []struct {
			ID      string `json:"id"`
			Content string `json:"content"`
			Author  struct {
				Username string `json:"username"`
			} `json:"author"`
		} `json:"data"`
		Meta struct {
			Pagination struct {
				Limit      int    `json:"limit"`
				HasMore    bool   `json:"has_more"`
				NextCursor string `json:"next_cursor"`
			} `json:"pagination"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	require.Len(t, body.Data, 1)
	assert.Equal(t, "示例推文", body.Data[0].Content)
	assert.Equal(t, "alice", body.Data[0].Author.Username)
	assert.Equal(t, 10, body.Meta.Pagination.Limit)
	assert.False(t, body.Meta.Pagination.HasMore)
}
func TestListByTopic_OK(t *testing.T) {
	repo := &stubTweetRepo{timeline: []*domaintweet.Tweet{sampleTweet()}}
	h := newTestHandler(repo)

	req := httptest.NewRequest(http.MethodGet, "/tweets/topics/Golang?limit=10", nil)
	req.SetPathValue("tag", "Golang")
	rr := httptest.NewRecorder()
	h.ListByTopic(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestGet_NotFound(t *testing.T) {
	h := newTestHandler(&stubTweetRepo{})

	req := httptest.NewRequest(http.MethodGet, "/tweets/x", nil)
	req.SetPathValue("id", shared.NewID().String())
	rr := httptest.NewRecorder()
	h.Get(rr, req)

	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestGet_BadID(t *testing.T) {
	h := newTestHandler(&stubTweetRepo{})

	req := httptest.NewRequest(http.MethodGet, "/tweets/bad", nil)
	req.SetPathValue("id", "not-a-uuid")
	rr := httptest.NewRecorder()
	h.Get(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestCreate_OK(t *testing.T) {
	repo := &stubTweetRepo{}
	h := newTestHandler(repo)

	req := httptest.NewRequest(http.MethodPost, "/tweets",
		bytes.NewBufferString(`{"content":"hello"}`))
	req.Header.Set("Content-Type", "application/json")
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.Create(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
	require.Len(t, repo.saved, 1)
	assert.Equal(t, authorID, repo.saved[0].AuthorID(), "作者应取自 session 身份而非请求体")
}

func TestCreate_DomainRejected(t *testing.T) {
	repo := &stubTweetRepo{}
	h := newTestHandler(repo)

	// 空内容 + 空图片 → 聚合根拒绝 → 400
	req := httptest.NewRequest(http.MethodPost, "/tweets", bytes.NewBufferString(`{"content":""}`))
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.Create(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Empty(t, repo.saved)
}

func TestDelete_ForbiddenForNonAuthor(t *testing.T) {
	tw := sampleTweet()
	repo := &stubTweetRepo{byID: map[string]*domaintweet.Tweet{tw.ID().String(): tw}}
	h := newTestHandler(repo)

	// 非作者、无权限码（service perm=nil 仅放行作者）→ 403
	req := httptest.NewRequest(http.MethodDelete, "/tweets/x", nil)
	req.SetPathValue("id", tw.ID().String())
	req = withIdentity(req, shared.NewID().String())
	rr := httptest.NewRecorder()
	h.Delete(rr, req)

	assert.Equal(t, http.StatusForbidden, rr.Code)
	assert.Empty(t, repo.deleted)
}

func TestDelete_OKForAuthor(t *testing.T) {
	tw := sampleTweet()
	repo := &stubTweetRepo{byID: map[string]*domaintweet.Tweet{tw.ID().String(): tw}}
	h := newTestHandler(repo)

	req := httptest.NewRequest(http.MethodDelete, "/tweets/x", nil)
	req.SetPathValue("id", tw.ID().String())
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.Delete(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	require.Len(t, repo.deleted, 1)
}
func TestGetUserProfile_OK(t *testing.T) {
	h := newTestHandler(&stubTweetRepo{})
	req := httptest.NewRequest(http.MethodGet, "/users/alice", nil)
	req.SetPathValue("username", "alice")
	rr := httptest.NewRecorder()
	h.GetUserProfile(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	var body struct {
		Data struct {
			Username string `json:"username"`
		} `json:"data"`
	}
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
	assert.Equal(t, "alice", body.Data.Username)
}

func TestGetUserProfile_NotFound(t *testing.T) {
	h := newTestHandler(&stubTweetRepo{})
	req := httptest.NewRequest(http.MethodGet, "/users/ghost", nil)
	req.SetPathValue("username", "ghost")
	rr := httptest.NewRecorder()
	h.GetUserProfile(rr, req)

	assert.Equal(t, http.StatusNotFound, rr.Code)
}
func TestLike_OK(t *testing.T) {
	h := newTestHandler(&stubTweetRepo{})
	req := httptest.NewRequest(http.MethodPost, "/tweets/00000000-0000-0000-0000-000000000001/like", nil)
	req.SetPathValue("id", "00000000-0000-0000-0000-000000000001")
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.Like(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestUnlike_OK(t *testing.T) {
	h := newTestHandler(&stubTweetRepo{})
	req := httptest.NewRequest(http.MethodDelete, "/tweets/00000000-0000-0000-0000-000000000001/like", nil)
	req.SetPathValue("id", "00000000-0000-0000-0000-000000000001")
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.Unlike(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

// --- 推文评论 handler 测试 ---

func TestCreateComment_OK(t *testing.T) {
	repo := &stubTweetRepo{byID: map[string]*domaintweet.Tweet{sampleTweet().ID().String(): sampleTweet()}}
	comments := newStubCommentRepo()
	h := newCommentTestHandler(repo, comments)

	req := httptest.NewRequest(http.MethodPost, "/tweets/x/comments",
		bytes.NewBufferString(`{"body":"好文"}`))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", sampleTweet().ID().String())
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.CreateComment(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
	require.Len(t, comments.saved, 1)
	assert.Equal(t, "好文", comments.saved[0].Body())
}

func TestCreateComment_WithPictures_PassedToService(t *testing.T) {
	repo := &stubTweetRepo{byID: map[string]*domaintweet.Tweet{sampleTweet().ID().String(): sampleTweet()}}
	comments := newStubCommentRepo()
	h := newCommentTestHandler(repo, comments)

	body := `{"body":"带图","pictures":[{"url":"/uploads/comment/a.webp","width":100,"height":200,"size":1024}]}`
	req := httptest.NewRequest(http.MethodPost, "/tweets/x/comments", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", sampleTweet().ID().String())
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.CreateComment(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
	require.Len(t, comments.saved, 1)
	require.Len(t, comments.saved[0].Pictures(), 1)
	assert.Equal(t, "/uploads/comment/a.webp", comments.saved[0].Pictures()[0].URL)
	assert.Equal(t, 100, comments.saved[0].Pictures()[0].Width)
	assert.Equal(t, int64(1024), comments.saved[0].Pictures()[0].Size)
}

func TestCreateComment_EmptyBody(t *testing.T) {
	repo := &stubTweetRepo{byID: map[string]*domaintweet.Tweet{sampleTweet().ID().String(): sampleTweet()}}
	h := newCommentTestHandler(repo, newStubCommentRepo())

	req := httptest.NewRequest(http.MethodPost, "/tweets/x/comments",
		bytes.NewBufferString(`{"body":"  "}`))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", sampleTweet().ID().String())
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.CreateComment(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestCreateComment_TweetNotFound(t *testing.T) {
	h := newCommentTestHandler(&stubTweetRepo{}, newStubCommentRepo())

	req := httptest.NewRequest(http.MethodPost, "/tweets/x/comments",
		bytes.NewBufferString(`{"body":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", shared.NewID().String())
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.CreateComment(rr, req)

	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestCreateComment_Reply(t *testing.T) {
	repo := &stubTweetRepo{byID: map[string]*domaintweet.Tweet{sampleTweet().ID().String(): sampleTweet()}}
	comments := newStubCommentRepo()
	h := newCommentTestHandler(repo, comments)

	// 先造顶层评论作为 parent
	top, err := domaintweet.NewComment(sampleTweet().ID(), authorID, "顶层")
	require.NoError(t, err)
	require.NoError(t, top.SetParent(nil))
	comments.byID[top.ID().String()] = top

	req := httptest.NewRequest(http.MethodPost, "/tweets/x/comments",
		bytes.NewBufferString(`{"body":"回复","parent_id":"`+top.ID().String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", sampleTweet().ID().String())
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.CreateComment(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
	require.Len(t, comments.saved, 1)
	assert.Equal(t, int16(1), comments.saved[0].Depth())
}

func TestListComments_OK(t *testing.T) {
	repo := &stubTweetRepo{}
	comments := newStubCommentRepo()
	for range 2 {
		c, err := domaintweet.NewComment(sampleTweet().ID(), authorID, "顶层")
		require.NoError(t, err)
		require.NoError(t, c.SetParent(nil))
		comments.byID[c.ID().String()] = c
	}
	h := newCommentTestHandler(repo, comments)

	req := httptest.NewRequest(http.MethodGet, "/tweets/x/comments?page=1&limit=10", nil)
	req.SetPathValue("id", sampleTweet().ID().String())
	rr := httptest.NewRecorder()
	h.ListComments(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	var body struct {
		Data []struct {
			Body  string `json:"body"`
			Depth int16  `json:"depth"`
		} `json:"data"`
		Meta struct {
			Pagination struct {
				Total int64 `json:"total"`
			} `json:"pagination"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	assert.Len(t, body.Data, 2)
	assert.Equal(t, int64(2), body.Meta.Pagination.Total)
}

func TestListComments_BadID(t *testing.T) {
	h := newCommentTestHandler(&stubTweetRepo{}, newStubCommentRepo())

	req := httptest.NewRequest(http.MethodGet, "/tweets/x/comments", nil)
	req.SetPathValue("id", "not-a-uuid")
	rr := httptest.NewRecorder()
	h.ListComments(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestDeleteComment_Author(t *testing.T) {
	repo := &stubTweetRepo{}
	comments := newStubCommentRepo()
	c, err := domaintweet.NewComment(sampleTweet().ID(), authorID, "我的评论")
	require.NoError(t, err)
	require.NoError(t, c.SetParent(nil))
	comments.byID[c.ID().String()] = c
	h := newCommentTestHandler(repo, comments)

	req := httptest.NewRequest(http.MethodDelete, "/tweets/x/comments/y", nil)
	req.SetPathValue("commentId", c.ID().String())
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.DeleteComment(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, comments.deleted, c.ID())
}

func TestDeleteComment_NotFound(t *testing.T) {
	h := newCommentTestHandler(&stubTweetRepo{}, newStubCommentRepo())

	req := httptest.NewRequest(http.MethodDelete, "/tweets/x/comments/y", nil)
	req.SetPathValue("commentId", shared.NewID().String())
	req = withIdentity(req, authorID.String())
	rr := httptest.NewRecorder()
	h.DeleteComment(rr, req)

	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestListReplies_OK(t *testing.T) {
	repo := &stubTweetRepo{}
	comments := newStubCommentRepo()
	top, err := domaintweet.NewComment(sampleTweet().ID(), authorID, "顶层")
	require.NoError(t, err)
	require.NoError(t, top.SetParent(nil))
	comments.byID[top.ID().String()] = top
	for range 2 {
		r, err := domaintweet.NewComment(sampleTweet().ID(), authorID, "回复")
		require.NoError(t, err)
		require.NoError(t, r.SetParent(top))
		comments.byID[r.ID().String()] = r
	}
	h := newCommentTestHandler(repo, comments)

	req := httptest.NewRequest(http.MethodGet, "/tweets/x/comments/y/replies?page=1&limit=10", nil)
	req.SetPathValue("commentId", top.ID().String())
	rr := httptest.NewRecorder()
	h.ListReplies(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	var body struct {
		Data []struct {
			Depth int16 `json:"depth"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	assert.Len(t, body.Data, 2)
	for _, d := range body.Data {
		assert.Equal(t, int16(1), d.Depth)
	}
}
