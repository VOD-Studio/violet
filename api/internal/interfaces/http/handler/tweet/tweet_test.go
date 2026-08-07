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

func (s *stubTweetRepo) FindTimeline(_ context.Context, _ *domaintweet.Cursor, _ int) ([]*domaintweet.Tweet, error) {
	return s.timeline, nil
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

var (
	authorID   = shared.MustParseID("00000000-0000-0000-0000-0000000000aa")
	sampleTime = time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)
)

func sampleTweet() *domaintweet.Tweet {
	return domaintweet.ReconstructTweet(
		shared.MustParseID("00000000-0000-0000-0000-000000000001"),
		authorID, "示例推文", []string{}, 0, sampleTime, sampleTime,
	)
}

func newTestHandler(repo *stubTweetRepo) *Handler {
	users := &stubUserRepo{users: map[string]*domainuser.User{}}
	uname, _ := domainuser.ParseUsername("alice")
	email, _ := domainuser.ParseEmail("alice@example.com")
	users.users[authorID.String()] = domainuser.NewUser(authorID, email, uname, domainuser.NewPasswordHash("x"))
	svc := apptweet.NewService(repo, users, nil, nil, appshared.NoopEventBus{})
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
