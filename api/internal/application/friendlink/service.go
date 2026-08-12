// Package friendlink 提供友链 application 层用例。
package friendlink

import (
	"context"
	"strings"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	domain "blog-api/internal/domain/friendlink"
	"blog-api/internal/domain/shared"
)

// codePrefix 匿名友链申请验证码在 CodeStore 中的场景前缀。
// 与 comment/verify/reset 的 key 空间隔离（如 friendlink:alice@x.com ≠ comment:alice@x.com）。
const codePrefix = "friendlink"

// 领域错误（映射见 internal/interfaces/http/response/error.go 的 httpStatusForCode）
var (
	// ErrInvalidCode 邮箱验证码错误、已过期、或尝试次数耗尽。
	// BadRequest → HTTP 400。一次性校验，CodeStore.Verify 内部原子删除。
	ErrInvalidCode = shared.BadRequest("验证码错误或已过期")

	// ErrPendingExists 同一 (ip_hash, contact_email) 已有待审核申请。
	// 业务配额硬约束：同一申请身份同时仅一个 pending（PRD-0014）。Conflict → HTTP 409。
	ErrPendingExists = shared.Conflict("你的申请正在审核中")

	// ErrURLTaken 站点 URL 已被非 rejected 记录占用（展示中/待审核/已下柜）。
	// rejected 不占用，被拒后可修正信息重新申请同一 URL。Conflict → HTTP 409。
	ErrURLTaken = shared.Conflict("该站点已在友链列表或审核中")
)

// EmailSender 邮件发送端口（application 层端口，不依赖具体 provider）。
//
// 在 friendlink 包重声明而非 import comment 包的同名接口，避免跨模块耦合；
// Go 结构化接口让 infrastructure/email 的 *Sender 天然适配。
type EmailSender interface {
	SendVerificationCode(ctx context.Context, email, code string) error
}

// Service 友链用例服务
type Service struct {
	repo        domain.FriendLinkRepository
	codeStore   appshared.CodeStore
	emailSender EmailSender
	bus         appshared.EventBus
}

// NewService 构造友链用例服务。
//
// codeStore 和 emailSender 用于匿名申请的邮箱验证码两步流（镜像评论域，PRD-0014）；
// bus 发布领域事件（审计订阅者消费）。
func NewService(repo domain.FriendLinkRepository, codeStore appshared.CodeStore, emailSender EmailSender, bus appshared.EventBus) *Service {
	return &Service{repo: repo, codeStore: codeStore, emailSender: emailSender, bus: bus}
}

// ============================================================
// 公开用例
// ============================================================

// ListPublic 前台友链列表（仅 approved，sort_order 升序同权重 created_at）。
//
// 空列表返回空数组而非 nil（前端空态依赖 [] 序列化）。
func (s *Service) ListPublic(ctx context.Context) ([]FriendLinkDTO, error) {
	items, err := s.repo.FindApproved(ctx)
	if err != nil {
		return nil, err
	}
	dtos := make([]FriendLinkDTO, 0, len(items))
	for _, f := range items {
		dtos = append(dtos, toDTO(f))
	}
	return dtos, nil
}

// ApplyInput 申请友链入参（handler 层组装，application 层消费）。
type ApplyInput struct {
	// UserID 登录用户 id；空字符串表示匿名（双轨认证）。
	// 决定走哪条校验路径：非空 → 跳过验证码；空 → CodeStore.Verify。
	UserID string

	Name        string
	URL         string
	AvatarURL   string // 可空
	Description string // 可空
	OwnerName   string // 可空
	LinkbackURL string // 可空，回链页地址（审核参考）

	// ContactEmail 联系邮箱。登录态由 handler 从 user 资料覆盖（防伪造）；
	// 匿名态手填必填。service 会再归一化一次保证与 CodeStore/配额 key 一致。
	ContactEmail string
	// Code 匿名必填：邮箱验证码（来自 /friend-links/code）。登录态忽略此字段。
	Code string

	// IPHash 申请 IP 的 SHA256（handler 用 middleware.GetClientIP + SHA256 算）。
	// 登录/匿名都填：业务配额 key = (ip_hash, contact_email)。
	IPHash string
}

// Apply 申请友链（双轨认证，PRD-0014）。
//
// 校验链：
//  1. 业务配额：同 (ip_hash, contact_email) 已有 pending → 409
//  2. URL 占用：被非 rejected 记录占用 → 409（rejected 不阻塞重新申请）
//  3. 匿名 → CodeStore.Verify 校验邮箱验证码（登录跳过）
//  4. domain.NewFriendLink 字段校验 → 落库 → 发布 friendlink.created
func (s *Service) Apply(ctx context.Context, in ApplyInput) (FriendLinkDTO, error) {
	isAnon := in.UserID == ""
	var userIDPtr *shared.ID
	if !isAnon {
		uid, err := shared.ParseID(in.UserID)
		if err != nil {
			return FriendLinkDTO{}, err
		}
		userIDPtr = &uid
	}

	email := domain.NormalizeEmail(in.ContactEmail)
	// 先判配额与 url 占用再验码：验证码一次性，撞 409 不应吞码（Spec 评审发现）
	if err := s.checkQuota(ctx, in.IPHash, email); err != nil {
		return FriendLinkDTO{}, err
	}
	if err := s.checkURLAvailable(ctx, strings.TrimSpace(in.URL), shared.ID{}); err != nil {
		return FriendLinkDTO{}, err
	}
	if isAnon {
		if err := s.verifyAnonCode(ctx, email, in.Code); err != nil {
			return FriendLinkDTO{}, err
		}
	}

	f, err := domain.NewFriendLink(domain.CreateParams{
		ID:           shared.NewID(),
		UserID:       userIDPtr,
		Name:         in.Name,
		URL:          in.URL,
		AvatarURL:    in.AvatarURL,
		Description:  in.Description,
		OwnerName:    in.OwnerName,
		LinkbackURL:  in.LinkbackURL,
		ContactEmail: email,
		IPHash:       in.IPHash,
	})
	if err != nil {
		return FriendLinkDTO{}, err
	}
	if err := s.repo.Save(ctx, f); err != nil {
		return FriendLinkDTO{}, err
	}
	s.publishEvents(ctx, f)
	return toDTO(f), nil
}

// verifyAnonCode 校验匿名申请的邮箱验证码。
// email 已归一化（与 domain 归一化一致），保证 key 一致。
func (s *Service) verifyAnonCode(ctx context.Context, email, code string) error {
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

// checkQuota 校验「同一申请身份同时仅一个 pending」配额。
func (s *Service) checkQuota(ctx context.Context, ipHash, email string) error {
	n, err := s.repo.CountPendingByIdentity(ctx, ipHash, email)
	if err != nil {
		return err
	}
	if n >= 1 {
		return ErrPendingExists
	}
	return nil
}

// checkURLAvailable 校验 URL 未被非 rejected 记录占用。
// excludeID 非零时排除自身（后台编辑场景）。
func (s *Service) checkURLAvailable(ctx context.Context, siteURL string, excludeID shared.ID) error {
	exists, err := s.repo.ExistsActiveByURL(ctx, siteURL, excludeID)
	if err != nil {
		return err
	}
	if exists {
		return ErrURLTaken
	}
	return nil
}

// SendCodeInput 匿名申请第一步（发送验证码）的入参。
type SendCodeInput struct {
	Email string // 接收验证码的邮箱；service 内会归一化
}

// SendCode 匿名申请第一步：生成验证码 → 存 Redis → 发邮件。
//
// 编排参照评论域：发邮件失败仅 warn 不阻塞（devMode 下验证码打日志）。
func (s *Service) SendCode(ctx context.Context, in SendCodeInput) error {
	email := domain.NormalizeEmail(in.Email)
	if email == "" {
		return shared.BadRequest("邮箱不能为空")
	}
	code, err := appshared.GenerateVerificationCode()
	if err != nil {
		return shared.Internal("生成验证码失败", err)
	}
	if err := s.codeStore.Store(ctx, codePrefix, email, appshared.SHA256Hash(code)); err != nil {
		log.Error().Err(err).Msg("存储友链申请验证码失败")
	}
	if err := s.emailSender.SendVerificationCode(ctx, email, code); err != nil {
		log.Warn().Err(err).Str("email", email).Msg("发送友链申请验证邮件失败")
	}
	return nil
}

// ============================================================
// 后台管理用例
// ============================================================

// ListByStatus 后台友链列表（状态筛选，空串 = 全部；分页）。
func (s *Service) ListByStatus(ctx context.Context, status string, page, limit int) ([]FriendLinkAdminDTO, int64, error) {
	if status != "" && !domain.IsValidStatus(status) {
		return nil, 0, shared.BadRequest("非法的状态筛选值")
	}
	items, total, err := s.repo.FindByStatus(ctx, status, page, limit)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]FriendLinkAdminDTO, 0, len(items))
	for _, f := range items {
		dtos = append(dtos, toAdminDTO(f))
	}
	return dtos, total, nil
}

// CountPending 统计待审核申请数量（后台菜单角标）
func (s *Service) CountPending(ctx context.Context) (int64, error) {
	return s.repo.CountPending(ctx)
}

// ManualInput 手动添加入参（不走申请流，直接 approved）。
type ManualInput struct {
	Name         string
	URL          string
	AvatarURL    string
	Description  string
	OwnerName    string
	LinkbackURL  string
	ContactEmail string // 可空（手动添加无需联系邮箱）
	SortOrder    int
}

// CreateManual 站长手动添加友链（直接 approved）。
//
// URL 占用检查同申请流（DB 部分唯一索引兜底）。
func (s *Service) CreateManual(ctx context.Context, in ManualInput) (FriendLinkAdminDTO, error) {
	if err := s.checkURLAvailable(ctx, strings.TrimSpace(in.URL), shared.ID{}); err != nil {
		return FriendLinkAdminDTO{}, err
	}
	f, err := domain.NewManual(
		shared.NewID(), in.Name, in.URL, in.AvatarURL, in.Description,
		in.OwnerName, in.LinkbackURL, in.ContactEmail, in.SortOrder,
	)
	if err != nil {
		return FriendLinkAdminDTO{}, err
	}
	if err := s.repo.Save(ctx, f); err != nil {
		return FriendLinkAdminDTO{}, err
	}
	s.publishEvents(ctx, f)
	return toAdminDTO(f), nil
}

// Update 后台编辑友链字段与排序值。
//
// URL 变更时重新做占用检查（排除自身）。
func (s *Service) Update(ctx context.Context, id string, in ManualInput) (FriendLinkAdminDTO, error) {
	fid, err := shared.ParseID(id)
	if err != nil {
		return FriendLinkAdminDTO{}, err
	}
	f, err := s.repo.FindByID(ctx, fid)
	if err != nil {
		return FriendLinkAdminDTO{}, err
	}
	if newURL := strings.TrimSpace(in.URL); newURL != f.URL() {
		if err := s.checkURLAvailable(ctx, newURL, fid); err != nil {
			return FriendLinkAdminDTO{}, err
		}
	}
	if err := f.Update(domain.UpdateParams{
		Name: in.Name, URL: in.URL, AvatarURL: in.AvatarURL, Description: in.Description,
		OwnerName: in.OwnerName, LinkbackURL: in.LinkbackURL,
		ContactEmail: in.ContactEmail, SortOrder: in.SortOrder,
	}); err != nil {
		return FriendLinkAdminDTO{}, err
	}
	if err := s.repo.Save(ctx, f); err != nil {
		return FriendLinkAdminDTO{}, err
	}
	s.publishEvents(ctx, f)
	return toAdminDTO(f), nil
}

// Approve 批准申请（pending → approved；rejected → approved 改判）
func (s *Service) Approve(ctx context.Context, id string) error {
	return s.transition(ctx, id, (*domain.FriendLink).Approve)
}

// Reject 拒绝申请（pending → rejected）
func (s *Service) Reject(ctx context.Context, id string) error {
	return s.transition(ctx, id, (*domain.FriendLink).Reject)
}

// Disable 下柜（approved → disabled）
func (s *Service) Disable(ctx context.Context, id string) error {
	return s.transition(ctx, id, (*domain.FriendLink).Disable)
}

// Restore 恢复（disabled → approved）
func (s *Service) Restore(ctx context.Context, id string) error {
	return s.transition(ctx, id, (*domain.FriendLink).Restore)
}

// transition 状态转换共享编排：加载 → 聚合根转换（非法拒绝）→ 落库 → 发事件。
func (s *Service) transition(ctx context.Context, id string, op func(*domain.FriendLink) error) error {
	fid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	f, err := s.repo.FindByID(ctx, fid)
	if err != nil {
		return err
	}
	if err := op(f); err != nil {
		return err
	}
	if err := s.repo.Save(ctx, f); err != nil {
		return err
	}
	s.publishEvents(ctx, f)
	return nil
}

// Delete 物理删除友链（任意状态可删；追溯靠审计事件）。
func (s *Service) Delete(ctx context.Context, id string) error {
	fid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	// 先加载拿名称快照（删除事件 payload），同时把「不存在」归一为 404。
	f, err := s.repo.FindByID(ctx, fid)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, fid); err != nil {
		return err
	}
	// 删除后聚合根不可继续存在，手动构造事件发布（同 announcement/comment 先例）
	s.publish(ctx, domain.NewFriendLinkDeleted(fid, f.Name()))
	return nil
}

// publishEvents 发布聚合根累积的领域事件（审计订阅者消费）
func (s *Service) publishEvents(ctx context.Context, f *domain.FriendLink) {
	events := f.PullEvents()
	if len(events) == 0 {
		return
	}
	if err := s.bus.Publish(ctx, events); err != nil {
		log.Warn().Err(err).Msg("发布友链事件失败")
	}
}

// publish 发布单个领域事件（审计订阅者消费）
func (s *Service) publish(ctx context.Context, event shared.DomainEvent) {
	if err := s.bus.Publish(ctx, []shared.DomainEvent{event}); err != nil {
		log.Warn().Err(err).Msg("发布友链事件失败")
	}
}
