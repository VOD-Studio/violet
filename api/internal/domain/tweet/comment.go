package tweet

import (
	"strings"
	"time"
	"unicode/utf8"

	"blog-api/internal/domain/shared"
)

// 推文评论正文上限（rune 计）。
// 评论即发即出（无审核），长度不超过推文正文上限，防长文滥用。
const MaxCommentBodyLen = 500

// MaxCommentDepth 展示层级上限。
// 0 是顶层评论，1 是回复。回复不再往下嵌套（与 comment 域楼中楼同构的 B 站式两层扁平）——
// 回复另一条回复时 depth 仍为 1，对话关系靠 parent_id 与 reply_to 标。
const MaxCommentDepth = 1

// Comment 推文评论聚合根（PRD-0013 P2 / issue #107）。
//
// 独立评论实体挂推文下，复用 comment 域的两层扁平楼中楼模式，但更简单：
// 仅登录可评论（无匿名）、即发即出（无审核状态机）、纯文本（无图片/锚点）、物理删除。
// 评论只在推文详情页出现，不进时间线。
//
// 不变量：
//   - body trim 后非空且 ≤ MaxCommentBodyLen rune
//   - tweetID/authorID 创建时固定，无 setter
//   - depth ≤ MaxCommentDepth（两层扁平）
type Comment struct {
	shared.AggregateRoot
	// id 评论唯一标识
	id shared.ID
	// tweetID 所属推文，创建时固定
	tweetID shared.ID
	// authorID 评论作者（登录用户），创建时固定
	authorID shared.ID
	// body 正文（纯文本），trim 后存储
	body string
	// parentID 被回复的评论 id；顶层评论为 nil
	parentID *shared.ID
	// depth 0=顶层，1=回复（两层扁平）
	depth int16
	// path 物化路径，顶层="<id>/"，回复挂顶层祖先下，用于按顶层聚合查整棵子树
	path string
	// timestamps 创建/更新时间（无编辑路径，updated_at 实际恒等于 created_at）
	timestamps shared.Timestamps
}

// NewComment 创建新评论（顶层，未设置 parent）。
//
// body 先 trim 再校验：纯空白视为空。创建后需调用 SetParent 设置层级与物化路径
// （SetParent(nil) 标记顶层，SetParent(parent) 标记回复）。
func NewComment(tweetID, authorID shared.ID, body string) (*Comment, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, shared.Validation("评论内容不能为空")
	}
	if utf8.RuneCountInString(body) > MaxCommentBodyLen {
		return nil, shared.Validation("评论内容不能超过 500 字")
	}

	now := time.Now()
	return &Comment{
		id:         shared.NewID(),
		tweetID:    tweetID,
		authorID:   authorID,
		body:       body,
		depth:      0,
		path:       "",
		timestamps: shared.Timestamps{CreatedAt: now, UpdatedAt: now},
	}, nil
}

// ReconstructComment 从持久化数据重建评论（无校验、无副作用、不记录事件）。
func ReconstructComment(
	id, tweetID, authorID shared.ID,
	body string,
	parentID *shared.ID,
	depth int16,
	path string,
	createdAt, updatedAt time.Time,
) *Comment {
	return &Comment{
		id:         id,
		tweetID:    tweetID,
		authorID:   authorID,
		body:       body,
		parentID:   parentID,
		depth:      depth,
		path:       path,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// SetParent 设置被回复的评论，确定层级与物化路径。
//
// 两层扁平语义（B 站式，与 comment 域同构）：回复一律 depth=1，不往下嵌套。
//   - parent 为 nil → 顶层评论，depth=0，path="<自身id>/"
//   - parent 是顶层（depth=0）→ depth=1，parent_id 指该顶层
//   - parent 是回复（depth=1）→ depth 仍为 1，parent_id 指被回复者
//
// path 始终挂到「顶层祖先」下面，保证同棵树前缀一致，便于按顶层聚合查子树。
func (c *Comment) SetParent(parent *Comment) error {
	if parent == nil {
		c.depth = 0
		c.path = c.id.String() + "/"
		return nil
	}
	c.depth = 1
	pid := parent.id
	c.parentID = &pid
	c.path = topAncestorPath(parent.path) + c.id.String() + "/"
	return nil
}

// topAncestorPath 取物化路径的第一段（顶层祖先的 id）。
// 例如 "aaa/bbb/ccc/" → "aaa/"。用于 SetParent 时把回复挂到顶层祖先下。
// 入参 path 为空时返回空串（防御，正常不会走到）。
func topAncestorPath(path string) string {
	if path == "" {
		return ""
	}
	idx := strings.Index(path, "/")
	if idx < 0 {
		return path + "/"
	}
	return path[:idx+1]
}

// 访问器（无 setter：不可编辑）
func (c *Comment) ID() shared.ID        { return c.id }
func (c *Comment) TweetID() shared.ID   { return c.tweetID }
func (c *Comment) AuthorID() shared.ID  { return c.authorID }
func (c *Comment) Body() string         { return c.body }
func (c *Comment) ParentID() *shared.ID { return c.parentID }
func (c *Comment) Depth() int16         { return c.depth }
func (c *Comment) Path() string         { return c.path }
func (c *Comment) CreatedAt() time.Time { return c.timestamps.CreatedAt }
func (c *Comment) UpdatedAt() time.Time { return c.timestamps.UpdatedAt }
