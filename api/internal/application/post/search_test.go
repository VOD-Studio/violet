package post

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
)

// fakeSearchRepo 记录 FindPage 调用参数并返回预设文章。
type fakeSearchRepo struct {
	fakeSlugRepo // 复用既有 stub（其余方法 panic）

	posts     []*domain.Post
	total     int64
	gotFilter domain.ListFilter
	gotPage   int
	gotLimit  int
}

func (f *fakeSearchRepo) FindPage(_ context.Context, filter domain.ListFilter, q shared.PageQuery) (shared.PageResult[*domain.Post], error) {
	f.gotFilter = filter
	f.gotPage, f.gotLimit = q.Page, q.Limit
	return shared.NewPageResult(q, f.posts, f.total), nil
}

func newSearchTestService(repo *fakeSearchRepo) *Service {
	return &Service{repo: repo}
}

func mustReconstructPost(t *testing.T, slug, title, contentMD, excerpt string) *domain.Post {
	t.Helper()
	p := domain.ReconstructPost(
		shared.NewID(), shared.NewID(), title, slug,
		contentMD, "<p>html</p>", excerpt, "",
		domain.StatusPublished, 0, false, "", "",
		nil, nil, nil, testTime, testTime,
	)
	return p
}

var testTime = time.Now()

func TestService_SearchPosts(t *testing.T) {
	repo := &fakeSearchRepo{
		posts: []*domain.Post{
			mustReconstructPost(t, "quantum-intro", "量子计算入门", "正文讨论量子纠缠与叠加态。", "摘要量子"),
		},
		total: 5,
	}
	svc := newSearchTestService(repo)

	res, err := svc.SearchPosts(context.Background(), shared.NewID(), "量子", "all", shared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)

	// 编排参数透传：filter 承载检索维度，page 1 / limit 20 原样传递
	assert.Equal(t, "量子", repo.gotFilter.Keyword)
	assert.Equal(t, "all", repo.gotFilter.Status)
	assert.Equal(t, 1, repo.gotPage)
	assert.Equal(t, 20, repo.gotLimit)

	require.Len(t, res.Posts, 1)
	item := res.Posts[0]
	assert.Equal(t, "quantum-intro", item.Slug)
	assert.Equal(t, domain.StatusPublished, item.Status)
	// total=5，本页 1 条（offset 0）→ has_more
	assert.Equal(t, int64(5), res.TotalCount)
	assert.True(t, res.HasMore)
	assert.Equal(t, 1, res.NextOffset)
}

func TestService_SearchPosts_OffsetPagination(t *testing.T) {
	repo := &fakeSearchRepo{posts: nil, total: 40}
	svc := newSearchTestService(repo)

	res, err := svc.SearchPosts(context.Background(), shared.NewID(), "x", "all", shared.PageQuery{Page: 3, Limit: 20})
	require.NoError(t, err)
	// PageQuery 直传：page 3 原样透传，PageMeta 按 offset 40 回算
	assert.Equal(t, 3, repo.gotPage)
	assert.Equal(t, int64(40), res.TotalCount)
	assert.False(t, res.HasMore)
	assert.Equal(t, 40, res.NextOffset)
}

func TestService_SearchPublished(t *testing.T) {
	repo := &fakeSearchRepo{
		posts: []*domain.Post{
			mustReconstructPost(t, "quantum-intro", "量子计算入门", "正文讨论量子纠缠与叠加态。", "摘要量子"),
		},
		total: 1,
	}
	svc := newSearchTestService(repo)

	res, err := svc.SearchPublished(context.Background(), "量子", shared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)

	// 编排参数透传：检索维度收敛进 filter，status 由 service 固定 published
	assert.Equal(t, "量子", repo.gotFilter.Keyword)
	assert.Equal(t, domain.StatusPublished, repo.gotFilter.Status)
	assert.Equal(t, 1, repo.gotPage)
	assert.Equal(t, 20, repo.gotLimit)

	require.Len(t, res.Posts, 1)
	assert.Equal(t, "quantum-intro", res.Posts[0].Slug)
	assert.Contains(t, res.Posts[0].Snippet, "量子")
	assert.Equal(t, int64(1), res.TotalCount)
}

func TestService_SearchPublished_OffsetPagination(t *testing.T) {
	repo := &fakeSearchRepo{posts: nil, total: 40}
	svc := newSearchTestService(repo)
	_, err := svc.SearchPublished(context.Background(), "x", shared.PageQuery{Page: 3, Limit: 20})
	require.NoError(t, err)
	// PageQuery 直传：page 3 原样透传
	assert.Equal(t, 3, repo.gotPage)
}

func TestMakeSnippet(t *testing.T) {
	keywords := []string{"量子"}

	t.Run("命中在开头", func(t *testing.T) {
		s := makeSnippet("量子计算入门", "", "无关正文", keywords, 80)
		assert.Equal(t, "量子计算入门", s)
	})

	t.Run("命中在中间加双侧省略号", func(t *testing.T) {
		long := string(make([]rune, 200))
		runes := []rune(long)
		for i := range runes {
			runes[i] = '文'
		}
		text := string(runes[:100]) + "量子" + string(runes[100:])
		s := makeSnippet("", "", text, keywords, 80)
		assert.Contains(t, s, "量子")
		assert.True(t, strings.HasPrefix(s, "…"), "左侧应有省略号: %q", s)
		assert.True(t, strings.HasSuffix(s, "…"), "右侧应有省略号: %q", s)
	})

	t.Run("命中在结尾", func(t *testing.T) {
		prefix := make([]rune, 100)
		for i := range prefix {
			prefix[i] = '文'
		}
		s := makeSnippet("", "", string(prefix)+"量子", keywords, 80)
		assert.Contains(t, s, "量子")
		assert.True(t, strings.HasPrefix(s, "…"))
		assert.False(t, strings.HasSuffix(s, "…"), "结尾命中不应有右侧省略号: %q", s)
	})

	t.Run("多次命中只取首个", func(t *testing.T) {
		s := makeSnippet("", "", "量子第一处，后面还有量子和量子。", keywords, 5)
		// 窗口以首个命中为中心（2 rune 命中词 + 后 5 rune）；若误取后续命中，中心会偏移
		assert.Equal(t, "量子第一处，后…", s)
	})

	t.Run("多字节字符不截断", func(t *testing.T) {
		// 窗口边界落在多字节字符中间时不应产生乱码
		prefix := make([]rune, 79)
		for i := range prefix {
			prefix[i] = '量'
		}
		text := string(prefix) + "目标词" + string(prefix)
		s := makeSnippet("", "", text, []string{"目标词"}, 80)
		assert.Contains(t, s, "目标词")
		assert.NotContains(t, s, "�")
	})

	t.Run("列优先级 title 先于正文", func(t *testing.T) {
		s := makeSnippet("量子标题", "", "量子正文", keywords, 80)
		assert.Equal(t, "量子标题", s)
	})

	t.Run("大小写不敏感命中", func(t *testing.T) {
		s := makeSnippet("", "", "Quantum Field Theory", []string{"quantum"}, 80)
		assert.Equal(t, "Quantum Field Theory", s)
	})
}

func TestService_SearchFormulas(t *testing.T) {
	md := "前文\n$E=mc^2$\n中\n$$\\frac{1}{2}+\\ce{H2O}$$\n后文"
	repo := &fakeSearchRepo{
		posts: []*domain.Post{
			mustReconstructPost(t, "f-post", "公式文章", md, ""),
			mustReconstructPost(t, "f-post2", "无命中文章", "不含目标命令 $x^2$", ""),
		},
		total: 2,
	}
	svc := newSearchTestService(repo)

	res, err := svc.SearchFormulas(context.Background(), shared.NewID(), "\\frac", 20, 0)
	require.NoError(t, err)

	// 初筛参数：query 原样透传进 filter、status all、单页取 MaxPageLimit 聚合候选
	assert.Equal(t, "\\frac", repo.gotFilter.Keyword)
	assert.Equal(t, "all", repo.gotFilter.Status)
	assert.Equal(t, 1, repo.gotPage)
	assert.Equal(t, shared.MaxPageLimit, repo.gotLimit)

	require.Len(t, res.Formulas, 1)
	f := res.Formulas[0]
	assert.Equal(t, "f-post", f.PostSlug)
	assert.Equal(t, "\\frac{1}{2}+\\ce{H2O}", f.Latex)
	assert.Equal(t, "block", f.DisplayMode)
	assert.Contains(t, f.ContextSnippet, "\\frac{1}{2}")
	assert.Equal(t, int64(1), res.TotalCount)
	assert.False(t, res.HasMore)
}

func TestService_SearchFormulas_Pagination(t *testing.T) {
	md := "$a_1$ $a_2$ $a_3$ $a_4$ $a_5$"
	repo := &fakeSearchRepo{
		posts: []*domain.Post{mustReconstructPost(t, "p", "t", md, "")},
		total: 1,
	}
	svc := newSearchTestService(repo)

	// 每页 2 条，第 2 页
	res, err := svc.SearchFormulas(context.Background(), shared.NewID(), "a_", 2, 2)
	require.NoError(t, err)
	require.Len(t, res.Formulas, 2)
	assert.Equal(t, "a_3", res.Formulas[0].Latex)
	assert.Equal(t, int64(5), res.TotalCount)
	assert.True(t, res.HasMore)
	assert.Equal(t, 4, res.NextOffset)

	// offset 超出
	res, err = svc.SearchFormulas(context.Background(), shared.NewID(), "a_", 2, 10)
	require.NoError(t, err)
	assert.Empty(t, res.Formulas)
	assert.False(t, res.HasMore)
}

func TestService_SearchCodeBlocks(t *testing.T) {
	md := "```python runnable\nimport requests\nprint(1)\n```\n\n```js\nconsole.log(2)\n```\n\n```go\nfmt.Println(3)\n```"
	repo := &fakeSearchRepo{
		posts: []*domain.Post{mustReconstructPost(t, "c-post", "代码文章", md, "")},
		total: 1,
	}
	svc := newSearchTestService(repo)
	ctx := context.Background()

	t.Run("lang 过滤 + 归一化", func(t *testing.T) {
		res, err := svc.SearchCodeBlocks(ctx, shared.NewID(), "", "node", false, 20, 0)
		require.NoError(t, err)
		require.Len(t, res.CodeBlocks, 1)
		assert.Equal(t, "node", res.CodeBlocks[0].Lang) // js 归一为 node
		assert.False(t, res.CodeBlocks[0].Runnable)
	})

	t.Run("runnable_only 过滤", func(t *testing.T) {
		res, err := svc.SearchCodeBlocks(ctx, shared.NewID(), "", "all", true, 20, 0)
		require.NoError(t, err)
		require.Len(t, res.CodeBlocks, 1)
		assert.Equal(t, "python", res.CodeBlocks[0].Lang)
		assert.True(t, res.CodeBlocks[0].Runnable)
	})

	t.Run("query 内容过滤", func(t *testing.T) {
		res, err := svc.SearchCodeBlocks(ctx, shared.NewID(), "requests", "all", false, 20, 0)
		require.NoError(t, err)
		require.Len(t, res.CodeBlocks, 1)
		assert.Contains(t, res.CodeBlocks[0].Code, "import requests")
	})

	t.Run("all 返回全部", func(t *testing.T) {
		res, err := svc.SearchCodeBlocks(ctx, shared.NewID(), "", "all", false, 20, 0)
		require.NoError(t, err)
		assert.Len(t, res.CodeBlocks, 3)
		assert.Equal(t, int64(3), res.TotalCount)
	})
}
