package chat

import (
	"context"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

// SetTypingInput 上报输入状态入参。
type SetTypingInput struct {
	// UserID 当前用户 ID。
	UserID domainshared.ID
	// ConversationID 会话 ID。
	ConversationID domainshared.ID
	// IsTyping true 表示开始/持续输入，false 表示显式停止。
	IsTyping bool
}

// SetTyping 向会话其他在线成员实时广播输入状态。
//
// 不经 SaveEvent 持久化、不参与 SSE 断线补发：输入状态是瞬态事实，补发会展示
// 误导性的"过期正在输入"（见 CONTEXT.md「输入状态」词条）。EventDTO 不带 ID，
// 使 SSE 帧不写 `id:` 行，避免污染其他事件类型依赖的 Last-Event-ID 续传序号。
func (s *Service) SetTyping(ctx context.Context, in SetTypingInput) error {
	if _, err := s.repo.FindByIDForMember(ctx, in.ConversationID, in.UserID); err != nil {
		return err
	}
	if s.notifier == nil {
		return nil
	}
	members, err := s.repo.ListMembers(ctx, in.ConversationID, false)
	if err != nil {
		return err
	}
	dto := EventDTO{
		Type:       string(domainchat.EventTypingUpdated),
		Version:    1,
		OccurredAt: s.now().Format(time.RFC3339Nano),
		Data: map[string]any{
			"conversation_id": in.ConversationID.String(),
			"user_id":         in.UserID.String(),
			"is_typing":       in.IsTyping,
		},
	}
	for _, member := range members {
		if !member.IsActive() || member.UserID().Equal(in.UserID) {
			continue
		}
		s.notifier.Push(member.UserID(), dto)
	}
	return nil
}
