package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/rs/zerolog/log"

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
	log.Info().Str("service", "TagService").Str("operation", "CreateTag").Str("name", name).Msg("开始创建标签")

	// 生成 slug
	slug := GenerateSlug(name)

	// 检查标签是否已存在
	log.Debug().Str("query", "GetTagBySlug").Str("slug", slug).Msg("检查标签是否已存在")
	_, err := s.queries.GetTagBySlug(ctx, slug)
	if err == nil {
		log.Warn().Str("slug", slug).Msg("标签已存在")
		return nil, ErrTagExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		log.Error().Err(err).Str("slug", slug).Msg("查询标签失败")
		return nil, fmt.Errorf("查询标签失败: %w", err)
	}

	// 创建标签
	log.Debug().Str("query", "CreateTag").Str("name", name).Msg("创建标签记录")
	tag, err := s.queries.CreateTag(ctx, generated.CreateTagParams{
		Name: name,
		Slug: slug,
	})
	if err != nil {
		log.Error().Err(err).Str("name", name).Msg("创建标签失败")
		return nil, fmt.Errorf("创建标签失败: %w", err)
	}

	log.Info().Int32("tag_id", tag.ID).Str("name", name).Msg("标签创建成功")
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
	log.Info().Str("service", "TagService").Str("operation", "DeleteTag").Int32("tag_id", id).Msg("开始删除标签")

	// 检查标签是否存在
	log.Debug().Str("query", "GetTagByID").Int32("tag_id", id).Msg("检查标签是否存在")
	_, err := s.queries.GetTagByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Int32("tag_id", id).Msg("标签不存在")
			return ErrTagNotFound
		}
		log.Error().Err(err).Int32("tag_id", id).Msg("查询标签失败")
		return fmt.Errorf("查询标签失败: %w", err)
	}

	// 删除标签（级联删除关联关系）
	log.Debug().Str("query", "DeleteTag").Int32("tag_id", id).Msg("执行删除操作")
	if err := s.queries.DeleteTag(ctx, id); err != nil {
		log.Error().Err(err).Int32("tag_id", id).Msg("删除标签失败")
		return fmt.Errorf("删除标签失败: %w", err)
	}

	log.Info().Int32("tag_id", id).Msg("标签删除成功")
	return nil
}
