package gorm

import (
	"context"
	"errors"
	"fmt"
	"strings"
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

// Save 保存文章并同步标签关联。
// 用 db.Transaction 包裹全文 + 标签关联，保证原子性；通过 Association API
// 操作 many2many 关系（替代原先手写 Begin/Commit + 裸 SQL 的脆弱实现）。
func (r *PostRepository) Save(ctx context.Context, p *post.Post) error {
	po := postToPO(p)
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 保存文章基本信息
		if err := tx.Save(&po).Error; err != nil {
			return domainshared.Internal("保存文章失败", err)
		}
		// 同步标签关联：按 name 查 tag → 替换关联
		tagNames := p.Tags()
		if len(tagNames) == 0 {
			return tx.Model(&po).Association("Tags").Clear()
		}
		var tags []model.Tag
		if err := tx.Where("name IN ?", tagNames).Find(&tags).Error; err != nil {
			return domainshared.Internal("查询标签失败", err)
		}
		// 校验：所有请求的标签必须存在，避免静默丢弃未知标签
		if len(tags) != len(tagNames) {
			found := make(map[string]bool, len(tags))
			for _, t := range tags {
				found[t.Name] = true
			}
			missing := make([]string, 0)
			for _, n := range tagNames {
				if !found[n] {
					missing = append(missing, n)
				}
			}
			return domainshared.BadRequest(fmt.Sprintf("标签不存在: %s", strings.Join(missing, ", ")))
		}
		return tx.Model(&po).Association("Tags").Replace(&tags)
	})
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

// IncrementViewAtomic 原子地浏览量+1 并记录浏览事件，保证两者在同一事务内提交。
// 在 DB 内用 UPDATE ... SET view_count = view_count + 1（避免读-改-写竞态），
// 同时写入 post_views 事件行。修复原先 Save 与 RecordView 分离导致计数与事件可能不一致。
func (r *PostRepository) IncrementViewAtomic(ctx context.Context, postID domainshared.ID, ipAddress, userAgent string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 浏览量原子自增（DB 内 +1，避免并发覆盖）
		if err := tx.Model(&model.Post{}).
			Where("id = ?", postID.UUID()).
			UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error; err != nil {
			return domainshared.Internal("更新浏览量失败", err)
		}
		// 浏览事件行
		pv := model.PostView{
			PostID: postID.UUID(), IPAddress: ipAddress, UserAgent: userAgent,
		}
		if err := tx.Create(&pv).Error; err != nil {
			return domainshared.Internal("记录浏览事件失败", err)
		}
		return nil
	})
}

// FindArchiveYears 返回所有含已发布文章的年份（倒序、去重）。
// 仅取 published_at 的年份分量，过滤未发布与无发布时间的文章。
func (r *PostRepository) FindArchiveYears(ctx context.Context) ([]int, error) {
	var years []int
	err := r.db.WithContext(ctx).
		Model(&model.Post{}).
		Where("status = ? AND published_at IS NOT NULL", post.StatusPublished).
		Distinct("EXTRACT(YEAR FROM published_at)").
		Order("EXTRACT(YEAR FROM published_at) DESC").
		Pluck("EXTRACT(YEAR FROM published_at)", &years).
		Error
	if err != nil {
		return nil, domainshared.Internal("归档年份查询失败", err)
	}
	return years, nil
}

// FindPublishedByYear 返回指定年份的全部已发布文章（按 published_at 倒序）。
// Preload Tags 以便归档项携带标签名。
func (r *PostRepository) FindPublishedByYear(ctx context.Context, year int) ([]*post.Post, error) {
	var pos []model.Post
	err := r.db.WithContext(ctx).
		Preload("Tags").
		Where("status = ? AND published_at IS NOT NULL AND EXTRACT(YEAR FROM published_at) = ?",
			post.StatusPublished, year).
		Order("published_at DESC").
		Find(&pos).Error
	if err != nil {
		return nil, domainshared.Internal("按年查询归档文章失败", err)
	}
	result := make([]*post.Post, 0, len(pos))
	for _, po := range pos {
		p, _ := postToDomain(po)
		result = append(result, p)
	}
	return result, nil
}

var _ post.PostRepository = (*PostRepository)(nil)
