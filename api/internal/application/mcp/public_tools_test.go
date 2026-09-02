package mcp

import (
	"context"
	"errors"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apppost "blog-api/internal/application/post"
	domain "blog-api/internal/domain/post"
	shared "blog-api/internal/domain/shared"
)

// fakePublicPostService 内存版公开文章服务，按 slug 预设返回。
type fakePublicPostService struct {
	bySlug    map[string]apppost.PostDTO
	listItems []apppost.PostListItemDTO
	listTotal int64
	gotListPQ shared.PageQuery
}

func (f *fakePublicPostService) GetPublishedBySlug(_ context.Context, slug string) (apppost.PostDTO, error) {
	dto, ok := f.bySlug[slug]
	if !ok {
		return apppost.PostDTO{}, domain.ErrNotFound
	}
	return dto, nil
}

func (f *fakePublicPostService) ListPublished(_ context.Context, _ string, q shared.PageQuery) (shared.PageResult[apppost.PostListItemDTO], error) {
	f.gotListPQ = q
	return shared.NewPageResult(q, f.listItems, f.listTotal), nil
}

// readReq 构造 ReadResourceRequest（Params 为指针字段）。
func readReq(uri string) *mcp.ReadResourceRequest {
	params := mcp.ReadResourceParams{URI: uri}
	return &mcp.ReadResourceRequest{Params: &params}
}

func TestPublicTools_ReadPost_Published(t *testing.T) {
	svc := &fakePublicPostService{bySlug: map[string]apppost.PostDTO{
		"quantum": {Slug: "quantum", Title: "量子计算", ContentMD: "# 量子\n$\\ket{0}$ 正文"},
	}}
	tools := NewPublicTools(svc, nil)

	res, err := tools.ReadPost(context.Background(), readReq("blog://posts/quantum"))
	require.NoError(t, err)
	require.Len(t, res.Contents, 1)
	assert.Equal(t, "blog://posts/quantum", res.Contents[0].URI)
	assert.Equal(t, "text/markdown", res.Contents[0].MIMEType)
	assert.Equal(t, "# 量子\n$\\ket{0}$ 正文", res.Contents[0].Text)
}

func TestPublicTools_ReadPost_DraftNotFound(t *testing.T) {
	// fakePublicPostService 不含该 slug 即模拟 GetPublishedBySlug 的 NotFound
	// （draft/archived/不存在在 Service 层统一返回 ErrNotFound）。
	svc := &fakePublicPostService{bySlug: map[string]apppost.PostDTO{}}
	tools := NewPublicTools(svc, nil)

	_, err := tools.ReadPost(context.Background(), readReq("blog://posts/wip"))
	require.Error(t, err)
	// 应是 MCP ResourceNotFoundError（非泛型 error），让客户端正确处理 404 语义
	assert.Contains(t, err.Error(), "not found")
}

func TestPublicTools_ReadPost_ArchivedNotFound(t *testing.T) {
	svc := &fakePublicPostService{bySlug: map[string]apppost.PostDTO{}}
	tools := NewPublicTools(svc, nil)

	_, err := tools.ReadPost(context.Background(), readReq("blog://posts/old"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestPublicTools_ReadPost_NotExistNotFound(t *testing.T) {
	svc := &fakePublicPostService{bySlug: map[string]apppost.PostDTO{}}
	tools := NewPublicTools(svc, nil)

	_, err := tools.ReadPost(context.Background(), readReq("blog://posts/no-such"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestPublicTools_ReadPost_InvalidURI(t *testing.T) {
	svc := &fakePublicPostService{}
	tools := NewPublicTools(svc, nil)

	_, err := tools.ReadPost(context.Background(), readReq("blog://drafts/x"))
	require.Error(t, err)
	// 非 blog://posts/ 前缀应拒绝，不透传到 Service 层
	assert.NotContains(t, err.Error(), "not found")
}

func TestPublicTools_ListPosts(t *testing.T) {
	svc := &fakePublicPostService{
		listItems: []apppost.PostListItemDTO{
			{Slug: "quantum", Title: "量子计算"},
			{Slug: "chemistry", Title: "化学笔记"},
		},
		listTotal: 2,
	}
	tools := NewPublicTools(svc, nil)

	res, err := tools.ListPosts(context.Background(), readReq("blog://posts"))
	require.NoError(t, err)
	require.Len(t, res.Contents, 1)
	assert.Equal(t, "text/markdown", res.Contents[0].MIMEType)
	// 目录含两条 slug + 标题，不含正文
	text := res.Contents[0].Text
	assert.Contains(t, text, "quantum")
	assert.Contains(t, text, "量子计算")
	assert.Contains(t, text, "chemistry")
	assert.Contains(t, text, "化学笔记")
	// 目录按页聚合：单页传 MaxPageLimit（Normalize 上限），首页即覆盖目录上限
	assert.Equal(t, 1, svc.gotListPQ.Page)
	assert.Equal(t, shared.MaxPageLimit, svc.gotListPQ.Limit)
}

func TestPublicTools_ListPosts_Empty(t *testing.T) {
	svc := &fakePublicPostService{listItems: nil, listTotal: 0}
	tools := NewPublicTools(svc, nil)

	res, err := tools.ListPosts(context.Background(), readReq("blog://posts"))
	require.NoError(t, err)
	require.Len(t, res.Contents, 1)
	// 空目录仍返回标题行，无文章条目
	assert.Contains(t, res.Contents[0].Text, "已发布文章目录")
}

func TestSlugFromURI(t *testing.T) {
	cases := []struct {
		uri    string
		slug   string
		hasErr bool
	}{
		{"blog://posts/quantum", "quantum", false},
		{"blog://posts/my-post-slug", "my-post-slug", false},
		{"blog://drafts/x", "", true},
		{"blog://posts/", "", true},
		{"http://example.com", "", true},
	}
	for _, c := range cases {
		got, err := slugFromURI(c.uri)
		if c.hasErr {
			require.Error(t, err, "URI %q 应报错", c.uri)
			continue
		}
		require.NoError(t, err)
		assert.Equal(t, c.slug, got)
	}
}

// 编译期断言：fakePublicPostService 实现 PublicPostService 接口。
var _ PublicPostService = (*fakePublicPostService)(nil)

// 抑制 errors 未用（保留给未来扩展的断言风格一致性）。
var _ = errors.Is
