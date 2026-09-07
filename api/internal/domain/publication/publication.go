package publication

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// Kind 标识发布物来源类型。
type Kind string

const (
	KindArticle Kind = "article"
	KindGallery Kind = "gallery"
	KindNote    Kind = "note"
)

// Entry 是首页消费的发布物投影。
type Entry struct {
	// Kind 标识文章、图集或笔记。
	Kind Kind
	// SourceID 是来源聚合的 UUID。
	SourceID shared.ID
	// RouteKey 是公开详情路由参数；文章和图集为 slug，笔记为 UUID。
	RouteKey string
	// Title 是最终公开展示标题。
	Title string
	// PublishedAt 是首次公开时间。
	PublishedAt time.Time
	// Featured 仅文章可能为 true。
	Featured bool
}

// Cursor 是严格时间流的最后一项定位键。
type Cursor struct {
	// PublishedAt 是当前页最后一项的发布时间。
	PublishedAt time.Time
	// Kind 是当前页最后一项的来源类型。
	Kind Kind
	// SourceID 是当前页最后一项的来源 UUID。
	SourceID shared.ID
}

// Query 描述发布物流的可选筛选条件。
type Query struct {
	// Cursor 非 nil 时只读取排序键位于其后的项。
	Cursor *Cursor
	// From 非 nil 时包含该时间下界。
	From *time.Time
	// To 非 nil 时不包含该时间上界。
	To *time.Time
	// FeaturedOnly 为 true 时只读取精选文章。
	FeaturedOnly bool
	// Limit 是数据库最多返回的记录数。
	Limit int
}

// Repository 定义发布物只读投影的查询 seam。
type Repository interface {
	// FindPage 按 published_at DESC、kind ASC、source_id DESC 返回稳定游标页。
	FindPage(ctx context.Context, query Query) ([]Entry, error)
}
