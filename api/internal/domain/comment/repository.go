package comment

import (
	"context"

	"blog-api/internal/domain/shared"
)

// CommentRepository 评论仓储接口
type CommentRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*Comment, error)
	// FindByPost 按文章列出评论。
	//
	// viewerUserID 为 nil 时（匿名 viewer，黑洞模式）：仅返回 status 匹配的评论，
	// 实际调用方service.ListByPost 会直接返回空数组，不查 DB。
	// viewerUserID 非空时（登录 viewer）：返回 status='approved' 的评论
	// 联合 created_by=viewer 的 pending 评论。
	//
	// status 参数保留以兼容后台管理等场景（前台固定传 StatusApproved）。
	FindByPost(ctx context.Context, postID shared.ID, status string, viewerUserID *shared.ID, page, limit int) ([]*Comment, int64, error)
	FindReplies(ctx context.Context, parentPath string) ([]*Comment, error)
	FindPending(ctx context.Context, page, limit int) ([]*Comment, int64, error)
	// CountPending 统计待审核评论数量（后台仪表盘角标）
	CountPending(ctx context.Context) (int64, error)
	// CountByPostAndAnon 统计某文章下某匿名身份（ip_hash + email）已留存的评论数。
	// 用于「一篇一次」配额校验（PRD-0001）。仅计 status IN ('pending','approved')。
	CountByPostAndAnon(ctx context.Context, postID shared.ID, ipHash, email string) (int64, error)
	// FindAll 全局评论列表（后台管理，可选状态筛选），关联所属文章标题/slug
	FindAll(ctx context.Context, status string, page, limit int) ([]*CommentWithPost, int64, error)
	// FindByIDWithPost 按ID查评论并关联所属文章（后台详情）
	FindByIDWithPost(ctx context.Context, id shared.ID) (*CommentWithPost, error)
	// BatchUpdateStatus 批量更新评论状态，返回受影响行数
	BatchUpdateStatus(ctx context.Context, ids []shared.ID, status string) (int64, error)
	Save(ctx context.Context, c *Comment) error
	UpdateStatus(ctx context.Context, id shared.ID, status string) error
	Delete(ctx context.Context, id shared.ID) error
}

// PostRef 所属文章只读视图（评论列表/详情需要展示文章来源）
type PostRef struct {
	ID    shared.ID
	Title string
	Slug  string
}

// CommentWithPost 评论 + 所属文章视图（后台管理读模型）
type CommentWithPost struct {
	Comment *Comment
	Post    PostRef
}

// 领域错误
var (
	ErrNotFound      = shared.NotFound("评论")
	ErrDepthExceeded = shared.BadRequest("评论嵌套深度超过限制")
	ErrInvalidStatus = shared.BadRequest("无效的评论状态")
)

// Reaction 评论反应实体（emoji 点赞）
type Reaction struct {
	id        shared.ID
	commentID shared.ID
	emojiID   int32
	userID    *shared.ID
	ipHash    string
}

// NewReaction 创建反应
func NewReaction(id, commentID shared.ID, emojiID int32, userID *shared.ID, ipHash string) *Reaction {
	return &Reaction{
		id: id, commentID: commentID, emojiID: emojiID,
		userID: userID, ipHash: ipHash,
	}
}

// ReconstructReaction 从持久化数据重建
func ReconstructReaction(id, commentID shared.ID, emojiID int32, userID *shared.ID, ipHash string, createdAt interface{ IsZero() bool }) *Reaction {
	return &Reaction{
		id: id, commentID: commentID, emojiID: emojiID,
		userID: userID, ipHash: ipHash,
	}
}

func (r *Reaction) ID() shared.ID        { return r.id }
func (r *Reaction) CommentID() shared.ID { return r.commentID }
func (r *Reaction) EmojiID() int32       { return r.emojiID }
func (r *Reaction) UserID() *shared.ID   { return r.userID }
func (r *Reaction) IPHash() string       { return r.ipHash }
