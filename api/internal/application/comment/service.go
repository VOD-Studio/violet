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

// AdminCommentDTO 后台管理评论读模型（含所属文章信息）
type AdminCommentDTO struct {
	CommentDTO
	PostID    string `json:"post_id"`
	PostTitle string `json:"post_title"`
	PostSlug  string `json:"post_slug"`
}

// ListAll 全局评论列表（后台管理，可选状态筛选）
func (s *Service) ListAll(ctx context.Context, status string, page, limit int) ([]AdminCommentDTO, int64, error) {
	items, total, err := s.commentRepo.FindAll(ctx, status, page, limit)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]AdminCommentDTO, 0, len(items))
	for _, cwp := range items {
		dto := AdminCommentDTO{
			CommentDTO: toDTO(cwp.Comment),
			PostID:     cwp.Post.ID.String(),
			PostTitle:  cwp.Post.Title,
			PostSlug:   cwp.Post.Slug,
		}
		dtos = append(dtos, dto)
	}
	return dtos, total, nil
}

// CountPending 统计待审核评论数量
func (s *Service) CountPending(ctx context.Context) (int64, error) {
	return s.commentRepo.CountPending(ctx)
}

// GetDetail 获取评论详情（后台管理，含所属文章）
func (s *Service) GetDetail(ctx context.Context, id string) (AdminCommentDTO, error) {
	cid, err := shared.ParseID(id)
	if err != nil {
		return AdminCommentDTO{}, err
	}
	cwp, err := s.commentRepo.FindByIDWithPost(ctx, cid)
	if err != nil {
		return AdminCommentDTO{}, err
	}
	return AdminCommentDTO{
		CommentDTO: toDTO(cwp.Comment),
		PostID:     cwp.Post.ID.String(),
		PostTitle:  cwp.Post.Title,
		PostSlug:   cwp.Post.Slug,
	}, nil
}

// BatchUpdateStatus 批量更新评论状态，返回受影响行数
func (s *Service) BatchUpdateStatus(ctx context.Context, ids []string, status string) (int64, error) {
	if !domain.IsValidStatus(status) {
		return 0, domain.ErrInvalidStatus
	}
	if len(ids) == 0 {
		return 0, shared.BadRequest("评论 ID 列表不能为空")
	}
	domainIDs := make([]shared.ID, 0, len(ids))
	for _, idStr := range ids {
		id, err := shared.ParseID(idStr)
		if err != nil {
			return 0, err
		}
		domainIDs = append(domainIDs, id)
	}
	return s.commentRepo.BatchUpdateStatus(ctx, domainIDs, status)
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
