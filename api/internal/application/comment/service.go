// Package comment 提供 application 层用例。
package comment

import (
	"context"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	domain "blog-api/internal/domain/comment"
	"blog-api/internal/domain/shared"
)

// 验证码场景前缀（与 auth 的 "verify"/"reset" 隔离）
const codePrefix = "comment"

// 领域错误
var (
	// ErrInvalidCode 验证码错误或已过期
	ErrInvalidCode = shared.BadRequest("验证码错误或已过期")
	// ErrAnonQuotaExceeded 该文章下匿名身份已留过言（一篇一次）
	ErrAnonQuotaExceeded = shared.Conflict("该文章下你已留过言")
)

// EmailSender 邮件发送端口（在 comment 包重声明，复用 infrastructure/email 的 Resend 实现，
// 避免 import auth 包；Go 隐式接口让二者天然适配）。
type EmailSender interface {
	SendVerificationCode(ctx context.Context, email, code string) error
}

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
	codeStore   appshared.CodeStore
	emailSender EmailSender
}

// NewService 构造评论用例服务。
//
// codeStore 和 emailSender 用于匿名评论的邮箱验证码两步流（PRD-0001）。
func NewService(repo domain.CommentRepository, codeStore appshared.CodeStore, emailSender EmailSender) *Service {
	return &Service{commentRepo: repo, codeStore: codeStore, emailSender: emailSender}
}

// ListByPost 按文章列出评论。
//
// 黑洞模式（PRD-0001）：匿名 viewer（viewerUserID 为空字符串）直接返回空数组，
// 看不到任何评论（含自己刚提交的）；登录 viewer 返回 approved ∪ 自己的 pending。
func (s *Service) ListByPost(ctx context.Context, postID, viewerUserID string, page, limit int) ([]CommentDTO, int64, error) {
	// 黑洞模式：匿名 viewer 不查 DB。
	if viewerUserID == "" {
		return []CommentDTO{}, 0, nil
	}
	pid, err := shared.ParseID(postID)
	if err != nil {
		return nil, 0, err
	}
	viewerID, err := shared.ParseID(viewerUserID)
	if err != nil {
		return nil, 0, err
	}
	items, total, err := s.commentRepo.FindByPost(ctx, pid, domain.StatusApproved, &viewerID, page, limit)
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
	UserID      string // 登录 user id；空字符串表示匿名
	AuthorName  string // 登录态由 handler 从 user 资料填，匿名态从前端填
	AuthorEmail string // 同上；匿名必填
	AuthorURL   string
	AvatarURL   string
	Body        string
	Code        string         // 匿名必填（邮箱验证码）
	Anchor      *domain.Anchor // 选区批注锚点；nil 表示自由评论
	IPHash      string         // handler 层从 middleware.GetClientIP + SHA256 填充
	UserAgent   string
}

// Create 创建评论。
//
// 双轨认证（PRD-0001）：
//   - 登录（UserID 非空）：跳过验证码、跳过配额，author_* 由 handler 从 user 资料填
//   - 匿名（UserID 空）：CodeStore.Verify 校验验证码 → per-post 配额校验 → 落库
//
// ip_hash 一律由 handler 填充（登录/匿名都需要，配额与反垃圾元数据都用）。
func (s *Service) Create(ctx context.Context, in CreateInput) (CommentDTO, error) {
	postID, err := shared.ParseID(in.PostID)
	if err != nil {
		return CommentDTO{}, err
	}

	isAnon := in.UserID == ""
	var userIDPtr *shared.ID
	if !isAnon {
		uid, err := shared.ParseID(in.UserID)
		if err != nil {
			return CommentDTO{}, err
		}
		userIDPtr = &uid
	}

	// 匿名路径：校验验证码 + 配额。
	if isAnon {
		if err := s.verifyAnonCode(ctx, in.AuthorEmail, in.Code); err != nil {
			return CommentDTO{}, err
		}
		if err := s.checkAnonQuota(ctx, postID, in.IPHash, in.AuthorEmail); err != nil {
			return CommentDTO{}, err
		}
	}

	c, err := domain.NewComment(domain.CreateParams{
		ID:          shared.NewID(),
		PostID:      postID,
		UserID:      userIDPtr,
		Anchor:      in.Anchor,
		AuthorName:  in.AuthorName,
		AuthorEmail: in.AuthorEmail,
		AuthorURL:   in.AuthorURL,
		AvatarURL:   in.AvatarURL,
		Body:        in.Body,
	})
	if err != nil {
		return CommentDTO{}, err
	}
	c.SetIPHash(in.IPHash)
	c.SetUserAgent(in.UserAgent)

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

// verifyAnonCode 校验匿名评论的邮箱验证码。
// email 会先归一化（与 domain.NewComment 的归一化一致），保证 key 一致。
func (s *Service) verifyAnonCode(ctx context.Context, email, code string) error {
	email = normalizeEmail(email)
	if email == "" || code == "" {
		return ErrInvalidCode
	}
	ok, err := s.codeStore.Verify(ctx, codePrefix, email, appshared.SHA256Hash(code))
	if err != nil {
		return shared.Internal("验证码校验失败", err)
	}
	if !ok {
		return ErrInvalidCode
	}
	return nil
}

// checkAnonQuota 校验「一篇一次」匿名配额。
func (s *Service) checkAnonQuota(ctx context.Context, postID shared.ID, ipHash, email string) error {
	email = normalizeEmail(email)
	n, err := s.commentRepo.CountByPostAndAnon(ctx, postID, ipHash, email)
	if err != nil {
		return err
	}
	if n >= 1 {
		return ErrAnonQuotaExceeded
	}
	return nil
}

// normalizeEmail 邮箱归一化（与 domain.normalizeEmail 一致：小写 + trim）。
// service 层在查 CodeStore / 配额前需用同一归一化 key。
func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// AnchorInput 锚点请求 DTO（handler 层接收的 JSON 形态，转成 domain.Anchor）。
type AnchorInput struct {
	BlockID       string `json:"block_id"`
	StartOffset   int    `json:"start_offset"`
	EndOffset     int    `json:"end_offset"`
	SelectedText  string `json:"selected_text"`
	BlockHashSync string `json:"block_text_hash"`
}

// ToDomain 转成领域 Anchor。nil 接收者返回 nil。
func (a *AnchorInput) ToDomain() *domain.Anchor {
	if a == nil {
		return nil
	}
	return &domain.Anchor{
		BlockID:       a.BlockID,
		StartOffset:   a.StartOffset,
		EndOffset:     a.EndOffset,
		SelectedText:  a.SelectedText,
		BlockHashSync: a.BlockHashSync,
	}
}

// SendCodeInput 发送匿名评论验证码入参
type SendCodeInput struct {
	PostID string
	Email  string
}

// SendCode 匿名评论第一步：生成验证码 → 存 Redis → 发邮件。
//
// 编排参照 auth.RegisterUserHandler：发邮件失败仅 warn 不阻塞（devMode 下验证码打日志）。
func (s *Service) SendCode(ctx context.Context, in SendCodeInput) error {
	email := normalizeEmail(in.Email)
	if email == "" {
		return shared.BadRequest("邮箱不能为空")
	}
	// 顺带校验 PostID 格式，避免对不存在的文章发码。
	if _, err := shared.ParseID(in.PostID); err != nil {
		return err
	}
	code, err := appshared.GenerateVerificationCode()
	if err != nil {
		return shared.Internal("生成验证码失败", err)
	}
	if err := s.codeStore.Store(ctx, codePrefix, email, appshared.SHA256Hash(code)); err != nil {
		log.Error().Err(err).Msg("存储评论验证码失败")
	}
	if err := s.emailSender.SendVerificationCode(ctx, email, code); err != nil {
		log.Warn().Err(err).Str("email", email).Msg("发送评论验证邮件失败")
	}
	return nil
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
