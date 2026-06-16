package comment

import (
	"context"

	"blog-api/internal/domain/shared"
)

// CommentRepository 评论仓储接口
type CommentRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*Comment, error)
	FindByPost(ctx context.Context, postID shared.ID, status string, page, limit int) ([]*Comment, int64, error)
	FindReplies(ctx context.Context, parentPath string) ([]*Comment, error)
	FindPending(ctx context.Context, page, limit int) ([]*Comment, int64, error)
	Save(ctx context.Context, c *Comment) error
	UpdateStatus(ctx context.Context, id shared.ID, status string) error
	Delete(ctx context.Context, id shared.ID) error
}

// ReactionRepository 评论反应仓储接口
type ReactionRepository interface {
	FindByComment(ctx context.Context, commentID shared.ID) ([]*Reaction, error)
	FindBatch(ctx context.Context, commentIDs []shared.ID) (map[shared.ID][]*Reaction, error)
	Save(ctx context.Context, r *Reaction) error
	Remove(ctx context.Context, commentID, emojiID shared.ID, userID *shared.ID, ipHash string) error
	CountByEmoji(ctx context.Context, commentID shared.ID) (map[int32]int64, error)
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
	createdAt shared.Timestamps
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
