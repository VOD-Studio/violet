// Package comment 提供 application 层用例。
package comment

import (
	"context"
	"time"

	domain "blog-api/internal/domain/comment"
	"blog-api/internal/domain/shared"
)

// CommentDTO 评论读模型
type CommentDTO struct {
	ID         string           `json:"id"`
	PostID     string           `json:"post_id"`
	ParentID   string           `json:"parent_id,omitempty"`
	Depth      int16            `json:"depth"`
	AuthorName string           `json:"author_name"`
	AvatarURL  string           `json:"avatar_url"`
	Body       string           `json:"body"`
	Pictures   []domain.Picture `json:"pictures"`
	Status     string           `json:"status"`
	CreatedAt  string           `json:"created_at"`
}

// Service 评论用例服务
type Service struct {
	commentRepo domain.CommentRepository
}

// NewService 构造评论用例服务
func NewService(repo domain.CommentRepository) *Service {
	return &Service{commentRepo: repo}
}

// ListByPost 按文章列出已审核评论
func (s *Service) ListByPost(ctx context.Context, postID string, page, limit int) ([]CommentDTO, int64, error) {
	pid, err := shared.ParseID(postID)
	if err != nil {
		return nil, 0, err
	}
	items, total, err := s.commentRepo.FindByPost(ctx, pid, domain.StatusApproved, page, limit)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]CommentDTO, 0, len(items))
	for _, c := range items {
		dtos = append(dtos, toDTO(c))
	}
	return dtos, total, nil
}

// ListPending 列出待审核评论
func (s *Service) ListPending(ctx context.Context, page, limit int) ([]CommentDTO, int64, error) {
	items, total, err := s.commentRepo.FindPending(ctx, page, limit)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]CommentDTO, 0, len(items))
	for _, c := range items {
		dtos = append(dtos, toDTO(c))
	}
	return dtos, total, nil
}

// CreateInput 创建评论入参
type CreateInput struct {
	PostID      string
	ParentID    string
	AuthorName  string
	AuthorEmail string
	AuthorURL   string
	AvatarURL   string
	Body        string
	IPHash      string
	UserAgent   string
}

// Create 创建评论
func (s *Service) Create(ctx context.Context, in CreateInput) (CommentDTO, error) {
	postID, err := shared.ParseID(in.PostID)
	if err != nil {
		return CommentDTO{}, err
	}
	c, err := domain.NewComment(shared.NewID(), postID, in.AuthorName, in.AuthorEmail, in.Body)
	if err != nil {
		return CommentDTO{}, err
	}
	// 设置父评论（嵌套回复）
	if in.ParentID != "" {
		parentID, err := shared.ParseID(in.ParentID)
		if err != nil {
			return CommentDTO{}, err
		}
		parent, err := s.commentRepo.FindByID(ctx, parentID)
		if err != nil {
			return CommentDTO{}, err
		}
		if err := c.SetParent(parent); err != nil {
			return CommentDTO{}, err
		}
	} else {
		_ = c.SetParent(nil)
	}
	if err := s.commentRepo.Save(ctx, c); err != nil {
		return CommentDTO{}, err
	}
	return toDTO(c), nil
}

// Approve 审核通过
func (s *Service) Approve(ctx context.Context, id string) error {
	cid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	return s.commentRepo.UpdateStatus(ctx, cid, domain.StatusApproved)
}

// MarkSpam 标记垃圾
func (s *Service) MarkSpam(ctx context.Context, id string) error {
	cid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	return s.commentRepo.UpdateStatus(ctx, cid, domain.StatusSpam)
}

// Delete 删除评论
func (s *Service) Delete(ctx context.Context, id string) error {
	cid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	return s.commentRepo.Delete(ctx, cid)
}

func toDTO(c *domain.Comment) CommentDTO {
	dto := CommentDTO{
		ID: c.ID().String(), PostID: c.PostID().String(),
		Depth: c.Depth(), AuthorName: c.AuthorName(),
		AvatarURL: c.AvatarURL(), Body: c.Body(),
		Pictures: c.Pictures(), Status: c.Status(),
		CreatedAt: c.CreatedAt().Format(time.RFC3339),
	}
	if c.ParentID() != nil {
		dto.ParentID = c.ParentID().String()
	}
	return dto
}
