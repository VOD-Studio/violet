package useradmin

import (
	"context"

	"blog-api/internal/domain/shared"
)

// UserMerger 账号合并的存储端口（30+ 张 user 归属表迁移由 infrastructure 实现）。
//
// 冲突策略（PRD-0033「合并 = 单事务迁移」）：
//   - 复合唯一键（comment_reactions / tweet_likes / custom_emoji_favorites /
//     chat_read_positions / chat_conversation_members 等）下 primary 与
//     secondary 各有一行 → 删 secondary 侧保留 primary 侧
//   - users 表 OAuth 列（google_id/github_id/github_login）：secondary 有值
//     而 primary 已占 → 保留 primary 的绑定，secondary 侧随行删除自然释放
//   - chat_direct_pairs 双用户列：合并产生 user_a==user_b 自环或重复 pair → 删除
//   - 全程单事务：任一步失败整体回滚，不产生半迁移状态
type UserMerger interface {
	// Merge 在单事务内把 secondary 的全部 user 归属迁给 primary 并删除 secondary 行。
	// 迁移表清单与冲突折叠规则见接口注释；调用方负责守卫与审计。
	Merge(ctx context.Context, primaryID, secondaryID shared.ID) error
}
