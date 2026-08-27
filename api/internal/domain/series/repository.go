package series

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// PostMeta 挂章校验所需的文章元数据（跨聚合读模型）。
type PostMeta struct {
	// PostID 文章 ID
	PostID shared.ID
	// AuthorID 文章作者
	AuthorID shared.ID
	// Title 文章标题（冲突转述用）
	Title string
	// Status 文章状态
	Status string
	// SeriesID 当前挂入的书；nil=未挂任何书
	SeriesID *shared.ID
}

// ChapterAssignment 挂章的单章落位。
type ChapterAssignment struct {
	// PostID 章节（文章）ID
	PostID shared.ID
	// SectionID 挂入的卷；nil=书根
	SectionID *shared.ID
	// Order 所在范围内的新序
	Order int
}

// ReorderPlan 全树调序计划的单个范围（PUT chapters/order 的领域形态）。
type ReorderPlan struct {
	// SectionID 范围所属卷；nil=书根
	SectionID *shared.ID
	// OrderedIDs 该范围内按新顺序排列的章节 ID 全集
	OrderedIDs []shared.ID
}

// ChapterStats 书的章节统计（列表页批量填充口径）。
type ChapterStats struct {
	// Total 全部状态章节数（含 draft/archived）
	Total int64
	// PublishedCount 已发布章节数
	PublishedCount int64
	// LatestPublishedAt 最近一个已发布章节的发布时间；无已发布章节时为零值
	LatestPublishedAt time.Time
}

// SeriesRepository 系列书仓储。
//
// 聚合部分（书 + 卷）与章节归属部分（posts 三列）分两组：
// 前者是标准聚合持久化；后者是跨聚合的归属元数据，
// 由 series 上下文直接维护（post 聚合的内容管理路径不感知书的存在）。
type SeriesRepository interface {
	// ============ 聚合（series + series_sections 两表） ============

	// Save 保存书（按主键 upsert 根字段；卷做精确 diff：
	// 删除 DB 有而聚合无的卷，upsert 聚合内全部卷）
	Save(ctx context.Context, s *Series) error
	// FindByID 按 ID 查找（含卷），不存在返回 ErrNotFound
	FindByID(ctx context.Context, id shared.ID) (*Series, error)
	// FindBySlug 按 slug 查找（含卷），不存在返回 ErrNotFound
	FindBySlug(ctx context.Context, slug string) (*Series, error)
	// FindPublishedPage 公开书架分页：仅 published，created_at DESC
	FindPublishedPage(ctx context.Context, q shared.PageQuery) (shared.PageResult[*Series], error)
	// FindPage 管理列表分页：全部状态，created_at DESC
	FindPage(ctx context.Context, q shared.PageQuery) (shared.PageResult[*Series], error)
	// FindPageByAuthor owner 视角分页（MCP agent=PAT 持有人）：全部状态，created_at DESC
	FindPageByAuthor(ctx context.Context, authorID shared.ID, q shared.PageQuery) (shared.PageResult[*Series], error)
	// ExistsBySlug slug 占用检查；excludeID 非零时排除自身
	ExistsBySlug(ctx context.Context, slug string, excludeID shared.ID) (bool, error)
	// FindSlugsByIDs 批量取书 slug（挂章冲突预检转述占用书；
	// 不带卷——避免按聚合重建引入每书一次的卷查询）；不存在的 ID 不出现在结果中
	FindSlugsByIDs(ctx context.Context, ids []shared.ID) (map[shared.ID]string, error)
	// Delete 物理删除书（级联删卷由 FK 承担；章节解绑由 posts FK ON DELETE SET NULL 承担）
	Delete(ctx context.Context, id shared.ID) error

	// ============ 章节归属（posts 三列） ============

	// FindChapters 取书内全部章节（未排序——展示序走 domain.OrderedChapters）。
	// 软删文章不返回。
	FindChapters(ctx context.Context, seriesID shared.ID) ([]Chapter, error)
	// FindSeriesIDByPostSlug 按文章 slug 反查其挂入的书 ID；
	// 文章不存在、软删或未挂书时返回 nil。
	FindSeriesIDByPostSlug(ctx context.Context, postSlug string) (*shared.ID, error)
	// FindPostMeta 批量取文章元数据（软删文章不返回，视为不存在）
	FindPostMeta(ctx context.Context, postIDs []shared.ID) ([]PostMeta, error)
	// AttachChapters 批量挂章（事务内逐章 UPDATE posts 三列；调用方保证归属已校验）
	AttachChapters(ctx context.Context, seriesID shared.ID, assignments []ChapterAssignment) error
	// DetachChapter 摘章：置空 posts 三列并重排所在范围剩余章节
	DetachChapter(ctx context.Context, seriesID shared.ID, postID shared.ID) error
	// ReorderChapters 全树全量调序（事务内按 plan 重写 posts.series_section_id + chapter_order）
	ReorderChapters(ctx context.Context, seriesID shared.ID, plans []ReorderPlan) error
	// CountChaptersInSection 卷内章节数（「非空卷拒绝删除」依据；含全部状态——
	// draft/archived 章节同样占位，避免删卷后归属悬空）
	CountChaptersInSection(ctx context.Context, sectionID shared.ID) (int64, error)
	// ChapterStatsBySeries 批量书章节统计（列表页填充：总数/已发布数/
	// 最近发布时间，一条聚合查询——避免分页循环内 per-book 查询）
	ChapterStatsBySeries(ctx context.Context, seriesIDs []shared.ID) (map[shared.ID]ChapterStats, error)
}
