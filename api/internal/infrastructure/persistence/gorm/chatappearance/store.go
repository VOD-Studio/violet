package chatappearance

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	domain "blog-api/internal/domain/chatappearance"
)

// ChatAppearanceStore 只读写公开装饰,不改写消息内容。
type ChatAppearanceStore struct{ db *gorm.DB }

// NewChatAppearanceStore 复用既有应用数据库连接池。
func NewChatAppearanceStore(db *gorm.DB) *ChatAppearanceStore { return &ChatAppearanceStore{db: db} }

var _ domain.Store = (*ChatAppearanceStore)(nil)

type chatAppearanceRow struct {
	UserID        string `gorm:"column:user_id"`
	AvatarFrameID string `gorm:"column:avatar_frame_id"`
	AvatarCharmID string `gorm:"column:avatar_charm_id"`
	BubbleThemeID string `gorm:"column:bubble_theme_id"`
	Revision      int64  `gorm:"column:revision"`
}

func (r chatAppearanceRow) selection() domain.Selection {
	return domain.Selection{AvatarFrameID: r.AvatarFrameID, AvatarCharmID: r.AvatarCharmID, BubbleThemeID: r.BubbleThemeID}
}

// Get 把缺失行视作原始样式,涵盖本功能上线前注册的账号。
func (s *ChatAppearanceStore) Get(ctx context.Context, userID string) (domain.State, error) {
	var row chatAppearanceRow
	result := s.db.WithContext(ctx).Table("chat_user_appearances").Where("user_id = ?", userID).Limit(1).Find(&row)
	if result.Error != nil {
		return domain.State{}, result.Error
	}
	return domain.State{Selection: row.selection(), Revision: row.Revision}, nil
}

// GetMany 单条参数化查询一次取回,避免每个头像各发一次请求。
func (s *ChatAppearanceStore) GetMany(ctx context.Context, ids []string) (map[string]domain.Selection, error) {
	output := make(map[string]domain.Selection, len(ids))
	for _, id := range ids {
		output[id] = domain.Selection{}
	}
	if len(ids) == 0 {
		return output, nil
	}
	var rows []chatAppearanceRow
	err := s.db.WithContext(ctx).Table("chat_user_appearances").Where("user_id IN ?", ids).Find(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		output[row.UserID] = row.selection()
	}
	return output, nil
}

// CompareAndSwap 用 RETURNING 原子写,不走读-改-写,并发标签页不会互相覆盖。
func (s *ChatAppearanceStore) CompareAndSwap(ctx context.Context, id string, value domain.Selection, expected int64) (domain.State, error) {
	var row *sql.Row
	if expected == 0 {
		row = s.db.WithContext(ctx).Raw(`INSERT INTO chat_user_appearances
   (user_id, avatar_frame_id, avatar_charm_id, bubble_theme_id, revision)
   VALUES (?, ?, ?, ?, 1) ON CONFLICT (user_id) DO NOTHING
   RETURNING revision`, id, value.AvatarFrameID, value.AvatarCharmID, value.BubbleThemeID).Row()
	} else {
		row = s.db.WithContext(ctx).Raw(`UPDATE chat_user_appearances
   SET avatar_frame_id = ?, avatar_charm_id = ?, bubble_theme_id = ?,
       revision = revision + 1, updated_at = CURRENT_TIMESTAMP
   WHERE user_id = ? AND revision = ? RETURNING revision`,
			value.AvatarFrameID, value.AvatarCharmID, value.BubbleThemeID, id, expected).Row()
	}
	var revision int64
	if err := row.Scan(&revision); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.State{}, domain.ErrConflict
		}
		return domain.State{}, err
	}
	return domain.State{Selection: value, Revision: revision}, nil
}

type badgeGrantRow struct {
	BadgeID   string     `gorm:"column:badge_id"`
	AwardedAt time.Time  `gorm:"column:awarded_at"`
	AwardedBy *uuid.UUID `gorm:"column:awarded_by"`
}

// Grants 返回用户全部持有徽章,按授予时间升序;授予者为空表示系统授予。
func (s *ChatAppearanceStore) Grants(ctx context.Context, userID string) ([]domain.BadgeGrant, error) {
	var rows []badgeGrantRow
	err := s.db.WithContext(ctx).Table("chat_user_badges").
		Where("user_id = ?", userID).
		Order("awarded_at ASC, badge_id ASC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	grants := make([]domain.BadgeGrant, 0, len(rows))
	for _, row := range rows {
		grants = append(grants, domain.BadgeGrant{
			BadgeID:   row.BadgeID,
			AwardedAt: row.AwardedAt,
			AwardedBy: uuidNILIfEmpty(row.AwardedBy),
		})
	}
	return grants, nil
}

// GrantsForUsers 一次取回多个用户的持有徽章 ID;每个传入 ID 都保证有键,未持有为空切片。
func (s *ChatAppearanceStore) GrantsForUsers(ctx context.Context, userIDs []string) (map[string][]string, error) {
	output := make(map[string][]string, len(userIDs))
	for _, id := range userIDs {
		output[id] = nil
	}
	if len(userIDs) == 0 {
		return output, nil
	}
	var rows []struct {
		UserID  string `gorm:"column:user_id"`
		BadgeID string `gorm:"column:badge_id"`
	}
	err := s.db.WithContext(ctx).Table("chat_user_badges").
		Where("user_id IN ?", userIDs).
		Order("awarded_at ASC, badge_id ASC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		output[row.UserID] = append(output[row.UserID], row.BadgeID)
	}
	return output, nil
}

// Grant 批量授予,单事务内逐条 ON CONFLICT 跳过已持有项,保证幂等。
func (s *ChatAppearanceStore) Grant(ctx context.Context, operatorID, userID string, badgeIDs []string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, badgeID := range badgeIDs {
			err := tx.Exec(`INSERT INTO chat_user_badges (user_id, badge_id, awarded_by)
				VALUES (?, ?, ?) ON CONFLICT (user_id, badge_id) DO NOTHING`,
				userID, badgeID, operatorID).Error
			if err != nil {
				return err
			}
		}
		return nil
	})
}

// Revoke 撤销一枚持有;未持有时报 ErrInvalid 而非静默成功,让管理端可感知。
func (s *ChatAppearanceStore) Revoke(ctx context.Context, userID, badgeID string) error {
	result := s.db.WithContext(ctx).Exec(
		`DELETE FROM chat_user_badges WHERE user_id = ? AND badge_id = ?`, userID, badgeID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return domain.ErrInvalid
	}
	return nil
}

// uuidNILIfEmpty 把可空的授予者列折叠成字符串;NULL 表示系统授予。
func uuidNILIfEmpty(value *uuid.UUID) string {
	if value == nil {
		return ""
	}
	return value.String()
}
