package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	domainapitoken "blog-api/internal/domain/api_token"
)

// fakeTokenLookup 内存版 TokenLookup，避免依赖 DB。
// done 在 TouchLastUsed 被调用后关闭，供测试等待异步刷新完成（避免竞态）。
type fakeTokenLookup struct {
	tokens   map[string]*domainapitoken.PAT // key = token hash
	touched  bool
	touchErr error
	done     chan struct{}
	mu       sync.Mutex
}

func (f *fakeTokenLookup) FindByHash(_ context.Context, hash string) (*domainapitoken.PAT, error) {
	p, ok := f.tokens[hash]
	if !ok {
		return nil, domainapitoken.ErrNotFound
	}
	return p, nil
}

func (f *fakeTokenLookup) TouchLastUsed(_ context.Context, id string, now time.Time) error {
	f.mu.Lock()
	f.touched = true
	if f.done != nil {
		close(f.done)
	}
	f.mu.Unlock()
	return f.touchErr
}

// makePAT 构造测试用 PAT（固定哈希便于查找）。
func makePAT(hash string, scopes []string, expiresAt time.Time) *domainapitoken.PAT {
	return domainapitoken.Reconstruct("tok-1", "u-1", "测试", hash, scopes, expiresAt, time.Now(), time.Now())
}

func reqWithBearer(token string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/mcp", nil)
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	return r
}

// TestTokenAuth_ValidBearerAuthorizes 有效 Bearer → 注入 ctx（user_id+scopes）+ 下游被调用 + TouchLastUsed。
func TestTokenAuth_ValidBearerAuthorizes(t *testing.T) {
	const plain = "mimo_pat_valid123"
	hash := domainapitoken.HashToken(plain)
	lookup := &fakeTokenLookup{
		tokens: map[string]*domainapitoken.PAT{
			hash: makePAT(hash, []string{domainapitoken.ScopePostsRead, domainapitoken.ScopePostsWrite}, time.Time{}),
		},
		done: make(chan struct{}),
	}
	called := false
	var gotUserID string
	var gotScopes []string
	h := TokenAuth(lookup)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		gotUserID = GetUserID(r.Context())
		gotScopes = GetTokenScopes(r.Context())
	}))
	h.ServeHTTP(httptest.NewRecorder(), reqWithBearer(plain))
	assert.True(t, called, "有效 token 应放行下游")
	assert.Equal(t, "u-1", gotUserID, "应注入 user_id")
	assert.Equal(t, []string{domainapitoken.ScopePostsRead, domainapitoken.ScopePostsWrite}, gotScopes, "应注入 scopes")
	// 异步刷新：等待 done channel 再断言，避免竞态
	<-lookup.done
	assert.True(t, lookup.touched, "应刷新 last_used_at")
}

func TestTokenAuth_MissingBearerReturns401(t *testing.T) {
	lookup := &fakeTokenLookup{}
	called := false
	h := TokenAuth(lookup)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, reqWithBearer(""))
	assert.False(t, called, "无 Bearer 应不调用下游")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestTokenAuth_InvalidBearerReturns401(t *testing.T) {
	lookup := &fakeTokenLookup{tokens: map[string]*domainapitoken.PAT{}}
	called := false
	h := TokenAuth(lookup)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, reqWithBearer("mimo_pat_unknown"))
	assert.False(t, called, "未知 token 应不调用下游")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestTokenAuth_ExpiredBearerReturns401(t *testing.T) {
	const plain = "mimo_pat_expired"
	hash := domainapitoken.HashToken(plain)
	pastExpiry := time.Now().Add(-time.Hour)
	lookup := &fakeTokenLookup{
		tokens: map[string]*domainapitoken.PAT{
			hash: makePAT(hash, []string{domainapitoken.ScopePostsRead}, pastExpiry),
		},
	}
	called := false
	h := TokenAuth(lookup)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, reqWithBearer(plain))
	assert.False(t, called, "过期 token 应不调用下游")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
