// Package gorm 提供 tag 模块的 GORM 存储实现。
package gorm

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"blog-api/internal/domain/shared"
	domaintag "blog-api/internal/domain/tag"
	newmodel "blog-api/internal/infrastructure/persistence/gorm/model"
)

// TagRepository 实现领域 TagRepository 端口
type TagRepository struct{ db *gorm.DB }

// NewTagRepository 创建标签仓储
func NewTagRepository(db *gorm.DB) *TagRepository {
	return &TagRepository{db: db}
}

func tagToDomain(po newmodel.Tag) domaintag.Tag {
	return domaintag.NewTag(po.ID, po.Name, po.Slug)
}

func (r *TagRepository) FindAll(ctx context.Context) ([]domaintag.Tag, error) {
	var pos []newmodel.Tag
	if err := r.db.WithContext(ctx).Order("id ASC").Find(&pos).Error; err != nil {
		return nil, shared.Internal("查询标签列表失败", err)
	}
	tags := make([]domaintag.Tag, 0, len(pos))
	for _, po := range pos {
		tags = append(tags, tagToDomain(po))
	}
	return tags, nil
}

func (r *TagRepository) FindPage(ctx context.Context, q shared.PageQuery) (shared.PageResult[domaintag.Tag], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&newmodel.Tag{}).Order("id ASC")
	var pos []newmodel.Tag
	total, err := countAndFind(query, q, &pos, "标签")
	if err != nil {
		return shared.PageResult[domaintag.Tag]{}, err
	}
	tags := make([]domaintag.Tag, 0, len(pos))
	for _, po := range pos {
		tags = append(tags, tagToDomain(po))
	}
	return shared.NewPageResult(q, tags, total), nil
}

func (r *TagRepository) FindByID(ctx context.Context, id int32) (domaintag.Tag, error) {
	var po newmodel.Tag
	if err := r.db.WithContext(ctx).First(&po, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domaintag.Tag{}, domaintag.ErrNotFound
		}
		return domaintag.Tag{}, shared.Internal("查询标签失败", err)
	}
	return tagToDomain(po), nil
}

func (r *TagRepository) FindBySlug(ctx context.Context, slug string) (domaintag.Tag, error) {
	var po newmodel.Tag
	if err := r.db.WithContext(ctx).Where("slug = ?", slug).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domaintag.Tag{}, domaintag.ErrNotFound
		}
		return domaintag.Tag{}, shared.Internal("查询标签失败", err)
	}
	return tagToDomain(po), nil
}

func (r *TagRepository) Save(ctx context.Context, t domaintag.Tag) (int32, error) {
	po := newmodel.Tag{ID: t.ID(), Name: t.Name(), Slug: t.Slug()}
	if po.ID == 0 {
		if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
			return 0, shared.Internal("创建标签失败", err)
		}
		return po.ID, nil
	}
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return 0, shared.Internal("更新标签失败", err)
	}
	return po.ID, nil
}

func (r *TagRepository) Delete(ctx context.Context, id int32) error {
	result := r.db.WithContext(ctx).Delete(&newmodel.Tag{}, id)
	if result.Error != nil {
		return shared.Internal("删除标签失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return domaintag.ErrNotFound
	}
	return nil
}

func (r *TagRepository) ExistsBySlug(ctx context.Context, slug string) (bool, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&newmodel.Tag{}).Where("slug = ?", slug).Count(&count).Error; err != nil {
		return false, shared.Internal("查询标签存在性失败", err)
	}
	return count > 0, nil
}

var _ domaintag.TagRepository = (*TagRepository)(nil)
