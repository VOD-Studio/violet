package gorm

import (
	"context"
	"sort"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func (r *PostRepository) Reorder(ctx context.Context, expected, ordered []shared.ID) error {
	ids := make([]uuid.UUID, len(expected))
	for i, id := range expected {
		ids[i] = id.UUID()
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var rows []model.Post
		// 固定锁顺序，重叠的分页/筛选排序不会互相死锁。
		if err := tx.Select("id", "sort_order", "is_featured").
			Where("id IN ?", ids).Order("id ASC").
			Clauses(clause.Locking{Strength: "UPDATE"}).Find(&rows).Error; err != nil {
			return shared.Internal("读取文章顺序失败", err)
		}
		if len(rows) != len(expected) {
			return shared.Conflict("文章已删除，请刷新列表后重试")
		}
		sort.Slice(rows, func(i, j int) bool { return rows[i].SortOrder < rows[j].SortOrder })
		for i, row := range rows {
			if row.ID != expected[i].UUID() || row.IsFeatured != rows[0].IsFeatured {
				return shared.Conflict("文章顺序或置顶分组已变化，请刷新列表后重试")
			}
		}
		for i, id := range ordered {
			if id == expected[i] {
				continue
			}
			if err := tx.Model(&model.Post{}).Where("id = ?", id.UUID()).
				UpdateColumn("sort_order", rows[i].SortOrder).Error; err != nil {
				return shared.Internal("保存文章顺序失败", err)
			}
		}
		return nil
	})
}

var _ post.OrderRepository = (*PostRepository)(nil)
