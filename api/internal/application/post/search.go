package post

import (
	"context"
	"strings"
	"time"

	domain "blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
)

// 检索编排：为 MCP 检索 tool（PRD-0006 S1）提供用例层支撑。
//
// 两层过滤的必然性：仓储 ILIKE 只能初筛「文章粒度」，公式/代码块是「元素粒度」，
// 元素级精准过滤（LaTeX 含片段、语言/runnable 标记）必须在 Go 侧用提取器完成。
//
// 分页形态的差异：
//   - SearchPosts：文章粒度，直接复用仓储分页（total_count 精确）。
//   - SearchFormulas / SearchCodeBlocks：元素粒度，先初筛全部候选文章（上限
//     searchCandidateLimit，个人博客规模足够），内存中提取+过滤后精确分页。

// searchCandidateLimit 元素级检索的候选文章上限。超出部分截断——
// 个人博客文章量远小于此，截断只影响理论完备性。
const searchCandidateLimit = 500

// PageMeta 分页元数据，内嵌进各检索结果（JSON 展平，契约字段不变）。
type PageMeta struct {
	TotalCount int64 `json:"total_count"`
	HasMore    bool  `json:"has_more"`
	NextOffset int   `json:"next_offset"`
}

// newPageMeta 由总数与当前页形态推导分页元数据。
func newPageMeta(total int64, offset, pageLen int) PageMeta {
	next := offset + pageLen
	return PageMeta{
		TotalCount: total,
		HasMore:    int64(next) < total,
		NextOffset: next,
	}
}

// SearchPostItem 检索命中的文章（snippet 替代全文，保护 agent 上下文窗口）。
type SearchPostItem struct {
	ID        string    `json:"id"`
	Slug      string    `json:"slug"`
	Title     string    `json:"title"`
	Status    string    `json:"status"` // 状态机：draft/published/archived
	Tags      []string  `json:"tags"`
	Snippet   string    `json:"snippet"`
	UpdatedAt time.Time `json:"updated_at"`
}

// SearchPostsResult 文章检索结果 + 分页元数据。
type SearchPostsResult struct {
	Posts []SearchPostItem `json:"posts"`
	PageMeta
}

// SearchFormulaItem 检索命中的公式。
type SearchFormulaItem struct {
	PostID         string `json:"post_id"`
	PostSlug       string `json:"post_slug"`
	PostTitle      string `json:"post_title"`
	Latex          string `json:"latex"`
	DisplayMode    string `json:"display_mode"` // inline / block
	ContextSnippet string `json:"context_snippet"`
}

// SearchFormulasResult 公式检索结果 + 分页元数据。
type SearchFormulasResult struct {
	Formulas []SearchFormulaItem `json:"formulas"`
	PageMeta
}

// SearchCodeBlockItem 检索命中的代码块。
type SearchCodeBlockItem struct {
	PostID    string `json:"post_id"`
	PostSlug  string `json:"post_slug"`
	PostTitle string `json:"post_title"`
	Lang      string `json:"lang"`
	Runnable  bool   `json:"runnable"`
	Code      string `json:"code"`
}

// SearchCodeBlocksResult 代码块检索结果 + 分页元数据。
type SearchCodeBlocksResult struct {
	CodeBlocks []SearchCodeBlockItem `json:"code_blocks"`
	PageMeta
}

// SearchPosts 文章检索：仓储分页 + snippet 生成。
// q.Offset 需为 limit 的整数倍（MCP 从 0 起按 next_offset 翻页，天然满足）。
func (s *Service) SearchPosts(ctx context.Context, authorID shared.ID, query, status string, q shared.PageQuery) (*SearchPostsResult, error) {
	q = q.Normalize()
	result, err := s.repo.FindPage(ctx, domain.ListFilter{
		AuthorID: &authorID, Keyword: query, Status: status, Sort: domain.SortUpdated,
	}, q)
	if err != nil {
		return nil, err
	}
	keywords := strings.Fields(query)
	items := make([]SearchPostItem, 0, len(result.Items))
	for _, p := range result.Items {
		items = append(items, SearchPostItem{
			ID:        p.ID().String(),
			Slug:      p.Slug(),
			Title:     p.Title(),
			Status:    p.Status(),
			Tags:      p.Tags(),
			Snippet:   makeSnippet(p.Title(), p.Excerpt(), p.ContentMD(), keywords, snippetWindow),
			UpdatedAt: p.UpdatedAt(),
		})
	}
	return &SearchPostsResult{
		Posts:    items,
		PageMeta: newPageMeta(result.Total, q.Offset(), len(items)),
	}, nil
}

// SearchPublished 前台公开搜索：在已发布文章内检索，复用 snippet 生成。
// 与 SearchPosts 的区别：无 authorID 过滤（公开），固定 status=published（仓储层收敛）。
func (s *Service) SearchPublished(ctx context.Context, query string, q shared.PageQuery) (*SearchPostsResult, error) {
	q = q.Normalize()
	result, err := s.repo.FindPage(ctx, domain.ListFilter{
		Status: domain.StatusPublished, Keyword: query, Sort: domain.SortUpdated,
	}, q)
	if err != nil {
		return nil, err
	}
	keywords := strings.Fields(query)
	items := make([]SearchPostItem, 0, len(result.Items))
	for _, p := range result.Items {
		items = append(items, SearchPostItem{
			ID:        p.ID().String(),
			Slug:      p.Slug(),
			Title:     p.Title(),
			Status:    p.Status(),
			Tags:      p.Tags(),
			Snippet:   makeSnippet(p.Title(), p.Excerpt(), p.ContentMD(), keywords, snippetWindow),
			UpdatedAt: p.UpdatedAt(),
		})
	}
	return &SearchPostsResult{
		Posts:    items,
		PageMeta: newPageMeta(result.Total, q.Offset(), len(items)),
	}, nil
}

// SearchFormulas 公式检索：ILIKE 初筛候选文章 → 提取器解析 → LaTeX 含 query 过滤。
// query 是 LaTeX 源码片段，大小写敏感（LaTeX 命令语义敏感，\Frac ≠ \frac）。
// 无漏保证：latex 是 content_md 的子串，初筛必命中含目标公式的文章。
func (s *Service) SearchFormulas(ctx context.Context, authorID shared.ID, query string, limit, offset int) (*SearchFormulasResult, error) {
	candidates, err := s.fetchCandidates(ctx, authorID, query)
	if err != nil {
		return nil, err
	}
	matched := make([]SearchFormulaItem, 0)
	for _, p := range candidates {
		formulas, _ := ExtractMarkdownElements(p.ContentMD())
		for _, f := range formulas {
			if !strings.Contains(f.Latex, query) {
				continue
			}
			matched = append(matched, SearchFormulaItem{
				PostID:         p.ID().String(),
				PostSlug:       p.Slug(),
				PostTitle:      p.Title(),
				Latex:          f.Latex,
				DisplayMode:    f.DisplayMode(),
				ContextSnippet: contextWindow(p.ContentMD(), f.Start, f.End, snippetWindow),
			})
		}
	}
	page, meta := paginateSlice(matched, limit, offset)
	return &SearchFormulasResult{
		Formulas: page,
		PageMeta: meta,
	}, nil
}

// SearchCodeBlocks 代码块检索：初筛 → 提取 → 按 lang/runnable/query 过滤。
// lang 为 all 或空串不过滤；query 为空串不过滤（检索全部代码块）。
// 大小写敏感：代码标识符语义敏感。
func (s *Service) SearchCodeBlocks(ctx context.Context, authorID shared.ID, query, lang string, runnableOnly bool, limit, offset int) (*SearchCodeBlocksResult, error) {
	// query 为空时仓储无法关键词初筛，退化为全量候选（仍按 author 隔离）。
	candidates, err := s.fetchCandidates(ctx, authorID, query)
	if err != nil {
		return nil, err
	}
	filterLang := lang != "" && lang != "all"
	matched := make([]SearchCodeBlockItem, 0)
	for _, p := range candidates {
		_, blocks := ExtractMarkdownElements(p.ContentMD())
		for _, b := range blocks {
			if filterLang && b.Lang != lang {
				continue
			}
			if runnableOnly && !b.Runnable {
				continue
			}
			if query != "" && !strings.Contains(b.Code, query) {
				continue
			}
			matched = append(matched, SearchCodeBlockItem{
				PostID:    p.ID().String(),
				PostSlug:  p.Slug(),
				PostTitle: p.Title(),
				Lang:      b.Lang,
				Runnable:  b.Runnable,
				Code:      b.Code,
			})
		}
	}
	page, meta := paginateSlice(matched, limit, offset)
	return &SearchCodeBlocksResult{
		CodeBlocks: page,
		PageMeta:   meta,
	}, nil
}

// fetchCandidates 元素级检索的候选文章初筛：按 updated_at 倒序取上限
// searchCandidateLimit 篇。FindPage 经 Normalize 钳制单页上限 100，超出时
// 按页聚合到候选上限——个人博客量级通常一页取满。query 为空时退化为全量
// 候选（仍按作者隔离）。
func (s *Service) fetchCandidates(ctx context.Context, authorID shared.ID, query string) ([]*domain.Post, error) {
	filter := domain.ListFilter{AuthorID: &authorID, Keyword: query, Status: "all", Sort: domain.SortUpdated}
	var all []*domain.Post
	for page := 1; len(all) < searchCandidateLimit; page++ {
		result, err := s.repo.FindPage(ctx, filter, shared.PageQuery{Page: page, Limit: shared.MaxPageLimit})
		if err != nil {
			return nil, err
		}
		all = append(all, result.Items...)
		if len(result.Items) == 0 || int64(len(all)) >= result.Total {
			break
		}
	}
	if len(all) > searchCandidateLimit {
		all = all[:searchCandidateLimit]
	}
	return all, nil
}

// snippetWindow snippet 上下文窗口半径（命中点前后各约 80 字符）。
const snippetWindow = 80

// makeSnippet 在 title/excerpt/contentMD 中找首个命中列，返回该列中
// 首个命中关键词前后各约 window 字符的上下文窗口（纯文本，多字节安全）。
// 多关键词时取在文本中出现最早的那个定位窗口。无命中时回退为开头窗口。
func makeSnippet(title, excerpt, contentMD string, keywords []string, window int) string {
	for _, text := range []string{title, excerpt, contentMD} {
		if text == "" {
			continue
		}
		pos, kwLen := earliestHit(text, keywords)
		if pos < 0 {
			continue
		}
		return windowAround(text, pos, pos+kwLen, window)
	}
	// 无命中（理论上仓储已保证至少一列命中，防御性回退）
	return windowAround(contentMD, 0, 0, window)
}

// contextWindow 返回 text 中 [start, end) 区间前后各约 window 字符的上下文。
func contextWindow(text string, start, end, window int) string {
	return windowAround(text, start, end, window)
}

// earliestHit 返回 keywords 在 text 中最早出现的字节位置与词长（大小写不敏感）。
// 无命中返回 (-1, 0)。
func earliestHit(text string, keywords []string) (int, int) {
	lower := strings.ToLower(text)
	best, bestLen := -1, 0
	for _, kw := range keywords {
		if kw == "" {
			continue
		}
		if idx := strings.Index(lower, strings.ToLower(kw)); idx >= 0 && (best < 0 || idx < best) {
			best, bestLen = idx, len(kw)
		}
	}
	return best, bestLen
}

// windowAround 截取 text 中 [start, end) 前后各约 window 个 rune 的窗口，
// 窗口未达边界时加省略号。字节偏移经 []rune 转换，不截断多字节字符。
func windowAround(text string, start, end, window int) string {
	runes := []rune(text)
	// 字节偏移 → rune 偏移
	rStart := len([]rune(text[:start]))
	rEnd := len([]rune(text[:end]))

	from := rStart - window
	if from < 0 {
		from = 0
	}
	to := rEnd + window
	if to > len(runes) {
		to = len(runes)
	}
	// 行内紧凑：换行折叠为空格，snippet 单段呈现
	snippet := strings.Join(strings.Fields(string(runes[from:to])), " ")
	if from > 0 {
		snippet = "…" + snippet
	}
	if to < len(runes) {
		snippet += "…"
	}
	return snippet
}

// paginateSlice 元素级内存分页，返回当前页与分页元数据。
func paginateSlice[T any](items []T, limit, offset int) (page []T, meta PageMeta) {
	total := int64(len(items))
	if offset >= len(items) {
		return []T{}, PageMeta{TotalCount: total, HasMore: false, NextOffset: offset}
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	return items[offset:end], newPageMeta(total, offset, end-offset)
}
