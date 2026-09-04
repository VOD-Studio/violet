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

	apppost "blog-api/internal/application/post"
	appsub "blog-api/internal/application/subscription"
	apptag "blog-api/internal/application/tag"
	domainapitoken "blog-api/internal/domain/api_token"
	domainshared "blog-api/internal/domain/shared"
)

// fakePostService 内存版文章服务，记录被调参数。seam #2：不依赖 DB。
type fakePostService struct {
	createInput *apppost.CreateInput
	updateInput *apppost.UpdateInput
	updateOpID  string
	statusID    string
	statusValue string
	getID       string
	listStatus  string
	listPage    int
	listLimit   int

	importURL    string
	importOpts   apppost.ImportURLOpts
	importResult apppost.ImportResult
	importErr    error

	createErr error
	updateErr error
	statusErr error
	getErr    error
	listErr   error
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
func (f *fakePostService) GetBySlugForAuthor(_ context.Context, slug string) (apppost.PostDTO, error) {
	return apppost.PostDTO{ID: "post-1", Slug: slug, Title: "草稿标题", ContentMD: "# 草稿\n正文"}, f.getErr
}
func (f *fakePostService) ListAll(ctx context.Context, status, keyword string, tags []string, q domainshared.PageQuery) (domainshared.PageResult[apppost.PostListItemDTO], error) {
	f.listStatus = status
	f.listPage = q.Page
	f.listLimit = q.Limit
	return domainshared.NewPageResult(q, []apppost.PostListItemDTO{{ID: "d1", Title: "草稿", Status: "draft"}}, 1), f.listErr
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

// fakeSubService 内存版订阅服务，记录被调参数。seam #2：不依赖 DB。
type fakeSubService struct {
	createInput  *appsub.CreateInput
	createResult appsub.SubscriptionDTO
	createErr    error

	getID     string
	getUserID string
	getResult appsub.SubscriptionDTO
	getErr    error

	listUserID string
	listStatus string
	listQuery  domainshared.PageQuery
	listResult []appsub.SubscriptionDTO
	listTotal  int64
	listErr    error

	updateInput *appsub.UpdateInput
	updateErr   error

	pauseID   string
	pauseErr  error
	resumeID  string
	resumeErr error
	deleteID  string
	deleteErr error
}

func (f *fakeSubService) Create(ctx context.Context, in appsub.CreateInput) (appsub.SubscriptionDTO, error) {
	f.createInput = &in
	return f.createResult, f.createErr
}
func (f *fakeSubService) GetByID(ctx context.Context, id, userID string) (appsub.SubscriptionDTO, error) {
	f.getID = id
	f.getUserID = userID
	return f.getResult, f.getErr
}
func (f *fakeSubService) ListByUser(ctx context.Context, userID, status string, q domainshared.PageQuery) (domainshared.PageResult[appsub.SubscriptionDTO], error) {
	f.listUserID = userID
	f.listStatus = status
	f.listQuery = q
	return domainshared.NewPageResult(q, f.listResult, f.listTotal), f.listErr
}
func (f *fakeSubService) Update(ctx context.Context, in appsub.UpdateInput) error {
	f.updateInput = &in
	return f.updateErr
}
func (f *fakeSubService) Pause(ctx context.Context, id, userID string) error {
	f.pauseID = id
	return f.pauseErr
}
func (f *fakeSubService) Resume(ctx context.Context, id, userID string) error {
	f.resumeID = id
	return f.resumeErr
}
func (f *fakeSubService) Delete(ctx context.Context, id, userID string) error {
	f.deleteID = id
	return f.deleteErr
}

// fakeTagService 内存版标签服务，记录被调参数。seam #2：不依赖 DB。
type fakeTagService struct {
	createOrGetName   string
	createOrGetResult apptag.TagDTO
	createOrGetErr    error

	listResult []apptag.TagDTO
	listErr    error
}

func (f *fakeTagService) CreateOrGet(_ context.Context, name string) (apptag.TagDTO, error) {
	f.createOrGetName = name
	return f.createOrGetResult, f.createOrGetErr
}

func (f *fakeTagService) List(_ context.Context) ([]apptag.TagDTO, error) {
	return f.listResult, f.listErr
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
	tools := NewPostTools(fake)
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
	tools := NewPostTools(fake)

	res, _, err := tools.CreatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, "u-1"), createPostArgs{Title: "x", Slug: "x"})
	require.NoError(t, err)
	assert.True(t, res.IsError, "缺 write scope 应返回 tool error")
	assert.Nil(t, fake.createInput, "不应调用 Create")
}

// ---- update_post ----

func TestUpdatePost_DelegatesWithWriteScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewPostTools(fake)
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
	tools := NewPostTools(fake)

	res, _, _ := tools.UpdatePost(context.Background(),
		reqWithToken(nil, "u-1"), updatePostArgs{ID: "x"})
	assert.True(t, res.IsError)
	assert.Nil(t, fake.updateInput)
}

// ---- publish_post ----

func TestPublishPost_DelegatesWithPublishScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewPostTools(fake)

	res, _, err := tools.PublishPost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsPublish}, "u-1"), publishPostArgs{ID: "post-7"})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "post-7", fake.statusID)
	assert.Equal(t, "published", fake.statusValue, "应调 UpdateStatus(id,\"published\")")
}

func TestPublishPost_RejectedWithOnlyWriteScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewPostTools(fake)

	res, _, _ := tools.PublishPost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), publishPostArgs{ID: "x"})
	assert.True(t, res.IsError, "write 不含 publish，应拒绝")
	assert.Empty(t, fake.statusID, "不应调 UpdateStatus")
}

// ---- get_post ----

func TestGetPost_DelegatesWithReadScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewPostTools(fake)

	res, _, err := tools.GetPost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, "u-1"), getPostArgs{ID: "post-3"})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "post-3", fake.getID)
}

func TestGetPost_RejectedWithoutReadScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewPostTools(fake)

	res, _, _ := tools.GetPost(context.Background(),
		reqWithToken(nil, "u-1"), getPostArgs{ID: "x"})
	assert.True(t, res.IsError)
	assert.Empty(t, fake.getID)
}

// ---- list_drafts ----

func TestListDrafts_DelegatesWithReadScope(t *testing.T) {
	fake := &fakePostService{}
	tools := NewPostTools(fake)

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
	tools := NewPostTools(fake)

	res, _, _ := tools.ListDrafts(context.Background(),
		reqWithToken(nil, "u-1"), listDraftsArgs{})
	assert.True(t, res.IsError)
	assert.Empty(t, fake.listStatus)
}

// ---- service error surfaces as tool error ----

func TestCreatePost_ServiceErrorBecomesToolError(t *testing.T) {
	fake := &fakePostService{createErr: errors.New("DB down")}
	tools := NewPostTools(fake)

	res, _, err := tools.CreatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), createPostArgs{Title: "x", Slug: "x"})
	require.NoError(t, err, "service error 不应作为 protocol error 返回")
	assert.True(t, res.IsError, "service error 应映射为 tool error（IsError=true）")
}

// ---- canonical_url 透传（转载语义，T1）----

func TestCreatePost_PassesCanonicalURL(t *testing.T) {
	fake := &fakePostService{}
	tools := NewPostTools(fake)
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
	tools := NewPostTools(fake)
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
	tools := NewPostTools(fake)
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
	tools := NewPostTools(fake)
	args := updatePostArgs{ID: "post-9", Title: "改回原创"}

	res, _, err := tools.UpdatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError)
	require.NotNil(t, fake.updateInput)
	assert.Nil(t, fake.updateInput.CanonicalURL, "update 不传 canonical_url 时为 nil")
}

// ---- content_html 透传（回归：MCP 落库空 HTML 致编辑页/预览无数据）----
//
// 根因：create_post/update_post 原本只接受 content_md，而编辑器与阅读端都以
// content_html 为权威源。修复后两个 tool 都透传 content_html，从 scrape_url 拿到的
// HTML carrier 能正确落库。
func TestCreatePost_PassesContentHTML(t *testing.T) {
	fake := &fakePostService{}
	tools := NewPostTools(fake)
	args := createPostArgs{
		Title:       "抓取文",
		Slug:        "scraped",
		ContentHTML: `<h2>标题</h2><p>正文</p>`,
		ContentMD:   "## 标题\n正文",
	}

	res, _, err := tools.CreatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError)
	require.NotNil(t, fake.createInput)
	assert.Equal(t, `<h2>标题</h2><p>正文</p>`, fake.createInput.ContentHTML,
		"content_html 应透传到 CreateInput（渲染/编辑权威源）")
	assert.Equal(t, "## 标题\n正文", fake.createInput.ContentMD)
}

func TestUpdatePost_PassesContentHTML(t *testing.T) {
	fake := &fakePostService{}
	tools := NewPostTools(fake)
	args := updatePostArgs{
		ID:          "post-9",
		ContentHTML: `<p>新正文</p>`,
	}

	res, _, err := tools.UpdatePost(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError)
	require.NotNil(t, fake.updateInput)
	assert.Equal(t, `<p>新正文</p>`, fake.updateInput.ContentHTML)
}

// ---- create_tag / list_tags ----

func TestCreateTag_DelegatesWithWriteScope(t *testing.T) {
	fake := &fakeTagService{createOrGetResult: apptag.TagDTO{ID: 5, Name: "Go", Slug: "go"}}
	tools := NewTagTools(fake)

	res, _, err := tools.CreateTag(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), createTagArgs{Name: "Go"})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "Go", fake.createOrGetName, "name 应透传到 CreateOrGet")
}

func TestCreateTag_RejectedWithoutWriteScope(t *testing.T) {
	fake := &fakeTagService{}
	tools := NewTagTools(fake)

	res, _, err := tools.CreateTag(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, "u-1"), createTagArgs{Name: "Go"})
	require.NoError(t, err)
	assert.True(t, res.IsError, "缺 write scope 应返回 tool error")
}

func TestCreateTag_ServiceErrorBecomesToolError(t *testing.T) {
	fake := &fakeTagService{createOrGetErr: errors.New("DB down")}
	tools := NewTagTools(fake)

	res, _, err := tools.CreateTag(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"), createTagArgs{Name: "Go"})
	require.NoError(t, err)
	assert.True(t, res.IsError, "service error 应映射为 tool error")
}

func TestListTags_DelegatesWithReadScope(t *testing.T) {
	fake := &fakeTagService{listResult: []apptag.TagDTO{{ID: 1, Name: "Go", Slug: "go"}}}
	tools := NewTagTools(fake)

	res, _, err := tools.ListTags(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, "u-1"), listTagsArgs{})
	require.NoError(t, err)
	assert.False(t, res.IsError)
}

func TestListTags_RejectedWithoutReadScope(t *testing.T) {
	fake := &fakeTagService{}
	tools := NewTagTools(fake)

	res, _, err := tools.ListTags(context.Background(),
		reqWithToken([]string{}, "u-1"), listTagsArgs{})
	require.NoError(t, err)
	assert.True(t, res.IsError, "缺 read scope 应返回 tool error")
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
	tools := NewScraperTools(fake, robots, nil)

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
	tools := NewScraperTools(fake, nil, nil)

	res, _, _ := tools.ScrapeURL(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, "u-1"),
		scrapeURLArgs{URL: "https://example.com"})
	assert.True(t, res.IsError, "缺 scrape scope 应返回 tool error（write 不含 scrape）")
	assert.Empty(t, fake.importURL, "不应调 ImportURL")
}

func TestScrapeURL_RejectedByRobotsDisallow(t *testing.T) {
	fake := &fakePostService{}
	robots := &fakeRobotsChecker{allowed: false, reason: "robots.txt 禁止抓取 /private"}
	tools := NewScraperTools(fake, robots, nil)

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
	tools := NewScraperTools(fake, robots, nil)

	res, _, err := tools.ScrapeURL(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsScrape}, "u-1"),
		scrapeURLArgs{URL: "https://example.com"})
	require.NoError(t, err, "service error 不应作为 protocol error")
	assert.True(t, res.IsError, "service error 应映射为 tool error")
}

// ---- 订阅 tool（T6）----

func TestCreateSubscription_DelegatesWithWriteScope(t *testing.T) {
	fs := &fakeSubService{createResult: appsub.SubscriptionDTO{ID: "sub-1", FeedURL: "https://x/feed"}}
	tools := NewScraperTools(nil, nil, fs)
	args := createSubscriptionArgs{
		FeedURL: "https://example.com/feed.xml", Interval: domainsubIntervalHourly(),
		AutoPublish: true, Tags: []string{"转载"},
	}

	// AutoPublish=true 需 subscriptions:write + posts:publish 两个 scope（PRD-0005 安全语义）
	res, _, err := tools.CreateSubscription(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsWrite, domainapitoken.ScopePostsPublish}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError, "有 write + publish scope 应成功")
	require.NotNil(t, fs.createInput)
	assert.Equal(t, "https://example.com/feed.xml", fs.createInput.FeedURL)
	assert.Equal(t, "u-1", fs.createInput.UserID, "UserID 取自 PAT")
	assert.True(t, fs.createInput.AutoPublish)
}

func TestCreateSubscription_RejectedWithoutWriteScope(t *testing.T) {
	fs := &fakeSubService{}
	tools := NewScraperTools(nil, nil, fs)

	res, _, _ := tools.CreateSubscription(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsRead}, "u-1"),
		createSubscriptionArgs{FeedURL: "https://x/feed"})
	assert.True(t, res.IsError, "read 不含 write，应拒绝")
	assert.Nil(t, fs.createInput, "不应调 Create")
}

func TestListSubscriptions_DelegatesWithReadScope(t *testing.T) {
	fs := &fakeSubService{
		listResult: []appsub.SubscriptionDTO{{ID: "s1", Status: "active"}},
		listTotal:  1,
	}
	tools := NewScraperTools(nil, nil, fs)

	res, _, err := tools.ListSubscriptions(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsRead}, "u-9"),
		listSubscriptionsArgs{Status: "active", Page: 1, Limit: 5})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "u-9", fs.listUserID)
	assert.Equal(t, "active", fs.listStatus)
	assert.Equal(t, 1, fs.listQuery.Page)
	assert.Equal(t, 5, fs.listQuery.Limit)
}

func TestListSubscriptions_RejectedWithoutReadScope(t *testing.T) {
	fs := &fakeSubService{listErr: errors.New("不应被调")}
	tools := NewScraperTools(nil, nil, fs)

	res, _, _ := tools.ListSubscriptions(context.Background(),
		reqWithToken(nil, "u-1"), listSubscriptionsArgs{})
	assert.True(t, res.IsError)
	assert.Empty(t, fs.listUserID)
}

func TestGetSubscription_DelegatesWithReadScope(t *testing.T) {
	fs := &fakeSubService{getResult: appsub.SubscriptionDTO{ID: "s1", FeedURL: "https://x/feed"}}
	tools := NewScraperTools(nil, nil, fs)

	res, _, err := tools.GetSubscription(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsRead}, "u-1"),
		getSubscriptionArgs{ID: "s1"})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "s1", fs.getID)
	assert.Equal(t, "u-1", fs.getUserID, "所有权校验取自 PAT")
}

func TestUpdateSubscription_DelegatesWithWriteScope(t *testing.T) {
	fs := &fakeSubService{}
	tools := NewScraperTools(nil, nil, fs)
	args := updateSubscriptionArgs{ID: "s1", Title: "新标题", Interval: domainsubIntervalWeekly()}

	res, _, err := tools.UpdateSubscription(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError)
	require.NotNil(t, fs.updateInput)
	assert.Equal(t, "s1", fs.updateInput.ID)
	assert.Equal(t, "新标题", fs.updateInput.Title)
	assert.Equal(t, "u-1", fs.updateInput.UserID)
}

func TestPauseSubscription_DelegatesWithWriteScope(t *testing.T) {
	fs := &fakeSubService{}
	tools := NewScraperTools(nil, nil, fs)

	res, _, err := tools.PauseSubscription(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsWrite}, "u-1"),
		subscriptionIDArgs{ID: "s1"})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "s1", fs.pauseID)
}

func TestResumeSubscription_DelegatesWithWriteScope(t *testing.T) {
	fs := &fakeSubService{}
	tools := NewScraperTools(nil, nil, fs)

	res, _, err := tools.ResumeSubscription(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsWrite}, "u-1"),
		subscriptionIDArgs{ID: "s1"})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "s1", fs.resumeID)
}

func TestDeleteSubscription_DelegatesWithWriteScope(t *testing.T) {
	fs := &fakeSubService{}
	tools := NewScraperTools(nil, nil, fs)

	res, _, err := tools.DeleteSubscription(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsWrite}, "u-1"),
		subscriptionIDArgs{ID: "s1"})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	assert.Equal(t, "s1", fs.deleteID)
}

// domainsubIntervalHourly 等小 helper 避免在测试里 import subscription 包。
func domainsubIntervalHourly() string { return "hourly" }
func domainsubIntervalWeekly() string { return "weekly" }

// ---- auto_publish scope gate（review 意见 2）----

func TestCreateSubscription_AutoPublishRequiresPostsPublishScope(t *testing.T) {
	fs := &fakeSubService{}
	tools := NewScraperTools(nil, nil, fs)
	args := createSubscriptionArgs{
		FeedURL:     "https://example.com/feed",
		AutoPublish: true,
	}

	res, _, err := tools.CreateSubscription(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.True(t, res.IsError, "auto_publish=true 缺 posts:publish 应拒绝（防 scope 绕过）")
	assert.Nil(t, fs.createInput, "不应调 Create")
}

func TestCreateSubscription_AutoPublishPassesWithPostsPublishScope(t *testing.T) {
	fs := &fakeSubService{createResult: appsub.SubscriptionDTO{ID: "sub-1"}}
	tools := NewScraperTools(nil, nil, fs)
	args := createSubscriptionArgs{
		FeedURL:     "https://example.com/feed",
		AutoPublish: true,
	}

	res, _, err := tools.CreateSubscription(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsWrite, domainapitoken.ScopePostsPublish}, "u-1"), args)
	require.NoError(t, err)
	assert.False(t, res.IsError, "两个 scope 齐全应放行")
	require.NotNil(t, fs.createInput)
	assert.True(t, fs.createInput.AutoPublish)
}

func TestUpdateSubscription_AutoPublishRequiresPostsPublishScope(t *testing.T) {
	fs := &fakeSubService{}
	tools := NewScraperTools(nil, nil, fs)
	args := updateSubscriptionArgs{ID: "s1", AutoPublish: true}

	res, _, err := tools.UpdateSubscription(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsWrite}, "u-1"), args)
	require.NoError(t, err)
	assert.True(t, res.IsError, "Update auto_publish=true 同样需 posts:publish")
	assert.Nil(t, fs.updateInput)
}

// ---- 5 个 tool 的 scope 拒绝负分支（review 意见 5）----

func TestGetSubscription_RejectedWithoutReadScope(t *testing.T) {
	fs := &fakeSubService{getErr: errors.New("不应被调")}
	tools := NewScraperTools(nil, nil, fs)
	res, _, _ := tools.GetSubscription(context.Background(),
		reqWithToken(nil, "u-1"), getSubscriptionArgs{ID: "s1"})
	assert.True(t, res.IsError)
	assert.Empty(t, fs.getID)
}

func TestUpdateSubscription_RejectedWithoutWriteScope(t *testing.T) {
	fs := &fakeSubService{updateErr: errors.New("不应被调")}
	tools := NewScraperTools(nil, nil, fs)
	res, _, _ := tools.UpdateSubscription(context.Background(),
		reqWithToken([]string{domainapitoken.ScopeSubscriptionsRead}, "u-1"),
		updateSubscriptionArgs{ID: "s1"})
	assert.True(t, res.IsError, "read 不含 write 应拒绝")
	assert.Nil(t, fs.updateInput)
}

func TestPauseSubscription_RejectedWithoutWriteScope(t *testing.T) {
	fs := &fakeSubService{pauseErr: errors.New("不应被调")}
	tools := NewScraperTools(nil, nil, fs)
	res, _, _ := tools.PauseSubscription(context.Background(),
		reqWithToken(nil, "u-1"), subscriptionIDArgs{ID: "s1"})
	assert.True(t, res.IsError)
	assert.Empty(t, fs.pauseID)
}

func TestResumeSubscription_RejectedWithoutWriteScope(t *testing.T) {
	fs := &fakeSubService{resumeErr: errors.New("不应被调")}
	tools := NewScraperTools(nil, nil, fs)
	res, _, _ := tools.ResumeSubscription(context.Background(),
		reqWithToken(nil, "u-1"), subscriptionIDArgs{ID: "s1"})
	assert.True(t, res.IsError)
	assert.Empty(t, fs.resumeID)
}

func TestDeleteSubscription_RejectedWithoutWriteScope(t *testing.T) {
	fs := &fakeSubService{deleteErr: errors.New("不应被调")}
	tools := NewScraperTools(nil, nil, fs)
	res, _, _ := tools.DeleteSubscription(context.Background(),
		reqWithToken(nil, "u-1"), subscriptionIDArgs{ID: "s1"})
	assert.True(t, res.IsError)
	assert.Empty(t, fs.deleteID)
}
