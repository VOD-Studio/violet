package gorm

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	domainshared "blog-api/internal/domain/shared"
)

// userMergeExecutor GORM 实现的账号合并（PRD-0033，30+ 张 user 归属表）。
type userMergeExecutor struct {
	db *gorm.DB
}

// NewUserMergeExecutor 创建账号合并执行器。
func NewUserMergeExecutor(db *gorm.DB) *userMergeExecutor {
	return &userMergeExecutor{db: db}
}

// simpleRef 单列直接改写：UPDATE <table> SET <col> = primary WHERE <col> = secondary。
type simpleRef struct{ table, col string }

// ownedRef 复合唯一键含 user 列的表：先删 secondary 侧与 primary 侧撞复合键的行，再改写。
// dedupCols 是除 user 列外构成唯一性的列（用于撞行判定）。
type ownedRef struct {
	table    string
	col      string
	dedupCols []string
}

// simpleRefs 无复合唯一约束的归属列（顺序无关，批量改写）。
var simpleRefs = []simpleRef{
	{"posts", "author_id"},
	{"post_versions", "editor_id"},
	{"comments", "created_by"},
	{"announcements", "created_by"},
	{"files", "owner_id"},
	{"upload_sessions", "user_id"},
	{"notes", "author_id"},
	{"galleries", "author_id"},
	{"tweet_comments", "author_id"},
	{"series", "author_id"},
	{"personas", "created_by"},
	{"api_tokens", "user_id"},
	{"notification_push_subscriptions", "user_id"},
	{"subscriptions", "user_id"},
	{"friendlinks", "user_id"},
	{"custom_emojis", "owner_id"},
	{"chat_conversations", "owner_id"},
	{"chat_messages", "sender_id"},
	{"chat_message_reactions", "user_id"},
	{"chat_events", "user_id"},
	{"chat_push_subscriptions", "user_id"},
}

// ownedRefs 复合唯一键表：撞行折叠（保留 primary 侧）后改写。
var ownedRefs = []ownedRef{
	{"comment_reactions", "user_id", []string{"comment_id", "emoji_id"}},
	{"tweet_likes", "user_id", []string{"tweet_id"}},
	// client_request_id 为部分唯一索引（WHERE NOT NULL）：幂等键为 NULL 的推文
	// 互不冲突（SQL NULL 不等值匹配），仅两侧同键撞行时折叠
	{"tweets", "author_id", []string{"client_request_id"}},
	{"custom_emoji_favorites", "user_id", []string{"emoji_id"}},
	{"chat_conversation_members", "user_id", []string{"conversation_id"}},
	{"chat_read_positions", "user_id", []string{"conversation_id"}},
	{"chat_bots", "user_id", nil}, // user_id 唯一：primary 已有 bot 时保留 primary 侧
	{"notifications", "user_id", []string{"event_id"}}, // uq(event,user)
}

// Merge 单事务迁移全部 user 归属并删除 secondary。
func (m *userMergeExecutor) Merge(ctx context.Context, primaryID, secondaryID domainshared.ID) error {
	p, s := primaryID.UUID(), secondaryID.UUID()
	return m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. 复合唯一键表：折叠撞行
		for _, ref := range ownedRefs {
			if err := dedupeAndRewrite(tx, ref, p, s); err != nil {
				return fmt.Errorf("合并 %s 失败: %w", ref.table, err)
			}
		}
		// 2. 简单归属表：直接改写
		for _, ref := range simpleRefs {
			if err := tx.Exec(
				fmt.Sprintf("UPDATE %s SET %s = ? WHERE %s = ?", ref.table, ref.col, ref.col),
				p, s,
			).Error; err != nil {
				return fmt.Errorf("合并 %s 失败: %w", ref.table, err)
			}
		}
		// 3. users OAuth 列：secondary 有值且 primary 空则迁，都有则保留 primary
		//    （secondary 行删除后其绑定自然释放，不撞唯一索引）
		if err := tx.Exec(`
			UPDATE users p SET
				google_id  = COALESCE(p.google_id,  s.google_id),
				github_id  = COALESCE(p.github_id,  s.github_id),
				github_login = COALESCE(p.github_login, s.github_login)
			FROM users s WHERE p.id = ? AND s.id = ?`, p, s).Error; err != nil {
			return fmt.Errorf("合并 users OAuth 列失败: %w", err)
		}
		// 4. chat_direct_pairs 双用户列：改写后清自环与重复 pair
		if err := tx.Exec(`
			UPDATE chat_direct_pairs
			SET user_a_id = CASE WHEN user_a_id = ? THEN ? ELSE user_a_id END,
			    user_b_id = CASE WHEN user_b_id = ? THEN ? ELSE user_b_id END
			WHERE user_a_id = ? OR user_b_id = ?`, s, p, s, p, s, s).Error; err != nil {
			return fmt.Errorf("合并 chat_direct_pairs 失败: %w", err)
		}
		if err := tx.Exec(`
			DELETE FROM chat_direct_pairs a
			USING chat_direct_pairs b
			WHERE a.user_a_id = a.user_b_id
			   OR (a.ctid < b.ctid AND a.user_a_id = b.user_a_id AND a.user_b_id = b.user_b_id)
			   OR (a.ctid < b.ctid AND a.user_a_id = b.user_b_id AND a.user_b_id = b.user_a_id)`).Error; err != nil {
			return fmt.Errorf("折叠 chat_direct_pairs 失败: %w", err)
		}
		// 5. 删除 secondary 行（各表已无引用）
		if err := tx.Exec("DELETE FROM users WHERE id = ?", s).Error; err != nil {
			return fmt.Errorf("删除被合并账号失败: %w", err)
		}
		return nil
	})
}

// dedupeAndRewrite 复合唯一键表：删 secondary 侧与 primary 侧撞键的行，再改写剩余行。
// dedupCols 为 nil 表示 user_id 单列唯一（primary 已占即折叠）。
func dedupeAndRewrite(tx *gorm.DB, ref ownedRef, p, s interface{}) error {
	var delSQL string
	if len(ref.dedupCols) == 0 {
		delSQL = fmt.Sprintf(
			"DELETE FROM %s WHERE %s = ? AND EXISTS (SELECT 1 FROM %s x WHERE x.%s = ?)",
			ref.table, ref.col, ref.table, ref.col)
		if err := tx.Exec(delSQL, s, p).Error; err != nil {
			return err
		}
	} else {
		// 撞键判定：secondary 行与 primary 行在 dedupCols 上同值
		match := ""
		args := []interface{}{}
		for _, c := range ref.dedupCols {
			match += fmt.Sprintf(" AND x.%s = t.%s", c, c)
		}
		delSQL = fmt.Sprintf(
			"DELETE FROM %s t WHERE t.%s = ? AND EXISTS (SELECT 1 FROM %s x WHERE x.%s = ?%s)",
			ref.table, ref.col, ref.table, ref.col, match)
		args = append(args, s, p)
		if err := tx.Exec(delSQL, args...).Error; err != nil {
			return err
		}
	}
	return tx.Exec(
		fmt.Sprintf("UPDATE %s SET %s = ? WHERE %s = ?", ref.table, ref.col, ref.col),
		p, s,
	).Error
}
