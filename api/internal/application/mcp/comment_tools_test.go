package mcp

import (
	"context"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appcomment "blog-api/internal/application/comment"
	domainapitoken "blog-api/internal/domain/api_token"
	domaincomment "blog-api/internal/domain/comment"
)

// textOf 提取 CallToolResult 首条内容的文本（okResult/errResult 都是 TextContent）。
func textOf(t *testing.T, res *mcp.CallToolResult) string {
	t.Helper()
	tc, ok := res.Content[0].(*mcp.TextContent)
	require.True(t, ok, "首条 Content 应为 *TextContent")
	return tc.Text
}

// fakeCommentSearchService 内存版评论检索服务，记录被调参数。seam #2：不依赖 DB。
type fakeCommentSearchService struct {
	searchRes *appcomment.SearchCommentsResult
	statsRes  *appcomment.CommentStatsResult
	err       error

	gotQuery        string
	gotAnchorFilter domaincomment.AnchorFilter
	gotLimit        int
	gotOffset       int
}

func (f *fakeCommentSearchService) SearchComments(_ context.Context, query string, af domaincomment.AnchorFilter, limit, offset int) (*appcomment.SearchCommentsResult, error) {
	f.gotQuery, f.gotAnchorFilter, f.gotLimit, f.gotOffset = query, af, limit, offset
	return f.searchRes, f.err
}

func (f *fakeCommentSearchService) ListRecentComments(_ context.Context, af domaincomment.AnchorFilter, limit, offset int) (*appcomment.SearchCommentsResult, error) {
	f.gotAnchorFilter, f.gotLimit, f.gotOffset = af, limit, offset
	return f.searchRes, f.err
}

func (f *fakeCommentSearchService) CommentStats(_ context.Context) (*appcomment.CommentStatsResult, error) {
	return f.statsRes, f.err
}

func oneCommentResult() *appcomment.SearchCommentsResult {
	return &appcomment.SearchCommentsResult{
		Comments: []appcomment.AdminCommentDTO{{PostTitle: "T", CommentDTO: appcomment.CommentDTO{Body: "反馈"}}},
	}
}

// ---- search_comments ----

func TestSearchComments_DelegatesWithReadScope(t *testing.T) {
	svc := &fakeCommentSearchService{searchRes: oneCommentResult()}
	tools := NewCommentTools(svc)

	res, _, err := tools.SearchComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()), searchCommentsArgs{Query: "公式"})
	require.NoError(t, err)
	require.False(t, res.IsError)
	assert.Equal(t, "公式", svc.gotQuery)
	assert.Equal(t, domaincomment.AnchorFilterAll, svc.gotAnchorFilter, "空 type 默认 all")
	assert.Equal(t, 20, svc.gotLimit, "limit 缺省 20")
}

func TestSearchComments_RejectedWithoutScope(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{})

	res, _, _ := tools.SearchComments(context.Background(),
		reqWithToken(nil, uuidUser()), searchCommentsArgs{Query: "x"})
	assert.True(t, res.IsError, "无 comments:read scope 应拒绝")
}

func TestSearchComments_EmptyQueryIsToolError(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{})

	res, _, _ := tools.SearchComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()), searchCommentsArgs{})
	assert.True(t, res.IsError, "空 query 应为 tool error")
}

func TestSearchComments_InvalidType(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{})

	res, _, _ := tools.SearchComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()),
		searchCommentsArgs{Query: "x", Type: "bogus"})
	assert.True(t, res.IsError)
}

func TestSearchComments_AnnotationFilter(t *testing.T) {
	svc := &fakeCommentSearchService{searchRes: oneCommentResult()}
	tools := NewCommentTools(svc)

	_, _, _ = tools.SearchComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()),
		searchCommentsArgs{Query: "x", Type: "annotation"})
	assert.Equal(t, domaincomment.AnchorFilterAnnotation, svc.gotAnchorFilter)
}

func TestSearchComments_LimitClampedTo50(t *testing.T) {
	svc := &fakeCommentSearchService{searchRes: oneCommentResult()}
	tools := NewCommentTools(svc)

	_, _, _ = tools.SearchComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()),
		searchCommentsArgs{Query: "x", Limit: 999})
	assert.Equal(t, 50, svc.gotLimit, "limit 超出钳制到 50")
}

func TestSearchComments_EmptyResultHint(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{searchRes: &appcomment.SearchCommentsResult{}})

	res, _, err := tools.SearchComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()),
		searchCommentsArgs{Query: "不存在"})
	require.NoError(t, err)
	// 首页空结果给可操作提示（错误即指令）
	assert.Contains(t, textOf(t, res), "建议")
}

// ---- list_recent_comments ----

func TestListRecentComments_DelegatesWithScope(t *testing.T) {
	svc := &fakeCommentSearchService{searchRes: oneCommentResult()}
	tools := NewCommentTools(svc)

	res, _, err := tools.ListRecentComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()), listRecentCommentsArgs{})
	require.NoError(t, err)
	require.False(t, res.IsError)
	// list 不传 query，只传 anchorFilter
	assert.Equal(t, domaincomment.AnchorFilterAll, svc.gotAnchorFilter)
}

func TestListRecentComments_RejectedWithoutScope(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{})

	res, _, _ := tools.ListRecentComments(context.Background(),
		reqWithToken(nil, uuidUser()), listRecentCommentsArgs{})
	assert.True(t, res.IsError)
}

func TestListRecentComments_EmptyResultHint(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{searchRes: &appcomment.SearchCommentsResult{}})

	res, _, err := tools.ListRecentComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()), listRecentCommentsArgs{})
	require.NoError(t, err)
	// 空结果给通用提示（非 query 提示）
	assert.Contains(t, textOf(t, res), "暂无")
}

// ---- comment_stats ----

func TestCommentStats_DelegatesWithScope(t *testing.T) {
	svc := &fakeCommentSearchService{statsRes: &appcomment.CommentStatsResult{}}
	svc.statsRes.Summary.TotalAnnotations = 5
	tools := NewCommentTools(svc)

	res, _, err := tools.CommentStats(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()), struct{}{})
	require.NoError(t, err)
	require.False(t, res.IsError)
}

func TestCommentStats_RejectedWithoutScope(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{})

	res, _, _ := tools.CommentStats(context.Background(),
		reqWithToken(nil, uuidUser()), struct{}{})
	assert.True(t, res.IsError)
}

func TestCommentStats_EmptyResultHint(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{statsRes: &appcomment.CommentStatsResult{}})

	res, _, err := tools.CommentStats(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()), struct{}{})
	require.NoError(t, err)
	assert.Contains(t, textOf(t, res), "暂无")
}

// 编译期断言：fakeCommentSearchService 实现 CommentSearchService 接口。
var _ CommentSearchService = (*fakeCommentSearchService)(nil)
