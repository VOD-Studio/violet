// Package post 定义文章聚合的领域模型。
//
// 文章含状态机（draft/published/archived）、slug 唯一性、
// 与 Tag 的多对多关联。文章是博客系统的核心聚合。
package post

import (
	"regexp"
	"time"

	"blog-api/internal/domain/shared"
)

// 文章状态
const (
	StatusDraft     = "draft"
	StatusPublished = "published"
	StatusArchived  = "archived"
)

// slugPattern slug 格式：小写字母数字连字符
var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

// IsValidStatus 状态合法性
func IsValidStatus(s string) bool {
	switch s {
	case StatusDraft, StatusPublished, StatusArchived:
		return true
	}
	return false
}

// IsValidSlug slug 格式校验
func IsValidSlug(s string) bool {
	return slugPattern.MatchString(s)
}

// Post 文章聚合根
type Post struct {
	shared.AggregateRoot

	// id 文章唯一标识
	id shared.ID
	// title 标题（用户可读，可含任意字符；不作为唯一键）
	title string
	// slug URL 友好标识，全局唯一；由 GenerateSlug 从标题生成，需满足 [a-z0-9-] 格式
	slug string
	// contentMD 正文 Markdown 源文本（编辑态，由前端渲染或转 HTML 存档）
	contentMD string
	// contentHTML 由 contentMD 预渲染的 HTML，发布态直接返回以避免运行时渲染
	contentHTML string
	// excerpt 摘要，用于列表与 SEO；为空时由调用方按规则截取正文生成
	excerpt string
	// coverImage 封面图 URL（可为空）
	coverImage string
	// status 文章状态机当前值：draft / published / archived（见 Status* 常量）
	status string
	// authorID 作者用户 ID（文章归属，创建后不变）
	authorID shared.ID
	// viewCount 累计浏览次数（每次 IncrementView 自增）
	viewCount int
	// isFeatured 是否精选文章（前端首页 / 精选位展示）
	isFeatured bool
	// seoTitle SEO 专用标题，为空时回退到 title
	seoTitle string
	// seoDescription SEO 专用描述，为空时回退到 excerpt
	seoDescription string
	// publishedAt 发布时间；仅 status=published 时有意义，发布前为 nil
	publishedAt *time.Time
	// canonicalURL 转载/分发源 URL；nil = 原创，非 nil = 转载（指向原始出处）
	canonicalURL *string
	// tags 关联的标签名列表（存 tag name 而非 ID，是多对多关联的快照）
	tags []string
	// timestamps 创建/更新时间戳（嵌入值对象，见 shared.Timestamps）
	timestamps shared.Timestamps
}

// NewPost 创建新文章（草稿状态）
func NewPost(id, authorID shared.ID, title, slug string) (*Post, error) {
	if title == "" {
		return nil, shared.BadRequest("标题不能为空")
	}
	if !IsValidSlug(slug) {
		return nil, shared.BadRequest("slug 格式无效")
	}
	return &Post{
		id: id, authorID: authorID, title: title, slug: slug,
		status: StatusDraft, viewCount: 0, tags: []string{},
	}, nil
}

// ReconstructPost 从持久化数据重建
func ReconstructPost(id, authorID shared.ID, title, slug, contentMD, contentHTML, excerpt, coverImage, status string, viewCount int, isFeatured bool, seoTitle, seoDescription string, publishedAt *time.Time, canonicalURL *string, tags []string, createdAt, updatedAt time.Time) *Post {
	if tags == nil {
		tags = []string{}
	}
	return &Post{
		id: id, authorID: authorID, title: title, slug: slug,
		contentMD: contentMD, contentHTML: contentHTML, excerpt: excerpt,
		coverImage: coverImage, status: status, viewCount: viewCount,
		isFeatured: isFeatured, seoTitle: seoTitle, seoDescription: seoDescription,
		publishedAt: publishedAt, canonicalURL: canonicalURL, tags: tags,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// Publish 发布文章
func (p *Post) Publish() {
	if p.status != StatusPublished {
		now := time.Now()
		p.publishedAt = &now
		p.status = StatusPublished
	}
}

// Archive 归档
func (p *Post) Archive() { p.status = StatusArchived }

// RevertToDraft 回退到草稿
func (p *Post) RevertToDraft() {
	p.status = StatusDraft
	p.publishedAt = nil
}

// IncrementView 浏览量 +1
func (p *Post) IncrementView() { p.viewCount++ }

// SetFeatured 设置精选
func (p *Post) SetFeatured(featured bool) { p.isFeatured = featured }

// UpdateContent 更新内容
func (p *Post) UpdateContent(title, contentMD, contentHTML, excerpt, coverImage string) error {
	if title == "" {
		return shared.BadRequest("标题不能为空")
	}
	p.title = title
	p.contentMD = contentMD
	p.contentHTML = contentHTML
	p.excerpt = excerpt
	p.coverImage = coverImage
	return nil
}

// UpdateSlug 更新 slug
func (p *Post) UpdateSlug(slug string) error {
	if !IsValidSlug(slug) {
		return shared.BadRequest("slug 格式无效")
	}
	p.slug = slug
	return nil
}

// UpdateSEO 更新 SEO 字段
func (p *Post) UpdateSEO(title, description string) {
	p.seoTitle = title
	p.seoDescription = description
}

// SetCanonicalURL 设置转载源 URL。传 nil 表示原创，非 nil 表示转载/分发。
func (p *Post) SetCanonicalURL(url *string) {
	p.canonicalURL = url
}

// SetTags 设置标签
func (p *Post) SetTags(tags []string) {
	if tags == nil {
		tags = []string{}
	}
	p.tags = tags
}

// IsPublished 是否已发布
func (p *Post) IsPublished() bool { return p.status == StatusPublished }

// 访问器
func (p *Post) ID() shared.ID           { return p.id }
func (p *Post) Title() string           { return p.title }
func (p *Post) Slug() string            { return p.slug }
func (p *Post) ContentMD() string       { return p.contentMD }
func (p *Post) ContentHTML() string     { return p.contentHTML }
func (p *Post) Excerpt() string         { return p.excerpt }
func (p *Post) CoverImage() string      { return p.coverImage }
func (p *Post) Status() string          { return p.status }
func (p *Post) AuthorID() shared.ID     { return p.authorID }
func (p *Post) ViewCount() int          { return p.viewCount }
func (p *Post) IsFeatured() bool        { return p.isFeatured }
func (p *Post) SEOTitle() string        { return p.seoTitle }
func (p *Post) SEODescription() string  { return p.seoDescription }
func (p *Post) PublishedAt() *time.Time { return p.publishedAt }
func (p *Post) CanonicalURL() *string   { return p.canonicalURL }
func (p *Post) Tags() []string          { return p.tags }
func (p *Post) CreatedAt() time.Time    { return p.timestamps.CreatedAt }
func (p *Post) UpdatedAt() time.Time    { return p.timestamps.UpdatedAt }
