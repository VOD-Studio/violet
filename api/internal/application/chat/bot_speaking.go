package chat

import (
	"context"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

// SetBotSilenced 由房主决定机器人成员能否在本会话发言。
func (s *Service) SetBotSilenced(ctx context.Context, ownerID, conversationID, botUserID domainshared.ID, silenced bool) error {
	if _, err := s.repo.FindByIDForMember(ctx, conversationID, ownerID); err != nil {
		return err
	}
	owner, err := s.repo.FindMember(ctx, conversationID, ownerID)
	if err != nil {
		return err
	}
	if !owner.IsActive() || owner.Role() != domainchat.MemberOwner {
		return domainshared.Forbidden("只有房主可以设置角色发言权限")
	}
	target, err := s.repo.FindMember(ctx, conversationID, botUserID)
	if err != nil {
		return err
	}
	if !target.IsActive() {
		return domainchat.ErrMemberNotFound
	}
	user, err := s.users.FindByID(ctx, botUserID)
	if err != nil {
		return err
	}
	if !user.IsBot() {
		return domainshared.BadRequest("只能设置角色的发言权限")
	}
	return s.repo.SetMemberSilenced(ctx, conversationID, botUserID, silenced)
}
