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

// MaxCommentPictures 单条评论图片数量上限。
// 对齐前端 RichCommentInput 默认上限（与文章评论一致，issue 推文评论表情图片）。
const MaxCommentPictures = 10

// MaxCommentDepth 展示层级上限。
// 0 是顶层评论，1 是回复。回复不再往下嵌套（与 comment 域楼中楼同构的 B 站式两层扁平）——
// 回复另一条回复时 depth 仍为 1，对话关系靠 parent_id 与 reply_to 标。
const MaxCommentDepth = 1

// Comment 推文评论聚合根（PRD-0013 P2 / issue #107）。
//
// 独立评论实体挂推文下，复用 comment 域的两层扁平楼中楼模式，但更简单：
// 仅登录可评论（无匿名）、即发即出（无审核状态机）、物理删除。
// 正文支持表情（[name] 占位符，应用层富化 emote 渲染）与附图（≤10 张）。
// 评论只在推文详情页出现，不进时间线。
//
// 不变量：
//   - body trim 后 ≤ MaxCommentBodyLen rune；body 与 pictures 至少其一非空
//     （纯图评论 body 为空串，由 SetPictures 兜底校验）
//   - pictures ≤ MaxCommentPictures 张，URL 归属经应用层校验（TweetImageChecker）
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
	// body 正文（纯文本 + emoji 语法），trim 后存储
	body string
	// pictures 评论附图数组（Bilibili 式，创建后经 SetPictures 接线，≤ MaxCommentPictures）
	pictures []Picture
	// parentID 被回复的评论 id；顶层评论为 nil
	parentID *shared.ID
	// depth 0=顶层，1=回复（两层扁平）
	depth int16
	// path 物化路径，顶层="<id>/"，回复挂顶层祖先下，用于按顶层聚合查整棵子树
	path string
	// timestamps 创建/更新时间（无编辑路径，updated_at 实际恒等于 created_at）
	timestamps shared.Timestamps
}

// Picture 评论图片（Bilibili 式附图，每张含显示尺寸与体积元数据）。
// 与 comment 域 Picture 同构；URL 为上传文件访问地址，归属校验后入库。
type Picture struct {
	URL    string `json:"url"`    // 图片访问 URL
	Width  int    `json:"width"`  // 像素宽
	Height int    `json:"height"` // 像素高
	Size   int64  `json:"size"`   // 字节体积
}

// NewComment 创建新评论（顶层，未设置 parent）。
//
// body 先 trim：纯图评论允许空串（「内容非空」由 SetPictures 在 pictures 接线后
// 兜底校验——body 与 pictures 至少其一非空）。创建后需调用 SetParent 设置层级
// 与物化路径（SetParent(nil) 标记顶层，SetParent(parent) 标记回复）。
func NewComment(tweetID, authorID shared.ID, body string) (*Comment, error) {
	body = strings.TrimSpace(body)
	if utf8.RuneCountInString(body) > MaxCommentBodyLen {
		return nil, shared.Validation("评论内容不能超过 500 字")
	}

	now := time.Now()
	return &Comment{
		id:         shared.NewID(),
		tweetID:    tweetID,
		authorID:   authorID,
		body:       body,
		pictures:   []Picture{},
		depth:      0,
		path:       "",
		timestamps: shared.Timestamps{CreatedAt: now, UpdatedAt: now},
	}, nil
}

// ReconstructComment 从持久化数据重建评论（无校验、无副作用、不记录事件）。
func ReconstructComment(
	id, tweetID, authorID shared.ID,
	body string,
	pictures []Picture,
	parentID *shared.ID,
	depth int16,
	path string,
	createdAt, updatedAt time.Time,
) *Comment {
	if pictures == nil {
		pictures = []Picture{}
	}
	return &Comment{
		id:         id,
		tweetID:    tweetID,
		authorID:   authorID,
		body:       body,
		pictures:   pictures,
		parentID:   parentID,
		depth:      depth,
		path:       path,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// SetPictures 设置评论附图（创建后接线；评论无更新路径，仅创建期调用）。
//
// nil 归一为空数组；超过 MaxCommentPictures 拒绝（聚合根不变量）。
// 内容兜底：pictures 为空时 body 必须非空——「body 与 pictures 至少其一非空」
// 的不变量在此校验（工厂在纯图评论场景已放行空 body）。
func (c *Comment) SetPictures(pics []Picture) error {
	if pics == nil {
		pics = []Picture{}
	}
	if len(pics) > MaxCommentPictures {
		return shared.Validation("评论图片不能超过 10 张")
	}
	if len(pics) == 0 && strings.TrimSpace(c.body) == "" {
		return shared.Validation("评论内容不能为空")
	}
	c.pictures = pics
	return nil
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

// 访问器（无编辑路径：仅创建期 SetParent / SetPictures 接线）
func (c *Comment) ID() shared.ID        { return c.id }
func (c *Comment) TweetID() shared.ID   { return c.tweetID }
func (c *Comment) AuthorID() shared.ID  { return c.authorID }
func (c *Comment) Body() string         { return c.body }
func (c *Comment) Pictures() []Picture  { return c.pictures }
func (c *Comment) ParentID() *shared.ID { return c.parentID }
func (c *Comment) Depth() int16         { return c.depth }
func (c *Comment) Path() string         { return c.path }
func (c *Comment) CreatedAt() time.Time { return c.timestamps.CreatedAt }
func (c *Comment) UpdatedAt() time.Time { return c.timestamps.UpdatedAt }
