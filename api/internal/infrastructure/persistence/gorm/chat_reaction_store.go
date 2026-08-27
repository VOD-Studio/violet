package gorm

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domainchatreaction "blog-api/internal/domain/chatreaction"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// ChatMessageReactionStore 实现聊天消息反应存储端口。
type ChatMessageReactionStore struct {
	db *gorm.DB
}

// NewChatMessageReactionStore 创建聊天消息反应存储。
func NewChatMessageReactionStore(db *gorm.DB) *ChatMessageReactionStore {
	return &ChatMessageReactionStore{db: db}
}

// ListByMessages 批量查询消息反应，并标记当前用户已添加的表情。
func (s *ChatMessageReactionStore) ListByMessages(ctx context.Context, messageIDs []domainshared.ID, viewerUserID domainshared.ID) (map[string][]domainchatreaction.AggregatedReaction, error) {
	result := make(map[string][]domainchatreaction.AggregatedReaction, len(messageIDs))
	if len(messageIDs) == 0 {
		return result, nil
	}

	ids := make([]uuid.UUID, 0, len(messageIDs))
	for _, messageID := range messageIDs {
		ids = append(ids, messageID.UUID())
	}
	var rows []struct {
		MessageID uuid.UUID `gorm:"column:message_id"`
		EmojiID   int32     `gorm:"column:emoji_id"`
		EmojiName string    `gorm:"column:emoji_name"`
		EmojiURL  string    `gorm:"column:emoji_url"`
		GifURL    string    `gorm:"column:gif_url"`
		Count     int64     `gorm:"column:count"`
		SelfInt   int       `gorm:"column:self_int"`
	}
	if err := s.db.WithContext(ctx).
		Table("chat_message_reactions cmr").
		Select("cmr.message_id, cmr.emoji_id, e.name AS emoji_name, e.url AS emoji_url, e.gif_url AS gif_url, COUNT(*) AS count, MAX(CASE WHEN cmr.user_id = ? THEN 1 ELSE 0 END) AS self_int", viewerUserID.UUID()).
		Joins("LEFT JOIN emojis e ON e.id = cmr.emoji_id").
		Where("cmr.message_id IN ?", ids).
		Group("cmr.message_id, cmr.emoji_id, e.name, e.url, e.gif_url").
		Order("cmr.message_id, count DESC, cmr.emoji_id ASC").
		Scan(&rows).Error; err != nil {
		return nil, domainshared.Internal("查询聊天消息反应失败", err)
	}
	for _, row := range rows {
		key := row.MessageID.String()
		result[key] = append(result[key], domainchatreaction.AggregatedReaction{
			EmojiID:   row.EmojiID,
			EmojiName: row.EmojiName,
			EmojiURL:  row.EmojiURL,
			GifURL:    row.GifURL,
			Count:     row.Count,
			Self:      row.SelfInt > 0,
		})
	}
	return result, nil
}

// Add 添加消息反应；重复添加同一种表情保持幂等，并在消息行锁内执行三种表情上限检查。
func (s *ChatMessageReactionStore) Add(ctx context.Context, messageID, userID domainshared.ID, emojiID int32) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var message model.ChatMessage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id, message_type, deleted_at").Where("id = ?", messageID.UUID()).Take(&message).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return domainshared.NotFound("消息")
			}
			return err
		}
		if message.DeletedAt != nil || message.MessageType == "system" {
			return domainshared.BadRequest("该消息不支持表情")
		}

		var existing int64
		if err := tx.Model(&model.ChatMessageReaction{}).
			Where("message_id = ? AND user_id = ? AND emoji_id = ?", messageID.UUID(), userID.UUID(), emojiID).
			Count(&existing).Error; err != nil {
			return err
		}
		if existing > 0 {
			return nil
		}

		var count int64
		if err := tx.Model(&model.ChatMessageReaction{}).
			Where("message_id = ? AND user_id = ?", messageID.UUID(), userID.UUID()).
			Count(&count).Error; err != nil {
			return err
		}
		if count >= domainchatreaction.MaxReactionsPerMessagePerUser {
			return domainchatreaction.ErrReactionLimitReached
		}

		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&model.ChatMessageReaction{
			ID: uuid.New(), MessageID: messageID.UUID(), EmojiID: emojiID, UserID: userID.UUID(),
		}).Error
	})
}

// Remove 移除当前用户对消息的指定表情反应。
func (s *ChatMessageReactionStore) Remove(ctx context.Context, messageID, userID domainshared.ID, emojiID int32) error {
	return s.db.WithContext(ctx).
		Where("message_id = ? AND user_id = ? AND emoji_id = ?", messageID.UUID(), userID.UUID(), emojiID).
		Delete(&model.ChatMessageReaction{}).Error
}

// RemoveByMessage 清理已删除消息的全部反应。
func (s *ChatMessageReactionStore) RemoveByMessage(ctx context.Context, messageID domainshared.ID) error {
	return s.db.WithContext(ctx).
		Where("message_id = ?", messageID.UUID()).
		Delete(&model.ChatMessageReaction{}).Error
}

var _ domainchatreaction.Store = (*ChatMessageReactionStore)(nil)
