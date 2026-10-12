package mcp

import (
	"context"
	"fmt"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appcomment "blog-api/internal/application/comment"
	apppost "blog-api/internal/application/post"
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
	tools := NewCommentTools(svc, nil, nil)

	res, _, err := tools.SearchComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()), searchCommentsArgs{Query: "公式"})
	require.NoError(t, err)
	require.False(t, res.IsError)
	assert.Equal(t, "公式", svc.gotQuery)
	assert.Equal(t, domaincomment.AnchorFilterAll, svc.gotAnchorFilter, "空 type 默认 all")
	assert.Equal(t, 20, svc.gotLimit, "limit 缺省 20")
}

func TestSearchComments_RejectedWithoutScope(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{}, nil, nil)

	res, _, _ := tools.SearchComments(context.Background(),
		reqWithToken(nil, uuidUser()), searchCommentsArgs{Query: "x"})
	assert.True(t, res.IsError, "无 comments:read scope 应拒绝")
}

func TestSearchComments_EmptyQueryIsToolError(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{}, nil, nil)

	res, _, _ := tools.SearchComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()), searchCommentsArgs{})
	assert.True(t, res.IsError, "空 query 应为 tool error")
}

func TestSearchComments_InvalidType(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{}, nil, nil)

	res, _, _ := tools.SearchComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()),
		searchCommentsArgs{Query: "x", Type: "bogus"})
	assert.True(t, res.IsError)
}

func TestSearchComments_AnnotationFilter(t *testing.T) {
	svc := &fakeCommentSearchService{searchRes: oneCommentResult()}
	tools := NewCommentTools(svc, nil, nil)

	_, _, _ = tools.SearchComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()),
		searchCommentsArgs{Query: "x", Type: "annotation"})
	assert.Equal(t, domaincomment.AnchorFilterAnnotation, svc.gotAnchorFilter)
}

func TestSearchComments_LimitClampedTo50(t *testing.T) {
	svc := &fakeCommentSearchService{searchRes: oneCommentResult()}
	tools := NewCommentTools(svc, nil, nil)

	_, _, _ = tools.SearchComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()),
		searchCommentsArgs{Query: "x", Limit: 999})
	assert.Equal(t, 50, svc.gotLimit, "limit 超出钳制到 50")
}

func TestSearchComments_EmptyResultHint(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{searchRes: &appcomment.SearchCommentsResult{}}, nil, nil)

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
	tools := NewCommentTools(svc, nil, nil)

	res, _, err := tools.ListRecentComments(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()), listRecentCommentsArgs{})
	require.NoError(t, err)
	require.False(t, res.IsError)
	// list 不传 query，只传 anchorFilter
	assert.Equal(t, domaincomment.AnchorFilterAll, svc.gotAnchorFilter)
}

func TestListRecentComments_RejectedWithoutScope(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{}, nil, nil)

	res, _, _ := tools.ListRecentComments(context.Background(),
		reqWithToken(nil, uuidUser()), listRecentCommentsArgs{})
	assert.True(t, res.IsError)
}

func TestListRecentComments_EmptyResultHint(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{searchRes: &appcomment.SearchCommentsResult{}}, nil, nil)

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
	tools := NewCommentTools(svc, nil, nil)

	res, _, err := tools.CommentStats(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()), struct{}{})
	require.NoError(t, err)
	require.False(t, res.IsError)
}

func TestCommentStats_RejectedWithoutScope(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{}, nil, nil)

	res, _, _ := tools.CommentStats(context.Background(),
		reqWithToken(nil, uuidUser()), struct{}{})
	assert.True(t, res.IsError)
}

func TestCommentStats_EmptyResultHint(t *testing.T) {
	tools := NewCommentTools(&fakeCommentSearchService{statsRes: &appcomment.CommentStatsResult{}}, nil, nil)

	res, _, err := tools.CommentStats(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()), struct{}{})
	require.NoError(t, err)
	assert.Contains(t, textOf(t, res), "暂无")
}

// ---- create_comment / create_annotation / create_block_comment ----

type fakeCommentWriteService struct {
	got   appcomment.CreateInput
	dto   appcomment.CommentDTO
	err   error
	calls int
}

func (f *fakeCommentWriteService) Create(_ context.Context, in appcomment.CreateInput) (appcomment.CommentDTO, error) {
	f.calls++
	f.got = in
	return f.dto, f.err
}

type fakeCommentPostLookup struct {
	bySlug map[string]apppost.PostDTO
	byID   map[string]apppost.PostDTO // 仅已发布文章
	err    error
}

func (f *fakeCommentPostLookup) GetPublishedByID(_ context.Context, id string) (apppost.PostDTO, error) {
	if f.err != nil {
		return apppost.PostDTO{}, f.err
	}
	dto, ok := f.byID[id]
	if !ok {
		return apppost.PostDTO{}, fmt.Errorf("not found")
	}
	return dto, nil
}

// publishedP1 默认把 p1 视为已发布文章。
func publishedP1() *fakeCommentPostLookup {
	return &fakeCommentPostLookup{byID: map[string]apppost.PostDTO{"p1": {ID: "p1"}}}
}

func (f *fakeCommentPostLookup) GetPublishedBySlug(_ context.Context, slug string) (apppost.PostDTO, error) {
	if f.err != nil {
		return apppost.PostDTO{}, f.err
	}
	dto, ok := f.bySlug[slug]
	if !ok {
		return apppost.PostDTO{}, fmt.Errorf("not found")
	}
	return dto, nil
}

func TestCreateComment_RequiresWriteScope(t *testing.T) {
	tools := NewCommentTools(nil, &fakeCommentWriteService{}, nil)
	res, _, _ := tools.CreateComment(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsRead}, uuidUser()),
		createCommentArgs{PostID: "p1", Body: "hi"})
	assert.True(t, res.IsError, "仅 comments:read 应拒绝写入")
}

func TestCreateComment_AsAIIdentity(t *testing.T) {
	w := &fakeCommentWriteService{dto: appcomment.CommentDTO{ID: "c1", Body: "hi", IsAI: true, AuthorName: "Violet AI"}}
	tools := NewCommentTools(nil, w, publishedP1())
	uid := uuidUser()
	res, _, err := tools.CreateComment(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsWrite}, uid),
		createCommentArgs{PostID: "p1", Body: "  hi  "})
	require.NoError(t, err)
	require.False(t, res.IsError)
	assert.Equal(t, 1, w.calls)
	assert.True(t, w.got.IsAI)
	assert.Equal(t, "Violet AI", w.got.AuthorName)
	assert.Equal(t, "/logo.png", w.got.AvatarURL)
	assert.Equal(t, uid, w.got.UserID)
	assert.Equal(t, "hi", w.got.Body)
	assert.Nil(t, w.got.Anchor)
}

func TestCreateComment_ResolvesSlug(t *testing.T) {
	w := &fakeCommentWriteService{dto: appcomment.CommentDTO{ID: "c1"}}
	posts := &fakeCommentPostLookup{bySlug: map[string]apppost.PostDTO{
		"react-tweet": {ID: "post-uuid-1", Slug: "react-tweet"},
	}}
	tools := NewCommentTools(nil, w, posts)
	res, _, err := tools.CreateComment(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsWrite}, uuidUser()),
		createCommentArgs{Slug: "react-tweet", Body: "nice"})
	require.NoError(t, err)
	require.False(t, res.IsError)
	assert.Equal(t, "post-uuid-1", w.got.PostID)
}

func TestCreateAnnotation_BuildsAnchor(t *testing.T) {
	w := &fakeCommentWriteService{dto: appcomment.CommentDTO{ID: "c1", IsAI: true}}
	tools := NewCommentTools(nil, w, publishedP1())
	res, _, err := tools.CreateAnnotation(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsWrite}, uuidUser()),
		createAnnotationArgs{
			PostID: "p1", Body: "批注", SelectedText: "hello",
			StartOffset: 0, EndOffset: 5, BlockText: "hello world",
		})
	require.NoError(t, err)
	require.False(t, res.IsError)
	require.NotNil(t, w.got.Anchor)
	assert.Equal(t, "hello", w.got.Anchor.SelectedText)
	assert.True(t, w.got.IsAI)
	assert.Equal(t, "Violet AI", w.got.AuthorName)
}

func TestCreateBlockComment_FullBlockAnchor(t *testing.T) {
	w := &fakeCommentWriteService{dto: appcomment.CommentDTO{ID: "c1", IsAI: true}}
	tools := NewCommentTools(nil, w, publishedP1())
	text := "整段段落文本"
	res, _, err := tools.CreateBlockComment(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsWrite}, uuidUser()),
		createBlockCommentArgs{PostID: "p1", Body: "段评", BlockText: text})
	require.NoError(t, err)
	require.False(t, res.IsError)
	require.NotNil(t, w.got.Anchor)
	assert.Equal(t, 0, w.got.Anchor.StartOffset)
	assert.Equal(t, text, w.got.Anchor.SelectedText)
	assert.True(t, w.got.IsAI)
}

func TestCreateComment_RejectsUnpublishedPostID(t *testing.T) {
	w := &fakeCommentWriteService{}
	tools := NewCommentTools(nil, w, publishedP1())
	res, _, err := tools.CreateComment(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsWrite}, uuidUser()),
		createCommentArgs{PostID: "draft-post", Body: "hi"})
	require.NoError(t, err)
	assert.True(t, res.IsError, "草稿/不存在的 post_id 应拒绝")
	assert.Equal(t, 0, w.calls)
}

func TestCreateAnnotation_ReplyInheritsParentAnchor(t *testing.T) {
	w := &fakeCommentWriteService{dto: appcomment.CommentDTO{ID: "c2"}}
	tools := NewCommentTools(nil, w, publishedP1())
	res, _, err := tools.CreateAnnotation(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeCommentsWrite}, uuidUser()),
		createAnnotationArgs{
			PostID: "p1", Body: "回复", ParentID: "parent-1",
			SelectedText: "other", StartOffset: 0, EndOffset: 5, BlockText: "hello world",
		})
	require.NoError(t, err)
	require.False(t, res.IsError)
	assert.Equal(t, "parent-1", w.got.ParentID)
	assert.Nil(t, w.got.Anchor, "回复不带自身锚点，由父评论继承")
}

// 编译期断言：fakeCommentSearchService 实现 CommentSearchService 接口。
var _ CommentSearchService = (*fakeCommentSearchService)(nil)
var _ CommentWriteService = (*fakeCommentWriteService)(nil)
var _ CommentPostLookup = (*fakeCommentPostLookup)(nil)
