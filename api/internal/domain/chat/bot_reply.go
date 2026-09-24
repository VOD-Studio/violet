package chat

import (
	"strings"
	"time"

	"blog-api/internal/domain/shared"
)

// BotReplyStatus 描述一条 bot 回复的生成阶段。
type BotReplyStatus string

const (
	BotReplyPending      BotReplyStatus = "pending"
	BotReplyThinking     BotReplyStatus = "thinking"
	BotReplyStreaming    BotReplyStatus = "streaming"
	BotReplyCompleted    BotReplyStatus = "completed"
	BotReplyFailed       BotReplyStatus = "failed"
	MaxBotThinkingLength                = 20_000
)

// BotReply 是消息附带的生成状态；普通消息没有该对象。
type BotReply struct {
	// status 当前生成阶段，完成与失败为终态。
	status BotReplyStatus
	// thinking bot 主动上报的可展示思考内容。
	thinking string
	// revision bot 累计更新的递增版本。
	revision int64
	// updatedAt 最近一次成功上报时间。
	updatedAt time.Time
}

// ReconstructBotReply 从已保存快照恢复生成信息。
func ReconstructBotReply(status BotReplyStatus, thinking string, revision int64, updatedAt time.Time) *BotReply {
	return &BotReply{status: status, thinking: thinking, revision: revision, updatedAt: updatedAt}
}

// NewPendingBotMessage 创建允许空正文的 bot 占位回复。
func NewPendingBotMessage(conversationID, senderID shared.ID, idempotencyKey string, now time.Time, replyToID *shared.ID) (*Message, error) {
	if conversationID.IsZero() || senderID.IsZero() {
		return nil, shared.BadRequest("消息归属不能为空")
	}
	if err := validateIdempotencyKey(idempotencyKey); err != nil {
		return nil, err
	}
	if err := validateReplyToID(replyToID); err != nil {
		return nil, err
	}
	m := newMessage(conversationID, senderID, MessageText, "", nil, nil, replyToID, idempotencyKey, now)
	m.botReply = &BotReply{status: BotReplyPending, updatedAt: now}
	return m, nil
}

// AdvanceBotReply 接受完整快照；过期版本和终态再次更新均拒绝。
func (m *Message) AdvanceBotReply(content, thinking string, status BotReplyStatus, revision int64, now time.Time) error {
	if m.botReply == nil || m.deletedAt != nil {
		return shared.Conflict("Bot 回复不可更新")
	}
	if m.botReply.status == BotReplyCompleted || m.botReply.status == BotReplyFailed {
		return shared.Conflict("Bot 回复已结束")
	}
	if revision <= m.botReply.revision {
		return shared.Conflict("Bot 回复版本已过期")
	}
	content = strings.TrimSpace(content)
	if len([]rune(content)) > MaxMessageContentLength || len([]rune(thinking)) > MaxBotThinkingLength {
		return shared.BadRequest("Bot 回复内容过长")
	}
	if status != BotReplyPending && status != BotReplyThinking && status != BotReplyStreaming && status != BotReplyCompleted && status != BotReplyFailed {
		return shared.BadRequest("Bot 回复状态无效")
	}
	if status == BotReplyCompleted && content == "" {
		return shared.BadRequest("完成的 Bot 回复不能为空")
	}
	m.content = content
	m.botReply.status = status
	m.botReply.thinking = thinking
	m.botReply.revision = revision
	m.botReply.updatedAt = now
	m.UpdatedAt = now
	return nil
}

// BotReply 返回当前生成状态；nil 表示普通消息。
func (m *Message) BotReply() *BotReply { return m.botReply }

// Status 返回生成阶段。
func (r *BotReply) Status() BotReplyStatus { return r.status }

// Thinking 返回思考内容。
func (r *BotReply) Thinking() string { return r.thinking }

// Revision 返回更新版本。
func (r *BotReply) Revision() int64 { return r.revision }

// UpdatedAt 返回最近上报时间。
func (r *BotReply) UpdatedAt() time.Time { return r.updatedAt }
