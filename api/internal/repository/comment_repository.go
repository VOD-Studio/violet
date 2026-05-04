// Package repository 提供数据访问层
package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"blog-api/internal/model"
)

// CommentRepository 评论仓储接口，定义评论数据访问方法
type CommentRepository interface {
	// Create 创建评论
	Create(ctx context.Context, comment *model.Comment) error
	// GetByID 根据 ID 查询评论
	GetByID(ctx context.Context, id uuid.UUID) (*model.Comment, error)
	// ListByPostID 查询文章的评论列表，可按状态过滤
	ListByPostID(ctx context.Context, postID uuid.UUID, status string) ([]*model.Comment, error)
	// ListPending 查询待审核评论列表（分页）
	ListPending(ctx context.Context, limit, offset int32) ([]*model.Comment, error)
	// CountPending 统计待审核评论数量
	CountPending(ctx context.Context) (int64, error)
	// UpdateStatus 更新评论状态
	UpdateStatus(ctx context.Context, id uuid.UUID, status string) error
	// Delete 删除评论（硬删除）
	Delete(ctx context.Context, id uuid.UUID) error
}

// commentRepository GORM 实现
type commentRepository struct {
	db *gorm.DB
}

// NewCommentRepository 创建评论仓储实例
func NewCommentRepository(db *gorm.DB) CommentRepository {
	return &commentRepository{db: db}
}

// Create 创建评论
func (r *commentRepository) Create(ctx context.Context, comment *model.Comment) error {
	return r.db.WithContext(ctx).Create(comment).Error
}

// GetByID 根据 ID 查询评论
func (r *commentRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Comment, error) {
	var comment model.Comment
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&comment).Error
	if err != nil {
		return nil, err
	}
	return &comment, nil
}

// ListByPostID 查询文章的评论列表，按 path 排序（树形结构）
func (r *commentRepository) ListByPostID(ctx context.Context, postID uuid.UUID, status string) ([]*model.Comment, error) {
	var comments []*model.Comment
	query := r.db.WithContext(ctx).Where("post_id = ?", postID)

	// 如果指定了状态，则过滤
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// 按 path 排序，保证父评论在子评论前面
	err := query.Order("path ASC").Find(&comments).Error
	if err != nil {
		return nil, err
	}
	return comments, nil
}

// UpdateStatus 更新评论状态（pending/approved/spam/deleted）
func (r *commentRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	return r.db.WithContext(ctx).
		Model(&model.Comment{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":     status,
			"updated_at": gorm.Expr("NOW()"),
		}).Error
}

// Delete 删除评论（硬删除，不可恢复）
func (r *commentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Comment{}).Error
}

// ListPending 查询待审核评论列表，按创建时间倒序
func (r *commentRepository) ListPending(ctx context.Context, limit, offset int32) ([]*model.Comment, error) {
	var comments []*model.Comment
	err := r.db.WithContext(ctx).
		Where("status = ?", "pending").
		Order("created_at DESC").
		Limit(int(limit)).
		Offset(int(offset)).
		Find(&comments).Error
	if err != nil {
		return nil, err
	}
	return comments, nil
}

// CountPending 统计待审核评论数量
func (r *commentRepository) CountPending(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&model.Comment{}).
		Where("status = ?", "pending").
		Count(&count).Error
	return count, err
}

// GetPictures 从 JSONB 字段解析评论图片列表
func GetPictures(comment *model.Comment) ([]*model.CommentPicture, error) {
	if len(comment.Pictures) == 0 {
		return []*model.CommentPicture{}, nil
	}

	var pictures []*model.CommentPicture
	if err := json.Unmarshal(comment.Pictures, &pictures); err != nil {
		return nil, fmt.Errorf("解析图片数据失败: %w", err)
	}
	return pictures, nil
}

// SetPictures 将评论图片列表序列化为 JSONB 格式
func SetPictures(comment *model.Comment, pictures []*model.CommentPicture) error {
	data, err := json.Marshal(pictures)
	if err != nil {
		return fmt.Errorf("序列化图片数据失败: %w", err)
	}
	comment.Pictures = data
	return nil
}
