package mcp

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	apppost "blog-api/internal/application/post"
	domainapitoken "blog-api/internal/domain/api_token"
	"blog-api/internal/domain/shared"
)

// SearchService MCP 检索 tool 依赖的检索服务端口。
// application/post.Service 实现之；抽接口便于单测 fake 替换（与 PostService 分离，
// 检索消费方不需要 CRUD 面）。
type SearchService interface {
	SearchPosts(ctx context.Context, authorID shared.ID, query, status string, q shared.PageQuery) (*apppost.SearchPostsResult, error)
	SearchFormulas(ctx context.Context, authorID shared.ID, query string, limit, offset int) (*apppost.SearchFormulasResult, error)
	SearchCodeBlocks(ctx context.Context, authorID shared.ID, query, lang string, runnableOnly bool, limit, offset int) (*apppost.SearchCodeBlocksResult, error)
}

// SearchTools 文章检索 tool 集合，挂在文章 MCP server（/api/v1/mcp）上。
// 私有写作助手视角：PAT + posts:read，检索范围 = PAT 持有人的全部文章（含草稿）。
type SearchTools struct {
	search SearchService
}

// NewSearchTools 构造检索 tool 集合。
func NewSearchTools(search SearchService) *SearchTools {
	return &SearchTools{search: search}
}

// --- 检索 tool 参数结构（jsonschema 由结构体 tag 推导） ---

type searchPostsArgs struct {
	Query  string `json:"query" jsonschema:"检索关键词，在标题/摘要/正文中做大小写不敏感匹配；空格分割多词，AND 逻辑"`
	Status string `json:"status,omitempty" jsonschema:"状态过滤：all / draft / published / archived（默认 all）"`
	Limit  int    `json:"limit,omitempty" jsonschema:"每页条数（默认 20，上限 50）"`
	Offset int    `json:"offset,omitempty" jsonschema:"分页偏移（默认 0；翻页传上一响应的 next_offset）"`
}

type searchFormulasArgs struct {
	Query  string `json:"query" jsonschema:"LaTeX 源码片段，如 \\frac、\\ket、\\ce{H2O}（大小写敏感）"`
	Limit  int    `json:"limit,omitempty" jsonschema:"每页条数（默认 20，上限 50）"`
	Offset int    `json:"offset,omitempty" jsonschema:"分页偏移（默认 0；翻页传上一响应的 next_offset）"`
}

type searchCodeBlocksArgs struct {
	Query        string `json:"query,omitempty" jsonschema:"代码内容关键词（可选，大小写敏感）"`
	Lang         string `json:"lang,omitempty" jsonschema:"语言过滤：python / node / go / rust / bun / all（默认 all）"`
	RunnableOnly bool   `json:"runnable_only,omitempty" jsonschema:"只返回带 runnable 标记的可运行块（默认 false）"`
	Limit        int    `json:"limit,omitempty" jsonschema:"每页条数（默认 20，上限 50）"`
	Offset       int    `json:"offset,omitempty" jsonschema:"分页偏移（默认 0；翻页传上一响应的 next_offset）"`
}

const (
	searchDefaultLimit = 20
	searchMaxLimit     = 50
)

// normalizePage 应用分页默认值与钳制：limit 缺省 20、上限 50；offset 负值归零。
func normalizePage(limit, offset int) (int, int) {
	if limit <= 0 {
		limit = searchDefaultLimit
	}
	if limit > searchMaxLimit {
		limit = searchMaxLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// operatorID 解析 PAT 持有人 user_id 为 shared.ID；非法返回错误。
func operatorID(req *mcp.CallToolRequest) (shared.ID, error) {
	return shared.ParseID(operatorUserID(req))
}

// emptyHint 空结果的可操作提示（错误即指令：教 agent 自我纠正而非卡住）。
func emptyHint(query string) *mcp.CallToolResult {
	return okResult(fmt.Sprintf(
		"未找到匹配 %q。建议：缩短关键词 / 换英文术语 / 去掉空格用单词重试。", query))
}

// withSearchAuth 检索 tool 公共门禁：posts:read scope 校验 + PAT 持有人解析。
// 失败时返回已包装好的 tool error（调用方直接 return）。
func withSearchAuth(req *mcp.CallToolRequest) (shared.ID, *mcp.CallToolResult) {
	if err := requireScope(req, domainapitoken.ScopePostsRead); err != nil {
		return shared.ID{}, errResult(err)
	}
	authorID, err := operatorID(req)
	if err != nil {
		return shared.ID{}, errResult(fmt.Errorf("PAT 持有人 ID 非法: %w", err))
	}
	return authorID, nil
}

// finishSearch 检索 tool 公共出口：首页空结果给可操作提示（错误即指令），
// 翻页后的空页是正常分页终止，返回 JSON；其余返回序列化结果。
func finishSearch(itemCount, offset int, query string, payload any) (*mcp.CallToolResult, any, error) {
	if itemCount == 0 && offset == 0 {
		return emptyHint(query), nil, nil
	}
	return okResult(payload), nil, nil
}

// SearchPosts 全文检索自己的文章（含草稿），返回标题与上下文片段（需 posts:read）。
func (t *SearchTools) SearchPosts(ctx context.Context, req *mcp.CallToolRequest, args searchPostsArgs) (*mcp.CallToolResult, any, error) {
	authorID, errRes := withSearchAuth(req)
	if errRes != nil {
		return errRes, nil, nil
	}
	if args.Query == "" {
		return errResult(fmt.Errorf("query 不能为空：提供检索关键词，如「量子」「transformer」")), nil, nil
	}
	status := args.Status
	if status == "" {
		status = "all"
	}
	switch status {
	case "all", "draft", "published", "archived":
	default:
		return errResult(fmt.Errorf("status 必须是 all / draft / published / archived 之一，收到 %q", args.Status)), nil, nil
	}
	limit, offset := normalizePage(args.Limit, args.Offset)
	res, err := t.search.SearchPosts(ctx, authorID, args.Query, status, shared.PageQuery{
		Page: offset/limit + 1, Limit: limit,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	return finishSearch(len(res.Posts), offset, args.Query, res)
}

// SearchFormulas 按 LaTeX 源码片段检索文章中的公式（需 posts:read）。
func (t *SearchTools) SearchFormulas(ctx context.Context, req *mcp.CallToolRequest, args searchFormulasArgs) (*mcp.CallToolResult, any, error) {
	authorID, errRes := withSearchAuth(req)
	if errRes != nil {
		return errRes, nil, nil
	}
	if args.Query == "" {
		return errResult(fmt.Errorf("query 不能为空：提供 LaTeX 片段，如 \\frac、\\ket、\\ce{H2O}")), nil, nil
	}
	limit, offset := normalizePage(args.Limit, args.Offset)
	res, err := t.search.SearchFormulas(ctx, authorID, args.Query, limit, offset)
	if err != nil {
		return errResult(err), nil, nil
	}
	return finishSearch(len(res.Formulas), offset, args.Query, res)
}

// SearchCodeBlocks 按语言/内容检索文章中的代码块（需 posts:read）。
func (t *SearchTools) SearchCodeBlocks(ctx context.Context, req *mcp.CallToolRequest, args searchCodeBlocksArgs) (*mcp.CallToolResult, any, error) {
	authorID, errRes := withSearchAuth(req)
	if errRes != nil {
		return errRes, nil, nil
	}
	lang := args.Lang
	if lang == "" {
		lang = "all"
	}
	switch lang {
	case "all", "python", "node", "go", "rust", "bun":
	default:
		return errResult(fmt.Errorf("lang 必须是 python / node / go / rust / bun / all 之一，收到 %q", args.Lang)), nil, nil
	}
	limit, offset := normalizePage(args.Limit, args.Offset)
	res, err := t.search.SearchCodeBlocks(ctx, authorID, args.Query, lang, args.RunnableOnly, limit, offset)
	if err != nil {
		return errResult(err), nil, nil
	}
	return finishSearch(len(res.CodeBlocks), offset, args.Query, res)
}
