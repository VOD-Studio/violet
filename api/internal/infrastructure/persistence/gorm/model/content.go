package model

import (
	"time"

	"github.com/google/uuid"
)

// Post 文章表持久化模型
type Post struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	Title          string     `gorm:"type:varchar(255);not null" json:"title"`
	Slug           string     `gorm:"type:varchar(255);unique" json:"slug"`
	ContentMD      string     `gorm:"type:text;column:content_md" json:"content_md"`
	ContentHTML    string     `gorm:"type:text;column:content_html" json:"content_html"`
	Excerpt        string     `gorm:"type:text" json:"excerpt"`
	CoverImage     string     `gorm:"type:text;column:cover_image" json:"cover_image"`
	Status         string     `gorm:"type:varchar(20);default:draft" json:"status"`
	AuthorID       uuid.UUID  `gorm:"type:uuid;column:author_id" json:"author_id"`
	ViewCount      int        `gorm:"default:0" json:"view_count"`
	IsFeatured     bool       `gorm:"default:false" json:"is_featured"`
	SEOTitle       string     `gorm:"type:varchar(255);column:seo_title" json:"seo_title"`
	SEODescription string     `gorm:"type:text;column:seo_description" json:"seo_description"`
	PublishedAt    *time.Time `gorm:"column:published_at" json:"published_at,omitempty"`
	CreatedAt      time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// 多对多关联标签
	Tags []Tag `gorm:"many2many:post_tags;"`
}

func (Post) TableName() string { return "posts" }

// Tag 标签表持久化模型
type Tag struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"type:varchar(50);unique" json:"name"`
	Slug      string    `gorm:"type:varchar(50);unique" json:"slug"`
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (Tag) TableName() string { return "tags" }

// Comment 评论表持久化模型
type Comment struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	PostID      uuid.UUID  `gorm:"type:uuid;column:post_id" json:"post_id"`
	ParentID    *uuid.UUID `gorm:"type:uuid;column:parent_id" json:"parent_id,omitempty"`
	Path        string     `gorm:"type:text" json:"path"`
	Depth       int16      `gorm:"type:smallint" json:"depth"`
	AuthorName  string     `gorm:"type:varchar(100);column:author_name" json:"author_name"`
	AuthorEmail string     `gorm:"type:varchar(255);column:author_email" json:"author_email"`
	AuthorURL   string     `gorm:"type:text;column:author_url" json:"author_url"`
	AvatarURL   string     `gorm:"type:varchar(512);column:avatar_url" json:"avatar_url"`
	Body        string     `gorm:"type:text" json:"body"`
	Pictures    []byte     `gorm:"type:jsonb;default:'[]'" json:"pictures"`
	Status      string     `gorm:"type:varchar(20);default:pending" json:"status"`
	IPHash      string     `gorm:"type:varchar(64);column:ip_hash" json:"ip_hash"`
	UserAgent   string     `gorm:"type:text;column:user_agent" json:"user_agent"`
	CreatedAt   time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (Comment) TableName() string { return "comments" }

// CommentReaction 评论反应表
type CommentReaction struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	CommentID uuid.UUID  `gorm:"type:uuid;column:comment_id" json:"comment_id"`
	EmojiID   int32      `gorm:"column:emoji_id" json:"emoji_id"`
	UserID    *uuid.UUID `gorm:"type:uuid;column:user_id" json:"user_id,omitempty"`
	IPHash    string     `gorm:"type:varchar(64);column:ip_hash" json:"ip_hash"`
	CreatedAt time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (CommentReaction) TableName() string { return "comment_reactions" }

// Announcement 公告表
type Announcement struct {
	ID        int32      `gorm:"primaryKey;autoIncrement" json:"id"`
	Title     string     `gorm:"type:varchar(255);not null" json:"title"`
	Content   string     `gorm:"type:text;not null" json:"content"`
	Type      string     `gorm:"type:varchar(20);default:info" json:"type"`
	IsActive  bool       `gorm:"default:true" json:"is_active"`
	StartTime *time.Time `gorm:"column:start_time" json:"start_time,omitempty"`
	EndTime   *time.Time `gorm:"column:end_time" json:"end_time,omitempty"`
	CreatedBy *uuid.UUID `gorm:"type:uuid;column:created_by" json:"created_by,omitempty"`
	CreatedAt time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (Announcement) TableName() string { return "announcements" }

// Project 项目表
type Project struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Title       string    `gorm:"type:varchar(255);not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	URL         string    `gorm:"type:text" json:"url"`
	GithubURL   string    `gorm:"type:text;column:github_url" json:"github_url"`
	ImageURL    string    `gorm:"type:text;column:image_url" json:"image_url"`
	TechStack   []string  `gorm:"type:text[];column:tech_stack" json:"tech_stack"`
	SortOrder   int       `gorm:"default:0" json:"sort_order"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (Project) TableName() string { return "projects" }

// EmojiGroup 表情分组表
type EmojiGroup struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"type:varchar(50);unique" json:"name"`
	Source    string    `gorm:"type:varchar(30);default:system" json:"source"`
	SortOrder int       `gorm:"default:0" json:"sort_order"`
	IsEnabled bool      `gorm:"default:true" json:"is_enabled"`
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	Emojis []Emoji `gorm:"foreignKey:GroupID"`
}

func (EmojiGroup) TableName() string { return "emoji_groups" }

// Emoji 表情表
type Emoji struct {
	ID          int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	GroupID     int32     `gorm:"column:group_id" json:"group_id"`
	Name        string    `gorm:"type:varchar(50)" json:"name"`
	URL         string    `gorm:"type:varchar(500)" json:"url"`
	SourceURL   string    `gorm:"type:varchar(500);column:source_url" json:"source_url"`
	GifURL      string    `gorm:"type:varchar(500);column:gif_url" json:"gif_url"`
	TextContent string    `gorm:"type:varchar(50);column:text_content" json:"text_content"`
	SortOrder   int       `gorm:"default:0" json:"sort_order"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`

	Group *EmojiGroup `gorm:"foreignKey:GroupID"`
}

func (Emoji) TableName() string { return "emojis" }

// Playlist 歌单表（歌曲以 JSONB 内联存储）
type Playlist struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Title      string    `gorm:"type:varchar(255)" json:"title"`
	Cover      string    `gorm:"type:varchar(512)" json:"cover"`
	Creator    string    `gorm:"type:varchar(100)" json:"creator"`
	Platform   string    `gorm:"type:varchar(20)" json:"platform"`
	PlaylistID string    `gorm:"type:varchar(100);column:playlist_id" json:"playlist_id"`
	SongCount  int       `gorm:"default:0" json:"song_count"`
	Songs      []byte    `gorm:"type:jsonb;default:'[]'" json:"songs"`
	IsActive   bool      `gorm:"default:false" json:"is_active"`
	CreatedAt  time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt  time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (Playlist) TableName() string { return "playlists" }

// File 文件表
type File struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	OwnerID      uuid.UUID  `gorm:"type:uuid;column:owner_id" json:"owner_id"`
	Purpose      string     `gorm:"type:varchar(20)" json:"purpose"`
	OriginalName string     `gorm:"type:varchar(255);column:original_name" json:"original_name"`
	Path         string     `gorm:"type:varchar(500)" json:"path"`
	URL          string     `gorm:"type:varchar(500)" json:"url"`
	Size         int64      `gorm:"type:bigint" json:"size"`
	MimeType     string     `gorm:"type:varchar(100);column:mime_type" json:"mime_type"`
	FileHash     string     `gorm:"type:varchar(64);column:file_hash" json:"file_hash"`
	Width        *int       `gorm:"type:integer" json:"width,omitempty"`
	Height       *int       `gorm:"type:integer" json:"height,omitempty"`
	Thumbnail    string     `gorm:"type:varchar(500)" json:"thumbnail"`
	Status       string     `gorm:"type:varchar(20);default:pending" json:"status"`
	RefCount     int        `gorm:"default:0" json:"ref_count"`
	DeletedAt    *time.Time `gorm:"column:deleted_at" json:"deleted_at,omitempty"`
	CreatedAt    time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt    time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (File) TableName() string { return "files" }
