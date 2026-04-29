package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"blog-api/internal/repository/generated"
)

// 标签相关错误定义
var (
	ErrTagNotFound = errors.New("标签不存在")
	ErrTagExists   = errors.New("标签已存在")
)

// TagService 标签业务服务
type TagService struct {
	queries *generated.Queries
}

// NewTagService 创建标签服务实例
func NewTagService(queries *generated.Queries) *TagService {
	return &TagService{
		queries: queries,
	}
}

// CreateTag 创建标签
// 自动生成 slug
func (s *TagService) CreateTag(ctx context.Context, name string) (*generated.Tag, error) {
	// 生成 slug
	slug := GenerateSlug(name)

	// 检查标签是否已存在
	_, err := s.queries.GetTagBySlug(ctx, slug)
	if err == nil {
		return nil, ErrTagExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("查询标签失败: %w", err)
	}

	// 创建标签
	tag, err := s.queries.CreateTag(ctx, generated.CreateTagParams{
		Name: name,
		Slug: slug,
	})
	if err != nil {
		return nil, fmt.Errorf("创建标签失败: %w", err)
	}

	return tag, nil
}

// ListTags 获取所有标签
func (s *TagService) ListTags(ctx context.Context) ([]*generated.Tag, error) {
	tags, err := s.queries.ListTags(ctx)
	if err != nil {
		return nil, fmt.Errorf("查询标签列表失败: %w", err)
	}
	return tags, nil
}

// GetTagBySlug 按 slug 获取标签
func (s *TagService) GetTagBySlug(ctx context.Context, slug string) (*generated.Tag, error) {
	tag, err := s.queries.GetTagBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrTagNotFound
		}
		return nil, fmt.Errorf("查询标签失败: %w", err)
	}
	return tag, nil
}

// DeleteTag 删除标签
func (s *TagService) DeleteTag(ctx context.Context, id int32) error {
	// 检查标签是否存在
	_, err := s.queries.GetTagByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrTagNotFound
		}
		return fmt.Errorf("查询标签失败: %w", err)
	}

	// 删除标签（级联删除关联关系）
	if err := s.queries.DeleteTag(ctx, id); err != nil {
		return fmt.Errorf("删除标签失败: %w", err)
	}

	return nil
}
