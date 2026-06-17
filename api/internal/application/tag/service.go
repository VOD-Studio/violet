// Package tag 提供标签的应用用例。
package tag

import (
	"context"
	"strings"
	"unicode"

	"github.com/google/uuid"

	domaintag "blog-api/internal/domain/tag"
)

// TagDTO 标签读模型
type TagDTO struct {
	ID   int32  `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// Service 标签用例服务
type Service struct {
	repo domaintag.TagRepository
}

// NewService 构造标签服务
func NewService(repo domaintag.TagRepository) *Service {
	return &Service{repo: repo}
}

// List 列出所有标签
func (s *Service) List(ctx context.Context) ([]TagDTO, error) {
	tags, err := s.repo.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	dtos := make([]TagDTO, 0, len(tags))
	for _, t := range tags {
		dtos = append(dtos, toDTO(t))
	}
	return dtos, nil
}

// Create 创建标签（自动生成 slug）
func (s *Service) Create(ctx context.Context, name string) (TagDTO, error) {
	slug := GenerateSlug(name)
	exists, err := s.repo.ExistsBySlug(ctx, slug)
	if err != nil {
		return TagDTO{}, err
	}
	if exists {
		return TagDTO{}, domaintag.ErrNameExists
	}
	id, err := s.repo.Save(ctx, domaintag.NewTag(0, name, slug))
	if err != nil {
		return TagDTO{}, err
	}
	return TagDTO{ID: id, Name: name, Slug: slug}, nil
}

// Delete 删除标签
func (s *Service) Delete(ctx context.Context, id int32) error {
	return s.repo.Delete(ctx, id)
}

func toDTO(t domaintag.Tag) TagDTO {
	return TagDTO{ID: t.ID(), Name: t.Name(), Slug: t.Slug()}
}

// GenerateSlug 从标题生成 URL 友好的 slug（支持中文，最大 50 字符）
func GenerateSlug(title string) string {
	slug := strings.ToLower(title)
	slug = strings.ReplaceAll(slug, " ", "-")
	var result []rune
	prevDash := false
	for _, r := range slug {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' || unicode.Is(unicode.Han, r) {
			if r == '-' {
				if !prevDash {
					result = append(result, r)
					prevDash = true
				}
			} else {
				result = append(result, r)
				prevDash = false
			}
		}
	}
	slug = strings.Trim(string(result), "-")
	if len(slug) > 50 {
		runes := []rune(slug[:50])
		lastDash := -1
		for i := len(runes) - 1; i >= 0; i-- {
			if runes[i] == '-' {
				lastDash = i
				break
			}
		}
		if lastDash > 0 {
			slug = string(runes[:lastDash])
		} else {
			slug = string(runes)
		}
		slug = slug + "-" + uuid.New().String()[:6]
	}
	if slug == "" {
		slug = "tag-" + uuid.New().String()[:8]
	}
	return slug
}
