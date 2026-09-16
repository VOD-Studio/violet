package chatappearance

import (
	"context"
	"database/sql"
	"errors"

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
