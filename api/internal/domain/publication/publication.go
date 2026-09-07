package publication

import (
	"context"
	"regexp"
	"strings"
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

var noteHTMLTagPattern = regexp.MustCompile(`<[^>]+>`)

// DeriveNoteTitle 返回首页使用的笔记标题；空标题从 HTML 纯文本派生，最多 48 个字符。
func DeriveNoteTitle(title, contentHTML string) string {
	title = strings.TrimSpace(title)
	if title != "" {
		return title
	}
	text := strings.Join(strings.Fields(noteHTMLTagPattern.ReplaceAllString(contentHTML, " ")), " ")
	runes := []rune(text)
	if len(runes) > 48 {
		return string(runes[:48]) + "…"
	}
	if text == "" {
		return "无题笔记"
	}
	return text
}

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

// DiscrepancyType 标识来源与投影的不一致类别。
type DiscrepancyType string

const (
	// DiscrepancyMissing 表示公开来源存在而投影缺失。
	DiscrepancyMissing DiscrepancyType = "missing"
	// DiscrepancyOrphaned 表示投影存在而公开来源不存在。
	DiscrepancyOrphaned DiscrepancyType = "orphaned"
	// DiscrepancyDrifted 表示来源与投影字段不一致。
	DiscrepancyDrifted DiscrepancyType = "drifted"
)

// Discrepancy 是一条可定位的不一致记录。
type Discrepancy struct {
	// Kind 标识来源类型。
	Kind Kind
	// SourceID 标识来源聚合。
	SourceID shared.ID
	// Type 标识缺失、冗余或字段漂移。
	Type DiscrepancyType
}

// ConsistencyReport 汇总三类投影差异。
type ConsistencyReport struct {
	// Missing 是来源存在而投影缺失的条目。
	Missing []Discrepancy
	// Orphaned 是投影存在而来源不再公开的条目。
	Orphaned []Discrepancy
	// Drifted 是来源与投影字段不一致的条目。
	Drifted []Discrepancy
}

// Reader 定义发布物读取 seam。
type Reader interface {
	// FindPage 按 published_at DESC、kind ASC、source_id DESC 返回稳定游标页。
	FindPage(ctx context.Context, query Query) ([]Entry, error)
}

// Writer 定义来源域事务内维护发布物投影的写入 seam。
type Writer interface {
	// Upsert 创建或更新同一来源发布物，不产生重复项。
	Upsert(ctx context.Context, entry Entry) error
	// Delete 删除指定来源发布物；目标不存在时保持幂等。
	Delete(ctx context.Context, kind Kind, sourceID shared.ID) error
}
