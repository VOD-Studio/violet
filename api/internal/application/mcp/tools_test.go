package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainapitoken "blog-api/internal/domain/api_token"
	apppost "blog-api/internal/application/post"
)

// fakePostService 内存版文章服务，记录被调参数。seam #2：不依赖 DB。
type fakePostService struct {
	createInput  *apppost.CreateInput
	updateInput  *apppost.UpdateInput
	updateOpID   string
	statusID     string
	statusValue  string
	getID        string
	listStatus   string
	listPage     int
	listLimit    int

	importURL    string
	importOpts   apppost.ImportURLOpts
	importResult apppost.ImportResult
	importErr    error

	createErr    error
	updateErr    error
	statusErr    error
	getErr       error
	listErr      error
}

func (f *fakePostService) Create(ctx context.Context, in apppost.CreateInput) (apppost.PostDTO, error) {
	f.createInput = &in
	return apppost.PostDTO{ID: "post-1", Title: in.Title, Slug: in.Slug}, f.createErr
}
func (f *fakePostService) Update(ctx context.Context, in apppost.UpdateInput, operatorID string) error {
	f.updateInput = &in
	f.updateOpID = operatorID
	return f.updateErr
}
func (f *fakePostService) UpdateStatus(ctx context.Context, id, status string) (apppost.PostDTO, error) {
	f.statusID = id
	f.statusValue = status
	return apppost.PostDTO{ID: id, Status: status}, f.statusErr
}
func (f *fakePostService) GetByID(ctx context.Context, id string) (apppost.PostDTO, error) {
	f.getID = id
	return apppost.PostDTO{ID: id, Title: "标题"}, f.getErr
}
func (f *fakePostService) ListAll(ctx context.Context, page, limit int, status string) ([]apppost.PostListItemDTO, int64, error) {
	f.listStatus = status
	f.listPage = page
	f.listLimit = limit
	return []apppost.PostListItemDTO{{ID: "d1", Title: "草稿", Status: "draft"}}, 1, f.listErr
}
func (f *fakePostService) ImportURL(ctx context.Context, rawURL string, opts apppost.ImportURLOpts) (apppost.ImportResult, error) {
	f.importURL = rawURL
	f.importOpts = opts
	return f.importResult, f.importErr
}

// fakeRobotsChecker 内存版 robots.txt 预检，按预设值返回。
type fakeRobotsChecker struct {
	allowed bool
	reason  string
	err     error
	called  bool
}

func (f *fakeRobotsChecker) Allowed(ctx context.Context, target string) (bool, string, error) {
	f.called = true
	return f.allowed, f.reason, f.err
}

// reqWithToken 构造带 TokenInfo 的 CallToolRequest；scopes/userID 控制身份。
func reqWithToken(scopes []string, userID string) *mcp.CallToolRequest {
	return &mcp.CallToolRequest{
		Extra: &mcp.RequestExtra{
			TokenInfo: &auth.TokenInfo{Scopes: scopes, UserID: userID},
		},
	}
}

func resultText(t *testing.T, res *mcp.CallToolResult) string {
	t.Helper()
	require.Len(t, res.Content, 1)
	tc, ok := res.Content[0].(*mcp.TextContent)
	require.True(t, ok, "Content[0] 应为 TextContent")
	return tc.Text
}

// ---- create_post ----

func TestCreatePost_DelegatesWithWriteScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)
	args := createPostArgs{Title: "你好", Slug: "hello", ContentMD: "# hi"}

	res, _, err := tools.CreatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError, "有 write scope 应成功")
	require.NotNil(t, fake.createInput, "应委托 Create")
	assert.Equal(t, "你好", fake.createInput.Title)
	assert.Equal(t, "u-1", fake.createInput.AuthorID, "AuthorID 应取自 PAT UserID")
	assert.Equal(t, "# hi", fake.createInput.ContentMD)
}

func TestCreatePost_RejectedWithoutWriteScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)

	res, _, err := tools.CreatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, "u-1"), createPostArgs{Title: "x", Slug: "x"})
	require.NoError(t, err)
	assert.True(t, res.IsError, "缺 write scope 应返回 tool error")
	assert.Nil(t, fake.createInput, "不应调用 Create")
}

// ---- update_post ----

func TestUpdatePost_DelegatesWithWriteScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)
	args := updatePostArgs{ID: "post-9", Title: "新标题"}

	res, _, err := tools.UpdatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError)
	require.NotNil(t, fake.updateInput)
	assert.Equal(t, "post-9", fake.updateInput.ID)
	assert.Equal(t, "u-1", fake.updateOpID, "operatorID 应取自 PAT UserID")
}

func TestUpdatePost_RejectedWithoutWriteScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)

	res, _, _ := tools.UpdatePost(context.Background(),
		reqWithToken(nil, "u-1"), updatePostArgs{ID: "x"})
	assert.True(t, res.IsError)
	assert.Nil(t, fake.updateInput)
}

// ---- publish_post ----

func TestPublishPost_DelegatesWithPublishScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)

	res, _, err := tools.PublishPost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsPublish}, "u-1"), publishPostArgs{ID: "post-7"})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "post-7", fake.statusID)
	assert.Equal(t, "published", fake.statusValue, "应调 UpdateStatus(id,\"published\")")
}

func TestPublishPost_RejectedWithOnlyWriteScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)

	res, _, _ := tools.PublishPost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), publishPostArgs{ID: "x"})
	assert.True(t, res.IsError, "write 不含 publish，应拒绝")
	assert.Empty(t, fake.statusID, "不应调 UpdateStatus")
}

// ---- get_post ----

func TestGetPost_DelegatesWithReadScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)

	res, _, err := tools.GetPost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, "u-1"), getPostArgs{ID: "post-3"})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "post-3", fake.getID)
}

func TestGetPost_RejectedWithoutReadScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)

	res, _, _ := tools.GetPost(context.Background(),
		reqWithToken(nil, "u-1"), getPostArgs{ID: "x"})
	assert.True(t, res.IsError)
	assert.Empty(t, fake.getID)
}

// ---- list_drafts ----

func TestListDrafts_DelegatesWithReadScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)

	res, _, err := tools.ListDrafts(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, "u-1"), listDraftsArgs{Page: 1, Limit: 10})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "draft", fake.listStatus, "应按 draft 状态查询")
	assert.Equal(t, 1, fake.listPage)
	assert.Equal(t, 10, fake.listLimit)
}

func TestListDrafts_RejectedWithoutReadScope(t *testing.T) {
	fake := &fakePostService{listErr: errors.New("不应被调")}
	tools := NewTools(fake, nil)

	res, _, _ := tools.ListDrafts(context.Background(),
		reqWithToken(nil, "u-1"), listDraftsArgs{})
	assert.True(t, res.IsError)
	assert.Empty(t, fake.listStatus)
}

// ---- service error surfaces as tool error ----

func TestCreatePost_ServiceErrorBecomesToolError(t *testing.T) {
	fake := &fakePostService{createErr: errors.New("DB down")}
	tools := NewTools(fake, nil)

	res, _, err := tools.CreatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), createPostArgs{Title: "x", Slug: "x"})
	require.NoError(t, err, "service error 不应作为 protocol error 返回")
	assert.True(t, res.IsError, "service error 应映射为 tool error（IsError=true）")
}

// ---- canonical_url 透传（转载语义，T1）----

func TestCreatePost_PassesCanonicalURL(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)
	args := createPostArgs{
		Title:        "转载文",
		Slug:         "repost",
		CanonicalURL: stringPtr("https://example.com/origin"),
	}

	res, _, err := tools.CreatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError)
	require.NotNil(t, fake.createInput)
	require.NotNil(t, fake.createInput.CanonicalURL, "传入 canonical_url 时 service 应收到非 nil")
	assert.Equal(t, "https://example.com/origin", *fake.createInput.CanonicalURL)
}

func TestCreatePost_OmitsCanonicalURLWhenAbsent(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)
	args := createPostArgs{Title: "原创文", Slug: "original"}

	res, _, err := tools.CreatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError)
	require.NotNil(t, fake.createInput)
	assert.Nil(t, fake.createInput.CanonicalURL, "未传 canonical_url 时 service 应收到 nil（= 原创）")
}

func TestUpdatePost_PassesCanonicalURL(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)
	args := updatePostArgs{
		ID:           "post-9",
		CanonicalURL: stringPtr("https://example.com/origin"),
	}

	res, _, err := tools.UpdatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError)
	require.NotNil(t, fake.updateInput)
	require.NotNil(t, fake.updateInput.CanonicalURL)
	assert.Equal(t, "https://example.com/origin", *fake.updateInput.CanonicalURL)
}

func TestUpdatePost_OmitsCanonicalURLWhenAbsent(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)
	args := updatePostArgs{ID: "post-9", Title: "改回原创"}

	res, _, err := tools.UpdatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError)
	require.NotNil(t, fake.updateInput)
	assert.Nil(t, fake.updateInput.CanonicalURL, "update 不传 canonical_url 时为 nil")
}

// stringPtr 测试辅助：返回字符串指针。
func stringPtr(s string) *string { return &s }

// ---- scrape_url（T5）----

// unmarshalScrapeResult 解析 okResult 的 JSON 文本到 map，便于断言字段。
func unmarshalScrapeResult(t *testing.T, res *mcp.CallToolResult) map[string]any {
	t.Helper()
	text := resultText(t, res)
	var m map[string]any
	require.NoError(t, json.Unmarshal([]byte(text), &m), "结果应为 JSON 对象")
	return m
}

func TestScrapeURL_DelegatesWithScrapeScope(t *testing.T) {
	fake := &fakePostService{
		importResult: apppost.ImportResult{
			Title:          "测试文章",
			HTML:           "<p>html</p>",
			Markdown:       "md",
			Excerpt:        "摘要",
			SeoTitle:       "seo-t",
			SeoDescription: "seo-d",
			CanonicalURL:   "https://example.com/canonical",
			CoverImage:     "https://example.com/cover.jpg",
		},
	}
	robots := &fakeRobotsChecker{allowed: true}
	tools := NewTools(fake, robots)

	res, _, err := tools.ScrapeURL(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsScrape}, "u-1"),
		scrapeURLArgs{URL: "https://example.com/post"})
	require.NoError(t, err)
	assert.False(t, res.IsError, "有 scrape scope 应成功")
	assert.Equal(t, "https://example.com/post", fake.importURL, "URL 应透传到 ImportURL")
	assert.True(t, robots.called, "应调 robots 预检")

	m := unmarshalScrapeResult(t, res)
	// 9 字段全映射
	assert.Equal(t, "测试文章", m["title"])
	assert.Equal(t, "<p>html</p>", m["content_html"])
	assert.Equal(t, "md", m["content_md"])
	assert.Equal(t, "摘要", m["excerpt"])
	assert.Equal(t, "https://example.com/canonical", m["canonical_url"])
	assert.Equal(t, "https://example.com/cover.jpg", m["cover_image"])
	assert.Equal(t, "seo-t", m["seo_title"])
	assert.Equal(t, "seo-d", m["seo_description"])
}

func TestScrapeURL_RejectedWithoutScrapeScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewTools(fake, nil)

	res, _, _ := tools.ScrapeURL(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"),
		scrapeURLArgs{URL: "https://example.com"})
	assert.True(t, res.IsError, "缺 scrape scope 应返回 tool error（write 不含 scrape）")
	assert.Empty(t, fake.importURL, "不应调 ImportURL")
}

func TestScrapeURL_RejectedByRobotsDisallow(t *testing.T) {
	fake := &fakePostService{}
	robots := &fakeRobotsChecker{allowed: false, reason: "robots.txt 禁止抓取 /private"}
	tools := NewTools(fake, robots)

	res, _, err := tools.ScrapeURL(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsScrape}, "u-1"),
		scrapeURLArgs{URL: "https://example.com/private"})
	require.NoError(t, err)
	assert.True(t, res.IsError, "robots 禁止应拒绝")
	assert.Empty(t, fake.importURL, "robots 拒绝时不应调 ImportURL")
}

func TestScrapeURL_ServiceErrorBecomesToolError(t *testing.T) {
	fake := &fakePostService{importErr: errors.New("抓取失败")}
	robots := &fakeRobotsChecker{allowed: true}
	tools := NewTools(fake, robots)

	res, _, err := tools.ScrapeURL(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsScrape}, "u-1"),
		scrapeURLArgs{URL: "https://example.com"})
	require.NoError(t, err, "service error 不应作为 protocol error")
	assert.True(t, res.IsError, "service error 应映射为 tool error")
}
