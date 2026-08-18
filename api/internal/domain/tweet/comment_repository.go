package tweet

import (
	"context"

	"blog-api/internal/domain/shared"
)

// CommentRepository 推文评论仓储接口（端口）。
//
// 评论分页走 offset 语义的 shared.PageQuery（评论流无顶部插入问题，与推文
// 时间线的 cursor 分页不同，见 PRD-0013 难逆决策）。顶层评论列表按 created_at
// 倒序（最新在前），回复按 created_at 正序（对话时间线），均带 id tiebreaker。
type CommentRepository interface {
	// Save 保存评论（按主键 upsert；评论无更新路径，upsert 服务重建场景）
	Save(ctx context.Context, c *Comment) error
	// FindByID 按 ID 查找评论
	FindByID(ctx context.Context, id shared.ID) (*Comment, error)
	// FindPage 分页列出推文评论（统一入口，筛选维度由 ListFilter 正交组合）。
	//
	// TweetID 场景返回顶层评论（depth=0），按 created_at DESC, id DESC（最新在前）；
	// ParentID 场景按顶层评论 path 前缀拉全部扁平回复（排除自身），排序由 Sort
	// 决定（默认 asc 对话时间线）。均带 id tiebreaker 防 offset 翻页漂移；
	// ParentID 指向的评论不存在时返回 ErrCommentNotFound。
	FindPage(ctx context.Context, filter ListFilter, q shared.PageQuery) (shared.PageResult[*Comment], error)
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

// ListFilter 推文评论列表筛选条件（FindPage 入参，维度正交组合）。
//
// 由调用方按场景组装：顶层评论列表传 TweetID；回复链传 ParentID+Sort，
// 两者互斥（TweetID 只出顶层、ParentID 只出回复链）。
type ListFilter struct {
	// TweetID 按推文过滤，仅返回顶层评论（depth=0），最新在前
	TweetID *shared.ID
	// ParentID 按顶层评论拉全部扁平回复（path 前缀，排除自身），配合 Sort
	ParentID *shared.ID
	// Sort 回复链时间排序："asc"（默认，最早优先）/ "desc"，仅 ParentID 场景生效
	Sort string
}

// ErrCommentNotFound 评论不存在
var ErrCommentNotFound = shared.NotFound("推文评论")
