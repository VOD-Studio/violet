package chat

import (
	"context"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

// PresenceReader 报告用户当前是否有活跃的聊天连接。
type PresenceReader interface {
	IsOnline(userID domainshared.ID) bool
}

// SettingsDTO 当前用户的聊天设置。
type SettingsDTO struct {
	// HideOnline 为 true 时对其他成员显示为离线。
	HideOnline bool `json:"hide_online"`
}

// WithPresence 注入在线状态来源与隐身设置，返回自身便于装配链式调用。
//
// 未注入时成员的 Online 恒为 false，聊天主链路不受影响。
func (s *Service) WithPresence(reader PresenceReader, settings domainchat.UserSettingsRepository) *Service {
	s.presence = reader
	s.settings = settings
	return s
}

func (s *Service) isOnline(userID domainshared.ID) bool {
	return s.presence != nil && s.presence.IsOnline(userID)
}

func (s *Service) hiddenOnline(ctx context.Context, ids []domainshared.ID) (map[domainshared.ID]bool, error) {
	if s.settings == nil {
		return map[domainshared.ID]bool{}, nil
	}
	return s.settings.HiddenOnline(ctx, ids)
}

// ChatSettings 读取当前用户的聊天设置。
func (s *Service) ChatSettings(ctx context.Context, userID domainshared.ID) (SettingsDTO, error) {
	hidden, err := s.hiddenOnline(ctx, []domainshared.ID{userID})
	if err != nil {
		return SettingsDTO{}, err
	}
	return SettingsDTO{HideOnline: hidden[userID]}, nil
}

// SetHideOnline 保存隐身设置，并把变化后的对外状态推给共同成员。
func (s *Service) SetHideOnline(ctx context.Context, userID domainshared.ID, hide bool) error {
	if s.settings == nil {
		return domainshared.Internal("聊天设置未启用", nil)
	}
	if err := s.settings.SetHideOnline(ctx, userID, hide); err != nil {
		return err
	}
	s.PresenceChanged(ctx, userID)
	return nil
}

// PresenceChanged 向与该用户同会话的其他成员推送其对外在线状态。
//
// 隐身用户对外恒为离线，推送的始终是 online=false，不泄露真实连接状态。
// 事件不持久化、不带 ID，与输入状态相同，不污染 Last-Event-ID 续传序号。
func (s *Service) PresenceChanged(ctx context.Context, userID domainshared.ID) {
	if s.notifier == nil {
		return
	}
	hidden, err := s.hiddenOnline(ctx, []domainshared.ID{userID})
	if err != nil {
		return
	}
	online := s.isOnline(userID) && !hidden[userID]
	peers, err := s.repo.ListCoMemberIDs(ctx, userID)
	if err != nil {
		return
	}
	dto := EventDTO{
		Type:       string(domainchat.EventPresenceUpdated),
		Version:    1,
		OccurredAt: s.now().Format(time.RFC3339Nano),
		Data: map[string]any{
			"user_id": userID.String(),
			"online":  online,
		},
	}
	for _, peer := range peers {
		if peer.Equal(userID) {
			continue
		}
		s.notifier.Push(peer, dto)
	}
}
