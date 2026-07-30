package mcp

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	apppost "blog-api/internal/application/post"
)

// PublicPostService 公开只读通道依赖的文章服务端口。
// 仅暴露已发布视角的两个读取方法，与 PostService（含写/草稿面）分离——
// reader 是匿名端点，构造上就不该触达草稿/写能力。
type PublicPostService interface {
	GetPublishedBySlug(ctx context.Context, slug string) (apppost.PostDTO, error)
	ListPublished(ctx context.Context, page, limit int, tag string) ([]apppost.PostListItemDTO, int64, error)
}

// PublicTools 公开只读 server（violet-reader）的 Resource 集合。
// 匿名访问，仅暴露已发布文章；草稿/公告/评论均不在此域（见 PRD-0007）。
type PublicTools struct {
	posts PublicPostService
}

// NewPublicTools 构造公开只读 Resource 集合。
func NewPublicTools(posts PublicPostService) *PublicTools {
	return &PublicTools{posts: posts}
}

// readPostArgs 单篇 Resource 的 URI 模板参数（blog://posts/{slug}）。
type readPostArgs struct {
	Slug string `json:"slug"`
}

// ReadPost 处理 blog://posts/{slug}：返回已发布文章的完整 Markdown 源码。
// draft/archived/不存在 统一 NotFound（状态过滤在 PublicPostService 层完成，
// handler 零状态判断，防草稿泄露）。
func (t *PublicTools) ReadPost(ctx context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
	slug, err := slugFromURI(req.Params.URI)
	if err != nil {
		return nil, err
	}
	dto, err := t.posts.GetPublishedBySlug(ctx, slug)
	if err != nil {
		return nil, mcp.ResourceNotFoundError(req.Params.URI)
	}
	return &mcp.ReadResourceResult{
		Contents: []*mcp.ResourceContents{{
			URI:      req.Params.URI,
			MIMEType: "text/markdown",
			Text:     dto.ContentMD,
		}},
	}, nil
}

// ListPosts 处理 blog://posts：返回已发布文章目录（slug + 标题，不 dump 正文）。
// 用于 agent 发现可读文章；resources/list 不自动展开 ResourceTemplate 实例，
// 故目录需独立静态 Resource（见 PRD-0007 Resources 形状）。
func (t *PublicTools) ListPosts(ctx context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
	// 目录无分页参数入口（Resource read 不带 query）；取首页足够大的 limit
	// 覆盖个人博客量级。未来文章量增长时升级为带游标的 template 形态。
	items, _, err := t.posts.ListPublished(ctx, 1, 200, "")
	if err != nil {
		return nil, fmt.Errorf("读取文章目录失败: %w", err)
	}
	var sb []byte
	sb = append(sb, "# 已发布文章目录\n\n"...)
	for _, it := range items {
		sb = append(sb, fmt.Sprintf("- %s\t%s\n", it.Slug, it.Title)...)
	}
	return &mcp.ReadResourceResult{
		Contents: []*mcp.ResourceContents{{
			URI:      req.Params.URI,
			MIMEType: "text/markdown",
			Text:     string(sb),
		}},
	}, nil
}

// slugFromURI 从 blog://posts/{slug} 提取 slug。
// go-sdk 对 ResourceTemplate 已按 RFC 6570 匹配并填充 URI，这里只做轻量裁剪。
func slugFromURI(uri string) (string, error) {
	const prefix = "blog://posts/"
	if len(uri) <= len(prefix) || uri[:len(prefix)] != prefix {
		return "", fmt.Errorf("无法解析文章 URI: %s", uri)
	}
	slug := uri[len(prefix):]
	if slug == "" {
		return "", fmt.Errorf("文章 slug 为空: %s", uri)
	}
	return slug, nil
}
