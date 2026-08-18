package comment

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// AnchorFilter 控制 FindByPost 按 anchor 列过滤的维度。
//
// 自由评论与批注共用 comments 表，靠 anchor_block_id 是否为 NULL 区分。
// 此类型把字符串约定收敛到一处，避免 magic string 散落 service/repo/handler。
type AnchorFilter string

const (
	// AnchorFilterAll 不过滤 anchor 列（自由评论 + 批注全返回）。
	// 后台管理/调试场景使用。
	AnchorFilterAll AnchorFilter = "all"
	// AnchorFilterFree 仅自由评论（anchor_block_id IS NULL）。
	// 默认值，前台底部评论区使用。
	AnchorFilterFree AnchorFilter = "free"
	// AnchorFilterAnnotation 仅批注（anchor_block_id IS NOT NULL）。
	// 前台批注角标层使用。
	AnchorFilterAnnotation AnchorFilter = "annotation"
)

// DepthFilter 控制 FindByPost 按 depth 列过滤的维度。
//
// 两层扁平下 depth 只分 0/1。顶层评论列表只查 depth=0，
// 回复走 FindReplies 单独查，避免子和父混在一页被分页切走。
type DepthFilter int16

const (
	// DepthFilterAll 不过滤 depth（顶层 + 回复全返回）。
	DepthFilterAll DepthFilter = -1
	// DepthFilterTopLevel 仅顶层评论（depth=0）。
	// 前台底部评论区列表用，配合「按需拉回复」分页策略。
	DepthFilterTopLevel DepthFilter = 0
	// DepthFilterReply 仅回复（depth=1）。
	DepthFilterReply DepthFilter = 1
)

// BlockCount 批注按块聚合的计数结果
type BlockCount struct {
	// BlockID 块标识符（块纯文本 SHA1 前 8 位，同 Anchor.BlockID）
	BlockID string
	// Count 该块上的批注数量（仅 depth=0 顶层批注）
	Count int64
}

// PostCommentStat 按文章聚合的评论统计（MCP comment_stats 读模型）。
// 用于 agent 判断哪些文章反馈最密集、最该先改进。
type PostCommentStat struct {
	// PostID 文章 id
	PostID shared.ID
	// PostTitle 文章标题（JOIN posts 取，展示用）
	PostTitle string
	// PostSlug 文章 slug（JOIN posts 取，用于构造文章链接）
	PostSlug        string
	AnnotationCount int64 // anchor_block_id IS NOT NULL 的评论数
	CommentCount    int64 // 全部评论数
	// LatestAt 该文章最新评论时间（MAX(created_at)）
	LatestAt time.Time
}

// CommentRepository 评论仓储接口
type CommentRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*Comment, error)
	// FindPage 分页列出评论（统一入口，筛选维度由 ListFilter 正交组合）。
	//
	// Status 是「所有人可见的基准状态」，空串 = 不过滤；前台固定传 StatusApproved。
	// ViewerUserID 控制额外的「自己 pending」可见性：
	//   - nil（匿名 viewer）：仅返回 Status 匹配项。
	//     注意 service.ListByPost 会在匿名时短路返回空数组、根本不走到这里；
	//     nil 分支保留给后台管理等复用场景。
	//   - 非空（登录 viewer）：返回 Status 匹配项 UNION created_by=viewer 的 pending 项。
	//     这样登录提交者能在审核通过前看到自己刚提交的评论（PRD-0001「审批与状态可见性」）。
	//
	// AnchorFilter / DepthFilter / BlockID / ParentID / Query 语义见 ListFilter 字段注释。
	// 排序：ParentID 场景按 Sort（created_at ± id tiebreaker）；
	// 其余场景 created_at DESC, id DESC tiebreaker（含 Query 检索与后台列表）。
	FindPage(ctx context.Context, filter ListFilter, q shared.PageQuery) (shared.PageResult[*Comment], error)
	// FindPageWithPost 分页列出评论并关联所属文章标题/slug（后台管理读模型）。
	//
	// filter.Status 空串 = 不过滤；Query 非空时做 body 多关键词 AND 检索
	// （每个词都命中 body ILIKE，MCP search_comments 用）。
	FindPageWithPost(ctx context.Context, filter ListFilter, q shared.PageQuery) (shared.PageResult[*CommentWithPost], error)
	// CountPending 统计待审核评论数量（后台仪表盘角标）
	CountPending(ctx context.Context) (int64, error)
	// CountByPostAndAnon 统计某文章下某匿名身份已留存的评论数。
	//
	// 匿名身份 = (ipHash, email) 双因子：同 IP 不同 email 算不同身份（解决 NAT 误伤），
	// 同 email 不同 IP 也算不同身份（防漫游）。仅计 pending/approved（spam/deleted 不占配额），
	// 这样被误判 spam 的留言不会浪费用户的「一篇一次」名额。
	// 用于「一篇一次」配额校验（PRD-0001 匿名留言板模式）。
	CountByPostAndAnon(ctx context.Context, postID shared.ID, ipHash, email string) (int64, error)
	// CountAnnotationsByBlock 按块聚合统计批注数量（仅 depth=0 顶层批注）。
	// viewerUserID 语义同 FindPage：nil=仅 approved；非空=approved ∪ 自己 pending。
	CountAnnotationsByBlock(ctx context.Context, postID shared.ID, status string, viewerUserID *shared.ID) ([]BlockCount, error)
	// Stats 按文章聚合评论统计（MCP comment_stats），仅含有反馈的文章。
	//
	// 按 post_id GROUP BY，计 annotation_count（anchor_block_id IS NOT NULL）/
	// comment_count（全部）/ latest_at（MAX(created_at)），JOIN posts 取标题/slug。
	// HAVING COUNT(*) > 0 排除零反馈文章，annotation_count DESC 排序。
	Stats(ctx context.Context, status string) ([]PostCommentStat, error)
	// FindByIDWithPost 按ID查评论并关联所属文章（后台详情）
	FindByIDWithPost(ctx context.Context, id shared.ID) (*CommentWithPost, error)
	// BatchUpdateStatus 批量更新评论状态，返回受影响行数
	BatchUpdateStatus(ctx context.Context, ids []shared.ID, status string) (int64, error)
	Save(ctx context.Context, c *Comment) error
	UpdateStatus(ctx context.Context, id shared.ID, status string) error
	Delete(ctx context.Context, id shared.ID) error
}

// ListFilter 评论列表筛选条件（FindPage / FindPageWithPost 入参，维度正交组合）。
//
// 由调用方按场景组装：前台文章评论传 PostID+DepthFilter+BlockID；回复链传
// ParentID+Sort；后台审核传 Status（或固定 pending）；全文检索传 Query。
type ListFilter struct {
	// Status 状态基准，空串 = 不过滤；前台/MCP 固定 StatusApproved
	Status string
	// ViewerUserID 非 nil 时返回 Status 匹配项 ∪ 该用户自己的 pending（登录可见性）
	ViewerUserID *shared.ID
	// AnchorFilter 按 anchor 列过滤（自由评论 / 批注 / 全部），见 AnchorFilter 常量
	AnchorFilter AnchorFilter
	// DepthFilter 按 depth 列过滤（顶层 / 回复），nil = 不过滤；
	// 仅按文章列评论场景有意义，ParentID 回复链场景勿设
	DepthFilter *DepthFilter
	PostID *shared.ID
	// ParentID 按顶层评论拉全部扁平回复（path 前缀，排除自身），配合 Sort
	ParentID *shared.ID
	// BlockID 批注按块精确过滤（懒加载），仅 PostID 场景有意义
	BlockID string
	// Sort 回复链时间排序："asc"（默认，最早优先）/ "desc"，仅 ParentID 场景生效
	Sort string
	// Query body 全文检索（空格分词多关键词 AND），仅 FindPageWithPost 支持
	Query string
}


// PostRef 所属文章只读视图（评论列表/详情需要展示文章来源）
type PostRef struct {
	// ID 文章 id
	ID shared.ID
	// Title 文章标题
	Title string
	// Slug 文章 slug（构造文章链接用）
	Slug string
}

// CommentWithPost 评论 + 所属文章视图（后台管理读模型）
type CommentWithPost struct {
	// Comment 评论
	Comment *Comment
	// Post 所属文章只读视图
	Post PostRef
}

// 领域错误
var (
	ErrNotFound      = shared.NotFound("评论")
	ErrDepthExceeded = shared.BadRequest("评论嵌套深度超过限制")
	ErrInvalidStatus = shared.BadRequest("无效的评论状态")
)

// Reaction 评论反应实体（emoji 点赞）
type Reaction struct {
	// id 反应唯一 id
	id shared.ID
	// commentID 所属评论 id
	commentID shared.ID
	// emojiID 表情 id（指向 emoji 分组里的某个表情）
	emojiID int32
	// userID 反应者用户 id；nil 表示匿名反应（按 ipHash 去重）
	userID *shared.ID
	// ipHash 反应者 IP 的 SHA256（匿名反应的去重标识，登录态可为空）
	ipHash string
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
