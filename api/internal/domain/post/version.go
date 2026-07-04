package post

import (
	"time"

	"blog-api/internal/domain/shared"
)

// PostVersion 文章版本快照实体
type PostVersion struct {
	id          shared.ID
	postID      shared.ID
	title       string
	contentMD   string
	contentHTML string
	excerpt     string
	coverImage  string
	tags        []string
	editorID    shared.ID // 编辑这一版的操作人（非文章所有者）
	summary     string
	createdAt   time.Time
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
