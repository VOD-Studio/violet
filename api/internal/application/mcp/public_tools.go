package mcp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	apppost "blog-api/internal/application/post"
	appseries "blog-api/internal/application/series"
	domainshared "blog-api/internal/domain/shared"
)

// PublicPostService 公开只读通道依赖的文章服务端口。
// 仅暴露已发布视角的两个读取方法，与 PostService（含写/草稿面）分离——
// reader 是匿名端点，构造上就不该触达草稿/写能力。
type PublicPostService interface {
	GetPublishedBySlug(ctx context.Context, slug string) (apppost.PostDTO, error)
	ListPublished(ctx context.Context, tag string, q domainshared.PageQuery) (domainshared.PageResult[apppost.PostListItemDTO], error)
}

// PublicSeriesService 公开只读通道依赖的系列书服务端口（仅已发布视角）。
type PublicSeriesService interface {
	ListPublished(ctx context.Context, page, limit int) ([]appseries.SeriesDTO, int64, error)
	GetBySlug(ctx context.Context, slug string) (appseries.SeriesDetailDTO, error)
}

// PublicTools 公开只读 server（violet-reader）的 Resource 集合。
// 匿名访问，仅暴露已发布文章；草稿/公告/评论均不在此域（见 PRD-0007）。
type PublicTools struct {
	posts  PublicPostService
	series PublicSeriesService
}

// NewPublicTools 构造公开只读 Resource 集合。series 传 *appseries.Service。
func NewPublicTools(posts PublicPostService, series PublicSeriesService) *PublicTools {
	return &PublicTools{posts: posts, series: series}
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
// publicListLimit 文章目录的取数上限：目录无分页参数入口（Resource read 不带
// query），取足够大的上限覆盖个人博客量级。未来文章量增长时升级为带游标的
// template 形态。
const publicListLimit = 200

// ListPosts 处理 blog://posts：返回已发布文章目录（slug + 标题，不 dump 正文）。
// 用于 agent 发现可读文章；resources/list 不自动展开 ResourceTemplate 实例，
// 故目录需独立静态 Resource（见 PRD-0007 Resources 形状）。
func (t *PublicTools) ListPosts(ctx context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
	// ListPublished 经 Normalize 钳制单页上限 100，按页聚合到目录上限。
	var items []apppost.PostListItemDTO
	for page := 1; len(items) < publicListLimit; page++ {
		result, err := t.posts.ListPublished(ctx, "", domainshared.PageQuery{Page: page, Limit: domainshared.MaxPageLimit})
		if err != nil {
			return nil, fmt.Errorf("读取文章目录失败: %w", err)
		}
		items = append(items, result.Items...)
		if len(result.Items) == 0 || int64(len(items)) >= result.Total {
			break
		}
	}
	if len(items) > publicListLimit {
		items = items[:publicListLimit]
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


// ============================================================
// 系列书 Resource（#272）：blog://series/{slug} + blog://series
// ============================================================

// readSeriesArgs 单本书 Resource 的 URI 模板参数（blog://series/{slug}）。
type readSeriesArgs struct {
	Slug string `json:"slug"`
}

// ReadSeries 处理 blog://series/{slug}：返回书的完整目录树（卷/部/章），
// 各章带 slug 指向 blog://posts/{slug}，agent 可逐章跳转读正文。
// draft 书 → NotFound（GetBySlug 公开视角已过滤）。
// 刻意不做 blog://series/{slug}/{chapter}：章节就是文章，内容读取走 posts Resource。
func (t *PublicTools) ReadSeries(ctx context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
	slug, err := seriesSlugFromURI(req.Params.URI)
	if err != nil {
		return nil, err
	}
	dto, err := t.series.GetBySlug(ctx, slug)
	if err != nil {
		// 不存在 → 资源 404；其余（DB/内部）原样透传，agent 可区分两种失败（评审修复）
		var notFound *domainshared.DomainError
		if errors.As(err, &notFound) && notFound.Code == domainshared.CodeNotFound {
			return nil, mcp.ResourceNotFoundError(req.Params.URI)
		}
		return nil, fmt.Errorf("读取系列书失败: %w", err)
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "# %s\n\n", dto.Title)
	if dto.Description != "" {
		fmt.Fprintf(&sb, "> %s\n\n", dto.Description)
	}
	if len(dto.RootChapters) > 0 {
		sb.WriteString("## 章节\n\n")
		for _, ch := range dto.RootChapters {
			fmt.Fprintf(&sb, "%d. [%s](blog://posts/%s)\n", ch.ChapterNo, ch.Title, ch.Slug)
		}
		sb.WriteString("\n")
	}
	for _, sec := range dto.Sections {
		fmt.Fprintf(&sb, "## %s\n\n", sec.Section.Title)
		for _, ch := range sec.Chapters {
			fmt.Fprintf(&sb, "%d. [%s](blog://posts/%s)\n", ch.ChapterNo, ch.Title, ch.Slug)
		}
		sb.WriteString("\n")
	}
	return &mcp.ReadResourceResult{
		Contents: []*mcp.ResourceContents{{
			URI:      req.Params.URI,
			MIMEType: "text/markdown",
			Text:     sb.String(),
		}},
	}, nil
}

// ListSeries 处理 blog://series：书目录（slug + 书名 + 章数），与 posts-index 同构。
func (t *PublicTools) ListSeries(ctx context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
	var items []appseries.SeriesDTO
	for page := 1; len(items) < publicListLimit; page++ {
		result, _, err := t.series.ListPublished(ctx, page, domainshared.MaxPageLimit)
		if err != nil {
			return nil, fmt.Errorf("读取系列书目录失败: %w", err)
		}
		items = append(items, result...)
		if len(result) == 0 {
			break
		}
	}
	if len(items) > publicListLimit {
		items = items[:publicListLimit]
	}
	var sb strings.Builder
	sb.WriteString("# 已发布系列书目录\n\n")
	for _, it := range items {
		fmt.Fprintf(&sb, "- %s\t%s（%d 章）\n", it.Slug, it.Title, it.ChapterCount)
	}
	return &mcp.ReadResourceResult{
		Contents: []*mcp.ResourceContents{{
			URI:      req.Params.URI,
			MIMEType: "text/markdown",
			Text:     sb.String(),
		}},
	}, nil
}

// seriesSlugFromURI 从 blog://series/{slug} 提取 slug。
func seriesSlugFromURI(uri string) (string, error) {
	const prefix = "blog://series/"
	if len(uri) <= len(prefix) || uri[:len(prefix)] != prefix {
		return "", fmt.Errorf("无法解析系列书 URI: %s", uri)
	}
	slug := uri[len(prefix):]
	if slug == "" {
		return "", fmt.Errorf("系列书 slug 为空: %s", uri)
	}
	return slug, nil
}
