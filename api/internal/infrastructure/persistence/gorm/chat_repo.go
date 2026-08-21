package gorm

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// ChatRepository 聊天 GORM 仓储实现。
type ChatRepository struct {
	db *gorm.DB
}

// NewChatRepository 构造聊天仓储。
func NewChatRepository(db *gorm.DB) *ChatRepository { return &ChatRepository{db: db} }

// FindByIDForMember 按会话 ID 查找当前有效成员可见的会话。
func (r *ChatRepository) FindByIDForMember(ctx context.Context, conversationID, userID domainshared.ID) (*domainchat.Conversation, error) {
	var po model.ChatConversation
	err := r.db.WithContext(ctx).
		Table("chat_conversations c").
		Select("c.*").
		Joins("JOIN chat_conversation_members cm ON cm.conversation_id = c.id").
		Where("c.id = ? AND cm.user_id = ? AND cm.left_at IS NULL", conversationID.UUID(), userID.UUID()).
		Take(&po).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domainchat.ErrConversationNotFound
	}
	if err != nil {
		return nil, err
	}
	return conversationToDomain(po), nil
}

// FindDirect 查找两个用户之间的现有私聊。
func (r *ChatRepository) FindDirect(ctx context.Context, userA, userB domainshared.ID) (*domainchat.Conversation, error) {
	a, b := orderedUUID(userA.UUID(), userB.UUID())
	var po model.ChatConversation
	err := r.db.WithContext(ctx).
		Table("chat_conversations c").
		Select("c.*").
		Joins("JOIN chat_direct_pairs dp ON dp.conversation_id = c.id").
		Where("dp.user_a_id = ? AND dp.user_b_id = ?", a, b).
		Take(&po).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domainchat.ErrConversationNotFound
	}
	if err != nil {
		return nil, err
	}
	return conversationToDomain(po), nil
}

// ListForMember 列出当前有效成员加入的会话。
func (r *ChatRepository) ListForMember(ctx context.Context, userID domainshared.ID, cursor *domainchat.ConversationCursor, limit int) ([]*domainchat.Conversation, error) {
	var rows []model.ChatConversation
	q := r.db.WithContext(ctx).
		Table("chat_conversations c").
		Select("c.*").
		Joins("JOIN chat_conversation_members cm ON cm.conversation_id = c.id").
		Where("cm.user_id = ? AND cm.left_at IS NULL", userID.UUID()).
		Order("c.updated_at DESC, c.id DESC").
		Limit(limit)
	if cursor != nil {
		q = q.Where("(c.updated_at < ?) OR (c.updated_at = ? AND c.id < ?)", cursor.UpdatedAt, cursor.UpdatedAt, cursor.ID.UUID())
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domainchat.Conversation, 0, len(rows))
	for _, row := range rows {
		out = append(out, conversationToDomain(row))
	}
	return out, nil
}

// SaveConversation 保存新会话及其成员。
func (r *ChatRepository) SaveConversation(ctx context.Context, conversation *domainchat.Conversation, members []*domainchat.Member) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(conversationToPO(conversation)).Error; err != nil {
			return err
		}
		for _, member := range members {
			if err := tx.Create(memberToPO(member)).Error; err != nil {
				return err
			}
		}
		if conversation.Kind() == domainchat.ConversationDirect && len(members) == 2 {
			a, b := orderedUUID(members[0].UserID().UUID(), members[1].UserID().UUID())
			return tx.Create(&model.ChatDirectPair{
				ConversationID: conversation.ID().UUID(), UserAID: a, UserBID: b,
			}).Error
		}
		return nil
	})
}

// DeleteConversation 删除已无成员的私有房间。
func (r *ChatRepository) DeleteConversation(ctx context.Context, conversationID domainshared.ID) error {
	return r.db.WithContext(ctx).Where("id = ?", conversationID.UUID()).Delete(&model.ChatConversation{}).Error
}

// RenameConversation 修改房间名称。
func (r *ChatRepository) RenameConversation(ctx context.Context, conversation *domainchat.Conversation) error {
	return r.db.WithContext(ctx).Model(&model.ChatConversation{}).
		Where("id = ?", conversation.ID().UUID()).
		Updates(map[string]any{"title": conversation.Title(), "updated_at": conversation.UpdatedAt}).Error
}

// ListMembers 列出会话成员。
func (r *ChatRepository) ListMembers(ctx context.Context, conversationID domainshared.ID, includeInactive bool) ([]*domainchat.Member, error) {
	var rows []model.ChatConversationMember
	q := r.db.WithContext(ctx).Where("conversation_id = ?", conversationID.UUID()).Order("joined_at ASC")
	if !includeInactive {
		q = q.Where("left_at IS NULL")
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domainchat.Member, 0, len(rows))
	for _, row := range rows {
		out = append(out, memberToDomain(row))
	}
	return out, nil
}

// FindMember 查找会话成员记录。
func (r *ChatRepository) FindMember(ctx context.Context, conversationID, userID domainshared.ID) (*domainchat.Member, error) {
	var row model.ChatConversationMember
	err := r.db.WithContext(ctx).
		Where("conversation_id = ? AND user_id = ?", conversationID.UUID(), userID.UUID()).
		Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domainchat.ErrMemberNotFound
	}
	if err != nil {
		return nil, err
	}
	return memberToDomain(row), nil
}

// SaveMember 新增或重新激活成员。
func (r *ChatRepository) SaveMember(ctx context.Context, member *domainchat.Member) error {
	po := memberToPO(member)
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "conversation_id"}, {Name: "user_id"}},
		DoUpdates: clause.Assignments(map[string]any{
			"role":      po.Role,
			"joined_at": po.JoinedAt,
			"left_at":   nil,
			"is_muted":  po.IsMuted,
		}),
	}).Create(po).Error
}

// LeaveMember 标记成员离开。
func (r *ChatRepository) LeaveMember(ctx context.Context, conversationID, userID domainshared.ID, now time.Time) error {
	result := r.db.WithContext(ctx).Model(&model.ChatConversationMember{}).
		Where("conversation_id = ? AND user_id = ? AND left_at IS NULL", conversationID.UUID(), userID.UUID()).
		Update("left_at", now)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return domainchat.ErrMemberNotFound
	}
	return nil
}

// RemoveMember 标记成员被房主移除。
func (r *ChatRepository) RemoveMember(ctx context.Context, conversationID, userID domainshared.ID, now time.Time) error {
	return r.LeaveMember(ctx, conversationID, userID, now)
}

// TransferOwnership 原子更新会话房主及成员角色。
func (r *ChatRepository) TransferOwnership(ctx context.Context, conversationID, previousOwnerID, nextOwnerID domainshared.ID, now time.Time) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&model.ChatConversation{}).
			Where("id = ? AND owner_id = ?", conversationID.UUID(), previousOwnerID.UUID()).
			Updates(map[string]any{"owner_id": nextOwnerID.UUID(), "updated_at": now})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return domainchat.ErrConversationNotFound
		}
		if err := tx.Model(&model.ChatConversationMember{}).
			Where("conversation_id = ? AND user_id = ? AND left_at IS NULL", conversationID.UUID(), previousOwnerID.UUID()).
			Update("role", string(domainchat.MemberMember)).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.ChatConversationMember{}).
			Where("conversation_id = ? AND user_id = ? AND left_at IS NULL", conversationID.UUID(), nextOwnerID.UUID()).
			Update("role", string(domainchat.MemberOwner)).Error; err != nil {
			return err
		}
		return nil
	})
}

// SetMemberMuted 更新当前成员的会话通知静音状态。
func (r *ChatRepository) SetMemberMuted(ctx context.Context, conversationID, userID domainshared.ID, muted bool) error {
	result := r.db.WithContext(ctx).Model(&model.ChatConversationMember{}).
		Where("conversation_id = ? AND user_id = ? AND left_at IS NULL", conversationID.UUID(), userID.UUID()).
		Update("is_muted", muted)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return domainchat.ErrMemberNotFound
	}
	return nil
}

// FindMessageByIdempotency 查找已发送消息。
func (r *ChatRepository) FindMessageByIdempotency(ctx context.Context, conversationID, senderID domainshared.ID, key string) (*domainchat.Message, error) {
	var po model.ChatMessage
	err := r.db.WithContext(ctx).Where("conversation_id = ? AND sender_id = ? AND idempotency_key = ?", conversationID.UUID(), senderID.UUID(), key).Take(&po).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domainchat.ErrMessageNotFound
	}
	if err != nil {
		return nil, err
	}
	return messageToDomain(po), nil
}

// SaveMessage 保存消息、更新会话时间并写入每个成员的事件流。
func (r *ChatRepository) SaveMessage(ctx context.Context, message *domainchat.Message, recipientIDs []domainshared.ID, payload map[string]any) ([]domainchat.Event, error) {
	var events []domainchat.Event
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(messageToPO(message)).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.ChatConversation{}).
			Where("id = ?", message.ConversationID().UUID()).
			Updates(map[string]any{"last_message_at": message.CreatedAt(), "updated_at": message.CreatedAt()}).Error; err != nil {
			return err
		}
		var err error
		eventPayload := map[string]any{
			"conversation_id": message.ConversationID().String(),
			"message_id":      message.ID().String(),
			"sender_id":       message.SenderID().String(),
			"message_type":    string(message.Type()),
		}
		if replyToID := message.ReplyToID(); replyToID != nil {
			eventPayload["reply_to_id"] = replyToID.String()
		}
		for key, value := range payload {
			eventPayload[key] = value
		}
		events, err = saveEvents(tx, recipientIDs, domainchat.EventMessageCreated, eventPayload)
		return err
	})
	return events, err
}

// SaveEvent 为指定用户追加聊天事件。
func (r *ChatRepository) SaveEvent(ctx context.Context, userIDs []domainshared.ID, eventType domainchat.ChatEventType, payload map[string]any) ([]domainchat.Event, error) {
	return saveEvents(r.db.WithContext(ctx), userIDs, eventType, payload)
}

func saveEvents(db *gorm.DB, userIDs []domainshared.ID, eventType domainchat.ChatEventType, payload map[string]any) ([]domainchat.Event, error) {
	if len(userIDs) == 0 {
		return nil, nil
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]struct{}, len(userIDs))
	out := make([]domainchat.Event, 0, len(userIDs))
	for _, userID := range userIDs {
		if userID.IsZero() {
			continue
		}
		key := userID.String()
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		po := model.ChatEvent{UserID: userID.UUID(), EventType: string(eventType), Payload: datatypes.JSON(encoded)}
		if err := db.Create(&po).Error; err != nil {
			return nil, err
		}
		out = append(out, eventToDomain(po))
	}
	return out, nil
}

// ListMessages 按创建时间倒序列出消息历史。
func (r *ChatRepository) ListMessages(ctx context.Context, conversationID domainshared.ID, cursor *domainchat.MessageCursor, limit int) ([]*domainchat.Message, error) {
	var rows []model.ChatMessage
	q := r.db.WithContext(ctx).Where("conversation_id = ?", conversationID.UUID()).Order("created_at DESC, id DESC").Limit(limit)
	if cursor != nil {
		q = q.Where("(created_at < ?) OR (created_at = ? AND id < ?)", cursor.CreatedAt, cursor.CreatedAt, cursor.ID.UUID())
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domainchat.Message, 0, len(rows))
	for _, row := range rows {
		out = append(out, messageToDomain(row))
	}
	return out, nil
}

// FindMessage 查找当前会话中的消息。
func (r *ChatRepository) FindMessage(ctx context.Context, conversationID, messageID domainshared.ID) (*domainchat.Message, error) {
	var po model.ChatMessage
	err := r.db.WithContext(ctx).Where("conversation_id = ? AND id = ?", conversationID.UUID(), messageID.UUID()).Take(&po).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domainchat.ErrMessageNotFound
	}
	if err != nil {
		return nil, err
	}
	return messageToDomain(po), nil
}

// DeleteMessage 保存管理员删除状态。
func (r *ChatRepository) DeleteMessage(ctx context.Context, message *domainchat.Message) error {
	var deletedBy any
	if message.DeletedBy() != nil {
		deletedBy = message.DeletedBy().UUID()
	}
	return r.db.WithContext(ctx).Model(&model.ChatMessage{}).
		Where("id = ? AND conversation_id = ?", message.ID().UUID(), message.ConversationID().UUID()).
		Updates(map[string]any{"deleted_at": message.DeletedAt(), "deleted_by": deletedBy, "updated_at": message.UpdatedAt}).Error
}

// SaveReadPosition 保存用户阅读位置。
func (r *ChatRepository) SaveReadPosition(ctx context.Context, position *domainchat.ReadPosition) error {
	po := readPositionToPO(position)
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "conversation_id"}, {Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"last_message_id", "read_at"}),
	}).Create(po).Error
}

// CountUnread 统计指定会话未读消息。
func (r *ChatRepository) CountUnread(ctx context.Context, conversationID, userID domainshared.ID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Raw(`
SELECT COUNT(*)
FROM chat_messages m
JOIN chat_conversation_members cm
  ON cm.conversation_id = m.conversation_id
 AND cm.user_id = ?
 AND cm.left_at IS NULL
LEFT JOIN chat_read_positions rp
  ON rp.conversation_id = m.conversation_id AND rp.user_id = cm.user_id
LEFT JOIN chat_messages lm ON lm.id = rp.last_message_id
WHERE m.conversation_id = ?
  AND m.sender_id <> ?
  AND m.deleted_at IS NULL
  AND (rp.last_message_id IS NULL OR m.created_at > lm.created_at OR (m.created_at = lm.created_at AND m.id > lm.id))
`, userID.UUID(), conversationID.UUID(), userID.UUID()).Scan(&count).Error
	return count, err
}

// CountAllUnread 统计用户全部会话未读消息。
func (r *ChatRepository) CountAllUnread(ctx context.Context, userID domainshared.ID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Raw(`
SELECT COUNT(*)
FROM chat_messages m
JOIN chat_conversation_members cm
  ON cm.conversation_id = m.conversation_id
 AND cm.user_id = ?
 AND cm.left_at IS NULL
LEFT JOIN chat_read_positions rp
  ON rp.conversation_id = m.conversation_id AND rp.user_id = cm.user_id
LEFT JOIN chat_messages lm ON lm.id = rp.last_message_id
WHERE m.sender_id <> ?
  AND m.deleted_at IS NULL
  AND (rp.last_message_id IS NULL OR m.created_at > lm.created_at OR (m.created_at = lm.created_at AND m.id > lm.id))
`, userID.UUID(), userID.UUID()).Scan(&count).Error
	return count, err
}

// FindEventsAfter 查找指定序号之后的用户事件。
func (r *ChatRepository) FindEventsAfter(ctx context.Context, userID domainshared.ID, afterSequence int64, limit int) ([]domainchat.Event, error) {
	var rows []model.ChatEvent
	if err := r.db.WithContext(ctx).Where("user_id = ? AND sequence > ?", userID.UUID(), afterSequence).Order("sequence ASC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]domainchat.Event, 0, len(rows))
	for _, row := range rows {
		out = append(out, eventToDomain(row))
	}
	return out, nil
}

// SavePushSubscription 保存浏览器推送订阅。
func (r *ChatRepository) SavePushSubscription(ctx context.Context, subscription *domainchat.PushSubscription) error {
	po := pushSubscriptionToPO(subscription)
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "endpoint"}},
		DoUpdates: clause.AssignmentColumns([]string{"user_id", "p256dh", "auth", "user_agent", "show_preview", "updated_at"}),
	}).Create(po).Error
}

// DeletePushSubscription 删除失效订阅。
func (r *ChatRepository) DeletePushSubscription(ctx context.Context, userID domainshared.ID, endpoint string) error {
	return r.db.WithContext(ctx).Where("user_id = ? AND endpoint = ?", userID.UUID(), endpoint).Delete(&model.ChatPushSubscription{}).Error
}

// ListPushSubscriptions 列出用户推送订阅。
func (r *ChatRepository) ListPushSubscriptions(ctx context.Context, userID domainshared.ID) ([]*domainchat.PushSubscription, error) {
	var rows []model.ChatPushSubscription
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID.UUID()).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domainchat.PushSubscription, 0, len(rows))
	for _, row := range rows {
		out = append(out, pushSubscriptionToDomain(row))
	}
	return out, nil
}

func orderedUUID(a, b uuid.UUID) (uuid.UUID, uuid.UUID) {
	if string(a[:]) > string(b[:]) {
		return b, a
	}
	return a, b
}

func conversationToPO(c *domainchat.Conversation) *model.ChatConversation {
	return &model.ChatConversation{
		ID: c.ID().UUID(), Kind: string(c.Kind()), OwnerID: c.OwnerID().UUID(), Title: c.Title(),
		LastMessageAt: c.LastMessageAt(), CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt,
	}
}

func conversationToDomain(po model.ChatConversation) *domainchat.Conversation {
	return domainchat.ReconstructConversation(domainshared.IDFromUUID(po.ID), domainshared.IDFromUUID(po.OwnerID), domainchat.ConversationKind(po.Kind), po.Title, po.LastMessageAt, po.CreatedAt, po.UpdatedAt)
}

func memberToPO(m *domainchat.Member) *model.ChatConversationMember {
	return &model.ChatConversationMember{
		ConversationID: m.ConversationID().UUID(), UserID: m.UserID().UUID(), Role: string(m.Role()),
		JoinedAt: m.JoinedAt(), LeftAt: m.LeftAt(), IsMuted: m.IsMuted(),
	}
}

func memberToDomain(po model.ChatConversationMember) *domainchat.Member {
	return domainchat.ReconstructMember(domainshared.IDFromUUID(po.ConversationID), domainshared.IDFromUUID(po.UserID), domainchat.MemberRole(po.Role), po.JoinedAt, po.LeftAt, po.IsMuted)
}

func messageToPO(m *domainchat.Message) *model.ChatMessage {
	var mediaID, sharedTweetID, replyToID, deletedBy *uuid.UUID
	if m.MediaID() != nil {
		u := m.MediaID().UUID()
		mediaID = &u
	}
	if m.SharedTweetID() != nil {
		u := m.SharedTweetID().UUID()
		sharedTweetID = &u
	}
	if m.ReplyToID() != nil {
		u := m.ReplyToID().UUID()
		replyToID = &u
	}
	if m.DeletedBy() != nil {
		u := m.DeletedBy().UUID()
		deletedBy = &u
	}
	return &model.ChatMessage{
		ID: m.ID().UUID(), ConversationID: m.ConversationID().UUID(), SenderID: m.SenderID().UUID(),
		MessageType: string(m.Type()), Content: m.Content(), MediaID: mediaID, SharedTweetID: sharedTweetID, ReplyToID: replyToID, IdempotencyKey: m.IdempotencyKey(),
		DeletedAt: m.DeletedAt(), DeletedBy: deletedBy, CreatedAt: m.CreatedAt(), UpdatedAt: m.UpdatedAt,
	}
}

func messageToDomain(po model.ChatMessage) *domainchat.Message {
	var mediaID, sharedTweetID, replyToID, deletedBy *domainshared.ID
	if po.MediaID != nil {
		id := domainshared.IDFromUUID(*po.MediaID)
		mediaID = &id
	}
	if po.SharedTweetID != nil {
		id := domainshared.IDFromUUID(*po.SharedTweetID)
		sharedTweetID = &id
	}
	if po.ReplyToID != nil {
		id := domainshared.IDFromUUID(*po.ReplyToID)
		replyToID = &id
	}
	if po.DeletedBy != nil {
		id := domainshared.IDFromUUID(*po.DeletedBy)
		deletedBy = &id
	}
	return domainchat.ReconstructMessage(domainshared.IDFromUUID(po.ID), domainshared.IDFromUUID(po.ConversationID), domainshared.IDFromUUID(po.SenderID), domainchat.MessageType(po.MessageType), po.Content, mediaID, sharedTweetID, replyToID, po.IdempotencyKey, po.DeletedAt, deletedBy, po.CreatedAt, po.UpdatedAt)
}

func readPositionToPO(p *domainchat.ReadPosition) *model.ChatReadPosition {
	var lastID *uuid.UUID
	if p.LastMessageID() != nil {
		u := p.LastMessageID().UUID()
		lastID = &u
	}
	return &model.ChatReadPosition{ConversationID: p.ConversationID().UUID(), UserID: p.UserID().UUID(), LastMessageID: lastID, ReadAt: p.ReadAt()}
}

func eventToDomain(po model.ChatEvent) domainchat.Event {
	payload := map[string]any{}
	_ = json.Unmarshal(po.Payload, &payload)
	return domainchat.Event{Sequence: po.Sequence, UserID: domainshared.IDFromUUID(po.UserID), Type: domainchat.ChatEventType(po.EventType), Payload: payload, CreatedAt: po.CreatedAt}
}

func pushSubscriptionToPO(s *domainchat.PushSubscription) *model.ChatPushSubscription {
	return &model.ChatPushSubscription{UserID: s.UserID.UUID(), Endpoint: s.Endpoint, P256DH: s.P256DH, Auth: s.Auth, UserAgent: s.UserAgent, ShowPreview: s.ShowPreview, CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt}
}

func pushSubscriptionToDomain(po model.ChatPushSubscription) *domainchat.PushSubscription {
	return &domainchat.PushSubscription{UserID: domainshared.IDFromUUID(po.UserID), Endpoint: po.Endpoint, P256DH: po.P256DH, Auth: po.Auth, UserAgent: po.UserAgent, ShowPreview: po.ShowPreview, CreatedAt: po.CreatedAt, UpdatedAt: po.UpdatedAt}
}

var _ domainchat.ConversationRepository = (*ChatRepository)(nil)
