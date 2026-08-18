package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	apppost "blog-api/internal/application/post"
	appsub "blog-api/internal/application/subscription"
	domainapitoken "blog-api/internal/domain/api_token"
	domainshared "blog-api/internal/domain/shared"
)

// errResult 把 error 包成 MCP tool error（IsError=true + 文本内容），不作为 protocol error。
func errResult(err error) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		IsError: true,
		Content: []mcp.Content{&mcp.TextContent{Text: err.Error()}},
	}
}

// okResult 把任意值序列化为 JSON 文本结果。
func okResult(v any) *mcp.CallToolResult {
	b, err := json.Marshal(v)
	if err != nil {
		return errResult(fmt.Errorf("序列化结果失败: %w", err))
	}
	return &mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: string(b)}},
	}
}

// CreatePost 创建草稿文章（需 posts:write）。AuthorID 取自 PAT 持有人。
func (t *PostTools) CreatePost(ctx context.Context, req *mcp.CallToolRequest, args createPostArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsWrite); err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.posts.Create(ctxWithOperator(ctx, operatorUserID(req)), apppost.CreateInput{
		AuthorID: operatorUserID(req),
		Title:    args.Title, Slug: args.Slug,
		ContentHTML: args.ContentHTML, ContentMD: args.ContentMD, Excerpt: args.Excerpt,
		CoverImage: args.CoverImage, CanonicalURL: args.CanonicalURL, Tags: args.Tags,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// UpdatePost 更新文章内容（需 posts:write）。操作者取自 PAT 持有人。
func (t *PostTools) UpdatePost(ctx context.Context, req *mcp.CallToolRequest, args updatePostArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsWrite); err != nil {
		return errResult(err), nil, nil
	}
	err := t.posts.Update(ctxWithOperator(ctx, operatorUserID(req)), apppost.UpdateInput{
		ID: args.ID, Title: args.Title, Slug: args.Slug,
		ContentHTML: args.ContentHTML, ContentMD: args.ContentMD, Excerpt: args.Excerpt,
		CoverImage: args.CoverImage, CanonicalURL: args.CanonicalURL, Tags: args.Tags,
	}, operatorUserID(req))
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]any{"id": args.ID, "updated": true}), nil, nil
}

// PublishPost 发布草稿文章（需 posts:publish，与 write 独立）。
func (t *PostTools) PublishPost(ctx context.Context, req *mcp.CallToolRequest, args publishPostArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsPublish); err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.posts.UpdateStatus(ctxWithOperator(ctx, operatorUserID(req)), args.ID, "published")
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// GetPost 按 ID 读取文章（需 posts:read）。
func (t *PostTools) GetPost(ctx context.Context, req *mcp.CallToolRequest, args getPostArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsRead); err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.posts.GetByID(ctx, args.ID)
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// ListDrafts 列出草稿文章（需 posts:read）。
func (t *PostTools) ListDrafts(ctx context.Context, req *mcp.CallToolRequest, args listDraftsArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsRead); err != nil {
		return errResult(err), nil, nil
	}
	q := domainshared.PageQuery{Page: args.Page, Limit: args.Limit}.Normalize()
	result, err := t.posts.ListAll(ctx, "draft", "", nil, q)
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]any{
		"items": result.Items, "total": result.Total, "page": result.Page, "limit": result.Limit,
	}), nil, nil
}

// CreateTag 创建标签（幂等：同名已存在则返回已存在；需 posts:write）。
// 抓取带标签文章时先用此 tool 建标签——create_post 校验 tags 必须先存在。
func (t *TagTools) CreateTag(ctx context.Context, req *mcp.CallToolRequest, args createTagArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsWrite); err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.tags.CreateOrGet(ctx, args.Name)
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// ListTags 列出所有标签（需 posts:read）。
func (t *TagTools) ListTags(ctx context.Context, req *mcp.CallToolRequest, args listTagsArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsRead); err != nil {
		return errResult(err), nil, nil
	}
	tags, err := t.tags.List(ctx)
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(tags), nil, nil
}

// ScrapeResult scrape_url tool 的返回结构（9 字段，对齐 Firecrawl formats 思路）。
// content_html 为渲染/编辑权威源，agent 应优先透传给 create_post 的 content_html；
// content_md 仅作降级（后端在缺 content_html 时自动转 HTML）。
type ScrapeResult struct {
	Title          string   `json:"title"`
	ContentMD      string   `json:"content_md"`
	ContentHTML    string   `json:"content_html"`
	Excerpt        string   `json:"excerpt"`
	CanonicalURL   string   `json:"canonical_url"`
	CoverImage     string   `json:"cover_image"`
	SeoTitle       string   `json:"seo_title"`
	SeoDescription string   `json:"seo_description"`
	Warnings       []string `json:"warnings,omitempty"`
}

// ScrapeURL 抓取外站文章并返回结构化数据（需 posts:scrape）。
// agent 拿到后审阅标题/正文/canonical，再调 create_post 建草稿（两步模式）。
//
// 预检链：scope 门禁 → robots.txt 尊重 → ImportURL（含 SSRF 防护）。
// canonical_url 回退：og:url > <link rel=canonical> > 输入 url。
func (t *ScraperTools) ScrapeURL(ctx context.Context, req *mcp.CallToolRequest, args scrapeURLArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsScrape); err != nil {
		return errResult(err), nil, nil
	}
	// robots.txt 预检（生产配置了 checker 才生效，测试/未配时跳过）
	if t.robots != nil {
		allowed, reason, err := t.robots.Allowed(ctx, args.URL)
		if err != nil {
			return errResult(fmt.Errorf("robots.txt 预检失败: %w", err)), nil, nil
		}
		if !allowed {
			return errResult(fmt.Errorf("目标站点不允许抓取: %s", reason)), nil, nil
		}
	}
	result, err := t.posts.ImportURL(ctx, args.URL, apppost.ImportURLOpts{})
	if err != nil {
		return errResult(err), nil, nil
	}
	canonical := result.CanonicalURL
	if canonical == "" {
		canonical = args.URL
	}
	return okResult(ScrapeResult{
		Title:          result.Title,
		ContentMD:      result.Markdown,
		ContentHTML:    result.HTML,
		Excerpt:        result.Excerpt,
		CanonicalURL:   canonical,
		CoverImage:     result.CoverImage,
		SeoTitle:       result.SeoTitle,
		SeoDescription: result.SeoDescription,
		Warnings:       result.Warnings,
	}), nil, nil
}

// --- 订阅 tool（T6） ---

// CreateSubscription 创建 RSS 订阅源（需 subscriptions:write）。
// auto_publish=true 时额外需 posts:publish scope（PRD-0005 安全语义，防 scope 绕过）。
func (t *ScraperTools) CreateSubscription(ctx context.Context, req *mcp.CallToolRequest, args createSubscriptionArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeSubscriptionsWrite); err != nil {
		return errResult(err), nil, nil
	}
	if err := requireScopeIf(req, args.AutoPublish, domainapitoken.ScopePostsPublish); err != nil {
		return errResult(fmt.Errorf("开启 auto_publish 需额外权限：%w", err)), nil, nil
	}
	dto, err := t.subs.Create(ctx, appsub.CreateInput{
		UserID:            operatorUserID(req),
		FeedURL:           args.FeedURL,
		Title:             args.Title,
		Interval:          args.Interval,
		AutoPublish:       args.AutoPublish,
		CanonicalOverride: args.CanonicalOverride,
		Tags:              args.Tags,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// ListSubscriptions 列出当前用户的订阅（需 subscriptions:read）。
func (t *ScraperTools) ListSubscriptions(ctx context.Context, req *mcp.CallToolRequest, args listSubscriptionsArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeSubscriptionsRead); err != nil {
		return errResult(err), nil, nil
	}
	q := domainshared.PageQuery{Page: args.Page, Limit: args.Limit}.Normalize()
	result, err := t.subs.ListByUser(ctx, operatorUserID(req), args.Status, q)
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]any{
		"items": result.Items, "total": result.Total, "page": result.Page, "limit": result.Limit,
	}), nil, nil
}

// GetSubscription 查单个订阅详情（需 subscriptions:read）。
func (t *ScraperTools) GetSubscription(ctx context.Context, req *mcp.CallToolRequest, args getSubscriptionArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeSubscriptionsRead); err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.subs.GetByID(ctx, args.ID, operatorUserID(req))
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// UpdateSubscription 更新订阅配置（需 subscriptions:write）。
// auto_publish=true 时额外需 posts:publish scope（同 CreateSubscription）。
func (t *ScraperTools) UpdateSubscription(ctx context.Context, req *mcp.CallToolRequest, args updateSubscriptionArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeSubscriptionsWrite); err != nil {
		return errResult(err), nil, nil
	}
	if err := requireScopeIf(req, args.AutoPublish, domainapitoken.ScopePostsPublish); err != nil {
		return errResult(fmt.Errorf("开启 auto_publish 需额外权限：%w", err)), nil, nil
	}
	err := t.subs.Update(ctx, appsub.UpdateInput{
		ID:                args.ID,
		UserID:            operatorUserID(req),
		Title:             args.Title,
		Interval:          args.Interval,
		AutoPublish:       args.AutoPublish,
		CanonicalOverride: args.CanonicalOverride,
		Tags:              args.Tags,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]any{"id": args.ID, "updated": true}), nil, nil
}

// PauseSubscription 手动暂停订阅（需 subscriptions:write）。
func (t *ScraperTools) PauseSubscription(ctx context.Context, req *mcp.CallToolRequest, args subscriptionIDArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeSubscriptionsWrite); err != nil {
		return errResult(err), nil, nil
	}
	if err := t.subs.Pause(ctx, args.ID, operatorUserID(req)); err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]any{"id": args.ID, "paused": true}), nil, nil
}

// ResumeSubscription 手动恢复订阅，清零失败计数（需 subscriptions:write）。
func (t *ScraperTools) ResumeSubscription(ctx context.Context, req *mcp.CallToolRequest, args subscriptionIDArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeSubscriptionsWrite); err != nil {
		return errResult(err), nil, nil
	}
	if err := t.subs.Resume(ctx, args.ID, operatorUserID(req)); err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]any{"id": args.ID, "resumed": true}), nil, nil
}

// DeleteSubscription 删除订阅（需 subscriptions:write）。
// 连带 entries 在 T7 加表后由 ON DELETE CASCADE 处理。
func (t *ScraperTools) DeleteSubscription(ctx context.Context, req *mcp.CallToolRequest, args subscriptionIDArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeSubscriptionsWrite); err != nil {
		return errResult(err), nil, nil
	}
	if err := t.subs.Delete(ctx, args.ID, operatorUserID(req)); err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]any{"id": args.ID, "deleted": true}), nil, nil
}
