package useradmin

import (
	"context"

	"github.com/rs/zerolog/log"

	"blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

// MergeInput 合并账号入参。
type MergeInput struct {
	PrimaryID   string
	SecondaryID string
	// ConfirmUsername 必须等于 secondary 用户名（高危不可逆操作的二次确认）
	ConfirmUsername string
}

// MergeUsers 把 secondary 账号的全部内容归属迁移给 primary 后删除 secondary。
//
// 安全守卫：
//   - primary/secondary 均须存在且不相等；内置超管不可参与（任一侧）
//   - confirm_username 必须等于 secondary 当前用户名（防误操作）
//   - 不可合并自己到自己（隐含于 confirm 与 id 校验）
//
// 迁移表清单与冲突折叠见 UserMerger 端口注释；全程单事务，写审计日志。
func (s *Service) MergeUsers(ctx context.Context, in MergeInput, operatorID, operatorRole string, operatorIsRoot bool, ip, ua string) (UserDTO, error) {
	pid, err := shared.ParseID(in.PrimaryID)
	if err != nil {
		return UserDTO{}, err
	}
	sid, err := shared.ParseID(in.SecondaryID)
	if err != nil {
		return UserDTO{}, err
	}
	if pid == sid {
		return UserDTO{}, shared.BadRequest("主账号与被合并账号不能相同")
	}

	primary, err := s.store.FindByID(ctx, pid)
	if err != nil {
		return UserDTO{}, err
	}
	secondary, err := s.store.FindByID(ctx, sid)
	if err != nil {
		return UserDTO{}, err
	}
	if primary.IsRoot() || secondary.IsRoot() {
		return UserDTO{}, shared.Forbidden("内置超级管理员不可参与账号合并")
	}
	if in.ConfirmUsername != secondary.Username().String() {
		return UserDTO{}, shared.BadRequest("确认用户名与被合并账号不匹配")
	}

	if s.merger == nil {
		return UserDTO{}, shared.Internal("账号合并执行器未装配", nil)
	}
	if err := s.merger.Merge(ctx, pid, sid); err != nil {
		return UserDTO{}, shared.Internal("账号合并失败", err)
	}

	// 审计：合并是高危不可逆操作
	if err := s.bus.Publish(ctx, []shared.DomainEvent{
		domainuser.NewUsersMerged(pid, secondary.Username().String(), primary.Username().String()),
	}); err != nil {
		log.Warn().Err(err).Msg("发布账号合并事件失败")
	}

	dto := toDTO(primary)
	// 合并后 primary 可能接手了 secondary 的 OAuth 绑定，重新读取最新状态
	if fresh, err := s.store.FindByID(ctx, pid); err == nil {
		dto = toDTO(fresh)
	}
	return dto, nil
}
