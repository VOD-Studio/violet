package post

import (
	"time"

	"blog-api/internal/domain/shared"
)

// PostVersion 文章版本快照实体
type PostVersion struct {
	// id 版本快照唯一标识（每次保存生成新 ID）
	id shared.ID
	// postID 所属文章 ID（快照与文章的多对一关系）
	postID shared.ID
	// title 该版本保存时刻的标题快照
	title string
	// contentMD 该版本保存时刻的 Markdown 正文快照
	contentMD string
	// contentHTML 该版本保存时刻的预渲染 HTML 快照
	contentHTML string
	// excerpt 该版本保存时刻的摘要快照
	excerpt string
	// coverImage 该版本保存时刻的封面图 URL 快照
	coverImage string
	// tags 该版本保存时刻的标签名列表快照（深拷贝，避免与文章共享底层数组）
	tags []string
	// editorID 编辑这一版的操作人（执行编辑的用户，与文章所有者 authorID 区分）
	editorID shared.ID
	// summary 本次保存的版本说明（编辑者填写的改动摘要，可为空）
	summary string
	// createdAt 该版本的创建时间（快照保存时刻）
	createdAt time.Time
}

// NewPostVersion 创建新快照（自动继承文章当前状态）
//
// editorID 为执行本次编辑操作的用户，与文章所有者（Post.AuthorID）区分。
func NewPostVersion(p *Post, editorID shared.ID, summary string) *PostVersion {
	tagsCopy := make([]string, len(p.Tags()))
	copy(tagsCopy, p.Tags())

	return &PostVersion{
		id:          shared.NewID(),
		postID:      p.ID(),
		title:       p.Title(),
		contentMD:   p.ContentMD(),
		contentHTML: p.ContentHTML(),
		excerpt:     p.Excerpt(),
		coverImage:  p.CoverImage(),
		tags:        tagsCopy,
		editorID:    editorID,
		summary:     summary,
		createdAt:   time.Now(),
	}
}

// ReconstructPostVersion 从持久化层重建
func ReconstructPostVersion(id, postID shared.ID, title, contentMD, contentHTML, excerpt, coverImage string, tags []string, editorID shared.ID, summary string, createdAt time.Time) *PostVersion {
	if tags == nil {
		tags = []string{}
	}
	return &PostVersion{
		id:          id,
		postID:      postID,
		title:       title,
		contentMD:   contentMD,
		contentHTML: contentHTML,
		excerpt:     excerpt,
		coverImage:  coverImage,
		tags:        tags,
		editorID:    editorID,
		summary:     summary,
		createdAt:   createdAt,
	}
}

// 访问器
func (v *PostVersion) ID() shared.ID           { return v.id }
func (v *PostVersion) PostID() shared.ID       { return v.postID }
func (v *PostVersion) Title() string           { return v.title }
func (v *PostVersion) ContentMD() string       { return v.contentMD }
func (v *PostVersion) ContentHTML() string     { return v.contentHTML }
func (v *PostVersion) Excerpt() string         { return v.excerpt }
func (v *PostVersion) CoverImage() string      { return v.coverImage }
func (v *PostVersion) Tags() []string          { return v.tags }
func (v *PostVersion) EditorID() shared.ID     { return v.editorID }
func (v *PostVersion) Summary() string         { return v.summary }
func (v *PostVersion) CreatedAt() time.Time    { return v.createdAt }
