// Package subscription - ports.go 定义 FetchOne 编排依赖的端口。
//
// 抽接口而非直接依赖 post.Service / gofeed，便于单测注入 fake。
// 这是 application 层依赖反转的标准模式（与 mcp.PostService 端口同构）。
package subscription

import (
	"context"

	apppost "blog-api/internal/application/post"
)

// PostImporter 文章导入端口：抓正文 + 建草稿。
// application/post.Service 实现之（ImportURL + Create 两个方法）。
type PostImporter interface {
	// ImportURL 抓取外站文章正文（复用 T3 SSRF 防护 + T4 HTML→MD）。
	ImportURL(ctx context.Context, rawURL string, opts apppost.ImportURLOpts) (apppost.ImportResult, error)
	// Create 建草稿/发布文章。AuthorID 由调用方指定（订阅归属用户）。
	Create(ctx context.Context, in apppost.CreateInput) (apppost.PostDTO, error)
}

// FeedItem 单条 feed entry 的抽象（屏蔽 gofeed.Feed.Items 细节）。
// 抽成结构体便于测试用假数据，不直接依赖 gofeed.Item。
type FeedItem struct {
	GUID        string
	Link        string
	Title       string
	PublishedAt *string // RFC3339，可能为空
}

// FeedParser feed 解析端口。生产用 gofeed，测试用假实现。
type FeedParser interface {
	// Parse 抓取并解析 feed URL，返回条目列表（按 feed 原始顺序）。
	Parse(ctx context.Context, feedURL string) ([]FeedItem, error)
}
