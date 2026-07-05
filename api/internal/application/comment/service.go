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

// codePrefix 匿名评论验证码在 CodeStore 中的场景前缀。
// 与 auth 包的 "verify"（注册验证）/"reset"（密码重置）隔离，
// 保证不同业务的验证码 key 空间不冲突（如 comment:alice@x.com ≠ verify:alice@x.com）。
const codePrefix = "comment"

// 领域错误（映射见 internal/interfaces/http/response/error.go 的 httpStatusForCode）
var (
	// ErrInvalidCode 邮箱验证码错误、已过期、或尝试次数耗尽（5 次错误锁定）。
	// BadRequest → HTTP 400。一次性校验，CodeStore.Verify 内部 Lua 原子删除。
	ErrInvalidCode = shared.BadRequest("验证码错误或已过期")

	// ErrAnonQuotaExceeded 该文章下此匿名身份已留过言。
	// 匿名留言板模式硬约束：每篇文章每个 (ip_hash, email) 仅能评论一次（PRD-0001）。
	// Conflict → HTTP 409。
	ErrAnonQuotaExceeded = shared.Conflict("该文章下你已留过言")
)

// EmailSender 邮件发送端口（application 层端口，不依赖具体 provider）。
//
// 在 comment 包重声明而非 import auth 包的同名接口，避免跨模块耦合；
// Go 结构化接口让 infrastructure/email 的 *Sender（Resend 实现）天然适配。
type EmailSender interface {
	SendVerificationCode(ctx context.Context, email, code string) error
}

// CommentDTO 评论读模型
// AnchorDTO 锚点响应 DTO（CommentDTO.Anchor 的形态，snake_case 外部契约）。
// 自由评论的 Anchor 为 nil（JSON 省略）；批注非 nil。
type AnchorDTO struct {
	BlockID       string `json:"block_id"`
	StartOffset   int    `json:"start_offset"`
	EndOffset     int    `json:"end_offset"`
	SelectedText  string `json:"selected_text"`
	BlockHashSync string `json:"block_text_hash"`
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
	// IsAuthor 该评论是否由文章 Owner 本人发出（运行时：created_by == post.author_id）。
	// 用于前端作者高亮（neon-green/shadcn emerald）。匿名评论恒为 false。
	IsAuthor   bool             `json:"is_author"`
	// Anchor 选区批注锚点；自由评论为 nil（JSON 省略），批注非 nil。
	Anchor     *AnchorDTO       `json:"anchor,omitempty"`
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
//
// postAuthorID 用于运行时计算 CommentDTO.is_author（comment.created_by == post.author_id），
// 由 handler 查 post 后传入。
//
// anchorFilter 控制按 anchor 列过滤（自由评论 / 批注 / 全部），见 domain.AnchorFilter；
// 空串视为 AnchorFilterAll。前端底部评论区传 AnchorFilterFree，批注角标层传
// AnchorFilterAnnotation，把两条数据流在接口层彻底分开。
func (s *Service) ListByPost(ctx context.Context, postID, viewerUserID, postAuthorID string, anchorFilter domain.AnchorFilter, page, limit int) ([]CommentDTO, int64, error) {
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
	items, total, err := s.commentRepo.FindByPost(ctx, pid, domain.StatusApproved, &viewerID, anchorFilter, page, limit)
	if err != nil {
		return nil, 0, err
	}
	// is_author 计算需要 post.author_id；解析失败时留空（所有评论都不算作者）。
	var authorID *shared.ID
	if postAuthorID != "" {
		if aid, err := shared.ParseID(postAuthorID); err == nil {
			authorID = &aid
		}
	}
	dtos := make([]CommentDTO, 0, len(items))
	for _, c := range items {
		dtos = append(dtos, toDTO(c, authorID))
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
			CommentDTO: toDTO(cwp.Comment, nil),
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
		CommentDTO: toDTO(cwp.Comment, nil),
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
		dtos = append(dtos, toDTO(c, nil))
	}
	return dtos, total, nil
}

// CreateInput 创建评论入参（handler 层组装，application 层消费）。
type CreateInput struct {
	PostID string // 所属文章 id
	ParentID string // 父评论 id（顶级评论为空）；非空时为嵌套回复

	// UserID 登录用户 id；空字符串表示匿名（双轨认证）。
	// 决定走哪条校验路径：非空 → 跳过验证码/配额；空 → 走匿名两步流校验。
	UserID string

	// 以下 author_* 字段：登录态由 handler 从 user 资料填充（请求体里的同名字段会被忽略防伪造）；
	// 匿名态由 handler 从请求体透传。匿名时 AuthorName/AuthorEmail 必填。
	AuthorName  string
	AuthorEmail string // 匿名必填；service 会再归一化一次保证与 CodeStore key 一致
	AuthorURL   string
	AvatarURL   string

	Body   string         // 评论正文（纯文本）
	Code   string         // 匿名必填：邮箱验证码。登录态忽略此字段。
	Anchor *domain.Anchor // 选区批注锚点；nil 表示自由评论。Anchor 非空时 UserID 必须非空。
	// Pictures 评论附图（Bilibili 式，可选）。handler 接线后流入 domain.SetPictures。
	Pictures []domain.Picture

	// IPHash 评论者 IP 的 SHA256（handler 用 middleware.GetClientIP + SHA256 算）。
	// 匿名评论的 per-post 配额依赖此字段；登录评论也填（反垃圾元数据统一）。
	IPHash string
	UserAgent string
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
	// pictures 接线（Issue-0003）：handler 传入则覆盖 NewComment 的空默认值。
	if len(in.Pictures) > 0 {
		c.SetPictures(in.Pictures)
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
	return toDTO(c, nil), nil
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
//
// 字段语义与 domain.Anchor 一一对应，仅 JSON tag 不同（snake_case 外部契约 vs 驼峰内部）。
// 之所以独立一层 DTO：domain 层不感知 HTTP/JSON，转换逻辑集中在 application 层。
type AnchorInput struct {
	BlockID       string `json:"block_id"`         // 块标识符（块纯文本 SHA1 前 8 位）
	StartOffset   int    `json:"start_offset"`     // 选区起始偏移（块内字符位）
	EndOffset     int    `json:"end_offset"`       // 选区结束偏移（exclusive）
	SelectedText  string `json:"selected_text"`    // 选中原文（fuzzy 重定位锚）
	BlockHashSync string `json:"block_text_hash"`  // 块内容快照（漂移检测）
}

// ToDomain 转成领域 Anchor。nil 接收者返回 nil（表示这是一条自由评论，非批注）。
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

// PictureInput 评论附图请求 DTO（handler 层接收的 JSON 形态，转成 domain.Picture）。
type PictureInput struct {
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Size   int64  `json:"size"`
}

// ToDomain 切片转换：[]PictureInput → []domain.Picture。
func PicturesToDomain(in []PictureInput) []domain.Picture {
	if len(in) == 0 {
		return nil
	}
	out := make([]domain.Picture, len(in))
	for i, p := range in {
		out[i] = domain.Picture{URL: p.URL, Width: p.Width, Height: p.Height, Size: p.Size}
	}
	return out
}

// SendCodeInput 匿名评论第一步（发送验证码）的入参。
type SendCodeInput struct {
	PostID string // 所属文章 id（顺带校验格式，避免对不存在的文章发码）
	Email  string // 接收验证码的邮箱；service 内会归一化
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

// toDTO 把 domain.Comment 转成 CommentDTO。
// postAuthorID 非空时用于计算 IsAuthor（comment.created_by == post.author_id）；
// nil 时 IsAuthor 恒为 false（适用于后台管理等不需要作者高亮的场景）。
func toDTO(c *domain.Comment, postAuthorID *shared.ID) CommentDTO {
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
	// is_author：仅当提供了 postAuthorID 且评论者登录态（created_by 非空）且二者相等时为 true
	if postAuthorID != nil && c.UserID() != nil && *c.UserID() == *postAuthorID {
		dto.IsAuthor = true
	}
	// anchor：批注才有，转成 DTO 形态（snake_case）
	if a := c.Anchor(); a != nil {
		dto.Anchor = &AnchorDTO{
			BlockID:       a.BlockID,
			StartOffset:   a.StartOffset,
			EndOffset:     a.EndOffset,
			SelectedText:  a.SelectedText,
			BlockHashSync: a.BlockHashSync,
		}
	}
	return dto
}
