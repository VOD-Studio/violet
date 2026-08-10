package tweet

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// Cursor 时间线 keyset 分页游标（值对象）。
//
// 推文 feed 顶部持续插入新数据，offset 分页会重复/漏数据（PRD-0013），
// 故用 (created_at, id) 复合游标：取上一页末条的 CreatedAt + ID，
// 查询条件 (created_at, id) < cursor，配合 idx_tweets_timeline 索引。
// base64 传输编解码在 application 层（游标值对象不感知传输格式）。
type Cursor struct {
	// CreatedAt 上一页末条推文的创建时间
	CreatedAt time.Time
	// ID 上一页末条推文的 ID（同毫秒/微秒并发推文的稳定 tiebreak）
	ID shared.ID
}

// TweetRepository 推文仓储接口（端口）
type TweetRepository interface {
	// Save 保存推文（按主键 upsert；推文无更新路径，upsert 服务 T5 点赞计数回写）
	Save(ctx context.Context, t *Tweet) error
	// FindByID 按 ID 查找推文
	FindByID(ctx context.Context, id shared.ID) (*Tweet, error)
	// FindByIDs 批量按 ID 查找推文
	FindByIDs(ctx context.Context, ids []shared.ID) ([]*Tweet, error)
	// FindTimeline 全局时间线：按 (created_at, id) 倒序 keyset 分页。
	// cursor 为 nil 时取第一页；返回最多 limit 条。
	FindTimeline(ctx context.Context, cursor *Cursor, limit int) ([]*Tweet, error)
	// FindByAuthor 用户主页推文列表：按作者过滤的同构 keyset 分页。
	FindByAuthor(ctx context.Context, authorID shared.ID, cursor *Cursor, limit int) ([]*Tweet, error)
	// FindByTopic 话题时间线：按话题标签过滤的 keyset 分页。
	FindByTopic(ctx context.Context, tag string, cursor *Cursor, limit int) ([]*Tweet, error)
	// Delete 物理删除推文（点赞/评论由 DB ON DELETE CASCADE 连带清理）
	Delete(ctx context.Context, id shared.ID) error

	// Like 点赞推文（重复点赞幂等；推文不存在返回 ErrNotFound）
	Like(ctx context.Context, tweetID, userID shared.ID) error
	// Unlike 取消点赞推文（未点赞幂等，不报错）
	Unlike(ctx context.Context, tweetID, userID shared.ID) error
	// IsLiked 查询指定用户是否已点赞某推文
	IsLiked(ctx context.Context, tweetID, userID shared.ID) (bool, error)
	// CountQuotesByTweetIDs 批量查询推文列表的被引用次数
	CountQuotesByTweetIDs(ctx context.Context, tweetIDs []shared.ID) (map[string]int64, error)
	// FindLikedTweetIDs 批量查询指定用户对推文列表的点赞状态集合
	FindLikedTweetIDs(ctx context.Context, userID shared.ID, tweetIDs []shared.ID) (map[string]bool, error)
}

// ErrNotFound 推文不存在
var ErrNotFound = shared.NotFound("推文")
