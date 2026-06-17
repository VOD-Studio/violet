package gorm

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"blog-api/internal/domain/post"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// PostRepository 文章仓储 GORM 实现
type PostRepository struct {
	db *gorm.DB
}

func NewPostRepository(db *gorm.DB) *PostRepository {
	return &PostRepository{db: db}
}

func postToPO(p *post.Post) model.Post {
	po := model.Post{
		ID: p.ID().UUID(), Title: p.Title(), Slug: p.Slug(),
		ContentMD: p.ContentMD(), ContentHTML: p.ContentHTML(),
		Excerpt: p.Excerpt(), CoverImage: p.CoverImage(),
		Status: p.Status(), AuthorID: p.AuthorID().UUID(),
		ViewCount: p.ViewCount(), IsFeatured: p.IsFeatured(),
		SEOTitle: p.SEOTitle(), SEODescription: p.SEODescription(),
	}
	if t := p.PublishedAt(); t != nil {
		po.PublishedAt = t
	}
	if c := p.CreatedAt(); !c.IsZero() {
		po.CreatedAt = c
		po.UpdatedAt = p.UpdatedAt()
	} else {
		po.CreatedAt = time.Now()
		po.UpdatedAt = time.Now()
	}
	return po
}

func postToDomain(po model.Post) (*post.Post, error) {
	tags := make([]string, 0, len(po.Tags))
	for _, t := range po.Tags {
		tags = append(tags, t.Name)
	}
	return post.ReconstructPost(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.AuthorID.String()),
		po.Title, po.Slug, po.ContentMD, po.ContentHTML,
		po.Excerpt, po.CoverImage, po.Status, po.ViewCount,
		po.IsFeatured, po.SEOTitle, po.SEODescription,
		po.PublishedAt, tags, po.CreatedAt, po.UpdatedAt,
	), nil
}

func (r *PostRepository) FindByID(ctx context.Context, id domainshared.ID) (*post.Post, error) {
	var po model.Post
	if err := r.db.WithContext(ctx).Preload("Tags").First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, post.ErrNotFound
		}
		return nil, domainshared.Internal("查询文章失败", err)
	}
	return postToDomain(po)
}

func (r *PostRepository) FindBySlug(ctx context.Context, slug string) (*post.Post, error) {
	var po model.Post
	if err := r.db.WithContext(ctx).Preload("Tags").First(&po, "slug = ?", slug).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, post.ErrNotFound
		}
		return nil, domainshared.Internal("查询文章失败", err)
	}
	return postToDomain(po)
}

func (r *PostRepository) FindPublished(ctx context.Context, page, limit int, tag string) ([]*post.Post, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Post{}).Where("status = ?", post.StatusPublished)
	if tag != "" {
		query = query.Joins("JOIN post_tags ON post_tags.post_id = posts.id").
			Joins("JOIN tags ON tags.id = post_tags.tag_id AND tags.slug = ?", tag)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, domainshared.Internal("统计文章失败", err)
	}
	var pos []model.Post
	offset := (page - 1) * limit
	if err := query.Preload("Tags").Order("published_at DESC").Offset(offset).Limit(limit).Find(&pos).Error; err != nil {
		return nil, 0, domainshared.Internal("查询文章列表失败", err)
	}
	result := make([]*post.Post, 0, len(pos))
	for _, po := range pos {
		p, _ := postToDomain(po)
		result = append(result, p)
	}
	return result, total, nil
}

func (r *PostRepository) FindAll(ctx context.Context, page, limit int, status string) ([]*post.Post, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Post{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, domainshared.Internal("统计文章失败", err)
	}
	var pos []model.Post
	offset := (page - 1) * limit
	if err := query.Preload("Tags").Order("created_at DESC").Offset(offset).Limit(limit).Find(&pos).Error; err != nil {
		return nil, 0, domainshared.Internal("查询文章列表失败", err)
	}
	result := make([]*post.Post, 0, len(pos))
	for _, po := range pos {
		p, _ := postToDomain(po)
		result = append(result, p)
	}
	return result, total, nil
}

func (r *PostRepository) ExistsBySlug(ctx context.Context, slug string) (bool, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.Post{}).Where("slug = ?", slug).Count(&count).Error; err != nil {
		return false, domainshared.Internal("查询 slug 存在性失败", err)
	}
	return count > 0, nil
}

func (r *PostRepository) Save(ctx context.Context, p *post.Post) error {
	po := postToPO(p)
	tx := r.db.WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 保存文章基本信息
	if err := tx.Save(&po).Error; err != nil {
		tx.Rollback()
		return domainshared.Internal("保存文章失败", err)
	}

	// 同步标签关联（按 name 查找 tag ID）
	if err := tx.Where("post_id = ?", po.ID).Delete(&struct {
		PostID string `gorm:"column:post_id"`
	}{PostID: po.ID.String()}).Error; err != nil {
		// 用原生 SQL 清理中间表
		tx.Exec("DELETE FROM post_tags WHERE post_id = ?", po.ID)
	}
	for _, tagName := range p.Tags() {
		var tag model.Tag
		if err := tx.Where("name = ?", tagName).First(&tag).Error; err == nil {
			tx.Exec("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING", po.ID, tag.ID)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return domainshared.Internal("提交文章事务失败", err)
	}
	return nil
}

func (r *PostRepository) Delete(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.Post{})
	if result.Error != nil {
		return domainshared.Internal("删除文章失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return post.ErrNotFound
	}
	return nil
}

// RecordView 记录浏览事件（写 post_views 表）
func (r *PostRepository) RecordView(ctx context.Context, postID domainshared.ID, ipAddress, userAgent string) error {
	pv := model.PostView{
		PostID:    postID.UUID(),
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}
	if err := r.db.WithContext(ctx).Create(&pv).Error; err != nil {
		return domainshared.Internal("记录浏览事件失败", err)
	}
	return nil
}

var _ post.PostRepository = (*PostRepository)(nil)
