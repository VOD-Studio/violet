package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	appcomment "blog-api/internal/application/comment"
	apppost "blog-api/internal/application/post"
	"blog-api/internal/brand"
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

// CommentWriteService 评论写入端口（自由评论 / 划线批注 / 段评共用 Create）。
type CommentWriteService interface {
	Create(ctx context.Context, in appcomment.CreateInput) (appcomment.CommentDTO, error)
}

// CommentPostLookup 按 slug 解析已发布文章，供 create_* 接受 slug 入参。
type CommentPostLookup interface {
	GetPublishedBySlug(ctx context.Context, slug string) (apppost.PostDTO, error)
	GetPublishedByID(ctx context.Context, id string) (apppost.PostDTO, error)
}

// CommentTools 评论检索 + 写入 tool 集合，挂在 violet-comments server（/api/v1/mcp/comments）。
// 读：PAT comments:read，仅 approved；写：PAT comments:write，以持有人身份发表（登录态）。
type CommentTools struct {
	comments CommentSearchService
	writer   CommentWriteService
	posts    CommentPostLookup
}

// NewCommentTools 构造评论 tool 集合。writer/posts 仅写入 tool 需要；检索单测可传 nil。
func NewCommentTools(comments CommentSearchService, writer CommentWriteService, posts CommentPostLookup) *CommentTools {
	return &CommentTools{comments: comments, writer: writer, posts: posts}
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

type createCommentArgs struct {
	PostID   string `json:"post_id,omitempty" jsonschema:"文章 ID；与 slug 二选一"`
	Slug     string `json:"slug,omitempty" jsonschema:"文章 slug（如 react-tweet-intro-native-react-card）；与 post_id 二选一"`
	Body     string `json:"body" jsonschema:"评论正文（纯文本，可含 [emoji] 占位）"`
	ParentID string `json:"parent_id,omitempty" jsonschema:"父评论 ID；非空表示回复（需登录，由 PAT 持有人身份发表）"`
}

type createAnnotationArgs struct {
	PostID        string `json:"post_id,omitempty" jsonschema:"文章 ID；与 slug 二选一"`
	Slug          string `json:"slug,omitempty" jsonschema:"文章 slug；与 post_id 二选一"`
	Body          string `json:"body" jsonschema:"批注正文"`
	ParentID      string `json:"parent_id,omitempty" jsonschema:"父评论 ID；回复批注时传入，子评继承父锚点，此时忽略选区参数"`
	BlockID       string `json:"block_id,omitempty" jsonschema:"块标识（块纯文本 SHA-256 前 8 位 hex）；缺省且提供 block_text 时自动计算"`
	StartOffset   *int   `json:"start_offset,omitempty" jsonschema:"选区起始偏移（块内字符位，0-based，与浏览器 string.length/UTF-16 一致）；顶级批注必填，回复可省略"`
	EndOffset     *int   `json:"end_offset,omitempty" jsonschema:"选区结束偏移（exclusive，必须大于 start_offset）；顶级批注必填，回复可省略"`
	SelectedText  string `json:"selected_text,omitempty" jsonschema:"选中的原文（fuzzy 重定位锚）；顶级批注必填，回复可省略"`
	BlockTextHash string `json:"block_text_hash,omitempty" jsonschema:"创建时块内容快照（SHA-256 前 8 位）；缺省且提供 block_text 时自动计算"`
	BlockText     string `json:"block_text,omitempty" jsonschema:"所在块纯文本；用于自动补齐 block_id / block_text_hash（与前端 computeBlockId 一致）"`
}

type createBlockCommentArgs struct {
	PostID    string `json:"post_id,omitempty" jsonschema:"文章 ID；与 slug 二选一"`
	Slug      string `json:"slug,omitempty" jsonschema:"文章 slug；与 post_id 二选一"`
	Body      string `json:"body" jsonschema:"段评正文"`
	BlockText string `json:"block_text" jsonschema:"目标段落的纯文本（与正文渲染后的 textContent 一致）；服务端据此生成覆盖全块的锚点"`
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
func withCommentScope(req *mcp.CallToolRequest) *mcp.CallToolResult {
	if err := requireScope(req, domainapitoken.ScopeCommentsRead); err != nil {
		return errResult(err)
	}
	return nil
}

// withCommentWriteScope 评论写入 tool 门禁：comments:write scope 校验。
func withCommentWriteScope(req *mcp.CallToolRequest) *mcp.CallToolResult {
	if err := requireScope(req, domainapitoken.ScopeCommentsWrite); err != nil {
		return errResult(err)
	}
	return nil
}

// resolvePostID 解析文章 ID：显式 post_id 优先；否则用 slug 查已发布文章。
func (t *CommentTools) resolvePostID(ctx context.Context, postID, slug string) (string, error) {
	postID = strings.TrimSpace(postID)
	slug = strings.TrimSpace(slug)
	if postID == "" && slug == "" {
		return "", fmt.Errorf("必须提供 post_id 或 slug 之一")
	}
	if t.posts == nil {
		return "", fmt.Errorf("未配置文章查找，无法解析文章")
	}
	if postID != "" {
		// post_id 同样只允许已发布文章，防止向草稿/归档文章写评论。
		dto, err := t.posts.GetPublishedByID(ctx, postID)
		if err != nil {
			return "", fmt.Errorf("按 post_id 查找已发布文章失败（post_id=%s）: %w", postID, err)
		}
		return dto.ID, nil
	}
	dto, err := t.posts.GetPublishedBySlug(ctx, slug)
	if err != nil {
		return "", fmt.Errorf("按 slug 查找已发布文章失败（slug=%s）: %w", slug, err)
	}
	if dto.ID == "" {
		return "", fmt.Errorf("文章 ID 为空（slug=%s）", slug)
	}
	return dto.ID, nil
}

// createAsPAT 以 PAT 持有人身份创建评论（登录路径；author_* 由 comment.Service 从 user 资料补齐）。
func (t *CommentTools) createAsPAT(ctx context.Context, req *mcp.CallToolRequest, postID, body, parentID string, anchor *domaincomment.Anchor, requireParentAnchor bool) (*mcp.CallToolResult, any, error) {
	if t.writer == nil {
		return errResult(fmt.Errorf("未配置评论写入服务")), nil, nil
	}
	userID := operatorUserID(req)
	if userID == "" {
		return errResult(fmt.Errorf("未认证：缺少访问令牌")), nil, nil
	}
	body = strings.TrimSpace(body)
	if body == "" {
		return errResult(fmt.Errorf("body 不能为空")), nil, nil
	}
	// AI 身份：专用昵称 + 站点 logo 头像 + is_ai，不用 PAT 持有人的 Google/GitHub 头像。
	dto, err := t.writer.Create(ctx, appcomment.CreateInput{
		PostID:     postID,
		ParentID:   strings.TrimSpace(parentID),
		UserID:     userID,
		AuthorName: brand.MCPAgentDisplayName,
		AvatarURL:  brand.MCPAgentAvatarURL,
		Body:       body,
		Anchor:              anchor,
		IsAI:                true,
		RequireParentAnchor: requireParentAnchor,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
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

// CreateComment 发表底部自由评论（无锚点；需 comments:write）。
// 以 PAT 持有人身份登录发表；站点开启审核时 status=pending，否则 approved。
func (t *CommentTools) CreateComment(ctx context.Context, req *mcp.CallToolRequest, args createCommentArgs) (*mcp.CallToolResult, any, error) {
	if errRes := withCommentWriteScope(req); errRes != nil {
		return errRes, nil, nil
	}
	postID, err := t.resolvePostID(ctx, args.PostID, args.Slug)
	if err != nil {
		return errResult(err), nil, nil
	}
	return t.createAsPAT(ctx, req, postID, args.Body, args.ParentID, nil, false)
}

// CreateAnnotation 发表划线批注（选区锚点五元组；需 comments:write）。
// 批注强制登录；可传 block_text 让服务端补齐 block_id / block_text_hash。
func (t *CommentTools) CreateAnnotation(ctx context.Context, req *mcp.CallToolRequest, args createAnnotationArgs) (*mcp.CallToolResult, any, error) {
	if errRes := withCommentWriteScope(req); errRes != nil {
		return errRes, nil, nil
	}
	postID, err := t.resolvePostID(ctx, args.PostID, args.Slug)
	if err != nil {
		return errResult(err), nil, nil
	}
	// 回复批注：子评继承父锚点（comment.Service 对 parent 有 anchor 的回复要求 anchor 为 nil），忽略调用方的选区参数。
	if strings.TrimSpace(args.ParentID) != "" {
		return t.createAsPAT(ctx, req, postID, args.Body, args.ParentID, nil, true)
	}
	if args.StartOffset == nil || args.EndOffset == nil || strings.TrimSpace(args.SelectedText) == "" {
		return errResult(fmt.Errorf("顶级批注需要 start_offset、end_offset 与 selected_text")), nil, nil
	}
	anchor, err := appcomment.ResolveAnnotationAnchor(
		strings.TrimSpace(args.BlockID),
		*args.StartOffset,
		*args.EndOffset,
		args.SelectedText,
		strings.TrimSpace(args.BlockTextHash),
		args.BlockText,
	)
	if err != nil {
		return errResult(err), nil, nil
	}
	return t.createAsPAT(ctx, req, postID, args.Body, args.ParentID, anchor, false)
}

// CreateBlockComment 发表段评（整块锚点；需 comments:write）。
// 传入段落纯文本 block_text，服务端生成覆盖全块的锚点（与前端段评入口一致）。
func (t *CommentTools) CreateBlockComment(ctx context.Context, req *mcp.CallToolRequest, args createBlockCommentArgs) (*mcp.CallToolResult, any, error) {
	if errRes := withCommentWriteScope(req); errRes != nil {
		return errRes, nil, nil
	}
	postID, err := t.resolvePostID(ctx, args.PostID, args.Slug)
	if err != nil {
		return errResult(err), nil, nil
	}
	anchor, err := appcomment.BuildFullBlockAnchor(args.BlockText)
	if err != nil {
		return errResult(err), nil, nil
	}
	return t.createAsPAT(ctx, req, postID, args.Body, "", anchor, false)
}
