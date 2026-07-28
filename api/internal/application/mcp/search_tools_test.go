package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainapitoken "blog-api/internal/domain/api_token"
	apppost "blog-api/internal/application/post"
	"blog-api/internal/domain/shared"
)

// fakeSearchService 内存版检索服务，记录被调参数。seam #2：不依赖 DB。
type fakeSearchService struct {
	postsRes *apppost.SearchPostsResult
	formRes  *apppost.SearchFormulasResult
	codeRes  *apppost.SearchCodeBlocksResult
	err      error

	gotAuthorID shared.ID
	gotQuery    string
	gotStatus   string
	gotLang     string
	gotRunnable bool
	gotLimit    int
	gotOffset   int
}

func (f *fakeSearchService) SearchPosts(_ context.Context, authorID shared.ID, query, status string, limit, offset int) (*apppost.SearchPostsResult, error) {
	f.gotAuthorID, f.gotQuery, f.gotStatus, f.gotLimit, f.gotOffset = authorID, query, status, limit, offset
	return f.postsRes, f.err
}

func (f *fakeSearchService) SearchFormulas(_ context.Context, authorID shared.ID, query string, limit, offset int) (*apppost.SearchFormulasResult, error) {
	f.gotAuthorID, f.gotQuery, f.gotLimit, f.gotOffset = authorID, query, limit, offset
	return f.formRes, f.err
}

func (f *fakeSearchService) SearchCodeBlocks(_ context.Context, authorID shared.ID, query, lang string, runnableOnly bool, limit, offset int) (*apppost.SearchCodeBlocksResult, error) {
	f.gotAuthorID, f.gotQuery, f.gotLang, f.gotRunnable, f.gotLimit, f.gotOffset = authorID, query, lang, runnableOnly, limit, offset
	return f.codeRes, f.err
}

// uuidUser 返回一个合法 UUID 用户 ID 字符串（PAT UserID 形态）。
func uuidUser() string { return shared.NewID().String() }

func onePostResult() *apppost.SearchPostsResult {
	return &apppost.SearchPostsResult{
		Posts:      []apppost.SearchPostItem{{ID: "p1", Title: "量子", Snippet: "…量子…"}},
		TotalCount: 1, HasMore: false, NextOffset: 1,
	}
}

// ---- search_posts ----

func TestSearchPosts_DelegatesWithReadScope(t *testing.T) {
	fake := &fakeSearchService{postsRes: onePostResult()}
	tools := NewSearchTools(fake)
	uid := uuidUser()

	res, _, err := tools.SearchPosts(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, uid), searchPostsArgs{Query: "量子"})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, uid, fake.gotAuthorID.String(), "authorID 应为 PAT 持有人")
	assert.Equal(t, "量子", fake.gotQuery)
	assert.Equal(t, "all", fake.gotStatus, "status 缺省应为 all")
	assert.Equal(t, 20, fake.gotLimit, "limit 缺省应为 20")
	assert.Equal(t, 0, fake.gotOffset)

	var out apppost.SearchPostsResult
	require.NoError(t, json.Unmarshal([]byte(resultText(t, res)), &out))
	assert.Equal(t, int64(1), out.TotalCount)
}

func TestSearchPosts_RejectedWithoutReadScope(t *testing.T) {
	fake := &fakeSearchService{err: errors.New("不应被调")}
	tools := NewSearchTools(fake)

	res, _, _ := tools.SearchPosts(context.Background(),
		reqWithToken(nil, uuidUser()), searchPostsArgs{Query: "量子"})
	assert.True(t, res.IsError)
	assert.Empty(t, fake.gotQuery)
}

func TestSearchPosts_EmptyQueryIsToolError(t *testing.T) {
	fake := &fakeSearchService{}
	tools := NewSearchTools(fake)

	res, _, _ := tools.SearchPosts(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, uuidUser()), searchPostsArgs{})
	assert.True(t, res.IsError)
	assert.Contains(t, resultText(t, res), "query 不能为空")
}

func TestSearchPosts_InvalidStatusIsToolError(t *testing.T) {
	fake := &fakeSearchService{}
	tools := NewSearchTools(fake)

	res, _, _ := tools.SearchPosts(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, uuidUser()),
		searchPostsArgs{Query: "x", Status: "deleted"})
	assert.True(t, res.IsError)
	assert.Contains(t, resultText(t, res), "status 必须是")
}

func TestSearchPosts_LimitClamped(t *testing.T) {
	fake := &fakeSearchService{postsRes: onePostResult()}
	tools := NewSearchTools(fake)
	req := reqWithToken([]string{domainapitoken.ScopePostsRead}, uuidUser())

	_, _, _ = tools.SearchPosts(context.Background(), req, searchPostsArgs{Query: "x", Limit: 100, Offset: -5})
	assert.Equal(t, 50, fake.gotLimit, "limit 超上限应钳制到 50")
	assert.Equal(t, 0, fake.gotOffset, "负 offset 应归零")
}

func TestSearchPosts_EmptyResultGivesHint(t *testing.T) {
	fake := &fakeSearchService{postsRes: &apppost.SearchPostsResult{Posts: nil, TotalCount: 0}}
	tools := NewSearchTools(fake)

	res, _, err := tools.SearchPosts(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, uuidUser()), searchPostsArgs{Query: "量子"})
	require.NoError(t, err)
	assert.False(t, res.IsError, "空结果不是错误，是可操作提示")
	assert.Contains(t, resultText(t, res), "未找到匹配")
	assert.Contains(t, resultText(t, res), "建议")
}

func TestSearchPosts_EmptyPageBeyondOffsetReturnsJSON(t *testing.T) {
	// 翻页后的空页是正常分页终止，不应返回提示文案
	fake := &fakeSearchService{postsRes: &apppost.SearchPostsResult{Posts: nil, TotalCount: 3}}
	tools := NewSearchTools(fake)

	res, _, _ := tools.SearchPosts(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, uuidUser()),
		searchPostsArgs{Query: "x", Offset: 40})
	assert.False(t, res.IsError)
	var out apppost.SearchPostsResult
	require.NoError(t, json.Unmarshal([]byte(resultText(t, res)), &out))
	assert.Equal(t, int64(3), out.TotalCount)
}

func TestSearchPosts_ServiceErrorBecomesToolError(t *testing.T) {
	fake := &fakeSearchService{err: errors.New("DB down")}
	tools := NewSearchTools(fake)

	res, _, err := tools.SearchPosts(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, uuidUser()), searchPostsArgs{Query: "x"})
	require.NoError(t, err, "service error 不应作为 protocol error 返回")
	assert.True(t, res.IsError)
}

// ---- search_formulas ----

func TestSearchFormulas_DelegatesWithReadScope(t *testing.T) {
	fake := &fakeSearchService{formRes: &apppost.SearchFormulasResult{
		Formulas: []apppost.SearchFormulaItem{{Latex: "\\frac{1}{2}", DisplayMode: "block"}},
		TotalCount: 1,
	}}
	tools := NewSearchTools(fake)
	uid := uuidUser()

	res, _, err := tools.SearchFormulas(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, uid), searchFormulasArgs{Query: "\\frac"})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, uid, fake.gotAuthorID.String())
	assert.Equal(t, "\\frac", fake.gotQuery)
	assert.Equal(t, 20, fake.gotLimit)
}

func TestSearchFormulas_RejectedWithoutReadScope(t *testing.T) {
	fake := &fakeSearchService{}
	tools := NewSearchTools(fake)

	res, _, _ := tools.SearchFormulas(context.Background(),
		reqWithToken(nil, uuidUser()), searchFormulasArgs{Query: "\\frac"})
	assert.True(t, res.IsError)
}

func TestSearchFormulas_EmptyQueryIsToolError(t *testing.T) {
	fake := &fakeSearchService{}
	tools := NewSearchTools(fake)

	res, _, _ := tools.SearchFormulas(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, uuidUser()), searchFormulasArgs{})
	assert.True(t, res.IsError)
	assert.Contains(t, resultText(t, res), "LaTeX")
}

// ---- search_code_blocks ----

func TestSearchCodeBlocks_DelegatesWithReadScope(t *testing.T) {
	fake := &fakeSearchService{codeRes: &apppost.SearchCodeBlocksResult{
		CodeBlocks: []apppost.SearchCodeBlockItem{{Lang: "python", Runnable: true, Code: "print(1)"}},
		TotalCount: 1,
	}}
	tools := NewSearchTools(fake)

	res, _, err := tools.SearchCodeBlocks(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, uuidUser()),
		searchCodeBlocksArgs{Query: "print", Lang: "python", RunnableOnly: true})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "print", fake.gotQuery)
	assert.Equal(t, "python", fake.gotLang)
	assert.True(t, fake.gotRunnable)
}

func TestSearchCodeBlocks_RejectedWithoutReadScope(t *testing.T) {
	fake := &fakeSearchService{}
	tools := NewSearchTools(fake)

	res, _, _ := tools.SearchCodeBlocks(context.Background(),
		reqWithToken(nil, uuidUser()), searchCodeBlocksArgs{})
	assert.True(t, res.IsError)
}

func TestSearchCodeBlocks_InvalidLangIsToolError(t *testing.T) {
	fake := &fakeSearchService{}
	tools := NewSearchTools(fake)

	res, _, _ := tools.SearchCodeBlocks(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, uuidUser()),
		searchCodeBlocksArgs{Lang: "c++"})
	assert.True(t, res.IsError)
	assert.Contains(t, resultText(t, res), "lang 必须是")
}

func TestSearchCodeBlocks_LangDefaultsToAll(t *testing.T) {
	fake := &fakeSearchService{codeRes: &apppost.SearchCodeBlocksResult{}}
	tools := NewSearchTools(fake)

	_, _, _ = tools.SearchCodeBlocks(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, uuidUser()), searchCodeBlocksArgs{})
	assert.Equal(t, "all", fake.gotLang)
}
