package gorm

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

type PostViewRepository struct {
	db *gorm.DB
}

func NewPostViewRepository(db *gorm.DB) *PostViewRepository {
	return &PostViewRepository{db: db}
}

func (r *PostViewRepository) FindPage(ctx context.Context, postID shared.ID, q shared.PageQuery) (shared.PageResult[post.View], error) {
	q = q.Normalize()
	var article model.Post
	if err := r.db.WithContext(ctx).Unscoped().Select("id").First(&article, "id = ?", postID.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return shared.PageResult[post.View]{}, post.ErrNotFound
		}
		return shared.PageResult[post.View]{}, shared.Internal("查询文章失败", err)
	}
	var rows []model.PostView
	total, err := countAndFind(r.db.WithContext(ctx).Model(&model.PostView{}).
		Where("post_id = ?", postID.UUID()).Order("created_at DESC, id ASC"), q, &rows, "文章浏览记录")
	if err != nil {
		return shared.PageResult[post.View]{}, err
	}
	items := make([]post.View, len(rows))
	for i, row := range rows {
		items[i] = post.View{ID: row.ID, IPAddress: row.IPAddress, UserAgent: row.UserAgent, CreatedAt: row.CreatedAt}
	}
	return shared.NewPageResult(q, items, total), nil
}

var _ post.ViewRepository = (*PostViewRepository)(nil)
