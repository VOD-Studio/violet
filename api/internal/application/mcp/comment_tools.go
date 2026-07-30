package mcp

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	appcomment "blog-api/internal/application/comment"
	domainapitoken "blog-api/internal/domain/api_token"
	domaincomment "blog-api/internal/domain/comment"
)

// CommentSearchService 评论检索 MCP tool 依赖的服务端口。
// application/comment.Service 实现之；抽接口便于单测 fake 替换（与 SearchService 同 seam 模式）。
type CommentSearchService interface {
	SearchComments(ctx context.Context, query string, anchorFilter domaincomment.AnchorFilter, limit, offset int) (*appcomment.SearchCommentsResult, error)
	ListRecentComments(ctx context.Context, anchorFilter domaincomment.AnchorFilter, limit, offset int) (*appcomment.SearchCommentsResult, error)
	CommentStats(ctx context.Context) (*appcomment.CommentStatsResult, error)
}

// CommentTools 评论检索 tool 集合，挂在 violet-comments server（/api/v1/mcp/comments）。
// PAT comments:read 私有视角，仅 approved；用于"读者批注→agent 检索反馈→改进文章"闭环。
type CommentTools struct {
	comments CommentSearchService
}

// NewCommentTools 构造评论检索 tool 集合。
func NewCommentTools(comments CommentSearchService) *CommentTools {
	return &CommentTools{comments: comments}
}

// --- tool 参数结构（jsonschema 由结构体 tag 推导） ---

type searchCommentsArgs struct {
	Query  string `json:"query" jsonschema:"评论关键词，在评论正文中做大小写不敏感匹配；空格分割多词，AND 逻辑"`
	Type   string `json:"type,omitempty" jsonschema:"评论类型：all / annotation（仅批注）/ free（仅自由评论，默认 all）"`
	Limit  int    `json:"limit,omitempty" jsonschema:"每页条数（默认 20，上限 50）"`
	Offset int    `json:"offset,omitempty" jsonschema:"分页偏移（默认 0；翻页传上一响应的 next_offset）"`
}

type listRecentCommentsArgs struct {
	Type   string `json:"type,omitempty" jsonschema:"评论类型：all / annotation / free（默认 all）"`
	Limit  int    `json:"limit,omitempty" jsonschema:"每页条数（默认 20，上限 50）"`
	Offset int    `json:"offset,omitempty" jsonschema:"分页偏移（默认 0；翻页传上一响应的 next_offset）"`
}

// parseCommentType 把 tool 参数的 type 字符串解析为仓储 AnchorFilter。
// 空串视为 all（对齐 AgentFilter 枚举）。
func parseCommentType(s string) (domaincomment.AnchorFilter, error) {
	switch s {
	case "", "all":
		return domaincomment.AnchorFilterAll, nil
	case "annotation":
		return domaincomment.AnchorFilterAnnotation, nil
	case "free":
		return domaincomment.AnchorFilterFree, nil
	default:
		return "", fmt.Errorf("type 必须是 all / annotation / free 之一，收到 %q", s)
	}
}

// withCommentScope 评论检索 tool 门禁：comments:read scope 校验。
// 评论含读者个人信息，需 PAT 登录（与文章公开 reader 通道对照）。
func withCommentScope(req *mcp.CallToolRequest) *mcp.CallToolResult {
	if err := requireScope(req, domainapitoken.ScopeCommentsRead); err != nil {
		return errResult(err)
	}
	return nil
}

// SearchComments 按关键词检索已审核评论/批注（需 comments:read）。
// 返回评论正文 + 所属文章；批注带 anchor.selected_text 选区原文（闭环核心）。
func (t *CommentTools) SearchComments(ctx context.Context, req *mcp.CallToolRequest, args searchCommentsArgs) (*mcp.CallToolResult, any, error) {
	if errRes := withCommentScope(req); errRes != nil {
		return errRes, nil, nil
	}
	if args.Query == "" {
		return errResult(fmt.Errorf("query 不能为空：提供评论关键词")), nil, nil
	}
	anchorFilter, err := parseCommentType(args.Type)
	if err != nil {
		return errResult(err), nil, nil
	}
	limit, offset := normalizePage(args.Limit, args.Offset)
	res, err := t.comments.SearchComments(ctx, args.Query, anchorFilter, limit, offset)
	if err != nil {
		return errResult(err), nil, nil
	}
	return finishSearch(len(res.Comments), offset, args.Query, res)
}

// ListRecentComments 按时间倒序浏览最新已审核评论（需 comments:read）。
// 与 SearchComments 区别：无 query 维度，纯时间流式浏览（看最近反馈动态）。
func (t *CommentTools) ListRecentComments(ctx context.Context, req *mcp.CallToolRequest, args listRecentCommentsArgs) (*mcp.CallToolResult, any, error) {
	if errRes := withCommentScope(req); errRes != nil {
		return errRes, nil, nil
	}
	anchorFilter, err := parseCommentType(args.Type)
	if err != nil {
		return errResult(err), nil, nil
	}
	limit, offset := normalizePage(args.Limit, args.Offset)
	res, err := t.comments.ListRecentComments(ctx, anchorFilter, limit, offset)
	if err != nil {
		return errResult(err), nil, nil
	}
	// 时间浏览无 query，空结果用通用提示（非 finishSearch 的 query 提示）
	if len(res.Comments) == 0 && offset == 0 {
		return okResult("暂无已审核评论。"), nil, nil
	}
	return okResult(res), nil, nil
}

// CommentStats 按文章聚合评论统计（需 comments:read）。
// 返回全局汇总 + 按文章明细（批注密集的优先），帮 agent 判断优先改进哪些文章。
func (t *CommentTools) CommentStats(ctx context.Context, req *mcp.CallToolRequest, _ struct{}) (*mcp.CallToolResult, any, error) {
	if errRes := withCommentScope(req); errRes != nil {
		return errRes, nil, nil
	}
	res, err := t.comments.CommentStats(ctx)
	if err != nil {
		return errResult(err), nil, nil
	}
	if len(res.Posts) == 0 {
		return okResult("暂无已审核评论反馈。"), nil, nil
	}
	return okResult(res), nil, nil
}
