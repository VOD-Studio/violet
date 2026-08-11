package tweet

import (
	"context"

	"blog-api/internal/domain/shared"
)

// CommentRepository 推文评论仓储接口（端口）。
//
// 评论分页沿用 page/limit（评论流无顶部插入问题，与推文时间线的 cursor 分页不同，
// 见 PRD-0013 难逆决策）。顶层评论列表按 created_at 倒序（最新在前），
// 回复按 created_at 正序（对话时间线）。
type CommentRepository interface {
	// Save 保存评论（按主键 upsert；评论无更新路径，upsert 服务重建场景）
	Save(ctx context.Context, c *Comment) error
	// FindByID 按 ID 查找评论
	FindByID(ctx context.Context, id shared.ID) (*Comment, error)
	// FindByTweet 列出推文下的顶层评论（depth=0），按 created_at 倒序，page/limit 分页。
	// 返回 (评论列表, 顶层评论总数)。
	FindByTweet(ctx context.Context, tweetID shared.ID, page, limit int) ([]*Comment, int64, error)
	// FindReplies 列出某顶层评论下的全部扁平回复（depth=1），按 created_at 正序，page/limit 分页。
	// parentID 是顶层评论 id；按 path 前缀查能拿到该顶层下的全部回复（含「回复 @yyy」链）。
	// 返回 (回复列表, 该顶层下回复总数)。
	FindReplies(ctx context.Context, parentID shared.ID, page, limit int) ([]*Comment, int64, error)
	// CountByTweet 统计推文下的评论总数（顶层 + 回复，供详情页展示）。
	CountByTweet(ctx context.Context, tweetID shared.ID) (int64, error)
	// CountByTweetIDs 批量统计多推文的评论数（服务时间线/用户主页卡片展示）。
	// 返回 tweetID 字符串 → 评论数 的映射；入参为空时返回空 map。
	CountByTweetIDs(ctx context.Context, tweetIDs []shared.ID) (map[string]int64, error)
	// CountRepliesByParents 批量统计多条顶层评论各自的回复数（顶层评论列表展示用，
	// 驱动前端「查看回复」toggle 显隐）。
	// parentIDs 是顶层评论 id；回复的 path 以顶层 id 为前缀（含「回复 @yyy」链），
	// 按 path 前缀聚合一次查询。返回 顶层评论 id 字符串 → 回复数 的映射；
	// 入参为空或某评论无回复时返回空 map / 缺省 0。
	CountRepliesByParents(ctx context.Context, parentIDs []shared.ID) (map[string]int64, error)
	// Delete 物理删除评论。
	// 顶层评论删除时，其回复由 parent_id 自引用 ON DELETE CASCADE 连带清理。
	Delete(ctx context.Context, id shared.ID) error
}

// ErrCommentNotFound 评论不存在
var ErrCommentNotFound = shared.NotFound("推文评论")
